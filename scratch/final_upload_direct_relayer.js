/**
 * @file final_upload_direct_relayer.js
 * @description Completes a Sepolia invoice upload with the relayer SDK node runtime.
 */

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { ethers } = require("ethers");
const { createInstance, SepoliaConfig } = require("@zama-fhe/relayer-sdk/node");

dotenv.config({ path: ".env.local" });

const logPath = path.join(process.cwd(), "scratch/final-upload-direct.log");

function log(...values) {
  const message = values.map((value) => (
    typeof value === "string" ? value : JSON.stringify(value)
  )).join(" ");
  fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`);
  console.log(...values);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

function parseGwei(value, fallback) {
  if (!value) {
    return fallback;
  }
  return ethers.parseUnits(value, "gwei");
}

function hexlifyBytes(value) {
  return ethers.hexlify(value);
}

function bumpGasLimit(estimated) {
  return (estimated * 120n) / 100n + 25_000n;
}

function loadAbi(artifactPath) {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  return artifact.abi;
}

async function main() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL || process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;
  const privateKey = requiredEnv("DEPLOYER_PRIVATE_KEY");
  const registryAddr = requiredEnv("NEXT_PUBLIC_REGISTRY_ADDRESS");
  const vaultAddr = requiredEnv("NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS");
  const fpRegistryAddr = requiredEnv("NEXT_PUBLIC_FINGERPRINT_REGISTRY_ADDRESS");
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const registryAbi = loadAbi(path.join(
    process.cwd(),
    "artifacts/contracts/ArbitraInvoiceRegistry.sol/ArbitraInvoiceRegistry.json",
  ));
  const vaultAbi = loadAbi(path.join(
    process.cwd(),
    "artifacts/contracts/ArbitraCollateralVault.sol/ArbitraCollateralVault.json",
  ));

  const registry = new ethers.Contract(registryAddr, registryAbi, wallet);
  const vault = new ethers.Contract(vaultAddr, vaultAbi, wallet);
  const fingerprint = BigInt(process.env.ARBITRA_E2E_FINGERPRINT || "1782711130654034");
  const faceValue = 1_000_000n;
  const dueDate = BigInt(Math.floor(Date.now() / 1000)) + 30n * 86400n;
  const zeroDebtor = "0x0000000000000000000000000000000000000000";

  log("supplier", wallet.address);
  log("ethBalance", ethers.formatEther(await provider.getBalance(wallet.address)));
  log("registry", registryAddr);
  log("vault", vaultAddr);
  log("fpRegistry", fpRegistryAddr);
  log("fingerprint", fingerprint.toString());
  log("invoiceCountBefore", (await registry.invoiceCount()).toString());
  log("existingStake", (await vault.stakedCollateralByFingerprint(fingerprint)).toString());
  log("supplierByFingerprint", await vault.supplierByFingerprint(fingerprint));

  log("create relayer instance");
  const instance = await createInstance({
    ...SepoliaConfig,
    network: rpcUrl,
  });

  log("encrypt upload inputs");
  const uploadInput = instance.createEncryptedInput(registryAddr, wallet.address);
  uploadInput.add64(faceValue);
  uploadInput.add64(dueDate);
  uploadInput.add64(fingerprint);
  uploadInput.add64(300n);
  uploadInput.add64(5n);
  const uploadEnc = await uploadInput.encrypt({
    onProgress: (args) => {
      log("proofProgress", `${args.type}:${args.step}/${args.totalSteps}`);
    },
  });

  const proof = hexlifyBytes(uploadEnc.inputProof);
  const handles = uploadEnc.handles.map(hexlifyBytes);
  const feeData = await provider.getFeeData();
  const defaultMaxFee = feeData.maxFeePerGas || ethers.parseUnits("8", "gwei");
  const defaultPriorityFee = feeData.maxPriorityFeePerGas || ethers.parseUnits("0.1", "gwei");
  const maxFeePerGas = parseGwei(process.env.ARBITRA_MAX_FEE_GWEI, defaultMaxFee);
  const maxPriorityFeePerGas = parseGwei(process.env.ARBITRA_PRIORITY_FEE_GWEI, defaultPriorityFee);
  const nonce = process.env.ARBITRA_TX_NONCE
    ? Number(process.env.ARBITRA_TX_NONCE)
    : await provider.getTransactionCount(wallet.address, "pending");

  const uploadArgs = [
    handles[0],
    proof,
    handles[1],
    proof,
    handles[2],
    proof,
    handles[3],
    proof,
    handles[4],
    proof,
    zeroDebtor,
    true,
    faceValue,
    fingerprint,
    800n,
  ];
  const estimatedGas = await registry.uploadInvoice.estimateGas(...uploadArgs);
  const gasLimit = process.env.ARBITRA_UPLOAD_GAS_LIMIT
    ? BigInt(process.env.ARBITRA_UPLOAD_GAS_LIMIT)
    : bumpGasLimit(estimatedGas);

  log("send upload", {
    nonce,
    estimatedGas: estimatedGas.toString(),
    gasLimit: gasLimit.toString(),
    maxFeePerGas: maxFeePerGas.toString(),
    maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
  });

  const uploadTx = await registry.uploadInvoice(
    ...uploadArgs,
    {
      gasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas,
      nonce,
    },
  );
  log("uploadTx", uploadTx.hash);

  const uploadReceipt = await uploadTx.wait(1);
  log("uploadReceipt", {
    status: uploadReceipt.status,
    gasUsed: uploadReceipt.gasUsed.toString(),
    blockNumber: uploadReceipt.blockNumber,
  });

  const invoiceId = await registry.invoiceCount();
  const invoice = await registry.invoices(invoiceId);
  log(JSON.stringify({
    invoiceId: invoiceId.toString(),
    status: invoice.status.toString(),
    supplier: invoice.supplier,
    faceValuePlaintext: invoice.faceValuePlaintext.toString(),
    collateralStaked: invoice.collateralStaked,
    uploadTx: uploadTx.hash,
  }, null, 2));
}

main().catch((error) => {
  log(error.stack || error.message || String(error));
  process.exit(1);
});
