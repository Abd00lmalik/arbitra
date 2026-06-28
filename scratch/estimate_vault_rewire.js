/**
 * @file estimate_vault_rewire.js
 * @description Estimates and checks ownership for a fresh collateral vault rewire.
 */

const hre = require("hardhat");

async function main() {
  const { ethers } = hre;
  const [signer] = await ethers.getSigners();
  const registry = await ethers.getContractAt("ArbitraInvoiceRegistry", process.env.NEXT_PUBLIC_REGISTRY_ADDRESS, signer);
  const vault = await ethers.getContractAt("ArbitraCollateralVault", process.env.NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS, signer);
  const fpRegistry = await ethers.getContractAt("ArbitraFingerprintRegistry", process.env.NEXT_PUBLIC_FINGERPRINT_REGISTRY_ADDRESS, signer);

  console.log("signer", signer.address);
  console.log("balance", ethers.formatEther(await ethers.provider.getBalance(signer.address)));
  console.log("registryOwner", await registry.owner());
  console.log("vaultOwner", await vault.owner());
  console.log("fpRegistryOwner", await fpRegistry.owner());
  console.log("registryContracts", {
    fpRegistry: await registry.fpRegistry(),
    riskCalc: await registry.riskCalc(),
    collateralVault: await registry.collateralVault(),
    escrowReceiver: await registry.escrowReceiver(),
  });

  const VaultFactory = await ethers.getContractFactory("ArbitraCollateralVault");
  const deployTx = await VaultFactory.getDeployTransaction(process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238");
  const gas = await ethers.provider.estimateGas({ ...deployTx, from: signer.address });
  const fee = await ethers.provider.getFeeData();
  console.log("estimatedDeployVaultGas", gas.toString());
  console.log("feeData", {
    gasPrice: fee.gasPrice?.toString(),
    maxFeePerGas: fee.maxFeePerGas?.toString(),
    maxPriorityFeePerGas: fee.maxPriorityFeePerGas?.toString(),
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
