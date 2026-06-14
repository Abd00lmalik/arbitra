const hre = require("hardhat");

async function main() {
  const REGISTRY_ADDRESS = "0x1A889b7A754578fB4d8AF18502314059926d041E";
  const FP_REGISTRY_ADDRESS = "0x1e0f6e137F588c369488bf76fab3b24805E5280f";
  const VAULT_ADDRESS = "0xAE64a9B5fB91D17Cb72463D82E733a7de6008CD0";
  const ESCROW_ADDRESS = "0x4FC7FF15BCD6e6d4968d93d6EAB8C89059Aec5A7";

  console.log("=== Checking Production Sepolia Contract Wiring ===");

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

  const fpRegistry = await hre.ethers.getContractAt([
    "function arbitraRegistry() external view returns (address)",
    "function fingerprintCount() external view returns (uint256)"
  ], FP_REGISTRY_ADDRESS);

  try {
    const regFp = await registry.fpRegistry();
    const regRisk = await registry.riskCalc();
    const regVault = await registry.collateralVault();
    const regEscrow = await registry.escrowReceiver();
    const regSbt = await registry.sbtContract();
    const regVerifier = await registry.platformVerifier();
    const regUsdc = await registry.usdc();
    const regCount = await registry.invoiceCount();

    console.log("ArbitraInvoiceRegistry (0x1A889...):");
    console.log("  fpRegistry:", regFp);
    console.log("  riskCalc:", regRisk);
    console.log("  collateralVault:", regVault);
    console.log("  escrowReceiver:", regEscrow);
    console.log("  sbtContract:", regSbt);
    console.log("  platformVerifier:", regVerifier);
    console.log("  usdc:", regUsdc);
    console.log("  invoiceCount:", regCount.toString());
  } catch (err) {
    console.error("Error reading from ArbitraInvoiceRegistry:", err.message || err);
  }

  try {
    const fpRegRegistry = await fpRegistry.arbitraRegistry();
    const fpRegCount = await fpRegistry.fingerprintCount();

    console.log("\nArbitraFingerprintRegistry (0x1e0f6...):");
    console.log("  arbitraRegistry:", fpRegRegistry);
    console.log("  fingerprintCount:", fpRegCount.toString());
  } catch (err) {
    console.error("Error reading from ArbitraFingerprintRegistry:", err.message || err);
  }
}

main().catch(console.error);
