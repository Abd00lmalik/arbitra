const userAddress = "0x328f1245fe05ea8c9dbc7c203b4af1e6098a431e";

const rpcUrls = [
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://rpc.ankr.com/eth_sepolia",
  "https://sepolia.gateway.tenderly.co",
  "https://eth-sepolia.g.alchemy.com/v2/yotZI2qyTxO9HqPMGJANO"
];

async function main() {
  for (const url of rpcUrls) {
    console.log(`Trying RPC: ${url}...`);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getTransactionCount",
          params: [userAddress, "latest"]
        }),
        signal: AbortSignal.timeout(5000) // 5s timeout
      });
      const data = await response.json();
      if (data.result !== undefined) {
        const nonce = parseInt(data.result, 16);
        console.log(`SUCCESS! Nonce from ${url}: ${nonce}`);
        // Let's also check the latest block number
        const blockResponse = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "eth_blockNumber",
            params: []
          })
        });
        const blockData = await blockResponse.json();
        console.log(`Latest block: ${parseInt(blockData.result, 16)}`);
        break; // stop on first success
      } else {
        console.log(`Failed: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      console.log(`Failed: ${err.message}`);
    }
  }
}

main();
