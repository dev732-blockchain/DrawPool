import { ethers } from "hardhat";

async function main() {
  const drawPoolAddress = "0x9FDf4bB61C30b691B0ecfe9235EFaafD77082290";
  const correctCoordinator = "0x343300b5d84D444B2ADc9116FEF1bED02BE49Cf2";

  console.log(`Setting correct VRF Coordinator to: ${correctCoordinator}`);
  
  const drawpool = await ethers.getContractAt("DrawPool", drawPoolAddress);

  // Send setCoordinator tx with Amoy gas overrides
  const tx = await drawpool.setCoordinator(correctCoordinator, {
    maxFeePerGas: ethers.parseUnits("35", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("30", "gwei")
  });

  console.log(`Transaction submitted: ${tx.hash}`);
  console.log("Waiting for confirmation...");
  await tx.wait(1);
  console.log("VRF Coordinator successfully updated on-chain!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
