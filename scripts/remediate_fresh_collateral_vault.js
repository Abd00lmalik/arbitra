/**
 * @file remediate_fresh_collateral_vault.js
 * @description Deploys and wires a fresh collateral vault for the active Arbitra registry.
 */

const hre = require("hardhat");

function parseGwei(value, fallback) {
  if (!value) {
    return fallback;
  }
  return hre.ethers.parseUnits(value, "gwei");
}

async function assertCleanVault(vault, registryAddress) {
  const linkedRegistry = await vault.arbitraRegistry();
  if (linkedRegistry.toLowerCase() !== registryAddress.toLowerCase()) {
    throw new Error(`Fresh vault registry mismatch: ${linkedRegistry}`);
  }

  for (const invoiceId of [1n, 2n, 3n]) {
    const stake = await vault.stakedCollateral(invoiceId);
    if (stake !== 0n) {
      throw new Error(`Fresh vault has unexpected stake at invoice ${invoiceId}: ${stake}`);
    }
  }
}

async function main() {
  const { ethers } = hre;
  const [owner] = await ethers.getSigners();

  const registryAddress = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
  const fpRegistryAddress = process.env.NEXT_PUBLIC_FINGERPRINT_REGISTRY_ADDRESS;
  const riskCalculatorAddress = process.env.NEXT_PUBLIC_RISK_CALCULATOR_ADDRESS || process.env.NEXT_PUBLIC_RISK_CALC_ADDRESS;
  const escrowReceiverAddress = process.env.NEXT_PUBLIC_ESCROW_RECEIVER_ADDRESS;
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

  if (!registryAddress || !fpRegistryAddress || !riskCalculatorAddress || !escrowReceiverAddress) {
    throw new Error("Missing registry, fingerprint registry, risk calculator, or escrow receiver address.");
  }

  const registry = await ethers.getContractAt("ArbitraInvoiceRegistry", registryAddress, owner);
  const registryOwner = await registry.owner();
  if (registryOwner.toLowerCase() !== owner.address.toLowerCase()) {
    throw new Error(`Signer ${owner.address} is not registry owner ${registryOwner}.`);
  }

  console.log("owner", owner.address);
  const ownerBalance = await ethers.provider.getBalance(owner.address);
  console.log("ownerBalance", ethers.formatEther(ownerBalance));
  console.log("registry", registryAddress);
  console.log("currentVault", await registry.collateralVault());

  const VaultFactory = await ethers.getContractFactory("ArbitraCollateralVault", owner);
  const deployTx = await VaultFactory.getDeployTransaction(usdcAddress);
  const estimatedDeployGas = await ethers.provider.estimateGas({ ...deployTx, from: owner.address });
  const fee = await ethers.provider.getFeeData();
  const maxFeePerGas = parseGwei("ARBITRA_MAX_FEE_GWEI" in process.env ? process.env.ARBITRA_MAX_FEE_GWEI : "", fee.maxFeePerGas ?? fee.gasPrice ?? 3_000_000_000n);
  const maxPriorityFeePerGas = parseGwei(
    "ARBITRA_PRIORITY_FEE_GWEI" in process.env ? process.env.ARBITRA_PRIORITY_FEE_GWEI : "",
    fee.maxPriorityFeePerGas ?? 1_000_000n,
  );
  const gasOptions = { maxFeePerGas, maxPriorityFeePerGas };
  const conservativeMaxFee = maxFeePerGas;
  const estimatedDeployCost = estimatedDeployGas * conservativeMaxFee;
  const minimumBalance = estimatedDeployCost + 600_000n * conservativeMaxFee;
  console.log("estimatedDeployGas", estimatedDeployGas.toString());
  console.log("feeCaps", {
    maxFeePerGas: maxFeePerGas.toString(),
    maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
  });
  console.log("estimatedMinimumBalance", ethers.formatEther(minimumBalance));

  if (ownerBalance < minimumBalance) {
    throw new Error(
      `Insufficient Sepolia ETH. Balance ${ethers.formatEther(ownerBalance)} ETH, need about ${ethers.formatEther(minimumBalance)} ETH.`,
    );
  }

  const vault = await VaultFactory.deploy(usdcAddress, gasOptions);
  await vault.waitForDeployment();
  const newVaultAddress = await vault.getAddress();
  console.log("newVault", newVaultAddress);

  const setVaultRegistryTx = await vault.setRegistry(registryAddress, gasOptions);
  await setVaultRegistryTx.wait(1);
  console.log("setVaultRegistryTx", setVaultRegistryTx.hash);

  const setContractsTx = await registry.setContracts(
    fpRegistryAddress,
    riskCalculatorAddress,
    newVaultAddress,
    escrowReceiverAddress,
    gasOptions,
  );
  await setContractsTx.wait(1);
  console.log("setContractsTx", setContractsTx.hash);

  await assertCleanVault(vault, registryAddress);
  const registryVault = await registry.collateralVault();
  if (registryVault.toLowerCase() !== newVaultAddress.toLowerCase()) {
    throw new Error(`Registry did not retain fresh vault: ${registryVault}`);
  }

  console.log(JSON.stringify({
    NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS: newVaultAddress,
    NEXT_PUBLIC_REGISTRY_ADDRESS: registryAddress,
    NEXT_PUBLIC_FINGERPRINT_REGISTRY_ADDRESS: fpRegistryAddress,
    NEXT_PUBLIC_RISK_CALCULATOR_ADDRESS: riskCalculatorAddress,
    NEXT_PUBLIC_ESCROW_RECEIVER_ADDRESS: escrowReceiverAddress,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
