import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("=== Starting Polygon Amoy Testnet Deployment ===");

  const subIdStr = process.env.AMOY_VRF_SUB_ID;
  if (!subIdStr) {
    throw new Error("Missing AMOY_VRF_SUB_ID in environment variables");
  }
  const subId = BigInt(subIdStr);

  const vrfCoordinator = "0x343300b5d84D444B2ADc9116FEF1bED02BE49Cf2".toLowerCase();
  const keyHash = "0x816bedba8a50b294e5cbd47842baf240c2385f2eaf719edbd4f250a137a8c899";

  console.log(`VRF Subscription ID: ${subId}`);
  console.log(`VRF Coordinator: ${vrfCoordinator}`);

  // 1. Deploy MockUSDT
  console.log("Deploying MockUSDT on Amoy...");
  const USDTFactory = await ethers.getContractFactory("MockUSDT");
  const usdt = await USDTFactory.deploy({
    maxFeePerGas: ethers.parseUnits("35", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("30", "gwei")
  });
  console.log(`MockUSDT Tx Hash submitted: ${usdt.deploymentTransaction()?.hash}`);
  await usdt.waitForDeployment();
  const usdtAddress = await usdt.getAddress();
  console.log(`MockUSDT deployed to Amoy: ${usdtAddress}`);

  // 2. Deploy DrawPool
  console.log("Deploying DrawPool on Amoy...");
  const DrawPoolFactory = await ethers.getContractFactory("DrawPool");
  const drawpool = await DrawPoolFactory.deploy(
    usdtAddress,
    vrfCoordinator,
    subId,
    keyHash,
    {
      maxFeePerGas: ethers.parseUnits("35", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("30", "gwei")
    }
  );
  console.log(`DrawPool Tx Hash submitted: ${drawpool.deploymentTransaction()?.hash}`);
  await drawpool.waitForDeployment();
  const drawpoolAddress = await drawpool.getAddress();
  console.log(`DrawPool deployed to Amoy: ${drawpoolAddress}`);

  // Save deployment outputs
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const deploymentData = {
    vrfCoordinator: vrfCoordinator,
    usdt: usdtAddress,
    drawPool: drawpoolAddress,
    subscriptionId: subId.toString(),
    keyHash: keyHash
  };

  fs.writeFileSync(
    path.join(deploymentsDir, "amoy.json"),
    JSON.stringify(deploymentData, null, 2)
  );
  console.log("Deployment addresses saved to deployments/amoy.json");

  console.log("\n=======================================================");
  console.log("ACTION REQUIRED:");
  console.log(`Add DrawPool contract address (${drawpoolAddress})`);
  console.log(`as a consumer to your VRF Subscription #${subId} at:`);
  console.log("https://vrf.chain.link/polygon-amoy");
  console.log("=======================================================");
  console.log("=== Amoy Deployment Complete ===");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
