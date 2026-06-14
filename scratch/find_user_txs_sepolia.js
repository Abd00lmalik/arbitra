const rpcUrl = "https://ethereum-sepolia-rpc.publicnode.com";
const userAddress = "0x328f1245fe05ea8c9d0c7c203b4af1e6098a431e".toLowerCase();

async function main() {
  console.log("Searching recent blocks for transactions from:", userAddress);
  try {
    const blockResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_blockNumber",
        params: []
      })
    });
    const blockData = await blockResponse.json();
    const latestBlock = parseInt(blockData.result, 16);
    console.log("Latest block:", latestBlock);
    
    // Scan last 300 blocks
    const startBlock = latestBlock - 300;
    
    const promises = [];
    for (let b = startBlock; b <= latestBlock; b++) {
      const bHex = "0x" + b.toString(16);
      promises.push((async () => {
        try {
          const res = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: b,
              method: "eth_getBlockByNumber",
              params: [bHex, true]
            })
          });
          const data = await res.json();
          if (data.result && data.result.transactions) {
            const txs = data.result.transactions;
            const matches = txs.filter(tx => tx.from && tx.from.toLowerCase() === userAddress);
            if (matches.length > 0) {
              return { block: b, txs: matches };
            }
          }
        } catch (e) {
          // ignore block query failures
        }
        return null;
      })());
    }
    
    const results = (await Promise.all(promises)).filter(r => r !== null);
    console.log(`Found ${results.length} blocks with user transactions:`);
    for (const res of results) {
      console.log(`\nBlock ${res.block}:`);
      for (const tx of res.txs) {
        console.log(`  Hash: ${tx.hash}`);
        console.log(`  To: ${tx.to}`);
        console.log(`  Value: ${parseInt(tx.value, 16) / 1e18} ETH`);
        console.log(`  Nonce: ${parseInt(tx.nonce, 16)}`);
        
        // Fetch receipt to see status
        const receiptRes = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "eth_getTransactionReceipt",
            params: [tx.hash]
          })
        });
        const receiptData = await receiptRes.json();
        const status = parseInt(receiptData.result.status, 16);
        console.log(`  Status: ${status === 1 ? "SUCCESS" : "FAILED (REVERTED)"}`);
        console.log(`  Gas Used: ${parseInt(receiptData.result.gasUsed, 16)}`);
      }
    }
  } catch (err) {
    console.error("Scan failed:", err.message);
  }
}

main();
