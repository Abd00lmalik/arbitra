const hre = require("hardhat");

async function main() {
  const VAULT_ADDRESS = "0x1e8fdFAC6ecaac3fcf186B30A947000e4d604e88";
  const vault = await hre.ethers.getContractAt([
    "function stakedCollateral(uint256 invoiceId) external view returns (uint256)",
    "function stakeStates(uint256 id) external view returns (uint8)",
    "function invoiceSupplier(uint256 invoiceId) external view returns (address)"
  ], VAULT_ADDRESS);

  console.log("Querying pre-deployed CollateralVault state at:", VAULT_ADDRESS);
  try {
    for (let id = 1; id <= 5; id++) {
      const stake = await vault.stakedCollateral(id);
      const state = await vault.stakeStates(id);
      const supplier = await vault.invoiceSupplier(id);
      console.log(`Invoice ID ${id}:`);
      console.log(`  stakedCollateral: ${stake.toString()} (${Number(stake)/1e6} USDC)`);
      console.log(`  stakeState: ${state.toString()}`);
      console.log(`  supplier: ${supplier}`);
    }
  } catch (err) {
    console.error("Query failed:", err.message);
  }
}

main().catch(console.error);
