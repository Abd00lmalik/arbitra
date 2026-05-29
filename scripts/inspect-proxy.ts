import { ethers } from "hardhat";

const WRAPPERS_REGISTRY_SEPOLIA = "0x2f0750Bbb0A246059d80e94c454586a7F27a128e";

// EIP-1967 implementation slot
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
// EIP-1967 beacon slot
const BEACON_SLOT = "0xa3f0ad74a5890d8fdb54af7d544a2185d5642d97d1b19601519e317d0046520b";

async function main() {
  const provider = ethers.provider;
  console.log(`Querying storage slots for proxy at: ${WRAPPERS_REGISTRY_SEPOLIA}`);

  const implSlotValue = await provider.getStorage(WRAPPERS_REGISTRY_SEPOLIA, IMPLEMENTATION_SLOT);
  console.log(`Implementation Slot value: ${implSlotValue}`);
  
  const beaconSlotValue = await provider.getStorage(WRAPPERS_REGISTRY_SEPOLIA, BEACON_SLOT);
  console.log(`Beacon Slot value: ${beaconSlotValue}`);

  // Try to parse implementation address
  const implAddress = "0x" + implSlotValue.slice(26);
  console.log(`Parsed Implementation Address: ${implAddress}`);

  if (implAddress !== "0x0000000000000000000000000000000000000000") {
    const implCode = await provider.getCode(implAddress);
    console.log(`Implementation bytecode length: ${implCode.length} bytes`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
