const { ethers } = require("hardhat");

async function main() {
  const coordinatorAddress = "0x343300b5d84d444b2adc9116fef1bed02be49cf3";
  const subId = "91206196242489075317353272924834884313287928978714277629282556607499433445072";
  const drawPoolAddress = "0x9FDf4bB61C30b691B0ecfe9235EFaafD77082290";

  const abi = [
    "function getSubscription(uint256 subId) external view returns (uint96 balance, uint96 nativeBalance, uint64 reqCount, address owner, address[] memory consumers)"
  ];

  const [signer] = await ethers.getSigners();
  const contract = new ethers.Contract(coordinatorAddress, abi, signer);

  try {
    const [balance, nativeBalance, reqCount, owner, consumers] = await contract.getSubscription(subId);
    console.log("SUBSCRIPTION_INFO:", {
      balanceLINK: ethers.formatEther(balance),
      balancePOL: ethers.formatEther(nativeBalance),
      reqCount: reqCount.toString(),
      owner,
      consumers,
      isDrawPoolConsumer: consumers.map(c => c.toLowerCase()).includes(drawPoolAddress.toLowerCase())
    });
  } catch (err) {
    console.error("Failed to query subscription details from VRF Coordinator:", err.message || err);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
