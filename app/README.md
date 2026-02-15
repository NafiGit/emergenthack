# Monad Gaming System

A blockchain-based game management system built on **Monad Testnet** where Admin agents create games and User agents participate by staking **0.1 MON** tokens. The winner automatically receives the entire prize pool.

## 🎮 Features

- **Admin Functions:**
  - Create games with configurable number of players (2-10)
  - Declare winners and trigger automatic payouts

- **User Functions:**
  - Join games by depositing exactly 0.1 MON
  - Automatic prize distribution to winners

- **Smart Contract:**
  - Transparent on-chain game logic
  - State management (OPEN → FULL → COMPLETED)
  - Access control and validation
  - Event emission for all actions

## 🛠️ Tech Stack

- **Blockchain:** Monad Testnet (Chain ID: 10143)
- **Smart Contracts:** Solidity 0.8.20
- **Framework:** Scaffold-ETH 2
- **Backend:** Hardhat
- **Frontend:** Next.js 14
- **Wallet Integration:** RainbowKit + Wagmi

## 📋 Prerequisites

- Node.js >= v18.17
- Yarn v1 or v2+
- MetaMask wallet
- MON testnet tokens from faucet

## 🚀 Quick Start

### 1. Install Dependencies

```bash
yarn install
```

### 2. Set Up Environment Variables

#### Backend (.env in packages/hardhat)
```bash
# Copy .env.example to .env
cp packages/hardhat/.env.example packages/hardhat/.env

# Configure your deployer private key (use yarn generate to create one)
# Add Monad RPC URL if different from default
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
```

#### Frontend (.env.local in packages/nextjs)
```bash
# Optional: Custom Monad RPC URL
NEXT_PUBLIC_MONAD_RPC_URL=https://testnet-rpc.monad.xyz
```

### 3. Generate Deployer Account (First Time Only)

```bash
cd packages/hardhat
yarn generate
```

This creates a new wallet and saves the encrypted private key. **Fund this address with MON tokens from the Monad faucet**.

### 4. Deploy Smart Contract

#### Local Development (Hardhat Network)
```bash
# Terminal 1: Start local node
cd packages/hardhat
yarn chain

# Terminal 2: Deploy contracts
cd packages/hardhat
yarn deploy
```

#### Monad Testnet
```bash
cd packages/hardhat
yarn deploy --network monadTestnet
```

### 5. Start Frontend

```bash
cd packages/nextjs
yarn start
```

Visit **http://localhost:3000** to interact with the dApp.

---

## 📚 Smart Contract Overview

### GameManager.sol

**Core Functions:**

```solidity
// Admin creates a new game
function createGame(uint8 requiredPlayers) external returns (uint256 gameId)

// Users join by depositing 0.1 MON
function joinGame(uint256 gameId) external payable

// Admin declares winner (triggers automatic payout)
function declareWinner(uint256 gameId, address winner) external

// View functions
function getActiveGames() external view returns (uint256[] memory)
function getPlayerGames(address player) external view returns (uint256[] memory)
function getAdminGames(address admin) external view returns (uint256[] memory)
function getGameDetails(uint256 gameId) external view returns (GameInfo memory)
```

**Constants:**
- `ENTRY_FEE`: 0.1 MON (0.1 ether)
- `MIN_PLAYERS`: 2
- `MAX_PLAYERS`: 10

**Game States:**
- `OPEN` - Accepting players
- `FULL` - All players joined, ready for winner declaration
- `COMPLETED` - Winner declared and paid

---

## 🧪 Testing

### Run All Tests
```bash
cd packages/hardhat
yarn test
```

### Run Specific Test File
```bash
yarn test test/GameManager.ts
```

### Test Coverage
```bash
yarn coverage
```

### Gas Report
```bash
REPORT_GAS=true yarn test
```

---

## 🎯 Usage Guide

### Add Monad Testnet to MetaMask

1. Open MetaMask
2. Click "Add Network" manually:
   - **Network Name:** Monad Testnet
   - **RPC URL:** `https://testnet-rpc.monad.xyz`
   - **Chain ID:** `10143`
   - **Currency Symbol:** MON
   - **Block Explorer:** `https://testnet.monadexplorer.com`

### Get Testnet MON Tokens

Visit the Monad testnet faucet and request tokens for your wallet address.

### Admin: Create a Game

1. Connect wallet to the dApp
2. Switch to Monad Testnet network
3. Navigate to Admin page
4. Enter number of players (2-10)
5. Click "Create Game"
6. Confirm transaction in MetaMask

### User: Join a Game

1. Connect wallet
2. Navigate to Games page
3. Browse available games
4. Click "Join Game" on an open game
5. Confirm transaction (0.1 MON will be deducted)

### Admin: Declare Winner

1. Navigate to your created games
2. Wait for game to reach FULL status
3. Select winner from dropdown (must be a participant)
4. Click "Declare Winner"
5. Winner automatically receives the prize pool!

---

## 📁 Project Structure

```
app/
├── packages/
│   ├── hardhat/                  # Smart contracts & deployment
│   │   ├── contracts/
│   │   │   └── GameManager.sol   # Main game contract
│   │   ├── deploy/
│   │   │   └── 01_deploy_game_manager.ts
│   │   ├── test/
│   │   │   └── GameManager.ts    # Comprehensive tests
│   │   └── hardhat.config.ts     # Monad testnet config
│   └── nextjs/                   # Frontend application
│       ├── app/                  # Next.js pages
│       ├── components/           # React components
│       └── scaffold.config.ts    # Monad chain definition
└── README.md
```

---

## 🔐 Security Features

- **Reentrancy Protection:** Uses checks-effects-interactions pattern
- **Access Control:** Only game admin can declare winner
- **Input Validation:** Strict checks on player count and deposit amounts
- **State Management:** Proper game state transitions
- **Winner Validation:** Winner must be an actual participant

---

## 🐛 Troubleshooting

### Issue: Transaction Fails

**Solution:** Ensure you have enough MON for gas fees + entry fee (if joining)

### Issue: Can't Connect to Monad Testnet

**Solution:** 
- Verify RPC URL is correct in MetaMask
- Check if Monad testnet is operational
- Try alternative RPC if available

### Issue: Contract Not Found

**Solution:**
- Ensure contract is deployed: `yarn deploy --network monadTestnet`
- Check if you're connected to the correct network
- Verify contract address in deployments folder

### Issue: Tests Failing

**Solution:**
```bash
# Clean and recompile
yarn clean
yarn compile
yarn test
```

---

## 📖 API Reference

See [implementation_plan.md](../../.gemini/antigravity/brain/6dba54c2-1c66-45f6-9b56-a4b048e1bb36/implementation_plan.md) for detailed technical documentation.

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/amazing-feature`
2. Make your changes
3. Run tests: `yarn test`
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Open a Pull Request

---

## 📝 License

MIT

---

## 🔗 Resources

- [Monad Official Documentation](https://monad.xyz)
- [Scaffold-ETH 2 Docs](https://docs.scaffoldeth.io)
- [Product Requirements Document](../../.gemini/antigravity/brain/6dba54c2-1c66-45f6-9b56-a4b048e1bb36/prd.md)

---

**Built with ❤️ on Monad Testnet**