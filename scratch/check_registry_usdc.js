const { ethers } = require("hardhat");

async function main() {
  const registryAddress = "0x0FFc6B97bB9625C134D0E751afE0E19B64269CD4";
  const registry = await ethers.getContractAt([
    "function usdc() view returns (address)"
  ], registryAddress);

  const usdcAddr = await registry.usdc();
  console.log("Registry USDC Address:", usdcAddr);
}

main().catch(console.error);
