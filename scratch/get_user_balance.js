const userAddress = "0x328f1245fe05ea8c9dbc7c203b4af1e6098a431e";
const rpcUrl = "https://sepolia.gateway.tenderly.co";

async function main() {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBalance",
        params: [userAddress, "latest"]
      })
    });
    const data = await response.json();
    if (data.result !== undefined) {
      const balanceWei = BigInt(data.result);
      const balanceEth = Number(balanceWei) / 1e18;
      console.log(`ETH Balance of ${userAddress} on Sepolia: ${balanceEth} ETH`);
    } else {
      console.log(`Failed: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.error("Failed to query balance:", err.message);
  }
}

main();
