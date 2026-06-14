const rpcUrl = "https://ethereum-sepolia-rpc.publicnode.com";
const FP_REGISTRY_ADDRESS = "0xe9ECB140583D81c2b7A81705CE8Bd4317CF3a720";
const EVENT_SIGNATURE_HASH = "0x9ef04d2e7fa82ea250dfbfab7f62e8417c8008d5192c7104bfa392877c23ffad";

async function main() {
  console.log(`Querying logs from ${rpcUrl} starting from deployment block 11048090...`);
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getLogs",
        params: [{
          address: FP_REGISTRY_ADDRESS,
          fromBlock: "0xa88d9a", // 11048090 in hex
          toBlock: "latest",
          topics: [EVENT_SIGNATURE_HASH]
        }]
      })
    });
    
    const data = await response.json();
    if (data.error) {
      console.error("RPC returned error:", data.error);
      return;
    }
    
    const logs = data.result;
    console.log(`Found ${logs.length} events:`);
    for (const log of logs) {
      const blockNum = parseInt(log.blockNumber, 16);
      const invoiceId = BigInt(log.topics[1]);
      const supplier = "0x" + log.topics[2].slice(26);
      const timestamp = BigInt(log.data);
      
      console.log(`Block: ${blockNum}`);
      console.log(`Tx Hash: ${log.transactionHash}`);
      console.log(`  Invoice ID: ${invoiceId.toString()}`);
      console.log(`  Supplier: ${supplier}`);
      console.log(`  Timestamp: ${new Date(Number(timestamp) * 1000).toISOString()}`);
      console.log("--------------------------------------");
    }
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}

main();
