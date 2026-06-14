const { ethers } = require("hardhat");

async function main() {
  const fpRegistryAddress = "0xe1bb31A72899a0D3DF969b3705F321d35388874B";
  const riskCalcAddress = "0xFb9F6fFaf309843ad103c6aD99eD36Ba80335434";
  const vaultAddress = "0x1e8fdFAC6ecaac3fcf186B30A947000e4d604e88";
  const escrowAddress = "0xE3d7c0E21D892f788ee5d1e1FDa25c7fcFAaD7e0";
  const registryAddress = "0x3107aa8E07302A75c69DE95f56e0781466C51D9c";

  console.log("Wiring Sepolia smart contracts...");
  const signers = await ethers.getSigners();
  const signer = signers[0];
  console.log(`Using deployer signer: ${signer.address}`);

  /* ABI setups */
  const fpRegistry = await ethers.getContractAt([
    "function setRegistry(address _registry) external",
    "function arbitraRegistry() view returns (address)"
  ], fpRegistryAddress, signer);

  const collateralVault = await ethers.getContractAt([
    "function setRegistry(address _registry) external",
    "function arbitraRegistry() view returns (address)"
  ], vaultAddress, signer);

  const escrowReceiver = await ethers.getContractAt([
    "function setRegistry(address _registry) external",
    "function arbitraRegistry() view returns (address)"
  ], escrowAddress, signer);

  const registry = await ethers.getContractAt([
    "function setContracts(address _fpRegistry, address _riskCalc, address _collateralVault, address _escrowReceiver) external",
    "function fpRegistry() view returns (address)",
    "function riskCalc() view returns (address)",
    "function collateralVault() view returns (address)",
    "function escrowReceiver() view returns (address)"
  ], registryAddress, signer);

  /* Set Registry on FingerprintRegistry */
  const currentFpReg = await fpRegistry.arbitraRegistry();
  if (currentFpReg.toLowerCase() !== registryAddress.toLowerCase()) {
    console.log("- Setting registry on FingerprintRegistry...");
    const tx = await fpRegistry.setRegistry(registryAddress, { gasLimit: 100000 });
    await tx.wait();
    console.log("  Registry set successfully!");
  } else {
    console.log("- FingerprintRegistry already linked.");
  }

  /* Set Registry on CollateralVault */
  const currentVaultReg = await collateralVault.arbitraRegistry();
  if (currentVaultReg.toLowerCase() !== registryAddress.toLowerCase()) {
    console.log("- Setting registry on CollateralVault...");
    const tx = await collateralVault.setRegistry(registryAddress, { gasLimit: 100000 });
    await tx.wait();
    console.log("  Registry set successfully!");
  } else {
    console.log("- CollateralVault already linked.");
  }

  /* Set Registry on EscrowReceiver */
  const currentEscrowReg = await escrowReceiver.arbitraRegistry();
  if (currentEscrowReg.toLowerCase() !== registryAddress.toLowerCase()) {
    console.log("- Setting registry on EscrowReceiver...");
    const tx = await escrowReceiver.setRegistry(registryAddress, { gasLimit: 100000 });
    await tx.wait();
    console.log("  Registry set successfully!");
  } else {
    console.log("- EscrowReceiver already linked.");
  }

  /* Set Contracts on main Registry */
  const curFp = await registry.fpRegistry();
  const curRisk = await registry.riskCalc();
  const curVault = await registry.collateralVault();
  const curEscrow = await registry.escrowReceiver();

  if (
    curFp.toLowerCase() !== fpRegistryAddress.toLowerCase() ||
    curRisk.toLowerCase() !== riskCalcAddress.toLowerCase() ||
    curVault.toLowerCase() !== vaultAddress.toLowerCase() ||
    curEscrow.toLowerCase() !== escrowAddress.toLowerCase()
  ) {
    console.log("- Configuring target contracts on main Registry...");
    const tx = await registry.setContracts(
      fpRegistryAddress,
      riskCalcAddress,
      vaultAddress,
      escrowAddress,
      { gasLimit: 150000 }
    );
    await tx.wait();
    console.log("  Contracts configured successfully!");
  } else {
    console.log("- Main Registry already fully configured.");
  }

  console.log("\nWIRING COMPLETE!");
}

main().catch(console.error);
