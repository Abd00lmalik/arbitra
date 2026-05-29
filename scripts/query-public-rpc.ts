import { ethers } from "ethers";

const WRAPPERS_REGISTRY_SEPOLIA = "0x2f0750Bbb0A246059d80e94c454586a7F27a128e";
const PUBLIC_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const DEPLOYMENT_BLOCK = 10162129;

async function main() {
  console.log(`Connecting to public Sepolia RPC: ${PUBLIC_RPC}...`);
  const provider = new ethers.JsonRpcProvider(PUBLIC_RPC);

  console.log(`Querying logs from block ${DEPLOYMENT_BLOCK} to ${DEPLOYMENT_BLOCK + 5000}...`);
  try {
    const logs = await provider.getLogs({
      address: WRAPPERS_REGISTRY_SEPOLIA,
      fromBlock: DEPLOYMENT_BLOCK,
      toBlock: DEPLOYMENT_BLOCK + 5000
    });
    
    console.log(`Found ${logs.length} historical logs.`);
    for (let i = 0; i < logs.length; i++) {
      console.log(`Log #${i}:`);
      console.log(`  Transaction Hash: ${logs[i].transactionHash}`);
      console.log(`  Block Number: ${logs[i].blockNumber}`);
      console.log(`  Topics:`, logs[i].topics);
      console.log(`  Data: ${logs[i].data}`);
    }
  } catch (err: any) {
    console.error("Error fetching logs:", err.message || err);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
