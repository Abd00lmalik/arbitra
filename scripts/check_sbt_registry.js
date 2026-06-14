const hre = require("hardhat");

async function main() {
  const sbtAddress = "0xa2Fb6d7d6058e4407Ca685192308c0a5C346b530";
  
  const sbt = await hre.ethers.getContractAt([
    "function arbitraRegistry() external view returns (address)",
    "function owner() external view returns (address)"
  ], sbtAddress);
  
  const registry = await sbt.arbitraRegistry();
  const ownerAddress = await sbt.owner();
  
  console.log("ArbitraSBT Address:", sbtAddress);
  console.log("Owner Address:", ownerAddress);
  console.log("Arbitra Registry set on SBT:", registry);
}

main().catch(console.error);
