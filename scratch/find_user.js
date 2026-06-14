const { ethers } = require("hardhat");

async function main() {
  const oldRegistryAddress = "0x1A889b7A754578fB4d8AF18502314059926d041E";
  const oldRegistry = await ethers.getContractAt([
    "event InvoiceUploaded(uint256 indexed invoiceId, address indexed supplier, address indexed debtor, uint256 timestamp)"
  ], oldRegistryAddress);

  console.log("Querying events...");
  const filter = oldRegistry.filters.InvoiceUploaded();
  const events = await oldRegistry.queryFilter(filter, 5000000, "latest");
  
  console.log(`Found ${events.length} upload events.`);
  for (const event of events) {
    const supplier = event.args.supplier;
    if (supplier.toLowerCase().startsWith("0xa6d5") && supplier.toLowerCase().endsWith("c940")) {
      console.log("MATCH FOUND:", supplier);
      
      const balance = await ethers.provider.getBalance(supplier);
      console.log("ETH Balance:", ethers.formatEther(balance));
      
      const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
      const usdc = await ethers.getContractAt([
        "function balanceOf(address) view returns (uint256)"
      ], usdcAddress);
      const usdcBalance = await usdc.balanceOf(supplier);
      console.log("USDC Balance:", Number(usdcBalance) / 1e6);
    }
  }
}

main().catch(console.error);
