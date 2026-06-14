const { ethers } = require("hardhat");

async function main() {
  const addresses = {
    collateralVault: "0x1e8fdFAC6ecaac3fcf186B30A947000e4d604e88",
    escrowReceiver: "0x7e0Af9e55184b2b4bd5bac455493c035d51eee3E",
    riskCalculator: "0xccf8A348A566F6Bf319e33567B2159241E8dad84",
    fingerprintRegistry: "0x165b9238f8AD7276F31c170b3C86a4B2c796BF37",
    registry: "0x0FFc6B97bB9625C134D0E751afE0E19B64269CD4"
  };

  for (const [name, addr] of Object.entries(addresses)) {
    const code = await ethers.provider.getCode(addr);
    console.log(`${name} (${addr}): code length = ${code.length}`);
  }
}

main().catch(console.error);
