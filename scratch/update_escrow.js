const { ethers } = require("hardhat");

async function main() {
  const registryAddress = "0x0FFc6B97bB9625C134D0E751afE0E19B64269CD4";
  const fpRegistry = "0x165b9238f8AD7276F31c170b3C86a4B2c796BF37";
  const riskCalc = "0xccf8A348A566F6Bf319e33567B2159241E8dad84";
  const collateralVault = "0x1e8fdFAC6ecaac3fcf186B30A947000e4d604e88";
  const newEscrowReceiver = "0x7e0Af9e55184b2b4bd5bac455493c035d51eee3E";

  const [deployer] = await ethers.getSigners();
  console.log("Using deployer address:", deployer.address);

  const registry = await ethers.getContractAt([
    "function setContracts(address _fpRegistry, address _riskCalc, address _collateralVault, address _escrowReceiver) external",
    "function escrowReceiver() view returns (address)"
  ], registryAddress, deployer);

  console.log("Current escrow receiver:", await registry.escrowReceiver());
  
  console.log("Calling setContracts...");
  const tx = await registry.setContracts(fpRegistry, riskCalc, collateralVault, newEscrowReceiver);
  console.log("Tx hash:", tx.hash);
  await tx.wait(2);
  console.log("Contracts updated successfully! New escrow receiver on-chain:", await registry.escrowReceiver());
}

main().catch(console.error);
