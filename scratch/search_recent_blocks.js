const hre = require("hardhat");

async function main() {
  const provider = hre.ethers.provider;
  const userAddress = "0x328f1245fe05ea8c9dbc7c203b4af1e6098a431e".toLowerCase();
  
  const latestBlock = await provider.getBlockNumber();
  console.log("Latest Block on Sepolia:", latestBlock);

  console.log("Searching last 1000 blocks for transactions from:", userAddress);
  
  let foundTxs = [];
  // We can search in chunks or just query blocks. Since we have a fast Alchemy RPC, this should be quick.
  // To avoid too many calls, we can fetch blocks.
  for (let i = latestBlock; i > latestBlock - 1000; i--) {
    if (i % 100 === 0) {
      console.log(`Searching block ${i}...`);
    }
    try {
      const block = await provider.getBlock(i, true);
      if (!block) continue;
      
      const txs = block.prefetchedTransactions || block.transactions;
      for (const tx of txs) {
        const txObj = typeof tx === "string" ? await provider.getTransaction(tx) : tx;
        if (txObj && txObj.from && txObj.from.toLowerCase() === userAddress) {
          foundTxs.push(txObj);
          console.log(`\nFound TX from user at block ${i}:`);
          console.log(`Hash: ${txObj.hash}`);
          console.log(`To: ${txObj.to}`);
          console.log(`Value: ${hre.ethers.formatEther(txObj.value)} ETH`);
          console.log(`Nonce: ${txObj.nonce}`);
          
          const receipt = await provider.getTransactionReceipt(txObj.hash);
          console.log(`Status: ${receipt.status === 1 ? "SUCCESS" : "REVERTED"}`);
        }
      }
    } catch (err) {
      // ignore block errors
    }
    // Stop early if we find at least 5 transactions
    if (foundTxs.length >= 5) break;
  }

  if (foundTxs.length === 0) {
    console.log("No transactions from user found in the last 1000 blocks.");
  }
}

main().catch(console.error);
