import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("=== Initializing Pause & Refund Script on Polygon ===");

  const drawPoolAddress = "0xe742fE499c493bF143fe22D51956335548B16884";
  const [signer] = await ethers.getSigners();
  
  console.log(`Using Wallet Address: ${signer.address}`);
  
  const balance = await ethers.provider.getBalance(signer.address);
  console.log(`MATIC Balance: ${ethers.formatEther(balance)} MATIC`);

  if (balance === 0n) {
    throw new Error("Deployer wallet has 0 MATIC — cannot pay gas fees");
  }

  // Load DrawPool contract instance
  const drawpool = await ethers.getContractAt("DrawPool", drawPoolAddress, signer);

  // 1. Check if already paused
  const isPaused = await drawpool.paused();
  if (!isPaused) {
    console.log("\n1. Pausing the contract...");
    const pauseTx = await drawpool.pause();
    console.log(`Pause transaction submitted: ${pauseTx.hash}`);
    await pauseTx.wait();
    console.log("✅ Smart contract is now PAUSED successfully!");
  } else {
    console.log("\n1. Smart contract is already paused.");
  }

  // 2. Trigger Refund for current round
  console.log("\n2. Launching emergency batch refund for active round...");
  
  // Fetch active round state
  const [roundId, entriesSold] = await drawpool.getActiveRound();
  console.log(`Active Round: #${roundId}, Entries Sold: ${entriesSold}`);

  if (entriesSold === 0n) {
    console.log("No ticket entries sold in the active round. Nothing to refund!");
    return;
  }

  // Run emergencyRefund to send USDT back to entrants
  const refundTx = await drawpool.emergencyRefund(entriesSold);
  console.log(`Refund transaction submitted: ${refundTx.hash}`);
  await refundTx.wait();
  console.log(`✅ Successfully refunded all ticket buyers for Round #${roundId}!`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
