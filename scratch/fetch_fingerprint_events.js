const hre = require("hardhat");

async function main() {
  const FP_REGISTRY_ADDRESS = "0xe9ECB140583D81c2b7A81705CE8Bd4317CF3a720";
  const provider = hre.ethers.provider;

  console.log("Fetching FingerprintRegistered events from:", FP_REGISTRY_ADDRESS);

  // We can query events from the block the contract was deployed (e.g. latestBlock - 5000)
  const latestBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latestBlock - 10000);

  const fpRegistry = await hre.ethers.getContractAt([
    "event FingerprintRegistered(uint256 indexed invoiceId, address indexed supplier, uint256 timestamp)"
  ], FP_REGISTRY_ADDRESS);

  try {
    const filter = fpRegistry.filters.FingerprintRegistered();
    const events = await fpRegistry.queryFilter(filter, fromBlock, latestBlock);

    console.log(`Found ${events.length} FingerprintRegistered events in last 10,000 blocks:`);
    for (const event of events) {
      console.log(`Invoice ID: ${event.args.invoiceId.toString()}`);
      console.log(`Supplier: ${event.args.supplier}`);
      console.log(`Timestamp: ${new Date(Number(event.args.timestamp) * 1000).toISOString()}`);
      console.log(`Transaction Hash: ${event.transactionHash}`);
      console.log(`Block Number: ${event.blockNumber}`);
      console.log("--------------------------------------");
    }
  } catch (err) {
    console.error("Failed to query events:", err.message || err);
  }
}

main().catch(console.error);
