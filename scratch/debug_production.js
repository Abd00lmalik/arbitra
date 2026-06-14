const hre = require("hardhat");

async function main() {
  const REGISTRY_ADDRESS = "0x1A889b7A754578fB4d8AF18502314059926d041E";
  const provider = hre.ethers.provider;

  console.log("Checking bytecode for:", REGISTRY_ADDRESS);
  const code = await provider.getCode(REGISTRY_ADDRESS);
  console.log("Bytecode length:", code.length);

  const registry = await hre.ethers.getContractAt([
    "function fpRegistry() external view returns (address)",
    "function riskCalc() external view returns (address)",
    "function collateralVault() external view returns (address)",
    "function escrowReceiver() external view returns (address)",
    "function sbtContract() external view returns (address)",
    "function platformVerifier() external view returns (address)",
    "function usdc() external view returns (address)",
    "function invoiceCount() external view returns (uint256)"
  ], REGISTRY_ADDRESS);

  const fns = [
    "fpRegistry",
    "riskCalc",
    "collateralVault",
    "escrowReceiver",
    "sbtContract",
    "platformVerifier",
    "usdc",
    "invoiceCount"
  ];

  for (const fn of fns) {
    try {
      const val = await registry[fn]();
      console.log(`  ${fn}: ${val}`);
    } catch (e) {
      console.log(`  ${fn} FAILED: ${e.message}`);
    }
  }
}

main().catch(console.error);
