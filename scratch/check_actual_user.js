const rpcUrl = "https://ethereum-sepolia-rpc.publicnode.com";
const userAddress = "0x328f1245fe05ea8c9d0c7c203b4af1e6098a431e";

async function main() {
  console.log("Checking actual user wallet details for:", userAddress);
  try {
    const responseNonce = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionCount",
        params: [userAddress, "latest"]
      })
    });
    const nonceData = await responseNonce.json();
    const nonce = parseInt(nonceData.result, 16);
    
    const responseBalance = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "eth_getBalance",
        params: [userAddress, "latest"]
      })
    });
    const balanceData = await responseBalance.json();
    const balanceWei = BigInt(balanceData.result);
    const balanceEth = Number(balanceWei) / 1e18;
    
    console.log(`Nonce (Transaction Count): ${nonce}`);
    console.log(`ETH Balance: ${balanceEth} ETH`);
  } catch (err) {
    console.error("Query failed:", err.message);
  }
}

main();
