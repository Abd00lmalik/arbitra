/**
 * @file final_upload_existing_stake.js
 * @description Completes the Sepolia invoice upload using an already staked fingerprint.
 */

const hre = require("hardhat");

function parseGwei(value, fallback) {
  if (!value) {
    return fallback;
  }
  return hre.ethers.parseUnits(value, "gwei");
}

async function main() {
  const { fhevm, ethers } = hre;
  console.log("initialize fhevm");
  await fhevm.initializeCLIApi();
  console.log("fhevm ready");
  const [supplier] = await ethers.getSigners();

  const registryAddr = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
  const vaultAddr = process.env.NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS;
  const fpRegistryAddr = process.env.NEXT_PUBLIC_FINGERPRINT_REGISTRY_ADDRESS;
  if (!registryAddr || !vaultAddr || !fpRegistryAddr) {
    throw new Error("Missing coherent NEXT_PUBLIC contract addresses in .env.local.");
  }

  const registry = await ethers.getContractAt("ArbitraInvoiceRegistry", registryAddr, supplier);
  const vault = await ethers.getContractAt("ArbitraCollateralVault", vaultAddr, supplier);

  const fingerprint = BigInt(process.env.ARBITRA_E2E_FINGERPRINT || "1782649999672390");
  const faceValue = 1_000_000n;
  const dueDate = BigInt(Math.floor(Date.now() / 1000)) + 30n * 86400n;
  const zeroDebtor = "0x0000000000000000000000000000000000000000";

  console.log("supplier", supplier.address);
  console.log("ethBalance", ethers.formatEther(await ethers.provider.getBalance(supplier.address)));
  console.log("registry", registryAddr);
  console.log("vault", vaultAddr);
  console.log("fpRegistry", fpRegistryAddr);
  console.log("fingerprint", fingerprint.toString());
  console.log("invoiceCountBefore", (await registry.invoiceCount()).toString());
  console.log("existingStake", (await vault.stakedCollateralByFingerprint(fingerprint)).toString());
  console.log("supplierByFingerprint", await vault.supplierByFingerprint(fingerprint));

  const uploadInput = fhevm.createEncryptedInput(registryAddr, supplier.address);
  uploadInput.add64(faceValue);
  uploadInput.add64(dueDate);
  uploadInput.add64(fingerprint);
  uploadInput.add64(300n);
  uploadInput.add64(5n);
  const uploadEnc = await uploadInput.encrypt();

  const fee = await ethers.provider.getFeeData();
  const maxFeePerGas = parseGwei(
    process.env.ARBITRA_MAX_FEE_GWEI,
    fee.maxFeePerGas || ethers.parseUnits("8", "gwei"),
  );
  const maxPriorityFeePerGas = parseGwei(
    process.env.ARBITRA_PRIORITY_FEE_GWEI,
    fee.maxPriorityFeePerGas || ethers.parseUnits("0.1", "gwei"),
  );
  console.log("feeData", {
    gasPrice: fee.gasPrice?.toString(),
    maxFeePerGas: fee.maxFeePerGas?.toString(),
    maxPriorityFeePerGas: fee.maxPriorityFeePerGas?.toString(),
    cappedMaxFeePerGas: maxFeePerGas.toString(),
    cappedMaxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
  });

  const uploadTx = await registry.uploadInvoice(
    uploadEnc.handles[0],
    uploadEnc.inputProof,
    uploadEnc.handles[1],
    uploadEnc.inputProof,
    uploadEnc.handles[2],
    uploadEnc.inputProof,
    uploadEnc.handles[3],
    uploadEnc.inputProof,
    uploadEnc.handles[4],
    uploadEnc.inputProof,
    zeroDebtor,
    true,
    faceValue,
    fingerprint,
    800n,
    {
      gasLimit: 1_800_000n,
      maxFeePerGas,
      maxPriorityFeePerGas,
    },
  );
  console.log("uploadTx", uploadTx.hash);

  const uploadReceipt = await uploadTx.wait(1);
  console.log("uploadReceipt", {
    status: uploadReceipt.status,
    gasUsed: uploadReceipt.gasUsed.toString(),
    blockNumber: uploadReceipt.blockNumber,
  });

  const invoiceId = await registry.invoiceCount();
  const invoice = await registry.invoices(invoiceId);
  console.log(JSON.stringify({
    invoiceId: invoiceId.toString(),
    status: invoice.status.toString(),
    supplier: invoice.supplier,
    faceValuePlaintext: invoice.faceValuePlaintext.toString(),
    collateralStaked: invoice.collateralStaked,
    uploadTx: uploadTx.hash,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
