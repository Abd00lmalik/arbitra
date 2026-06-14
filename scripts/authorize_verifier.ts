/**
 * @file authorize_verifier.ts
 * @description Script to authorize EOA 0x7e0Af9e55184b2b4bd5bac455493c035d51eee3E
 *              as the verifier/relayer across all Sepolia smart contracts.
 */

import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Using deployer address: ${deployer.address}`);

  const targetVerifier = "0x7e0Af9e55184b2b4bd5bac455493c035d51eee3E";

  const registryAddress = "0x5eC0a3Cc74C648178cdd5F05a0aae08e06a9cb93";
  const identityAddress = "0x31dA844d811f94ff34e8B3E84aC9a5fcB5eAB584";
  const oracleAddress   = "0xbB3cDdC1c5a1A7E8F2983B3aB6953A5c7a52ADa6";

  console.log(`\n--- Authorizing Verifier: ${targetVerifier} ---`);

  // 1. Update Platform Verifier on ArbitraInvoiceRegistry
  console.log(`Connecting to ArbitraInvoiceRegistry at ${registryAddress}...`);
  const registry = await ethers.getContractAt("ArbitraInvoiceRegistry", registryAddress, deployer);
  const currentPlatformVerifier = await registry.platformVerifier();
  console.log(`Current Platform Verifier: ${currentPlatformVerifier}`);

  if (currentPlatformVerifier.toLowerCase() !== targetVerifier.toLowerCase()) {
    console.log(`Updating platform verifier to ${targetVerifier}...`);
    const tx = await registry.setPlatformVerifier(targetVerifier);
    console.log(`Submitted tx: ${tx.hash}`);
    await tx.wait(2);
    console.log(`Confirmed!`);
  } else {
    console.log(`Already set correctly.`);
  }

  // 2. Update Compliance Relayer on ArbitraIdentity
  console.log(`\nConnecting to ArbitraIdentity at ${identityAddress}...`);
  const identity = await ethers.getContractAt("ArbitraIdentity", identityAddress, deployer);
  const currentRelayer = await identity.complianceRelayer();
  console.log(`Current Compliance Relayer: ${currentRelayer}`);

  if (currentRelayer.toLowerCase() !== targetVerifier.toLowerCase()) {
    console.log(`Updating compliance relayer to ${targetVerifier}...`);
    const tx = await identity.setComplianceRelayer(targetVerifier);
    console.log(`Submitted tx: ${tx.hash}`);
    await tx.wait(2);
    console.log(`Confirmed!`);
  } else {
    console.log(`Already set correctly.`);
  }

  // 3. Update Oracle Backend on MockKYBOracle
  console.log(`\nConnecting to MockKYBOracle at ${oracleAddress}...`);
  const oracle = await ethers.getContractAt("MockKYBOracle", oracleAddress, deployer);
  const currentBackend = await oracle.oracleBackend();
  console.log(`Current Oracle Backend: ${currentBackend}`);

  if (currentBackend.toLowerCase() !== targetVerifier.toLowerCase()) {
    console.log(`Updating oracle backend to ${targetVerifier}...`);
    const tx = await oracle.setOracleBackend(targetVerifier);
    console.log(`Submitted tx: ${tx.hash}`);
    await tx.wait(2);
    console.log(`Confirmed!`);
  } else {
    console.log(`Already set correctly.`);
  }

  console.log("\nVerifier authorization completed successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
