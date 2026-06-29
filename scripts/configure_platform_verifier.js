/**
 * @file configure_platform_verifier.js
 * @description Checks or updates the invoice registry platform verifier on Sepolia.
 */

const { config } = require("dotenv");
const { ethers } = require("ethers");

config({ path: ".env.local" });
config({ path: "frontend/.env.local", override: false });

const REGISTRY_ABI = [
  "function owner() view returns (address)",
  "function platformVerifier() view returns (address)",
  "function setPlatformVerifier(address _verifier) external",
];

const DEFAULT_REGISTRY_ADDRESS = "0xDE46d22134f0a9595188aA96dFFAC82561172b9f";
const DEFAULT_PLATFORM_VERIFIER = "0x7e0Af9e55184b2b4bd5bac455493c035d51eee3E";
const DEFAULT_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

function requireAddress(value, label) {
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${label} must be a 20-byte hex address.`);
  }

  return value;
}

function getRpcUrl() {
  if (process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL) return process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;
  if (process.env.ALCHEMY_API_KEY) return `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
  return DEFAULT_RPC_URL;
}

async function main() {
  const registryAddress = requireAddress(
    process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ||
      process.env.ARBITRA_REGISTRY_ADDRESS ||
      DEFAULT_REGISTRY_ADDRESS,
    "registry address",
  );
  const targetVerifier = requireAddress(
    process.env.PLATFORM_VERIFIER_ADDRESS ||
      process.env.ORACLE_BACKEND_ADDRESS ||
      DEFAULT_PLATFORM_VERIFIER,
    "platform verifier",
  );

  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY is required to update the registry verifier.");
  }

  const provider = new ethers.JsonRpcProvider(getRpcUrl());
  const ownerWallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, ownerWallet);

  const [owner, currentVerifier, ownerBalance] = await Promise.all([
    registry.owner(),
    registry.platformVerifier(),
    provider.getBalance(ownerWallet.address),
  ]);

  console.log("Registry:", registryAddress);
  console.log("Owner:", owner);
  console.log("Owner wallet:", ownerWallet.address);
  console.log("Owner balance:", ethers.formatEther(ownerBalance), "ETH");
  console.log("Current platform verifier:", currentVerifier);
  console.log("Target platform verifier:", targetVerifier);

  if (owner.toLowerCase() !== ownerWallet.address.toLowerCase()) {
    throw new Error("DEPLOYER_PRIVATE_KEY does not match registry owner.");
  }

  if (currentVerifier.toLowerCase() === targetVerifier.toLowerCase()) {
    console.log("Registry already uses the target platform verifier.");
    return;
  }

  const tx = await registry.setPlatformVerifier(targetVerifier);
  console.log("Transaction:", tx.hash);
  const receipt = await tx.wait();
  console.log("Status:", receipt.status);
  console.log("New platform verifier:", await registry.platformVerifier());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
