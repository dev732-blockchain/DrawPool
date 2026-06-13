import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("=== Starting Polygon MAINNET Deployment ===");

  const subIdStr = process.env.MAINNET_VRF_SUB_ID;
  if (!subIdStr) {
    throw new Error("Missing MAINNET_VRF_SUB_ID in environment variables");
  }
  const subId = BigInt(subIdStr);

  // Polygon Mainnet Chainlink VRF v2.5 addresses
  const vrfCoordinator = "0x12c4b8b60a90b8b890fe506b627d341b5399d59a";
  const keyHash = "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae"; // 500 Gwei lane

  // Native USDT on Polygon Mainnet (PoS)
  const usdtAddress = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";

  console.log(`VRF Subscription ID: ${subId}`);
  console.log(`VRF Coordinator: ${vrfCoordinator}`);
  console.log(`USDT (Polygon Native): ${usdtAddress}`);

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer wallet: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer MATIC balance: ${ethers.formatEther(balance)} MATIC`);

  if (balance === 0n) {
    throw new Error("Deployer wallet has 0 MATIC — cannot pay gas fees");
  }

  // Deploy DrawPool (no MockUSDT — using real USDT on mainnet)
  console.log("\nDeploying DrawPool on Polygon Mainnet...");
  const DrawPoolFactory = await ethers.getContractFactory("DrawPool");
  const drawpool = await DrawPoolFactory.deploy(
    usdtAddress,
    vrfCoordinator,
    subId,
    keyHash,
    {
      maxFeePerGas: ethers.parseUnits("700", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("60", "gwei")
    }
  );
  console.log(`DrawPool Tx Hash: ${drawpool.deploymentTransaction()?.hash}`);
  console.log("Waiting for confirmation...");
  await drawpool.waitForDeployment();
  const drawpoolAddress = await drawpool.getAddress();
  console.log(`\n✅ DrawPool deployed to Mainnet: ${drawpoolAddress}`);

  // Save deployment info
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir);

  const deploymentData = {
    network: "polygon-mainnet",
    chainId: 137,
    deployer: deployer.address,
    vrfCoordinator,
    usdt: usdtAddress,
    drawPool: drawpoolAddress,
    subscriptionId: subId.toString(),
    keyHash,
    constants: {
      ticketPrice: "$1 USDT",
      maxEntries: 200,
      prizeAmount: "$100 USDT"
    },
    deployedAt: new Date().toISOString()
  };

  fs.writeFileSync(
    path.join(deploymentsDir, "mainnet.json"),
    JSON.stringify(deploymentData, null, 2)
  );
  console.log("Deployment saved to deployments/mainnet.json");

  console.log("\n=======================================================");
  console.log("⚠️  ACTION REQUIRED — DO THIS NOW:");
  console.log("=======================================================");
  console.log(`1. Go to: https://vrf.chain.link/polygon`);
  console.log(`2. Open your subscription #${subId}`);
  console.log(`3. Click "Add Consumer"`);
  console.log(`4. Paste: ${drawpoolAddress}`);
  console.log(`5. Confirm the transaction in MetaMask`);
  console.log("=======================================================");
  console.log("\nWithout this step, draws WILL FAIL when a round fills up.");
  console.log("\n=== Polygon Mainnet Deployment Complete ===");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
