const { ethers } = require("hardhat");

async function main() {
  const vaultAddress = "0x1e8fdFAC6ecaac3fcf186B30A947000e4d604e88";
  const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  
  const usdc = await ethers.getContractAt([
    "function balanceOf(address) view returns (uint256)"
  ], usdcAddress);
  
  const balance = await usdc.balanceOf(vaultAddress);
  console.log("Vault USDC Balance:", Number(balance) / 1e6);

  // Also check user's raw USDC balance from this node
  const userAddress = "0xA6d55D0fC7C55F0A12117974B69dbf01E74Dc940";
  const userBalance = await usdc.balanceOf(userAddress);
  console.log("User USDC Balance:", Number(userBalance) / 1e6);
}

main().catch(console.error);
