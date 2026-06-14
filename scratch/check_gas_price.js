const { ethers } = require("hardhat");

async function main() {
  const feeData = await ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice;
  console.log("Gas Price:", ethers.formatUnits(gasPrice, "gwei"), "Gwei");

  const limit2_5M = 2_500_000n;
  const cost2_5M = limit2_5M * gasPrice;
  console.log("Required ETH for 2.5M gas limit:", ethers.formatEther(cost2_5M), "ETH");

  const limit1_5M = 1_500_000n;
  const cost1_5M = limit1_5M * gasPrice;
  console.log("Required ETH for 1.5M gas limit:", ethers.formatEther(cost1_5M), "ETH");
}

main().catch(console.error);
