import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("=== Initializing Unpause Script on Polygon ===");

  const drawPoolAddress = "0xe742fE499c493bF143fe22D51956335548B16884";
  const [signer] = await ethers.getSigners();
  
  console.log(`Using Wallet Address: ${signer.address}`);
  
  const balance = await ethers.provider.getBalance(signer.address);
  console.log(`MATIC Balance: ${ethers.formatEther(balance)} MATIC`);

  const drawpool = await ethers.getContractAt("DrawPool", drawPoolAddress, signer);

  // Check if paused
  const isPaused = await drawpool.paused();
  if (isPaused) {
    console.log("\nUnpausing the contract to resume play...");
    const unpauseTx = await drawpool.unpause({
      maxPriorityFeePerGas: ethers.parseUnits("40", "gwei"),
      maxFeePerGas: ethers.parseUnits("50", "gwei")
    });
    console.log(`Unpause transaction submitted: ${unpauseTx.hash}`);
    await unpauseTx.wait();
    console.log("✅ Smart contract is now UNPAUSED and active!");
  } else {
    console.log("\nSmart contract is already active (not paused).");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
