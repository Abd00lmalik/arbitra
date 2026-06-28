/**
 * @file e2e_upload_coherent_stack.js
 * @description Runs a small Sepolia upload against the coherent Arbitra contract stack.
 */

const hre = require("hardhat");

async function main() {
  const { fhevm } = hre;
  await fhevm.initializeCLIApi();
  const [supplier] = await hre.ethers.getSigners();

  const registryAddr = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
  const vaultAddr = process.env.NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS;
  const fpRegistryAddr = process.env.NEXT_PUBLIC_FINGERPRINT_REGISTRY_ADDRESS;
  const usdcAddr = process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const zeroDebtor = "0x0000000000000000000000000000000000000000";

  if (!registryAddr || !vaultAddr || !fpRegistryAddr) {
    throw new Error("Missing coherent NEXT_PUBLIC contract addresses in .env.local.");
  }

  console.log("supplier", supplier.address);
  console.log("registry", registryAddr);
  console.log("vault", vaultAddr);
  console.log("fpRegistry", fpRegistryAddr);

  const usdc = await hre.ethers.getContractAt([
    "function approve(address,uint256) external returns (bool)",
    "function allowance(address,address) external view returns (uint256)",
    "function balanceOf(address) external view returns (uint256)",
  ], usdcAddr, supplier);
  const vault = await hre.ethers.getContractAt("ArbitraCollateralVault", vaultAddr, supplier);
  const fpRegistry = await hre.ethers.getContractAt("ArbitraFingerprintRegistry", fpRegistryAddr, supplier);
  const registry = await hre.ethers.getContractAt("ArbitraInvoiceRegistry", registryAddr, supplier);

  const now = BigInt(Math.floor(Date.now() / 1000));
  const requestedFingerprint = process.env.ARBITRA_E2E_FINGERPRINT;
  const fingerprint = requestedFingerprint
    ? BigInt(requestedFingerprint)
    : BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));
  const faceValue = 1_000_000n;
  const requiredCollateral = (faceValue * 500n) / 10000n;
  const dueDate = now + 30n * 86400n;

  const ethBalance = await hre.ethers.provider.getBalance(supplier.address);
  const usdcBalance = await usdc.balanceOf(supplier.address);
  console.log("ethBalance", hre.ethers.formatEther(ethBalance));
  console.log("usdcBalance", hre.ethers.formatUnits(usdcBalance, 6));
  console.log("fingerprint", fingerprint.toString());
  console.log("faceValue", faceValue.toString());
  console.log("requiredCollateral", requiredCollateral.toString());

  if (usdcBalance < requiredCollateral) {
    throw new Error("Supplier lacks test USDC for collateral.");
  }

  const existingStake = await vault.stakedCollateralByFingerprint(fingerprint);
  if (existingStake === 0n) {
    const allowance = await usdc.allowance(supplier.address, vaultAddr);
    if (allowance < requiredCollateral) {
      console.log("approve vault");
      const approveTx = await usdc.approve(vaultAddr, requiredCollateral);
      await approveTx.wait(1);
      console.log("approveTx", approveTx.hash);
    }

    console.log("stake collateral");
    const stakeTx = await vault.stakeCollateral(fingerprint, faceValue, { gasLimit: 180_000n });
    await stakeTx.wait(1);
    console.log("stakeTx", stakeTx.hash);
  } else {
    console.log("stake already pending", existingStake.toString());
  }

  console.log("encrypt duplicate check");
  const dupInput = fhevm.createEncryptedInput(fpRegistryAddr, supplier.address);
  dupInput.add64(fingerprint);
  dupInput.add64(faceValue);
  const dupEnc = await dupInput.encrypt();

  console.log("check uniqueness");
  const checkTx = await fpRegistry.checkInvoiceUniqueness(
    dupEnc.handles[0],
    dupEnc.inputProof,
    dupEnc.handles[1],
    dupEnc.inputProof,
    { gasLimit: 1_200_000n },
  );
  await checkTx.wait(1);
  console.log("checkTx", checkTx.hash);

  const nextInvoiceId = (await registry.invoiceCount()) + 1n;
  console.log("nextInvoiceId", nextInvoiceId.toString());

  console.log("confirm fingerprint");
  const confirmTx = await fpRegistry.confirmAndRegister(nextInvoiceId, { gasLimit: 300_000n });
  await confirmTx.wait(1);
  console.log("confirmTx", confirmTx.hash);

  console.log("encrypt upload");
  const uploadInput = fhevm.createEncryptedInput(registryAddr, supplier.address);
  uploadInput.add64(faceValue);
  uploadInput.add64(dueDate);
  uploadInput.add64(fingerprint);
  uploadInput.add64(300n);
  uploadInput.add64(5n);
  const uploadEnc = await uploadInput.encrypt();

  console.log("upload invoice");
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
    { gasLimit: 1_800_000n },
  );
  const uploadReceipt = await uploadTx.wait(1);
  console.log("uploadTx", uploadTx.hash, "status", uploadReceipt.status);

  const invoice = await registry.invoices(nextInvoiceId);
  console.log(JSON.stringify({
    invoiceId: nextInvoiceId.toString(),
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
