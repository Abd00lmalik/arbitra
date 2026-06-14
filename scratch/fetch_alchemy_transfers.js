const userAddress = "0x328f1245fe05ea8c9dbc7c203b4af1e6098a431e";
const rpcUrl = "https://eth-sepolia.g.alchemy.com/v2/yotZI2qyTxO9HqPMGJANO";

async function main() {
  console.log("Fetching asset transfers from Alchemy for:", userAddress);
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getAssetTransfers",
        params: [{
          fromAddress: userAddress,
          category: ["external"],
          order: "desc",
          maxCount: "0x5"
        }]
      })
    });
    
    const data = await response.json();
    if (data.error) {
      console.error("Alchemy API returned error:", data.error);
      return;
    }
    
    const transfers = data.result.transfers;
    console.log(`Found ${transfers.length} recent transfers:`);
    for (const tx of transfers) {
      console.log(`Hash: ${tx.hash}`);
      console.log(`  Block: ${parseInt(tx.blockNum, 16)}`);
      console.log(`  To: ${tx.to}`);
      console.log(`  Value: ${tx.value} ETH`);
      console.log(`  Asset: ${tx.asset}`);
      console.log("--------------------------------------");
    }
  } catch (err) {
    console.error("Failed to query Alchemy:", err.message);
  }
}

main();
