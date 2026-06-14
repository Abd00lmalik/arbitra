const hre = require("hardhat");

async function main() {
  const verifier = "0x7e0Af9e55184b2b4bd5bac455493c035d51eee3E";
  const provider = hre.ethers.provider;

  const balance = await provider.getBalance(verifier);
  const txCount = await provider.getTransactionCount(verifier);
  const pendingTxCount = await provider.getTransactionCount(verifier, "pending");

  console.log("Verifier Address:", verifier);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH");
  console.log("Confirmed Transaction Count (Nonce):", txCount);
  console.log("Pending Transaction Count (Nonce):", pendingTxCount);

  // Get the SBT contract and check if the user already has a valid SBT
  const userWallet = "0x73092e88D49946ac32b6Eb1a394f81bb553e411a"; // Let's check deployer/user wallet
  const sbtAddress = "0xa2Fb6d7d6058e4407Ca685192308c0a5C346b530";
  const sbt = await hre.ethers.getContractAt("ArbitraSBT", sbtAddress);
  try {
    const hasSbt = await sbt.hasValidSBT(userWallet);
    console.log(`User wallet ${userWallet} has valid SBT:`, hasSbt);
  } catch (e) {
    console.error("Failed to check SBT:", e.message);
  }
}

main().catch(console.error);
