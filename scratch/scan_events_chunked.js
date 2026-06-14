const rpcUrl = "https://eth-sepolia.g.alchemy.com/v2/yotZI2qyTxO9HqPMGJANO";
const FP_REGISTRY_ADDRESS = "0xe9ECB140583D81c2b7A81705CE8Bd4317CF3a720";
const EVENT_SIGNATURE_HASH = "0x9ef04d2e7fa82ea250dfbfab7f62e8417c8008d5192c7104bfa392877c23ffad";

async function main() {
  console.log("Chunked event log scanning for FP Registry:", FP_REGISTRY_ADDRESS);
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
    
    // We will scan 2000 blocks back in chunks of 10 blocks
    const startBlock = latestBlock - 2000;
    const chunkSize = 10;
    let foundLogsCount = 0;
    
    console.log(`Scanning from block ${startBlock} to ${latestBlock} in chunks of 10...`);
    
    // We can do multiple chunk requests in parallel (e.g. 10 at a time) to speed it up
    const promises = [];
    for (let current = startBlock; current <= latestBlock; current += chunkSize) {
      const from = current;
      const to = Math.min(current + chunkSize - 1, latestBlock);
      
      const fromHex = "0x" + from.toString(16);
      const toHex = "0x" + to.toString(16);
      
      promises.push((async () => {
        try {
          const response = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 2,
              method: "eth_getLogs",
              params: [{
                address: FP_REGISTRY_ADDRESS,
                fromBlock: fromHex,
                toBlock: toHex,
                topics: [EVENT_SIGNATURE_HASH]
              }]
            })
          });
          const data = await response.json();
          if (data.result && data.result.length > 0) {
            return data.result;
          }
        } catch (err) {
          // ignore chunk failures
        }
        return [];
      })());
    }
    
    const results = await Promise.all(promises);
    const allLogs = results.flat();
    console.log(`Scan completed. Found ${allLogs.length} events:`);
    
    for (const log of allLogs) {
      console.log(`Block: ${parseInt(log.blockNumber, 16)}`);
      console.log(`Tx Hash: ${log.transactionHash}`);
      const invoiceId = BigInt(log.topics[1]);
      const supplier = "0x" + log.topics[2].slice(26);
      const timestamp = BigInt(log.data);
      console.log(`  Invoice ID: ${invoiceId.toString()}`);
      console.log(`  Supplier: ${supplier}`);
      console.log(`  Timestamp: ${new Date(Number(timestamp) * 1000).toISOString()}`);
      console.log("--------------------------------------");
    }
  } catch (err) {
    console.error("Scan failed:", err.message);
  }
}

main();
