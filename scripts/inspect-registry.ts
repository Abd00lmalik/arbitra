import { ethers } from "hardhat";

const WRAPPERS_REGISTRY_SEPOLIA = "0x2f0750Bbb0A246059d80e94c454586a7F27a128e";

async function main() {
  const provider = ethers.provider;
  console.log(`Checking address: ${WRAPPERS_REGISTRY_SEPOLIA}`);
  
  const code = await provider.getCode(WRAPPERS_REGISTRY_SEPOLIA);
  console.log(`Bytecode length: ${code.length} bytes (should be > 2 if deployed)`);
  if (code === "0x") {
    console.error("ERROR: No contract deployed at this address on this network!");
    return;
  }

  // Check if we can get logs
  console.log("Fetching recent events from registry...");
  try {
    const logs = await provider.getLogs({
      address: WRAPPERS_REGISTRY_SEPOLIA,
      fromBlock: 0, // start from 0 to scan everything on testnet
      toBlock: "latest"
    });
    console.log(`Found ${logs.length} logs/events in history.`);
    for (let i = 0; i < Math.min(logs.length, 10); i++) {
      console.log(`Log #${i}:`, logs[i]);
    }
  } catch (err: any) {
    console.warn("Error fetching logs:", err.message || err);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
