const hre = require("hardhat");

async function main() {
  const verifierPrivateKey = process.env.VERIFIER_PRIVATE_KEY;
  if (!verifierPrivateKey) {
    console.error("VERIFIER_PRIVATE_KEY not set in environment!");
    return;
  }

  const verifierWallet = new hre.ethers.Wallet(verifierPrivateKey, hre.ethers.provider);
  const [deployer] = await hre.ethers.getSigners();

  console.log("Sending from Verifier:", verifierWallet.address);
  console.log("Sending to Deployer:", deployer.address);

  const tx = await verifierWallet.sendTransaction({
    to: deployer.address,
    value: hre.ethers.parseEther("0.09"),
  });

  console.log("Transaction Hash:", tx.hash);
  console.log("Waiting for confirmation...");
  await tx.wait();
  console.log("Transaction confirmed!");

  const depBal = await hre.ethers.provider.getBalance(deployer.address);
  console.log("New Deployer Balance:", hre.ethers.formatEther(depBal), "ETH");
}

main().catch(console.error);
