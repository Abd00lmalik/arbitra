const hre = require("hardhat");

async function main() {
  const provider = hre.ethers.provider;
  const userAddress = "0x328f1245fe05ea8c9dbc7c203b4af1e6098a431e".toLowerCase();
  const registryAddress = "0x31d17A1DB4d72c63FD4E484A324E06b55c27c9CA".toLowerCase();
  
  const latestBlock = await provider.getBlockNumber();
  console.log(`Latest block: ${latestBlock}`);
  console.log(`Scanning last 40 blocks for transactions from user: ${userAddress}`);
  
  let userTxs = [];
  
  // Scan 40 blocks
  for (let i = latestBlock; i > latestBlock - 40; i--) {
    try {
      const block = await provider.getBlock(i);
      if (!block) continue;
      
      const txHashes = block.transactions;
      if (!txHashes || txHashes.length === 0) continue;
      
      // Fetch details for all txs in block
      const txDetails = await Promise.all(
        txHashes.map(hash => provider.getTransaction(hash).catch(() => null))
      );
      
      for (const tx of txDetails) {
        if (tx && tx.from && tx.from.toLowerCase() === userAddress) {
          userTxs.push(tx);
        }
      }
    } catch (err) {
      console.error(`Error scanning block ${i}:`, err.message);
    }
  }
  
  console.log(`Found ${userTxs.length} transactions from user in the last 40 blocks.`);
  
  // Sort user transactions by block number descending
  userTxs.sort((a, b) => b.blockNumber - a.blockNumber);
  
  const regTx = userTxs.find(tx => tx.to && tx.to.toLowerCase() === registryAddress);
  if (!regTx) {
    console.log("No transactions found to the Invoice Registry in recent blocks.");
    console.log("Recent user transactions found:");
    userTxs.slice(0, 10).forEach(tx => {
      console.log(`Hash: ${tx.hash}, To: ${tx.to}, Block: ${tx.blockNumber}`);
    });
    return;
  }
  
  console.log("\nFound latest transaction to Invoice Registry:");
  console.log("Hash:", regTx.hash);
  console.log("From:", regTx.from);
  console.log("To:", regTx.to);
  console.log("Block Number:", regTx.blockNumber);
  
  const receipt = await provider.getTransactionReceipt(regTx.hash);
  console.log("Status:", receipt.status === 1 ? "Success" : "Failed (Reverted)");
  console.log("Gas Used:", receipt.gasUsed.toString());
  
  if (receipt.status === 0) {
    console.log("Transaction failed! Attempting to trace/re-run to get revert reason...");
    try {
      await provider.call({
        from: regTx.from,
        to: regTx.to,
        data: regTx.data,
        value: regTx.value,
        gasPrice: regTx.gasPrice,
        gasLimit: regTx.gasLimit,
        blockTag: regTx.blockNumber - 1
      });
      console.log("Call completed without error? (Should not happen if it reverted)");
    } catch (callErr) {
      console.log("Revert Reason/Error:", callErr.message);
      if (callErr.data) {
        console.log("Error Data:", callErr.data);
      }
    }
  } else {
    console.log("Transaction was successful.");
  }
}

main().catch(console.error);
