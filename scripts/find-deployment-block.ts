import { ethers } from "hardhat";

const TARGET_ADDRESS = "0x2f0750Bbb0A246059d80e94c454586a7F27a128e";

async function main() {
  const provider = ethers.provider;
  const latestBlock = await provider.getBlockNumber();
  console.log(`Latest block: ${latestBlock}`);

  let low = 0;
  let high = latestBlock;
  let deploymentBlock = -1;

  console.log("Finding deployment block via binary search...");
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const code = await provider.getCode(TARGET_ADDRESS, mid);
    if (code !== "0x") {
      deploymentBlock = mid;
      high = mid - 1; // look for earlier blocks
    } else {
      low = mid + 1; // look for later blocks
    }
  }

  if (deploymentBlock === -1) {
    console.error("Contract not found in history!");
    return;
  }

  console.log(`🎉 DEPLOYMENT BLOCK FOUND: ${deploymentBlock}`);

  // Now query logs from deploymentBlock to deploymentBlock + 5000
  console.log(`Querying logs from block ${deploymentBlock} to ${deploymentBlock + 5000}...`);
  try {
    const logs = await provider.getLogs({
      address: TARGET_ADDRESS,
      fromBlock: deploymentBlock,
      toBlock: deploymentBlock + 5000
    });
    
    console.log(`Found ${logs.length} logs.`);
    for (let i = 0; i < logs.length; i++) {
      console.log(`Log #${i}:`);
      console.log(`  Tx Hash: ${logs[i].transactionHash}`);
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
