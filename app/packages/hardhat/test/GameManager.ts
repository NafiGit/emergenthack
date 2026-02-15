import { expect } from "chai";
import { ethers } from "hardhat";
import { GameManager } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("GameManager", function () {
    let gameManager: GameManager;
    let admin: HardhatEthersSigner;
    let user1: HardhatEthersSigner;
    let user2: HardhatEthersSigner;
    let user3: HardhatEthersSigner;
    let nonParticipant: HardhatEthersSigner;

    const ENTRY_FEE = ethers.parseEther("0.1");
    const MIN_PLAYERS = 2;
    const MAX_PLAYERS = 10;

    beforeEach(async () => {
        [admin, user1, user2, user3, nonParticipant] = await ethers.getSigners();
        const GameManagerFactory = await ethers.getContractFactory("GameManager");
        gameManager = (await GameManagerFactory.deploy()) as GameManager;
        await gameManager.waitForDeployment();
    });

    describe("Deployment", () => {
        it("Should set the correct entry fee", async () => {
            expect(await gameManager.ENTRY_FEE()).to.equal(ENTRY_FEE);
        });

        it("Should set correct player limits", async () => {
            expect(await gameManager.MIN_PLAYERS()).to.equal(MIN_PLAYERS);
            expect(await gameManager.MAX_PLAYERS()).to.equal(MAX_PLAYERS);
        });

        it("Should initialize with zero games", async () => {
            expect(await gameManager.getTotalGames()).to.equal(0);
        });
    });

    describe("Game Creation", () => {
        it("Should create a game with valid player count", async () => {
            await gameManager.connect(admin).createGame(3);
            expect(await gameManager.getTotalGames()).to.equal(1);

            const gameInfo = await gameManager.getGameDetails(0);
            expect(gameInfo.admin).to.equal(admin.address);
            expect(gameInfo.requiredPlayers).to.equal(3);
            expect(gameInfo.currentPlayers).to.equal(0);
            expect(gameInfo.state).to.equal(0);
        });

        it("Should emit GameCreated event", async () => {
            await expect(gameManager.connect(admin).createGame(3)).to.emit(gameManager, "GameCreated");
        });

        it("Should reject game creation with players below minimum", async () => {
            await expect(gameManager.connect(admin).createGame(1)).to.be.revertedWithCustomError(
                gameManager,
                "InvalidPlayerCount",
            );
        });

        it("Should reject game creation with players above maximum", async () => {
            await expect(gameManager.connect(admin).createGame(11)).to.be.revertedWithCustomError(
                gameManager,
                "InvalidPlayerCount",
            );
        });

        it("Should create multiple games with unique IDs", async () => {
            await gameManager.connect(admin).createGame(2);
            await gameManager.connect(user1).createGame(3);
            expect(await gameManager.getTotalGames()).to.equal(2);

            const game0 = await gameManager.getGameDetails(0);
            const game1 = await gameManager.getGameDetails(1);
            expect(game0.admin).to.equal(admin.address);
            expect(game1.admin).to.equal(user1.address);
        });
    });

    describe("Join Game", () => {
        beforeEach(async () => {
            await gameManager.connect(admin).createGame(3);
        });

        it("Should join game with correct entry fee", async () => {
            await expect(gameManager.connect(user1).joinGame(0, { value: ENTRY_FEE }))
                .to.emit(gameManager, "PlayerJoined")
                .withArgs(0, user1.address, 1, ENTRY_FEE);

            const gameInfo = await gameManager.getGameDetails(0);
            expect(gameInfo.currentPlayers).to.equal(1);
            expect(gameInfo.prizePool).to.equal(ENTRY_FEE);
        });

        it("Should reject insufficient entry fee", async () => {
            const insufficientFee = ethers.parseEther("0.05");
            await expect(gameManager.connect(user1).joinGame(0, { value: insufficientFee })).to.be.revertedWithCustomError(
                gameManager,
                "IncorrectEntryFee",
            );
        });

        it("Should reject excess entry fee", async () => {
            const excessFee = ethers.parseEther("0.2");
            await expect(gameManager.connect(user1).joinGame(0, { value: excessFee })).to.be.revertedWithCustomError(
                gameManager,
                "IncorrectEntryFee",
            );
        });

        it("Should prevent duplicate joins from same user", async () => {
            await gameManager.connect(user1).joinGame(0, { value: ENTRY_FEE });
            await expect(gameManager.connect(user1).joinGame(0, { value: ENTRY_FEE })).to.be.revertedWithCustomError(
                gameManager,
                "AlreadyJoined",
            );
        });

        it("Should change game state to FULL when last player joins", async () => {
            await gameManager.connect(user1).joinGame(0, { value: ENTRY_FEE });
            await gameManager.connect(user2).joinGame(0, { value: ENTRY_FEE });
            await expect(gameManager.connect(user3).joinGame(0, { value: ENTRY_FEE }))
                .to.emit(gameManager, "GameFull")
                .withArgs(0, ENTRY_FEE * 3n, 3);

            const gameInfo = await gameManager.getGameDetails(0);
            expect(gameInfo.state).to.equal(1);
        });

        it("Should accumulate prize pool correctly", async () => {
            await gameManager.connect(user1).joinGame(0, { value: ENTRY_FEE });
            await gameManager.connect(user2).joinGame(0, { value: ENTRY_FEE });

            const gameInfo = await gameManager.getGameDetails(0);
            expect(gameInfo.prizePool).to.equal(ENTRY_FEE * 2n);
        });
    });

    describe("Declare Winner", () => {
        beforeEach(async () => {
            await gameManager.connect(admin).createGame(2);
            await gameManager.connect(user1).joinGame(0, { value: ENTRY_FEE });
            await gameManager.connect(user2).joinGame(0, { value: ENTRY_FEE });
        });

        it("Should declare winner and transfer prize pool", async () => {
            const user1BalanceBefore = await ethers.provider.getBalance(user1.address);
            await gameManager.connect(admin).declareWinner(0, user1.address);

            const user1BalanceAfter = await ethers.provider.getBalance(user1.address);
            expect(user1BalanceAfter - user1BalanceBefore).to.equal(ENTRY_FEE * 2n);

            const gameInfo = await gameManager.getGameDetails(0);
            expect(gameInfo.winner).to.equal(user1.address);
            expect(gameInfo.state).to.equal(3);
        });

        it("Should only allow game admin to declare winner", async () => {
            await expect(gameManager.connect(user1).declareWinner(0, user1.address)).to.be.revertedWithCustomError(
                gameManager,
                "NotGameAdmin",
            );
        });

        it("Should reject winner who is not a participant", async () => {
            await expect(gameManager.connect(admin).declareWinner(0, nonParticipant.address)).to.be.revertedWithCustomError(
                gameManager,
                "WinnerNotParticipant",
            );
        });

        it("Should reject declaring winner for game not FULL", async () => {
            await gameManager.connect(admin).createGame(3);
            await gameManager.connect(user1).joinGame(1, { value: ENTRY_FEE });
            await expect(gameManager.connect(admin).declareWinner(1, user1.address)).to.be.revertedWithCustomError(
                gameManager,
                "GameNotFull",
            );
        });
    });

    describe("View Functions", () => {
        beforeEach(async () => {
            await gameManager.connect(admin).createGame(2);
            await gameManager.connect(user1).createGame(3);
            await gameManager.connect(admin).createGame(2);

            await gameManager.connect(user1).joinGame(0, { value: ENTRY_FEE });
            await gameManager.connect(user2).joinGame(0, { value: ENTRY_FEE });
            await gameManager.connect(user1).joinGame(1, { value: ENTRY_FEE });
            await gameManager.connect(user1).joinGame(2, { value: ENTRY_FEE });
            await gameManager.connect(user2).joinGame(2, { value: ENTRY_FEE });
            await gameManager.connect(admin).declareWinner(2, user1.address);
        });

        it("Should get active games", async () => {
            const activeGames = await gameManager.getActiveGames();
            expect(activeGames.length).to.equal(2);
            expect(activeGames).to.deep.equal([0n, 1n]);
        });

        it("Should get player games", async () => {
            const user1Games = await gameManager.getPlayerGames(user1.address);
            expect(user1Games.length).to.equal(3);
        });

        it("Should get admin games", async () => {
            const adminGames = await gameManager.getAdminGames(admin.address);
            expect(adminGames.length).to.equal(2);
        });

        it("Should get total games count", async () => {
            expect(await gameManager.getTotalGames()).to.equal(3);
        });
    });

    describe("Integration: Complete Game Flow", () => {
        it("Should complete full game lifecycle successfully", async () => {
            await gameManager.connect(admin).createGame(3);
            let gameInfo = await gameManager.getGameDetails(0);
            expect(gameInfo.state).to.equal(0);

            await gameManager.connect(user1).joinGame(0, { value: ENTRY_FEE });
            await gameManager.connect(user2).joinGame(0, { value: ENTRY_FEE });
            await gameManager.connect(user3).joinGame(0, { value: ENTRY_FEE });

            gameInfo = await gameManager.getGameDetails(0);
            expect(gameInfo.state).to.equal(1);
            expect(gameInfo.prizePool).to.equal(ENTRY_FEE * 3n);

            const winnerBalanceBefore = await ethers.provider.getBalance(user2.address);
            await gameManager.connect(admin).declareWinner(0, user2.address);

            gameInfo = await gameManager.getGameDetails(0);
            expect(gameInfo.state).to.equal(3);
            expect(gameInfo.winner).to.equal(user2.address);

            const winnerBalanceAfter = await ethers.provider.getBalance(user2.address);
            expect(winnerBalanceAfter - winnerBalanceBefore).to.equal(ENTRY_FEE * 3n);
        });
    });
});
