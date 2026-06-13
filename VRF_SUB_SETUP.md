# DrawPool — Chainlink VRF v2.5 Subscription Setup Guide

This guide details how to create, fund, and register a **Chainlink VRF v2.5 Subscription** to enable provably fair winner draws for DrawPool.

---

## 1. Setup on Polygon Amoy Testnet

To deploy and test DrawPool on the Polygon Amoy testnet, follow these steps:

### Step A: Connect to MetaMask and Get Faucet Tokens
1. Install **MetaMask** and connect to the **Polygon Amoy Testnet** (Chain ID: `80002`). You can add it automatically via [chainlist.org](https://chainlist.org/?search=amoy).
2. Get free test **POL** for gas fees from the [Polygon Amoy Faucet](https://faucet.polygon.technology/) or [Chainlink Faucet](https://faucets.chain.link/polygon-amoy).
3. Get free test **LINK** tokens from the [Chainlink Faucet](https://faucets.chain.link/polygon-amoy) (required to fund your VRF subscription).

### Step B: Create a VRF Subscription
1. Go to the [Chainlink VRF Subscription Dashboard](https://vrf.chain.link/).
2. Select network: **Polygon Amoy**.
3. Click **Create Subscription** and confirm the transaction in MetaMask.
4. Copy your **Subscription ID** (e.g. `262766...`).

### Step C: Fund Your Subscription
1. Inside your subscription details page, click **Actions** -> **Fund Subscription**.
2. Input the amount of LINK to deposit (at least 2-5 LINK is recommended for testing).
3. Approve and confirm the transfer transaction.

### Step D: Deploy Contract and Add Consumer
1. Set the environment variable `AMOY_VRF_SUB_ID` to your Subscription ID in your `.env` file inside the `contract` folder:
   ```env
   AMOY_VRF_SUB_ID=your_subscription_id_here
   PRIVATE_KEY=your_meta_mask_private_key_here
   AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
   ```
2. Run the deployment script to deploy DrawPool to Amoy:
   ```bash
   cd contract
   npx hardhat run scripts/deploy-testnet.ts --network amoy
   ```
3. Copy the deployed **DrawPool contract address** from the output.
4. Go back to your Chainlink VRF Subscription page, click **Add Consumer**, paste the DrawPool contract address, and confirm the transaction.

---

## 2. Setup on Polygon Mainnet

When ready to go live on Polygon Mainnet:

### Step A: Create and Fund VRF Subscription
1. Go to [vrf.chain.link](https://vrf.chain.link/) and connect MetaMask on **Polygon Mainnet**.
2. Click **Create Subscription** and confirm.
3. Fund the subscription with real **LINK** tokens (purchased on an exchange like Binance or Uniswap and sent to your wallet). 10-20 LINK is recommended to start.

### Step B: Update Contract Constructor Arguments
Before deploying to mainnet, update the VRF Coordinator and keyHash constants in your deployment script to match Polygon Mainnet values:

| Parameter | Value |
|---|---|
| **VRF Coordinator Address** | `0x12c4b8b60A90b8B890fE506B627d341b5399D59a` |
| **Key Hash (Gas Lane)** | `0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae` (500 Gwei lane) |

### Step C: Add Contract as Consumer
1. Deploy your mainnet DrawPool contract.
2. Register the mainnet contract address as a consumer under your Mainnet VRF Subscription.

---

## 3. Environment Variables Sync

Once setup is complete, configure your backend and frontend `.env` files:

### Backend `.env`
```env
POLYGON_RPC_HTTP=https://polygon-amoy.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
DATABASE_URL=postgresql://user:pass@host:5432/drawpool
OWNER_ADDRESS=your_cold_wallet_address_here
DRAWPOOL_CONTRACT_ADDRESS=your_deployed_drawpool_address_here
USDT_ADDRESS=your_deployed_mock_usdt_address_here
IS_TESTNET=true
```

### Frontend `.env.local`
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_DRAWPOOL_CONTRACT_ADDRESS=your_deployed_drawpool_address_here
NEXT_PUBLIC_USDT_ADDRESS=your_deployed_mock_usdt_address_here
NEXT_PUBLIC_OWNER_ADDRESS=your_cold_wallet_address_here
NEXT_PUBLIC_POLYGON_EXPLORER=https://amoy.polygonscan.com
NEXT_PUBLIC_IS_TESTNET=true
```
