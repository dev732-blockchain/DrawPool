# Deploy Checklist — DrawPool Decentralized Architecture
> Provably Fair prize draw platform using on-chain Solidity contracts and Chainlink VRF v2.5.

Follow this checklist step-by-step to deploy DrawPool to production (Polygon Mainnet) or staging (Polygon Amoy Testnet).

---

## 1. Pre-Deployment & Chainlink VRF Setup
- [ ] **Owner/Cold Wallet**:
  - Ensure you have a secure MetaMask wallet that will own the contract.
  - This wallet is the only one authorized to change coordinator settings, trigger emergency paused states, or withdraw accumulated platform revenues from the contract.
- [ ] **Chainlink VRF Subscription**:
  - Connect MetaMask on the target network (**Polygon Mainnet** or **Polygon Amoy Testnet**).
  - Go to the [Chainlink VRF Subscription Dashboard](https://vrf.chain.link/).
  - Click **Create Subscription** and confirm the transaction.
  - Copy your **Subscription ID** (e.g. `12345...`).
- [ ] **Fund Subscription**:
  - Deposit LINK tokens into your subscription (recommended: 10-20 LINK for Mainnet, 2-5 LINK for Testnet). Draws will fail if the subscription lacks funding to pay for VRF callbacks.

---

## 2. Smart Contract Deployment
- [ ] **Configure hardhat.config.ts**:
  - Add your deployment wallet private key to hardhat configuration (keep private!).
  - Ensure Polygon Mainnet RPC URL is configured.
- [ ] **Deploy Contract**:
  - Deploy `DrawPool.sol` specifying the constructor arguments:
    - `subscriptionId`: Your Chainlink VRF Subscription ID
    - `vrfCoordinator`: `0x12c4b8b60A90b8B890fE506B627d341b5399D59a` (Polygon Mainnet) or `0x343300b5d84D444B2ADc9116FEF1bED02BE49Cf2` (Amoy Testnet)
    - `keyHash`: `0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae` (Mainnet 500 Gwei lane) or `0x810306d8a5900c500c8714fc7ae5448348b1d12903b41d99cd68efcf5c9a4441` (Amoy 500 Gwei lane)
    - `usdtAddress`: `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` (Mainnet native USDT) or your deployed MockUSDT address on Amoy.
- [ ] **Add Consumer**:
  - Copy the deployed DrawPool contract address.
  - Go back to your Chainlink VRF subscription page, click **Add Consumer**, paste the DrawPool contract address, and confirm the transaction. *Without this, the contract cannot request random numbers.*

---

## 3. Backend Deployment (Railway)
- [ ] Push the `backend/` directory to your GitHub repository.
- [ ] Deploy the service on [Railway.app](https://railway.app/).
- [ ] Provision a **PostgreSQL** database. Railway links `DATABASE_URL` automatically.
- [ ] Go to your service **Variables** and add these values:
  - `POLYGON_RPC_HTTP`: Alchemy/Infura RPC endpoint
  - `OWNER_ADDRESS`: Your MetaMask Cold Wallet public address (guards admin authorization)
  - `DRAWPOOL_CONTRACT_ADDRESS`: The deployed `DrawPool` contract address
  - `USDT_ADDRESS`: `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` (or MockUSDT)
  - `IS_TESTNET`: `false` (for Mainnet) or `true` (for Amoy)
- [ ] Run backend migrations in the Railway terminal:
  ```bash
  npx prisma migrate deploy
  ```
- [ ] Copy the generated Railway backend HTTPS URL (e.g. `https://your-backend.railway.app`).

---

## 4. Frontend Deployment (Vercel)
- [ ] Push the `frontend/` directory to your GitHub repository.
- [ ] Deploy the project on [Vercel.com](https://vercel.com/).
- [ ] Configure these environment variables in your Vercel settings:
  - `NEXT_PUBLIC_DRAWPOOL_CONTRACT_ADDRESS`: Your deployed DrawPool contract address
  - `NEXT_PUBLIC_USDT_ADDRESS`: `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` (or MockUSDT)
  - `NEXT_PUBLIC_OWNER_ADDRESS`: Your Cold Wallet address (for admin dashboard access)
  - `NEXT_PUBLIC_BACKEND_URL`: Railway backend HTTPS URL
  - `NEXT_PUBLIC_WS_URL`: Railway backend WSS URL
  - `NEXT_PUBLIC_POLYGON_EXPLORER`: `https://polygonscan.com` (or `https://amoy.polygonscan.com`)
  - `NEXT_PUBLIC_IS_TESTNET`: `false` (for Mainnet) or `true` (for Amoy)
- [ ] Deploy and verify the homepage renders correctly and connects MetaMask on the correct network.

---

## 5. End-to-End Live Verification
- [ ] Connect a separate player wallet in MetaMask.
- [ ] Click **Add USDT to Wallet** to verify assets configuration.
- [ ] Approve USDT spending limit, then buy tickets to trigger the smart contract transaction.
- [ ] Confirm that your entries sold count increments live on the progress bar.
- [ ] Fill the round entries (`200` on Mainnet, `10` on Testnet) to verify the Chainlink VRF callback triggers on-chain, pays out the winner, sends platform revenue, and restarts the next round automatically.
