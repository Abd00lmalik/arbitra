const { ethers } = require("hardhat");

async function main() {
  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
  const verifierKey = process.env.VERIFIER_PRIVATE_KEY;

  if (deployerKey) {
    const deployerWallet = new ethers.Wallet(deployerKey, ethers.provider);
    const deployerBal = await ethers.provider.getBalance(deployerWallet.address);
    console.log(`Deployer Address: ${deployerWallet.address}`);
    console.log(`Deployer Balance: ${ethers.formatEther(deployerBal)} ETH`);
  } else {
    console.log("No DEPLOYER_PRIVATE_KEY configured.");
  }

  if (verifierKey) {
    const verifierWallet = new ethers.Wallet(verifierKey, ethers.provider);
    const verifierBal = await ethers.provider.getBalance(verifierWallet.address);
    console.log(`Verifier Address: ${verifierWallet.address}`);
    console.log(`Verifier Balance: ${ethers.formatEther(verifierBal)} ETH`);
  } else {
    console.log("No VERIFIER_PRIVATE_KEY configured.");
  }
}

main().catch(console.error);
