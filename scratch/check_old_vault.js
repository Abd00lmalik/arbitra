const { ethers } = require("hardhat");

async function main() {
  const oldVaultAddress = "0xAE64a9B5fB91D17Cb72463D82E733a7de6008CD0";
  const oldVault = await ethers.getContractAt([
    "function usdc() view returns (address)"
  ], oldVaultAddress);

  try {
    const usdcAddr = await oldVault.usdc();
    console.log("Old Vault USDC Address:", usdcAddr);
  } catch (e) {
    console.error("Failed to query old vault usdc:", e.message);
  }
}

main().catch(console.error);
