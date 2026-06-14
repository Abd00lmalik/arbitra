const { ethers } = require("hardhat");

async function main() {
  const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const usdc = await ethers.getContractAt([
    "event Approval(address indexed owner, address indexed spender, uint256 value)"
  ], usdcAddress);

  const latestBlock = await ethers.provider.getBlockNumber();
  console.log("Latest block:", latestBlock);

  // Scan the last 30 blocks block-by-block to avoid RPC range restrictions
  for (let i = 0; i < 30; i++) {
    const blockNum = latestBlock - i;
    const filter = usdc.filters.Approval();
    
    try {
      const logs = await usdc.queryFilter(filter, blockNum, blockNum);
      if (logs.length > 0) {
        for (const log of logs) {
          const owner = log.args.owner;
          if (owner.toLowerCase().startsWith("0xa6d5") || owner.toLowerCase().startsWith("0x8a6d5")) {
            console.log(`\nMATCH FOUND in block ${blockNum}:`, owner);
            const balance = await ethers.provider.getBalance(owner);
            console.log("ETH Balance:", ethers.formatEther(balance));
            return;
          }
        }
      }
    } catch (err) {
      console.warn(`Error scanning block ${blockNum}:`, err.message);
    }
  }
  console.log("No matching addresses found in the last 30 blocks.");
}

main().catch(console.error);
