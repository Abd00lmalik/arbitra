const hre = require("hardhat");

async function main() {
  const REGISTRY_ADDRESS = "0x8bE1232c5f85349727F7142e771317E5EE173F0C";
  
  const sbtAddress = "0xa2Fb6d7d6058e4407Ca685192308c0a5C346b530";
  console.log("Using ArbitraSBT address:", sbtAddress);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const registry = await hre.ethers.getContractAt([
    "function setSBTContract(address _sbt) external",
    "function sbtContract() external view returns (address)"
  ], REGISTRY_ADDRESS, deployer);

  const currentSbt = await registry.sbtContract();
  if (currentSbt.toLowerCase() === sbtAddress.toLowerCase()) {
    console.log("SBT Contract is already wired correctly!");
    return;
  }

  console.log(`Setting SBTContract on InvoiceRegistry to ${sbtAddress}...`);
  const tx = await registry.setSBTContract(sbtAddress);
  console.log("Transaction hash:", tx.hash);
  await tx.wait(1);
  console.log("SBT Contract wired successfully!");
}

main().catch(console.error);
