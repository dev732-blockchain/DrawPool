import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("=== Starting Local Deployment ===");

  // 1. Deploy VRF Coordinator Mock
  const baseFee = ethers.parseEther("0.1"); // 0.1 LINK
  const gasPriceLink = 1e9; // 1 Gwei
  const weiPerUnitLink = ethers.parseEther("1"); // 1 LINK = 1 ETH

  console.log("Deploying VRFCoordinatorV2_5Mock...");
  const CoordinatorFactory = await ethers.getContractFactory("MockVRFCoordinator");
  const coordinator = await CoordinatorFactory.deploy(baseFee, gasPriceLink, weiPerUnitLink, { gasLimit: 8000000 });
  await coordinator.waitForDeployment();
  const coordinatorAddress = await coordinator.getAddress();
  console.log(`VRFCoordinatorV2_5Mock deployed to: ${coordinatorAddress}`);

  // 2. Create and Fund VRF Subscription
  console.log("Creating VRF Subscription...");
  const createSubTx = await coordinator.createSubscription({ gasLimit: 1000000 });
  const createSubReceipt = await createSubTx.wait();
  
  // Parse subId from logs
  const coordInterface = coordinator.interface;
  const subCreatedLog = createSubReceipt?.logs.find(
    (l) => coordInterface.parseLog(l as any)?.name === "SubscriptionCreated"
  );
  if (!subCreatedLog) throw new Error("SubscriptionCreated event not found");
  const subId = coordInterface.parseLog(subCreatedLog as any)?.args[0];
  console.log(`VRF Subscription Created. ID: ${subId}`);

  console.log("Funding Subscription with Mock LINK...");
  const fundAmount = ethers.parseEther("10"); // 10 LINK
  await coordinator.fundSubscription(subId, fundAmount, { gasLimit: 1000000 });
  console.log("Subscription funded.");

  // 3. Deploy Mock USDT
  console.log("Deploying MockUSDT...");
  const USDTFactory = await ethers.getContractFactory("MockUSDT");
  const usdt = await USDTFactory.deploy({ gasLimit: 4000000 });
  await usdt.waitForDeployment();
  const usdtAddress = await usdt.getAddress();
  console.log(`MockUSDT deployed to: ${usdtAddress}`);

  // 4. Deploy DrawPool Contract
  const keyHash = "0x816bedba8a50b294e5cbd47842baf240c2385f2eaf719edbd4f250a137a8c899"; // dummy keyhash
  console.log("Deploying DrawPool...");
  const DrawPoolFactory = await ethers.getContractFactory("DrawPool");
  const drawpool = await DrawPoolFactory.deploy(
    usdtAddress,
    coordinatorAddress,
    subId,
    keyHash,
    { gasLimit: 6000000 }
  );
  await drawpool.waitForDeployment();
  const drawpoolAddress = await drawpool.getAddress();
  console.log(`DrawPool deployed to: ${drawpoolAddress}`);

  // 5. Add DrawPool as consumer to Coordinator
  console.log("Registering DrawPool as consumer...");
  await coordinator.addConsumer(subId, drawpoolAddress, { gasLimit: 1000000 });
  console.log("Consumer registered.");

  // Save deployment outputs
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  const deploymentData = {
    vrfCoordinator: coordinatorAddress,
    usdt: usdtAddress,
    drawPool: drawpoolAddress,
    subscriptionId: subId.toString(),
    keyHash: keyHash
  };

  fs.writeFileSync(
    path.join(deploymentsDir, "local.json"),
    JSON.stringify(deploymentData, null, 2)
  );
  console.log("Deployment addresses saved to deployments/local.json");
  console.log("=== Local Deployment Complete ===");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
