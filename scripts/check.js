const hre = require("hardhat");

async function main() {
  const VAULT_ADDRESS = "0xe17fcf5067ebc32853d1da38cf43ed9e05a1e2c8";
  const REGISTRY_ADDRESS = "0xea4ff37da639d21564f1f3647a70259d0fdd92e0";

  const vault = await hre.ethers.getContractAt([
    "function stakedCollateral(uint256 invoiceId) external view returns (uint256)",
    "function invoiceSupplier(uint256 invoiceId) external view returns (address)"
  ], VAULT_ADDRESS);

  const registry = await hre.ethers.getContractAt([
    "function invoiceCount() external view returns (uint256)"
  ], REGISTRY_ADDRESS);

  const count = await registry.invoiceCount();
  console.log("Registry invoiceCount:", count.toString());

  for (let i = 1; i <= 10; i++) {
    const staked = await vault.stakedCollateral(i);
    const supplier = await vault.invoiceSupplier(i);
    console.log(`Invoice #${i}: staked = ${staked.toString()} USDC units, supplier = ${supplier}`);
  }
}

main().catch(console.error);
