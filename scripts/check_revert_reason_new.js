const hre = require("hardhat");

async function main() {
  const provider = hre.ethers.provider;
  const userAddress = "0x328f1245fe05ea8c9d0c7c203b4af1e6098a431e".toLowerCase();
  
  // We can check both registries or any transaction from the user
  const latestBlock = await provider.getBlockNumber();
  console.log("Latest Block:", latestBlock);

  let foundTxs = [];
  const searchBlocksCount = 1000;
  console.log(`Searching last ${searchBlocksCount} blocks...`);
  
  for (let i = latestBlock; i > latestBlock - searchBlocksCount; i--) {
    try {
      const block = await provider.getBlock(i, true);
      if (!block) continue;
      
      const txs = block.prefetchedTransactions || block.transactions;
      for (const tx of txs) {
        const txObj = typeof tx === "string" ? await provider.getTransaction(tx) : tx;
        if (txObj && txObj.from && txObj.from.toLowerCase() === userAddress) {
          foundTxs.push(txObj);
        }
      }
    } catch (err) {
      // ignore
    }
  }

  if (foundTxs.length === 0) {
    console.log("No recent transactions from user found in search range.");
    return;
  }

  console.log(`Found ${foundTxs.length} transactions from user:`);
  for (const tx of foundTxs) {
    console.log(`\nTransaction Hash: ${tx.hash}`);
    console.log(`To: ${tx.to}`);
    console.log(`Block: ${tx.blockNumber}`);
    const receipt = await provider.getTransactionReceipt(tx.hash);
    console.log(`Status: ${receipt.status === 1 ? "SUCCESS" : "REVERTED"}`);
    
    if (receipt.status === 0) {
      console.log("Simulating transaction to find revert reason...");
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
      } catch (err) {
        console.log("Revert reason:", err.message);
        if (err.data) {
          console.log("Revert data:", err.data);
        }
      }
    }
  }
}

main().catch(console.error);
