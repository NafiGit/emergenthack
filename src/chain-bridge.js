// MineForge Chain Bridge — Monad Testnet integration for arena betting
// Records matches on-chain via GameManager.sol and rewards winning bettors with MON

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

const WALLETS_PATH = '/tmp/arena-logs/wallets.json';

// Minimal GameManager ABI (deployed at 0xbD2A6049BC38d11a445Fe4A21f4a6f5CFCC6912D)
const GAME_MANAGER_ABI = [
  'function createGame(uint8 _requiredPlayers) external returns (uint256)',
  'function declareWinner(uint256 _gameId, address _winner) external',
  'function getTotalGames() external view returns (uint256)',
  'function getGameDetails(uint256 _gameId) external view returns (tuple(address admin, uint8 requiredPlayers, uint8 currentPlayers, uint256 prizePool, uint8 state, address[] players, address winner, uint256 createdAt))',
  'event GameCreated(uint256 indexed gameId, address indexed admin, uint8 requiredPlayers, uint256 timestamp)',
  'event WinnerDeclared(uint256 indexed gameId, address indexed winner, uint256 payout, uint256 timestamp)',
];

const CONTRACT_ADDRESS = '0xbD2A6049BC38d11a445Fe4A21f4a6f5CFCC6912D';

class ChainBridge {
  constructor() {
    this.enabled = false;
    this.provider = null;
    this.wallet = null;
    this.contract = null;
    this.playerWallets = {}; // Minecraft username → ETH address
    this.onChainGames = 0;
    this.rewardAmount = '0.001';
  }

  async init() {
    const privateKey = process.env.MONAD_PRIVATE_KEY;
    const rpcUrl = process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz';
    this.rewardAmount = process.env.MONAD_REWARD_AMOUNT || '0.001';

    if (!privateKey) {
      console.log('[CHAIN] No MONAD_PRIVATE_KEY set — running in offline mode (no on-chain features)');
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      this.contract = new ethers.Contract(CONTRACT_ADDRESS, GAME_MANAGER_ABI, this.wallet);

      // Test connection
      const balance = await this.provider.getBalance(this.wallet.address);
      const network = await this.provider.getNetwork();
      this.onChainGames = await this.getTotalGames();

      console.log(`[CHAIN] Connected to Monad Testnet (chainId: ${network.chainId})`);
      console.log(`[CHAIN] Server wallet: ${this.wallet.address}`);
      console.log(`[CHAIN] Balance: ${ethers.formatEther(balance)} MON`);
      console.log(`[CHAIN] GameManager: ${CONTRACT_ADDRESS}`);
      console.log(`[CHAIN] Total on-chain games: ${this.onChainGames}`);
      console.log(`[CHAIN] Reward per winning bet: ${this.rewardAmount} MON`);

      this.enabled = true;
      this._loadWallets();
    } catch (e) {
      console.log(`[CHAIN] Failed to connect: ${e.message} — running in offline mode`);
      this.enabled = false;
    }
  }

  // ─── Wallet Registry ────────────────────────────────────

  _loadWallets() {
    try {
      if (fs.existsSync(WALLETS_PATH)) {
        this.playerWallets = JSON.parse(fs.readFileSync(WALLETS_PATH, 'utf8'));
        const count = Object.keys(this.playerWallets).length;
        if (count > 0) console.log(`[CHAIN] Loaded ${count} registered wallets`);
      }
    } catch { /* ignore */ }
  }

  _saveWallets() {
    try {
      fs.mkdirSync(path.dirname(WALLETS_PATH), { recursive: true });
      fs.writeFileSync(WALLETS_PATH, JSON.stringify(this.playerWallets, null, 2));
    } catch { /* ignore */ }
  }

  registerWallet(playerName, address) {
    if (!ethers.isAddress(address)) return { success: false, error: 'Invalid ETH address' };
    this.playerWallets[playerName] = ethers.getAddress(address); // checksum
    this._saveWallets();
    return { success: true, address: this.playerWallets[playerName] };
  }

  getWallet(playerName) {
    return this.playerWallets[playerName] || null;
  }

  get registeredCount() {
    return Object.keys(this.playerWallets).length;
  }

  // ─── On-Chain Match Recording ───────────────────────────

  async createMatchGame(arena, fighter1, fighter2) {
    if (!this.enabled) return null;
    try {
      const tx = await this.contract.createGame(2);
      const receipt = await tx.wait();

      // Parse GameCreated event to get gameId
      let gameId = null;
      for (const log of receipt.logs) {
        try {
          const parsed = this.contract.interface.parseLog({ topics: log.topics, data: log.data });
          if (parsed && parsed.name === 'GameCreated') {
            gameId = parsed.args[0];
            break;
          }
        } catch { /* not our event */ }
      }

      this.onChainGames++;
      const shortHash = tx.hash.slice(0, 10) + '...' + tx.hash.slice(-6);
      console.log(`[CHAIN] Match created on-chain: ${arena} ${fighter1} vs ${fighter2} | Game #${gameId} | TX: ${shortHash}`);
      return { gameId: gameId?.toString(), txHash: tx.hash };
    } catch (e) {
      console.log(`[CHAIN] createMatchGame failed: ${e.message}`);
      return null;
    }
  }

  async recordWinner(gameId, winnerAddress) {
    if (!this.enabled || !gameId) return null;
    try {
      const tx = await this.contract.declareWinner(gameId, winnerAddress);
      const receipt = await tx.wait();
      const shortHash = tx.hash.slice(0, 10) + '...' + tx.hash.slice(-6);
      console.log(`[CHAIN] Winner recorded on-chain: Game #${gameId} | TX: ${shortHash}`);
      return { txHash: tx.hash };
    } catch (e) {
      console.log(`[CHAIN] recordWinner failed (expected if no players joined): ${e.message}`);
      return null;
    }
  }

  async rewardBettors(winnerNames) {
    if (!this.enabled) return [];
    const results = [];
    const amount = ethers.parseEther(this.rewardAmount);

    for (const playerName of winnerNames) {
      const addr = this.playerWallets[playerName];
      if (!addr) continue; // no registered wallet, skip

      try {
        const tx = await this.wallet.sendTransaction({ to: addr, value: amount });
        await tx.wait();
        const shortHash = tx.hash.slice(0, 10) + '...' + tx.hash.slice(-6);
        console.log(`[CHAIN] Rewarded ${playerName} (${addr}): ${this.rewardAmount} MON | TX: ${shortHash}`);
        results.push({ player: playerName, address: addr, txHash: tx.hash, amount: this.rewardAmount });
      } catch (e) {
        console.log(`[CHAIN] Reward failed for ${playerName}: ${e.message}`);
      }
    }
    return results;
  }

  // ─── Utility ────────────────────────────────────────────

  async getBalance() {
    if (!this.enabled) return null;
    try {
      const bal = await this.provider.getBalance(this.wallet.address);
      return ethers.formatEther(bal);
    } catch { return null; }
  }

  async getTotalGames() {
    if (!this.contract) return 0;
    try {
      const total = await this.contract.getTotalGames();
      return Number(total);
    } catch { return 0; }
  }
}

export const chainBridge = new ChainBridge();
