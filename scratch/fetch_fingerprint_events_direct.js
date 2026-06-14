const rpcUrl = "https://eth-sepolia.g.alchemy.com/v2/yotZI2qyTxO9HqPMGJANO";
const FP_REGISTRY_ADDRESS = "0xe9ECB140583D81c2b7A81705CE8Bd4317CF3a720";
const EVENT_SIGNATURE_HASH = "0x9ef04d2e7fa82ea250dfbfab7f62e8417c8008d5192c7104bfa392877c23ffad"; // Keccak256 of FingerprintRegistered(uint256,address,uint256)

async function main() {
  console.log("Fetching logs directly from Alchemy for FP Registry:", FP_REGISTRY_ADDRESS);
  try {
    // Let's get the latest block number first
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
    
    // Call eth_getLogs block-by-block for the last 40 blocks
    console.log("Scanning last 40 blocks individually...");
    let foundLogsCount = 0;
    for (let b = latestBlock; b > latestBlock - 40; b--) {
      const bHex = "0x" + b.toString(16);
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
              fromBlock: bHex,
              toBlock: bHex,
              topics: [EVENT_SIGNATURE_HASH]
            }]
          })
        });
        
        const data = await response.json();
        if (data.result && data.result.length > 0) {
          const logs = data.result;
          foundLogsCount += logs.length;
          for (const log of logs) {
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
        }
      } catch (err) {
        console.error(`Error querying block ${b}:`, err.message);
      }
    }
    console.log(`Scan completed. Found ${foundLogsCount} events.`);
  } catch (err) {
    console.error("Failed to fetch logs:", err.message);
  }
}

main();
