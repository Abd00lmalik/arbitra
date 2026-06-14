const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Using deployer address:", deployer.address);

  const targetVerifier = "0x7e0Af9e55184b2b4bd5bac455493c035d51eee3E";

  // 1. Authorize on MockKYBOracle
  const oracleAddress = "0x27eB4eA7966C5d8700625567dFE6bD87f9Efaed3";
  console.log(`Configuring MockKYBOracle at ${oracleAddress}...`);
  const oracle = await hre.ethers.getContractAt("MockKYBOracle", oracleAddress, deployer);
  
  const currentBackend = await oracle.oracleBackend();
  if (currentBackend.toLowerCase() !== targetVerifier.toLowerCase()) {
    console.log(`- Updating backend from ${currentBackend} to ${targetVerifier}...`);
    const tx = await oracle.setOracleBackend(targetVerifier);
    await tx.wait();
    console.log("- Updated MockKYBOracle successfully!");
  } else {
    console.log("- MockKYBOracle already configured correctly.");
  }

  // 2. Authorize on ArbitraIdentity
  const identityAddress = "0x31dA844d811f94ff34e8B3E84aC9a5fcB5eAB584";
  console.log(`Configuring ArbitraIdentity at ${identityAddress}...`);
  const identity = await hre.ethers.getContractAt("ArbitraIdentity", identityAddress, deployer);

  const currentRelayer = await identity.complianceRelayer();
  if (currentRelayer.toLowerCase() !== targetVerifier.toLowerCase()) {
    console.log(`- Updating compliance relayer from ${currentRelayer} to ${targetVerifier}...`);
    const tx = await identity.setComplianceRelayer(targetVerifier);
    await tx.wait();
    console.log("- Updated ArbitraIdentity successfully!");
  } else {
    console.log("- ArbitraIdentity already configured correctly.");
  }

  // 3. Return excess ETH back to verifier
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Current Deployer Balance:", hre.ethers.formatEther(balance), "ETH");

  const keepLimit = hre.ethers.parseEther("0.03");
  if (balance > keepLimit) {
    const excess = balance - keepLimit;
    // Estimate gas for the transfer to avoid sending too much and reverting
    const gasLimit = 21000n;
    const feeData = await hre.ethers.provider.getFeeData();
    const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || hre.ethers.parseUnits("25", "gwei");
    const gasCost = gasLimit * gasPrice;

    if (excess > gasCost) {
      const transferAmount = excess - gasCost;
      console.log(`Returning excess of ${hre.ethers.formatEther(transferAmount)} ETH back to ${targetVerifier}...`);
      const tx = await deployer.sendTransaction({
        to: targetVerifier,
        value: transferAmount,
        gasLimit: gasLimit
      });
      await tx.wait();
      console.log("- Refund transaction successful!");
    } else {
      console.log("- Excess balance is less than transaction gas cost, skipping refund.");
    }
  } else {
    console.log("- Balance is below 0.03 ETH, no refund needed.");
  }

  const finalBalance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Final Deployer Balance:", hre.ethers.formatEther(finalBalance), "ETH");
}

main().catch(console.error);
