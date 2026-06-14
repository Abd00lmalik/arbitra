const hre = require("hardhat");

async function main() {
  const provider = hre.ethers.provider;
  const txHash = "0x3fcc512b94f9346083d0cfc5d2245217ec7cab02af22ae6a7c627bc2c26299d6";
  
  console.log("Fetching transaction receipt...");
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) {
    console.log("Transaction receipt not found.");
    return;
  }
  
  console.log(`Status: ${receipt.status === 1 ? "SUCCESS" : "REVERTED"}`);
  console.log(`Block: ${receipt.blockNumber}`);
  
  const tx = await provider.getTransaction(txHash);
  if (!tx) {
    console.log("Transaction data not found.");
    return;
  }
  
  console.log("Simulating transaction...");
  try {
    await provider.call({
      from: tx.from,
      to: tx.to,
      data: tx.data,
      value: tx.value,
      gasPrice: tx.gasPrice,
      gasLimit: tx.gasLimit,
      blockTag: tx.blockNumber - 1
    });
    console.log("Simulation succeeded? That's strange, it should revert.");
  } catch (err) {
    console.log("Revert reason:", err.message);
    if (err.data) {
      console.log("Revert data:", err.data);
    }
  }
}

main().catch(console.error);
