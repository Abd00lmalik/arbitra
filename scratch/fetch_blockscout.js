const userAddress = "0x328f1245fe05ea8c9d0c7c203b4af1e6098a431e";

async function main() {
  const url = `https://eth-sepolia.blockscout.com/api?module=account&action=txlist&address=${userAddress}&sort=desc`;
  console.log("Fetching transactions from Blockscout for:", userAddress);
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "1" || !data.result) {
      console.log("Error from Blockscout:", data.message, data.result);
      return;
    }
    
    const txs = data.result;
    console.log(`\nFound ${txs.length} transactions:`);
    for (const tx of txs.slice(0, 10)) {
      console.log(`Hash: ${tx.hash}`);
      console.log(`  To: ${tx.to} (${tx.functionName || "No function name"})`);
      console.log(`  Block: ${tx.blockNumber}`);
      console.log(`  Status: ${tx.txreceipt_status === "1" ? "SUCCESS" : "FAILED (REVERTED)"}`);
      console.log(`  Time: ${new Date(tx.timeStamp * 1000).toISOString()}`);
      console.log("--------------------------------------");
    }
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}

main();
