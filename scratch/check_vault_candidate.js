/**
 * @file check_vault_candidate.js
 * @description Checks whether a Sepolia collateral vault candidate is safe for registry rewiring.
 */

const hre = require("hardhat");

async function main() {
  const { ethers } = hre;
  const [signer] = await ethers.getSigners();
  const vaultAddress = process.env.CANDIDATE_VAULT_ADDRESS || "0x1e8fdFAC6ecaac3fcf186B30A947000e4d604e88";
  const registryAddress = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
  const fingerprint = BigInt(process.env.ARBITRA_E2E_FINGERPRINT || "1782649999672390");

  const code = await ethers.provider.getCode(vaultAddress);
  console.log("candidateVault", vaultAddress);
  console.log("codeLength", code.length);
  if (code === "0x") {
    console.log("noCode", true);
    return;
  }

  const vault = await ethers.getContractAt("ArbitraCollateralVault", vaultAddress, signer);
  const owner = await vault.owner();
  const linkedRegistry = await vault.arbitraRegistry();
  console.log("signer", signer.address);
  console.log("owner", owner);
  console.log("arbitraRegistry", linkedRegistry);
  console.log("targetRegistry", registryAddress);
  console.log("usdc", await vault.usdc());
  console.log("fingerprintStake", (await vault.stakedCollateralByFingerprint(fingerprint)).toString());
  console.log("fingerprintSupplier", await vault.supplierByFingerprint(fingerprint));
  console.log("fingerprintState", (await vault.stakeStates(fingerprint)).toString());

  for (const invoiceId of [1n, 2n, 3n, 4n, 5n]) {
    console.log(JSON.stringify({
      invoiceId: invoiceId.toString(),
      stakedCollateral: (await vault.stakedCollateral(invoiceId)).toString(),
      invoiceSupplier: await vault.invoiceSupplier(invoiceId),
      stakeState: (await vault.stakeStates(invoiceId)).toString(),
    }));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
