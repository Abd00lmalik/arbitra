const { ethers } = require("hardhat");

async function main() {
  const address = ethers.getAddress("0xA6d54203673F8090D4bE438D95b6EF77C401c940".toLowerCase());
  const balance = await ethers.provider.getBalance(address);
  console.log("ETH Balance:", ethers.formatEther(balance));
  
  // Also check USDC balance
  const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const usdc = await ethers.getContractAt([
    "function balanceOf(address) view returns (uint256)"
  ], usdcAddress);
  const usdcBalance = await usdc.balanceOf(address);
  console.log("USDC Balance:", Number(usdcBalance) / 1e6);
}

main().catch(console.error);
