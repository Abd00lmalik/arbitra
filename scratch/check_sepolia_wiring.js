const hre = require("hardhat");

async function main() {
  const REGISTRY_ADDRESS = "0x31d17A1DB4d72c63FD4E484A324E06b55c27c9CA";
  const FP_REGISTRY_ADDRESS = "0xe9ECB140583D81c2b7A81705CE8Bd4317CF3a720";
  const VAULT_ADDRESS = "0x1e8fdFAC6ecaac3fcf186B30A947000e4d604e88";
  const ESCROW_ADDRESS = "0xE3d7c0E21D892f788ee5d1e1FDa25c7fcFAaD7e0";

  console.log("=== Checking Sepolia Contract Wiring ===");

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

  const vault = await hre.ethers.getContractAt([
    "function arbitraRegistry() external view returns (address)",
    "function usdc() external view returns (address)"
  ], VAULT_ADDRESS);

  const escrow = await hre.ethers.getContractAt([
    "function arbitraRegistry() external view returns (address)"
  ], ESCROW_ADDRESS);

  try {
    const regFp = await registry.fpRegistry();
    const regRisk = await registry.riskCalc();
    const regVault = await registry.collateralVault();
    const regEscrow = await registry.escrowReceiver();
    const regSbt = await registry.sbtContract();
    const regVerifier = await registry.platformVerifier();
    const regUsdc = await registry.usdc();
    const regCount = await registry.invoiceCount();

    console.log("ArbitraInvoiceRegistry:");
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

    console.log("\nArbitraFingerprintRegistry:");
    console.log("  arbitraRegistry:", fpRegRegistry);
    console.log("  fingerprintCount:", fpRegCount.toString());
  } catch (err) {
    console.error("Error reading from ArbitraFingerprintRegistry:", err.message || err);
  }

  try {
    const vaultRegistry = await vault.arbitraRegistry();
    const vaultUsdc = await vault.usdc();

    console.log("\nArbitraCollateralVault:");
    console.log("  arbitraRegistry:", vaultRegistry);
    console.log("  usdc:", vaultUsdc);
  } catch (err) {
    console.error("Error reading from ArbitraCollateralVault:", err.message || err);
  }

  try {
    const escrowRegistry = await escrow.arbitraRegistry();

    console.log("\nArbitraEscrowReceiver:");
    console.log("  arbitraRegistry:", escrowRegistry);
  } catch (err) {
    console.error("Error reading from ArbitraEscrowReceiver:", err.message || err);
  }
}

main().catch(console.error);
