const hre = require("hardhat");

async function checkContracts(label, vaultAddress, registryAddress) {
  console.log(`\n=== Checking ${label} ===`);
  try {
    const vault = await hre.ethers.getContractAt([
      "function usdc() external view returns (address)",
      "function arbitraRegistry() external view returns (address)",
      "function stakedCollateral(uint256 invoiceId) external view returns (uint256)",
      "function invoiceSupplier(uint256 invoiceId) external view returns (address)"
    ], vaultAddress);

    const registry = await hre.ethers.getContractAt([
      "function usdc() external view returns (address)",
      "function invoiceCount() external view returns (uint256)",
      "function collateralVault() external view returns (address)"
    ], registryAddress);

    const vaultUsdc = await vault.usdc();
    const vaultRegistry = await vault.arbitraRegistry();
    const registryUsdc = await registry.usdc();
    const registryVault = await registry.collateralVault();

    console.log(`Vault USDC address: ${vaultUsdc}`);
    console.log(`Vault Registry wired to: ${vaultRegistry}`);
    console.log(`Registry USDC address: ${registryUsdc}`);
    console.log(`Registry Vault wired to: ${registryVault}`);

    const count = await registry.invoiceCount();
    console.log(`Invoice count: ${count.toString()}`);
  } catch (err) {
    console.error(`Error checking ${label}:`, err.message || err);
  }
}

async function main() {
  const OLD_VAULT = "0xE17FCf5067eBc32853d1da38cf43ed9e05a1e2c8";
  const OLD_REGISTRY = "0xeA4fF37Da639d21564f1F3647a70259D0FDD92e0";

  const NEW_VAULT = "0xAE64a9B5fB91D17Cb72463D82E733a7de6008CD0";
  const NEW_REGISTRY = "0x1A889b7A754578fB4d8AF18502314059926d041E";

  await checkContracts("OLD CONTRACTS", OLD_VAULT, OLD_REGISTRY);
  await checkContracts("NEW CONTRACTS", NEW_VAULT, NEW_REGISTRY);
}

main().catch(console.error);
