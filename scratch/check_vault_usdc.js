const { ethers } = require("hardhat");

async function main() {
  const vaultAddress = "0x1e8fdFAC6ecaac3fcf186B30A947000e4d604e88";
  const vault = await ethers.getContractAt([
    "function usdc() view returns (address)"
  ], vaultAddress);

  const usdcAddr = await vault.usdc();
  console.log("Vault USDC Address:", usdcAddr);
  
  // Also check if owner of vault is deployer
  const owner = await vault.owner();
  console.log("Vault Owner:", owner);
}

main().catch(console.error);
