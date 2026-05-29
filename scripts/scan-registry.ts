import { ethers } from "hardhat";

const WRAPPERS_REGISTRY_SEPOLIA = "0x2f0750Bbb0A246059d80e94c454586a7F27a128e";

const REGISTRY_ABI = [
  {
    inputs: [{ internalType: "address", name: "token", type: "address" }],
    name: "getConfidentialTokenAddress",
    outputs: [
      { internalType: "bool", name: "found", type: "bool" },
      { internalType: "address", name: "confidentialToken", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
];

const KNOWN_TOKENS = [
  { name: "Standard Sepolia USDT", address: "0x7169D38820dfd117C3FA1f22a697dBA58d90BA06" },
  { name: "Aave Sepolia USDT", address: "0xaA8E23Fb1079EA71e0a56F48a2aa51851D8433D0" },
  { name: "Aave Sepolia USDC", address: "0x94a9D9AC8a228768A46fa4C6e3D8B84A22B0058b" },
  { name: "Circle Sepolia USDC", address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" },
  { name: "Mock USDC (old)", address: "0xda9d4f9b09ac000d276d49ba157978022d4f20ec" },
  { name: "Sepolia WETH", address: "0x7b79995e5f793a07bc00c21412e50ecae098e7f9" },
  { name: "Sepolia WBTC", address: "0x29f2d40b060cca9757af2337d1309fca9515949d" },
];

async function main() {
  console.log("Scanning Zama Wrappers Registry for registered tokens...");
  const registry = await ethers.getContractAt(REGISTRY_ABI, WRAPPERS_REGISTRY_SEPOLIA);

  for (const token of KNOWN_TOKENS) {
    try {
      const normalizedAddress = ethers.getAddress(token.address.toLowerCase());
      const [found, confidentialToken] = await registry.getConfidentialTokenAddress(normalizedAddress);
      if (found) {
        console.log(`✅ MATCH! ${token.name} (${normalizedAddress}) -> cToken: ${confidentialToken}`);
      } else {
        console.log(`❌ No match for ${token.name} (${normalizedAddress})`);
      }
    } catch (err: any) {
      console.log(`⚠️ Error checking ${token.name}: ${err.message || err}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
