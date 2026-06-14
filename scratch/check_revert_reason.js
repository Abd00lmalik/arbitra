const hre = require("hardhat");

async function main() {
  const provider = hre.ethers.provider;
  const userAddress = "0x328f1245fe05ea8c9dbc7c203b4af1e6098a431e".toLowerCase();
  
  // Get active registry address
  const registryAddress = "0x31d17A1DB4d72c63FD4E484A324E06b55c27c9CA".toLowerCase();
  console.log("Registry Address:", registryAddress);

  // We can fetch the latest blocks and check their tx list
  const latestBlock = await provider.getBlockNumber();
  console.log("Latest Block:", latestBlock);

  let foundTxs = [];
  for (let i = latestBlock; i > latestBlock - 100; i--) {
    try {
      const block = await provider.getBlock(i, true);
      if (!block) continue;
      
      const txs = block.prefetchedTransactions || block.transactions;
      for (const tx of txs) {
        const txObj = typeof tx === "string" ? await provider.getTransaction(tx) : tx;
        if (txObj && txObj.to && txObj.to.toLowerCase() === registryAddress && txObj.from.toLowerCase() === userAddress) {
          foundTxs.push(txObj);
        }
      }
    } catch (err) {
      // ignore
    }
    if (foundTxs.length >= 2) break;
  }

  if (foundTxs.length === 0) {
    console.log("No recent transactions from user to registry found in last 100 blocks.");
    return;
  }

  for (const tx of foundTxs) {
    console.log(`\nTransaction Hash: ${tx.hash}`);
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
