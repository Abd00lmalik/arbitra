const userAddress = "0x328f1245fe05ea8c9dbc7c203b4af1e6098a431e";

async function main() {
  const url = `https://api.etherscan.io/v2/api?chainid=11155111&module=account&action=txlist&address=${userAddress}&sort=desc&apikey=yotZI2qyTxO9HqPMGJANO`; 
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "1") {
      console.log("Error from Etherscan:", data.message, data.result);
      const fallbackUrl = `https://api.etherscan.io/v2/api?chainid=11155111&module=account&action=txlist&address=${userAddress}&sort=desc`;
      const fbRes = await fetch(fallbackUrl);
      const fbData = await fbRes.json();
      console.log("Fallback results length:", fbData.result ? fbData.result.length : 0);
      if (fbData.result && fbData.result.length > 0) {
        printTxs(fbData.result);
      }
    } else {
      printTxs(data.result);
    }
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}

function printTxs(txs) {
  console.log(`\nFound ${txs.length} transactions:`);
  for (const tx of txs.slice(0, 15)) {
    console.log(`Hash: ${tx.hash}`);
    console.log(`  To: ${tx.to} (${tx.functionName || "No function name"})`);
    console.log(`  Block: ${tx.blockNumber}`);
    console.log(`  Status: ${tx.isError === "1" ? "FAILED" : "SUCCESS"}`);
    console.log(`  Time: ${new Date(tx.timeStamp * 1000).toISOString()}`);
  }
}

main();
