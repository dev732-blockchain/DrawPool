const { ethers } = require("hardhat");

async function main() {
  const drawPoolAddress = "0x9FDf4bB61C30b691B0ecfe9235EFaafD77082290";
  const abi = [
    "function getActiveRound() external view returns (uint256 roundId, uint256 entriesSold, bool isLocked, bool deactivated)"
  ];

  // Get signer to query
  const [signer] = await ethers.getSigners();
  const contract = new ethers.Contract(drawPoolAddress, abi, signer);

  try {
    const [roundId, entriesSold, isLocked, deactivated] = await contract.getActiveRound();
    console.log("ROUND_INFO:", {
      roundId: roundId.toString(),
      entriesSold: entriesSold.toString(),
      isLocked,
      deactivated
    });
  } catch (err) {
    console.error("Failed to query contract:", err);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
