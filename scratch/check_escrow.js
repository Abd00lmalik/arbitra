const { ethers } = require("hardhat");

async function main() {
  const escrowAddress = "0x7e0Af9e55184b2b4bd5bac455493c035d51eee3E";
  const code = await ethers.provider.getCode(escrowAddress);
  console.log("Contract code length:", code.length);

  if (code !== "0x") {
    const escrow = await ethers.getContractAt([
      "function arbitraRegistry() view returns (address)",
      "function owner() view returns (address)"
    ], escrowAddress);

    try {
      const reg = await escrow.arbitraRegistry();
      console.log("Escrow currently points to registry:", reg);
    } catch (e) {
      console.log("No arbitraRegistry() view function found on escrow.");
    }

    try {
      const owner = await escrow.owner();
      console.log("Escrow owner:", owner);
    } catch (e) {
      console.log("No owner() view function found on escrow.");
    }
  }
}

main().catch(console.error);
