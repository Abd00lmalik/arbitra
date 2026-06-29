/**
 * @file configure_investor_sbt_access.js
 * @description Verifies and configures InvoiceRegistry risk access to use the investor SBT.
 */

const { ethers } = require("ethers");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../frontend/.env.local") });
dotenv.config({ path: path.join(__dirname, "../frontend/.env") });
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const REGISTRY_ADDRESS =
  process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ||
  process.env.REGISTRY_ADDRESS ||
  "0xDE46d22134f0a9595188aA96dFFAC82561172b9f";

const INVESTOR_SBT_ADDRESS =
  process.env.NEXT_PUBLIC_INVESTOR_SBT_ADDRESS ||
  process.env.INVESTOR_SBT_ADDRESS ||
  "0x52DfdBA750528207216f3d558D5f3aD04Be23e3b";

const RPC_URL =
  process.env.SEPOLIA_RPC_URL ||
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
  process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

const REGISTRY_ABI = [
  "function owner() view returns (address)",
  "function sbtContract() view returns (address)",
  "function setSBTContract(address _sbt) external",
];

async function main() {
  if (!RPC_URL) {
    throw new Error("Missing SEPOLIA_RPC_URL.");
  }
  if (!DEPLOYER_PRIVATE_KEY) {
    throw new Error("Missing DEPLOYER_PRIVATE_KEY.");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
  const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, wallet);
  const [owner, currentSbt, balance] = await Promise.all([
    registry.owner(),
    registry.sbtContract(),
    provider.getBalance(wallet.address),
  ]);

  console.log("Registry:", REGISTRY_ADDRESS);
  console.log("Current SBT:", currentSbt);
  console.log("Target investor SBT:", INVESTOR_SBT_ADDRESS);
  console.log("Signer:", wallet.address);
  console.log("Owner:", owner);
  console.log("Owner balance ETH:", ethers.formatEther(balance));

  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error("DEPLOYER_PRIVATE_KEY does not match registry owner.");
  }

  if (currentSbt.toLowerCase() === INVESTOR_SBT_ADDRESS.toLowerCase()) {
    console.log("InvoiceRegistry already uses investor SBT for risk access.");
    return;
  }

  const tx = await registry.setSBTContract(INVESTOR_SBT_ADDRESS);
  console.log("setSBTContract tx:", tx.hash);
  await tx.wait();

  const updatedSbt = await registry.sbtContract();
  console.log("Updated SBT:", updatedSbt);
  if (updatedSbt.toLowerCase() !== INVESTOR_SBT_ADDRESS.toLowerCase()) {
    throw new Error("InvoiceRegistry SBT update did not persist.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
