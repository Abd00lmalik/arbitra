const { ethers } = require("hardhat");

async function main() {
  const vaultAddress = "0x1e8fdFAC6ecaac3fcf186B30A947000e4d604e88";
  const vault = await ethers.getContractAt([
    "event CollateralStaked(uint256 indexed invoiceId, address indexed supplier, uint256 amount)"
  ], vaultAddress);

  const latestBlock = await ethers.provider.getBlockNumber();
  console.log("Latest block:", latestBlock);

  // Scan the last 300 blocks block-by-block
  for (let i = 0; i < 300; i++) {
    const blockNum = latestBlock - i;
    const filter = vault.filters.CollateralStaked();
    
    try {
      const logs = await vault.queryFilter(filter, blockNum, blockNum);
      if (logs.length > 0) {
        for (const log of logs) {
          const supplier = log.args.supplier;
          console.log(`\nMATCH FOUND in block ${blockNum}:`, supplier);
          const balance = await ethers.provider.getBalance(supplier);
          console.log("ETH Balance:", ethers.formatEther(balance));
          return;
        }
      }
    } catch (err) {
      // ignore block fetch errors
    }
  }
  console.log("No staking events found in the last 300 blocks.");
}

main().catch(console.error);
