const { ethers } = require("ethers");

const RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/yotZI2qyTxO9HqPMGJANO";
const VAULT_ADDRESS = "0xAE64a9B5fB91D17Cb72463D82E733a7de6008CD0";
const REGISTRY_ADDRESS = "0x1A889b7A754578fB4d8AF18502314059926d041E";

const VAULT_ABI = [
  "function stakedCollateral(uint256 invoiceId) external view returns (uint256)",
  "function invoiceSupplier(uint256 invoiceId) external view returns (address)"
];

const REGISTRY_ABI = [
  "function invoiceCount() external view returns (uint256)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);
  const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);

  const count = await registry.invoiceCount();
  console.log("Registry invoiceCount:", count.toString());

  console.log("\nDumping status for Invoice IDs 1 to 20:");
  for (let i = 1; i <= 20; i++) {
    const staked = await vault.stakedCollateral(i);
    const supplier = await vault.invoiceSupplier(i);
    if (staked > 0n) {
      console.log(`Invoice #${i}: STAKED = ${staked.toString()} USDC units, supplier = ${supplier}`);
    } else {
      console.log(`Invoice #${i}: FREE`);
    }
  }
}

main().catch(console.error);
