# DrawPool — Decentralized Smart Contract Prize Draw

DrawPool is an anonymous, decentralized crypto prize draw platform built on Polygon. In this version, the platform is driven by Solidity smart contracts. Entry funds are held securely on-chain inside the contract, winner selection is coordinated using **Chainlink VRF v2.5**, and prize payouts are executed automatically and atomically by the smart contract.

The backend acts purely as a real-time event listener and database synchronizer, and the frontend allows direct MetaMask contract interaction (approving USDT and entering draws). This eliminates all hot wallet private key server risks.

---

## How It Works

```
User opens DrawPool site & connects MetaMask
        |
User selects ticket quantity (1-100) and clicks Buy
        |
MetaMask prompts USDT Approve transaction (if allowance is low)
        |
MetaMask prompts enterDraw(quantity) transaction on DrawPool contract
        |
DrawPool contract pulls USDT from user, records entries on-chain
        |
Backend contractListener detects EntryPurchased event live
        |
Backend updates database & broadcasts progress via Socket.io
        |
When entries == MAX_ENTRIES (10 on testnet / 200 on mainnet):
        |
DrawPool contract locks and requests random words from Chainlink VRF
        |
Chainlink VRF Coordinator calls rawFulfillRandomWords callback on contract
        |
Contract selects winner, transfers prize (e.g. $100) to winner and revenue ($100) to owner
Contract automatically increments round and starts new round
        |
Backend detects WinnerSelected event and logs complete round to DB
        |
Frontend shows Winner Modal live to all visitors
```

---

## Directory Structure

```
drawpool/
├── contract/                     -- Hardhat Solidity Project
│   ├── contracts/
│   │   ├── DrawPool.sol          -- Core DrawPool contract with VRF callback
│   │   └── mocks/                -- Mock USDT and Mock VRF Coordinator
│   ├── scripts/                  -- Local and testnet deployment scripts
│   ├── test/                     -- 20 hardhat unit tests (npx hardhat test)
│   └── tsconfig.json
│
├── backend/                      -- Fastify Blockchain Event Sync
│   ├── prisma/
│   │   └── schema.prisma         -- Database schema for Rounds & Entries
│   ├── src/
│   │   ├── services/
│   │   │   ├── contractListener.ts -- Ethers.js live contract event listener
│   │   │   └── socketService.ts    -- Socket.io progress broadcaster
│   │   ├── routes/               -- API endpoints for active rounds & history
│   │   ├── config.ts             -- App configurations loading contract address
│   │   └── index.ts              -- Entry point (Fastify + Socket.io + Listener)
│   └── tsconfig.json
│
├── frontend/                     -- Next.js 16 Client Interface
│   ├── app/                      -- App Router layouts, verify, my-entries pages
│   ├── components/
│   │   ├── EntryInstructions.tsx -- Interactive contract checkout flow
│   │   ├── FairnessVerifier.tsx  -- Chainlink VRF proof verification display
│   │   └── WalletConnect.tsx     -- Direct window.ethereum MetaMask switcher
│   └── tsconfig.json
│
├── VRF_SUB_SETUP.md              -- Chainlink VRF Subscription setup instructions
└── README.md                     -- This documentation file
```

---

## How to Run Locally

### 1. Run Local Node & Deploy Contracts
1. Go to the `contract` folder:
   ```bash
   cd contract
   npm install
   ```
2. Start local Hardhat node:
   ```bash
   npx hardhat node
   ```
3. In a new terminal, deploy contracts to local node:
   ```bash
   npx hardhat run scripts/deploy-local.ts --network localhost
   ```
   *This deploys MockVRFCoordinator, MockUSDT, DrawPool, funds the VRF subscription, and saves addresses to `deployments/local.json`.*
4. Run Hardhat unit test suite:
   ```bash
   npx hardhat test
   ```
   *Verifies 20 tests covering reentrancy, VRF callbacks, edge cases, and deactivations.*

### 2. Run Backend Listener
1. Copy `backend/.env.example` to `backend/.env` and update configurations with the local contract addresses from `contract/deployments/local.json`:
   ```env
   POLYGON_RPC_HTTP=http://127.0.0.1:8545
   DATABASE_URL=postgresql://user:pass@host:5432/drawpool
   OWNER_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   DRAWPOOL_CONTRACT_ADDRESS=0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
   USDT_ADDRESS=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
   IS_TESTNET=true
   ```
2. Start the backend:
   ```bash
   cd backend
   npm install
   npx prisma db push
   npm run dev
   ```

### 3. Run Frontend
1. Copy `frontend/.env.local.example` to `frontend/.env.local` and add local contract addresses:
   ```env
   NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
   NEXT_PUBLIC_WS_URL=ws://localhost:3001
   NEXT_PUBLIC_DRAWPOOL_CONTRACT_ADDRESS=0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
   NEXT_PUBLIC_USDT_ADDRESS=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
   NEXT_PUBLIC_OWNER_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   NEXT_PUBLIC_POLYGON_EXPLORER=https://amoy.polygonscan.com
   NEXT_PUBLIC_IS_TESTNET=true
   ```
2. Start the Next.js development server:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser. Connect wallet, claim free USDT faucet tokens, and buy tickets directly on-chain!

---

## Cryptographic Fairness & Security

- **Chainlink VRF v2.5**: Relies on verifiable random functions where the coordinator contract verifies the cryptographic proof of randomness on-chain before selecting the winner index.
- **USDT Allowance Guarding**: The contract only pulls the exact required USDT matching the tickets requested by the user, and never more.
- **Emergency Protection**: Pausable and emergency deactivation (kill switch) allow the administrator to pause entries or deactivate the contract, immediately refunding all active round tickets to players' wallets.
