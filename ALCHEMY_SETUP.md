# Alchemy Notify Webhook Setup Guide

DrawPool uses **Alchemy Notify** to track incoming USDT payments to the hot wallet. Whenever USDT is sent to the hot wallet on Polygon, Alchemy detects it and fires a POST webhook request to the backend server within 5–30 seconds.

Follow these steps to set up and configure the webhook:

---

## Step 1: Create an Alchemy Account & App
1. Go to [alchemy.com](https://www.alchemy.com/) and sign up for a free account.
2. Open the Alchemy Dashboard and click **Create App**.
3. Choose the network settings:
   - **Chain**: Polygon
   - **Network**: Polygon Mainnet (or **Polygon Amoy** if deploying to testnet)
4. Once created, copy the **API HTTP** and **WebSocket (WS)** URLs. 
   - Paste these into your backend environment variables as `POLYGON_RPC_HTTP` and `POLYGON_RPC_WS` (or config equivalents).

---

## Step 2: Create the Address Activity Webhook
1. In the Alchemy Dashboard sidebar, navigate to **Notify** (or Webhooks).
2. Click **Create Webhook** and select **Address Activity**.
3. Configure the webhook settings:
   - **Webhook URL**: `https://your-backend-url.railway.app/webhook/alchemy`
     *(For local development/testing, you can expose port 3001 using ngrok: `http://<ngrok-id>.ngrok-free.app/webhook/alchemy`)*
   - **Network**: Polygon Mainnet (or **Polygon Amoy** for testnet)
   - **Addresses to Watch**: Paste your public **Hot Wallet Address** here.
4. Click **Create Webhook**.

---

## Step 3: Configure Signing Key
1. Find your newly created webhook in the list and copy the **Signing Key** (secret string).
2. Add this secret to your backend environment variables as:
   ```bash
   ALCHEMY_SIGNING_KEY=your_copied_signing_key_here
   ```
3. Restart or redeploy your backend server to load the key. The server uses this key to compute HMAC-SHA256 signatures to verify that incoming webhook requests genuinely originate from Alchemy.

---

## Step 4: Send a Test Webhook
1. In the Alchemy Notify dashboard, click the **Send Test Webhook** button for your webhook.
2. Inspect your backend server logs. You should see a log message confirming receipt:
   ```bash
   [PaymentWatcher] Processing activity: tx=...
   ```
3. A successful response of `200 OK` with `{ "status": "ok" }` should be returned by the server immediately.
