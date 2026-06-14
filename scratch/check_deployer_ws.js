const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log("Deployer Address:", signer.address);
  const depBal = await hre.ethers.provider.getBalance(signer.address);
  console.log("Balance:", hre.ethers.formatEther(depBal), "ETH");

  const verifier = "0x7e0Af9e55184b2b4bd5bac455493c035d51eee3E";
  const verBal = await hre.ethers.provider.getBalance(verifier);
  console.log("Verifier Control Address:", verifier);
  console.log("Balance:", hre.ethers.formatEther(verBal), "ETH");
}

main().catch(console.error);
