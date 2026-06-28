/**
 * @file check_sepolia_wiring.js
 * @description Verifies Sepolia deployment addresses are wired to one coherent Arbitra stack.
 */

const hre = require("hardhat");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../frontend/.env.local") });
dotenv.config({ path: path.join(__dirname, "../frontend/.env") });
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const AUX_ABI = [
  "function arbitraRegistry() external view returns (address)",
];

const REGISTRY_ABI = [
  "function fpRegistry() external view returns (address)",
  "function riskCalc() external view returns (address)",
  "function collateralVault() external view returns (address)",
  "function escrowReceiver() external view returns (address)",
  "function platformVerifier() external view returns (address)",
  "function sbtContract() external view returns (address)",
  "function usdc() external view returns (address)",
];

function requireAddress(name) {
  const value = process.env[name];
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${name} is missing or invalid.`);
  }
  return value;
}

function sameAddress(left, right) {
  return left.toLowerCase() === right.toLowerCase();
}

function reportCheck(label, actual, expected) {
  if (sameAddress(actual, expected)) {
    console.log(`  ok ${label}`);
    return true;
  }

  console.error(`  mismatch ${label}: actual ${actual}, expected ${expected}`);
  return false;
}

async function main() {
  const registryAddress = requireAddress("NEXT_PUBLIC_REGISTRY_ADDRESS");
  const escrowAddress = requireAddress("NEXT_PUBLIC_ESCROW_RECEIVER_ADDRESS");
  const fpRegistryAddress = requireAddress("NEXT_PUBLIC_FINGERPRINT_REGISTRY_ADDRESS");
  const vaultAddress = requireAddress("NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS");
  const verifierPrivateKey = process.env.VERIFIER_PRIVATE_KEY;

  console.log("=== Checking Arbitra Deployment and Contract Wiring ===");
  console.log(`  NEXT_PUBLIC_REGISTRY_ADDRESS:             ${registryAddress}`);
  console.log(`  NEXT_PUBLIC_ESCROW_RECEIVER_ADDRESS:      ${escrowAddress}`);
  console.log(`  NEXT_PUBLIC_FINGERPRINT_REGISTRY_ADDRESS: ${fpRegistryAddress}`);
  console.log(`  NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS:     ${vaultAddress}`);

  let derivedVerifier = "";
  if (verifierPrivateKey && verifierPrivateKey.startsWith("0x")) {
    derivedVerifier = new hre.ethers.Wallet(verifierPrivateKey).address;
    console.log(`  Derived verifier:                         ${derivedVerifier}`);
  }

  const registry = await hre.ethers.getContractAt(REGISTRY_ABI, registryAddress);
  const fpRegistry = await hre.ethers.getContractAt(AUX_ABI, fpRegistryAddress);
  const vault = await hre.ethers.getContractAt(AUX_ABI, vaultAddress);
  const escrow = await hre.ethers.getContractAt(AUX_ABI, escrowAddress);

  const regFp = await registry.fpRegistry();
  const regRisk = await registry.riskCalc();
  const regVault = await registry.collateralVault();
  const regEscrow = await registry.escrowReceiver();
  const regVerifier = await registry.platformVerifier();
  const fpRegistryRegistry = await fpRegistry.arbitraRegistry();
  const vaultRegistry = await vault.arbitraRegistry();
  const escrowRegistry = await escrow.arbitraRegistry();

  console.log("\nOn-chain values read:");
  console.log(`  registry.fpRegistry():             ${regFp}`);
  console.log(`  registry.riskCalc():               ${regRisk}`);
  console.log(`  registry.collateralVault():        ${regVault}`);
  console.log(`  registry.escrowReceiver():         ${regEscrow}`);
  console.log(`  registry.platformVerifier():       ${regVerifier}`);
  console.log(`  fpRegistry.arbitraRegistry():      ${fpRegistryRegistry}`);
  console.log(`  collateralVault.arbitraRegistry(): ${vaultRegistry}`);
  console.log(`  escrowReceiver.arbitraRegistry():  ${escrowRegistry}`);

  console.log("\n=== Wiring Verification Checks ===");
  const checks = [
    reportCheck("Registry -> FingerprintRegistry", regFp, fpRegistryAddress),
    reportCheck("FingerprintRegistry -> Registry", fpRegistryRegistry, registryAddress),
    reportCheck("Registry -> CollateralVault", regVault, vaultAddress),
    reportCheck("CollateralVault -> Registry", vaultRegistry, registryAddress),
    reportCheck("Registry -> EscrowReceiver", regEscrow, escrowAddress),
    reportCheck("EscrowReceiver -> Registry", escrowRegistry, registryAddress),
  ];

  if (derivedVerifier) {
    checks.push(reportCheck("Registry -> PlatformVerifier", regVerifier, derivedVerifier));
  } else {
    console.log("  skip Registry -> PlatformVerifier, VERIFIER_PRIVATE_KEY missing.");
  }

  if (!checks.every(Boolean)) {
    process.exitCode = 1;
    console.error("\nWIRING MISMATCH DETECTED.");
    return;
  }

  console.log("\nALL WIRING CHECKS PASSED.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
