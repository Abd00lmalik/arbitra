/**
 * @file scan_vault_candidates.js
 * @description Scans known collateral vault addresses for clean Sepolia state.
 */

const hre = require("hardhat");

const CANDIDATES = [
  "0x5DbD519573770b7cE26D744C568e465566a86ddd",
  "0x1e8fdFAC6ecaac3fcf186B30A947000e4d604e88",
];

async function main() {
  const { ethers } = hre;
  const [signer] = await ethers.getSigners();

  for (const vaultAddress of CANDIDATES) {
    const code = await ethers.provider.getCode(vaultAddress);
    if (code === "0x") {
      console.log(JSON.stringify({ vaultAddress, hasCode: false }));
      continue;
    }

    try {
      const vault = await ethers.getContractAt("ArbitraCollateralVault", vaultAddress, signer);
      const firstFive = [];
      for (const invoiceId of [1n, 2n, 3n, 4n, 5n]) {
        firstFive.push({
          invoiceId: invoiceId.toString(),
          stakedCollateral: (await vault.stakedCollateral(invoiceId)).toString(),
          invoiceSupplier: await vault.invoiceSupplier(invoiceId),
          stakeState: (await vault.stakeStates(invoiceId)).toString(),
        });
      }

      console.log(JSON.stringify({
        vaultAddress,
        owner: await vault.owner(),
        registry: await vault.arbitraRegistry(),
        usdc: await vault.usdc(),
        firstFive,
      }, null, 2));
    } catch (error) {
      console.log(JSON.stringify({
        vaultAddress,
        error: error.message,
      }, null, 2));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
