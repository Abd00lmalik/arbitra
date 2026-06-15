const hre = require("hardhat");

async function main() {
  const REGISTRY_1 = "0x8bE1232c5f85349727F7142e771317E5EE173F0C"; // frontend/.env.local
  const REGISTRY_2 = "0x90512d8b10Ae535FBDF4Ba5e36e5437303571124"; // deployments/sepolia

  const abi = ["function platformVerifier() external view returns (address)"];

  const contract1 = await hre.ethers.getContractAt(abi, REGISTRY_1);
  const contract2 = await hre.ethers.getContractAt(abi, REGISTRY_2);

  try {
    const v1 = await contract1.platformVerifier();
    console.log("Registry 1 (0x8bE12...): platformVerifier =", v1);
  } catch (e) {
    console.log("Registry 1 failed:", e.message);
  }

  try {
    const v2 = await contract2.platformVerifier();
    console.log("Registry 2 (0x90512...): platformVerifier =", v2);
  } catch (e) {
    console.log("Registry 2 failed:", e.message);
  }
}

main().catch(console.error);
