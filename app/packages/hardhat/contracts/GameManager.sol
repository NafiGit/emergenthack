// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GameManager
 * @dev Manages blockchain-based games where Admin creates games and Users join by staking MON tokens
 * @notice Admin creates games with required player count, Users join with 0.1 MON, Winner gets entire prize pool
 */
contract GameManager {
	// ============ Constants ============

	uint256 public constant ENTRY_FEE = 0.1 ether; // 0.1 MON
	uint8 public constant MIN_PLAYERS = 2;
	uint8 public constant MAX_PLAYERS = 10;

	// ============ Enums ============

	enum GameState {
		OPEN, // Accepting players
		FULL, // All players joined, ready to start
		STARTED, // Game in progress (winner being determined)
		COMPLETED, // Winner declared and paid
		CANCELLED // Game cancelled
	}

	// ============ Structs ============

	struct GameInfo {
		address admin; // Game creator
		uint8 requiredPlayers; // Number of players needed
		uint8 currentPlayers; // Current number of players
		uint256 prizePool; // Total MON staked
		GameState state; // Current game state
		address[] players; // List of participants
		address winner; // Winner address (set when declared)
		uint256 createdAt; // Timestamp of creation
	}

	// ============ State Variables ============

	mapping(uint256 => GameInfo) public games;
	mapping(uint256 => mapping(address => bool)) public hasJoined; // gameId => player => hasJoined
	uint256 public gameIdCounter;

	// ============ Events ============

	event GameCreated(uint256 indexed gameId, address indexed admin, uint8 requiredPlayers, uint256 timestamp);
	event PlayerJoined(uint256 indexed gameId, address indexed player, uint8 currentPlayers, uint256 prizePool);
	event GameFull(uint256 indexed gameId, uint256 prizePool, uint8 totalPlayers);
	event WinnerDeclared(uint256 indexed gameId, address indexed winner, uint256 payout, uint256 timestamp);
	event GameCancelled(uint256 indexed gameId, address indexed admin, uint256 timestamp);

	// ============ Errors ============

	error InvalidPlayerCount();
	error GameNotFound();
	error GameNotOpen();
	error GameAlreadyFull();
	error IncorrectEntryFee();
	error AlreadyJoined();
	error NotGameAdmin();
	error GameNotFull();
	error WinnerNotParticipant();
	error GameAlreadyCompleted();
	error TransferFailed();

	// ============ Modifiers ============

	modifier onlyGameAdmin(uint256 _gameId) {
		if (games[_gameId].admin != msg.sender) revert NotGameAdmin();
		_;
	}

	modifier gameExists(uint256 _gameId) {
		if (_gameId >= gameIdCounter) revert GameNotFound();
		_;
	}

	// ============ Functions ============

	/**
	 * @notice Create a new game
	 * @param _requiredPlayers Number of players required (2-10)
	 * @return gameId The ID of the created game
	 */
	function createGame(uint8 _requiredPlayers) external returns (uint256 gameId) {
		if (_requiredPlayers < MIN_PLAYERS || _requiredPlayers > MAX_PLAYERS) {
			revert InvalidPlayerCount();
		}

		gameId = gameIdCounter++;

		GameInfo storage game = games[gameId];
		game.admin = msg.sender;
		game.requiredPlayers = _requiredPlayers;
		game.currentPlayers = 0;
		game.prizePool = 0;
		game.state = GameState.OPEN;
		game.createdAt = block.timestamp;

		emit GameCreated(gameId, msg.sender, _requiredPlayers, block.timestamp);
	}

	/**
	 * @notice Join a game by depositing 0.1 MON
	 * @param _gameId The ID of the game to join
	 */
	function joinGame(uint256 _gameId) external payable gameExists(_gameId) {
		GameInfo storage game = games[_gameId];

		// Validation checks
		if (game.state != GameState.OPEN) revert GameNotOpen();
		if (game.currentPlayers >= game.requiredPlayers) revert GameAlreadyFull();
		if (msg.value != ENTRY_FEE) revert IncorrectEntryFee();
		if (hasJoined[_gameId][msg.sender]) revert AlreadyJoined();

		// Add player to game
		game.players.push(msg.sender);
		game.currentPlayers++;
		game.prizePool += msg.value;
		hasJoined[_gameId][msg.sender] = true;

		emit PlayerJoined(_gameId, msg.sender, game.currentPlayers, game.prizePool);

		// Check if game is full
		if (game.currentPlayers == game.requiredPlayers) {
			game.state = GameState.FULL;
			emit GameFull(_gameId, game.prizePool, game.currentPlayers);
		}
	}

	/**
	 * @notice Declare winner and distribute prize pool
	 * @param _gameId The ID of the game
	 * @param _winner Address of the winner (must be a participant)
	 */
	function declareWinner(uint256 _gameId, address _winner) external gameExists(_gameId) onlyGameAdmin(_gameId) {
		GameInfo storage game = games[_gameId];

		// Validation checks
		if (game.state != GameState.FULL) revert GameNotFull();
		if (!hasJoined[_gameId][_winner]) revert WinnerNotParticipant();

		// Set winner and update state
		game.winner = _winner;
		game.state = GameState.COMPLETED;

		// Transfer prize pool to winner
		uint256 payout = game.prizePool;
		(bool success, ) = payable(_winner).call{ value: payout }("");
		if (!success) revert TransferFailed();

		emit WinnerDeclared(_gameId, _winner, payout, block.timestamp);
	}

	/**
	 * @notice Get detailed information about a game
	 * @param _gameId The ID of the game
	 * @return Game information
	 */
	function getGameDetails(uint256 _gameId) external view gameExists(_gameId) returns (GameInfo memory) {
		return games[_gameId];
	}

	/**
	 * @notice Get all active (OPEN or FULL) games
	 * @return Array of game IDs
	 */
	function getActiveGames() external view returns (uint256[] memory) {
		uint256 count = 0;

		// First pass: count active games
		for (uint256 i = 0; i < gameIdCounter; i++) {
			if (games[i].state == GameState.OPEN || games[i].state == GameState.FULL) {
				count++;
			}
		}

		// Second pass: collect active game IDs
		uint256[] memory activeGames = new uint256[](count);
		uint256 index = 0;
		for (uint256 i = 0; i < gameIdCounter; i++) {
			if (games[i].state == GameState.OPEN || games[i].state == GameState.FULL) {
				activeGames[index] = i;
				index++;
			}
		}

		return activeGames;
	}

	/**
	 * @notice Get games that a specific player has joined
	 * @param _player Address of the player
	 * @return Array of game IDs
	 */
	function getPlayerGames(address _player) external view returns (uint256[] memory) {
		uint256 count = 0;

		// First pass: count games player joined
		for (uint256 i = 0; i < gameIdCounter; i++) {
			if (hasJoined[i][_player]) {
				count++;
			}
		}

		// Second pass: collect game IDs
		uint256[] memory playerGames = new uint256[](count);
		uint256 index = 0;
		for (uint256 i = 0; i < gameIdCounter; i++) {
			if (hasJoined[i][_player]) {
				playerGames[index] = i;
				index++;
			}
		}

		return playerGames;
	}

	/**
	 * @notice Get games created by a specific admin
	 * @param _admin Address of the admin
	 * @return Array of game IDs
	 */
	function getAdminGames(address _admin) external view returns (uint256[] memory) {
		uint256 count = 0;

		// First pass: count games created by admin
		for (uint256 i = 0; i < gameIdCounter; i++) {
			if (games[i].admin == _admin) {
				count++;
			}
		}

		// Second pass: collect game IDs
		uint256[] memory adminGames = new uint256[](count);
		uint256 index = 0;
		for (uint256 i = 0; i < gameIdCounter; i++) {
			if (games[i].admin == _admin) {
				adminGames[index] = i;
				index++;
			}
		}

		return adminGames;
	}

	/**
	 * @notice Get total number of games created
	 * @return Total game count
	 */
	function getTotalGames() external view returns (uint256) {
		return gameIdCounter;
	}
}
