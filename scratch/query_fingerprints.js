const hre = require("hardhat");

async function main() {
  const FP_REGISTRY_ADDRESS = "0xe9ECB140583D81c2b7A81705CE8Bd4317CF3a720";
  const REGISTRY_ADDRESS = "0x31d17A1DB4d72c63FD4E484A324E06b55c27c9CA";
  
  const fpRegistry = await hre.ethers.getContractAt([
    "function getFingerprint(uint256 invoiceId) external view returns (bytes32)",
    "function fingerprintCount() external view returns (uint256)"
  ], FP_REGISTRY_ADDRESS);

  const registry = await hre.ethers.getContractAt([
    "function invoiceCount() external view returns (uint256)"
  ], REGISTRY_ADDRESS);

  const fpCount = await fpRegistry.fingerprintCount();
  const invCount = await registry.invoiceCount();
  console.log("Fingerprint Registry Address:", FP_REGISTRY_ADDRESS);
  console.log("Invoice Registry Address:", REGISTRY_ADDRESS);
  console.log("Fingerprint Count:", fpCount.toString());
  console.log("Invoice Count:", invCount.toString());

  console.log("\nQuerying fingerprints for invoice IDs 1 to 5...");
  for (let id = 1; id <= 5; id++) {
    try {
      const fp = await fpRegistry.getFingerprint(id);
      console.log(`Invoice ID ${id}: ${fp}`);
    } catch (err) {
      console.log(`Invoice ID ${id} query failed:`, err.message);
    }
  }
}

main().catch(console.error);
