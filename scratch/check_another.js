const { ethers } = require("hardhat");

async function main() {
  const address = ethers.getAddress("0x8a6d5D0fC7C55F0A12117974B69dbf01E74Dc940".toLowerCase());
  const balance = await ethers.provider.getBalance(address);
  console.log("ETH Balance:", ethers.formatEther(balance));

  const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const usdc = await ethers.getContractAt([
    "function balanceOf(address) view returns (uint256)"
  ], usdcAddress);
  const usdcBalance = await usdc.balanceOf(address);
  console.log("USDC Balance:", Number(usdcBalance) / 1e6);
}

main().catch(console.error);
