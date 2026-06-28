/**
 * @file inspect_final_upload_revert.js
 * @description Inspects the current Sepolia state around the final upload revert.
 */

const hre = require("hardhat");

async function main() {
  const { ethers } = hre;
  const [supplier] = await ethers.getSigners();
  const registryAddr = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
  const vaultAddr = process.env.NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS;
  const fpRegistryAddr = process.env.NEXT_PUBLIC_FINGERPRINT_REGISTRY_ADDRESS;
  const fingerprint = BigInt(process.env.ARBITRA_E2E_FINGERPRINT || "1782649999672390");

  const registry = await ethers.getContractAt("ArbitraInvoiceRegistry", registryAddr, supplier);
  const vault = await ethers.getContractAt("ArbitraCollateralVault", vaultAddr, supplier);
  const fpRegistry = await ethers.getContractAt("ArbitraFingerprintRegistry", fpRegistryAddr, supplier);

  console.log("supplier", supplier.address);
  console.log("ethBalance", ethers.formatEther(await ethers.provider.getBalance(supplier.address)));
  console.log("invoiceCount", (await registry.invoiceCount()).toString());
  console.log("stakeByFingerprint", (await vault.stakedCollateralByFingerprint(fingerprint)).toString());
  console.log("supplierByFingerprint", await vault.supplierByFingerprint(fingerprint));
  console.log("stakeStateFingerprint", (await vault.stakeStates(fingerprint)).toString());

  for (const invoiceId of [1n, 2n, 3n]) {
    const invoice = await registry.invoices(invoiceId);
    const fingerprintHandle = await fpRegistry.getFingerprint(invoiceId);
    console.log(JSON.stringify({
      invoiceId: invoiceId.toString(),
      registrySupplier: invoice.supplier,
      registryStatus: invoice.status.toString(),
      registryCollateralStaked: invoice.collateralStaked,
      registryFaceValuePlaintext: invoice.faceValuePlaintext.toString(),
      vaultStake: (await vault.stakedCollateral(invoiceId)).toString(),
      vaultSupplier: await vault.invoiceSupplier(invoiceId),
      vaultStakeState: (await vault.stakeStates(invoiceId)).toString(),
      fingerprintHandle,
    }, null, 2));
  }

  const txHash = process.env.ARBITRA_REVERT_TX;
  if (txHash) {
    const tx = await ethers.provider.getTransaction(txHash);
    if (!tx) {
      console.log("revertTx", "not found");
      return;
    }

    try {
      const result = await ethers.provider.call({
        to: tx.to,
        from: tx.from,
        data: tx.data,
        gasLimit: tx.gasLimit,
        maxFeePerGas: tx.maxFeePerGas,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
      }, tx.blockNumber ? tx.blockNumber - 1 : undefined);
      console.log("ethCallResult", result);
    } catch (error) {
      console.log("ethCallError", {
        shortMessage: error.shortMessage,
        reason: error.reason,
        data: error.data,
        message: error.message,
      });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
