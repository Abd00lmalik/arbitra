const hre = require("hardhat");

async function main() {
  const provider = hre.ethers.provider;
  const userAddress = "0x328f1245fe05ea8c9dbc7c203b4af1e6098a431e";
  const nonce = await provider.getTransactionCount(userAddress);
  console.log(`Current transaction count (nonce) of ${userAddress}: ${nonce}`);
}

main().catch(console.error);
