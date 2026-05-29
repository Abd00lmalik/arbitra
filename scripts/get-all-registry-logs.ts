import { ethers } from "ethers";

const WRAPPERS_REGISTRY_SEPOLIA = "0x2f0750Bbb0A246059d80e94c454586a7F27a128e";
const PUBLIC_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const DEPLOYMENT_BLOCK = 10162129;
const CHUNK_SIZE = 50000;

async function main() {
  console.log(`Connecting to public Sepolia RPC: ${PUBLIC_RPC}...`);
  const provider = new ethers.JsonRpcProvider(PUBLIC_RPC);
  const latestBlock = await provider.getBlockNumber();
  console.log(`Latest block: ${latestBlock}`);

  console.log("Starting chunked log query...");
  let allLogs: any[] = [];

  for (let fromBlock = DEPLOYMENT_BLOCK; fromBlock <= latestBlock; fromBlock += CHUNK_SIZE) {
    const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, latestBlock);
    console.log(`Querying block range: ${fromBlock} to ${toBlock}...`);
    try {
      const logs = await provider.getLogs({
        address: WRAPPERS_REGISTRY_SEPOLIA,
        fromBlock,
        toBlock
      });
      if (logs.length > 0) {
        console.log(`Found ${logs.length} logs in this range.`);
        allLogs = allLogs.concat(logs);
      }
    } catch (err: any) {
      console.error(`Error querying range ${fromBlock}-${toBlock}:`, err.message || err);
    }
  }

  console.log(`\nScan complete! Found ${allLogs.length} total logs.`);
  for (let i = 0; i < allLogs.length; i++) {
    console.log(`Log #${i}:`);
    console.log(`  Tx Hash: ${allLogs[i].transactionHash}`);
    console.log(`  Block: ${allLogs[i].blockNumber}`);
    console.log(`  Topics:`, allLogs[i].topics);
    console.log(`  Data: ${allLogs[i].data}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
