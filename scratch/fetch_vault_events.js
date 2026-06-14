const rpcUrl = "https://ethereum-sepolia-rpc.publicnode.com";
const VAULT_ADDRESS = "0x1e8fdFAC6ecaac3fcf186B30A947000e4d604e88";
const EVENT_SIGNATURE_HASH = "0x3454794e754a69c0d454646a7821c2bc8e03a9482f28a7e0db96666666666666"; // Will compute dynamically in script

async function main() {
  const { ethers } = require("ethers");
  const eventSig = "CollateralStaked(uint256,address,uint256)";
  const eventTopic = ethers.id(eventSig);
  
  console.log("Event signature hash for CollateralStaked:", eventTopic);
  console.log(`Querying vault events from ${rpcUrl} starting from block 11048090...`);
  
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getLogs",
        params: [{
          address: VAULT_ADDRESS,
          fromBlock: "0xa88d9a", // 11048090 in hex
          toBlock: "latest",
          topics: [eventTopic]
        }]
      })
    });
    
    const data = await response.json();
    if (data.error) {
      console.error("RPC returned error:", data.error);
      return;
    }
    
    const logs = data.result;
    console.log(`Found ${logs.length} CollateralStaked events:`);
    for (const log of logs) {
      const blockNum = parseInt(log.blockNumber, 16);
      const fingerprint = BigInt(log.topics[1]);
      const supplier = "0x" + log.topics[2].slice(26);
      const amount = BigInt(log.data);
      
      console.log(`Block: ${blockNum}`);
      console.log(`Tx Hash: ${log.transactionHash}`);
      console.log(`  Fingerprint: 0x${fingerprint.toString(16)}`);
      console.log(`  Supplier: ${supplier}`);
      console.log(`  Amount: ${Number(amount) / 1e6} USDC`);
      console.log("--------------------------------------");
    }
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}

main();
