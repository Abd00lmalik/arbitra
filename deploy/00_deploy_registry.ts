import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

/**
 * Deploy ArbitraInvoiceRegistry with the cUSDT address.
 *
 * On local hardhat/localhost:
 *   Deploys MockERC7984 as a stand-in for cUSDT.
 *
 * On Sepolia:
 *   Queries the Zama Wrappers Registry to resolve the real cUSDT address
 *   for the standard testnet USDT (0x7169D38820dfd117C3FA1f22a697dBA58d90BA06).
 *   Falls back to a MockERC7984 deployment if the registry lookup fails.
 */

/** Zama Wrappers Registry on Sepolia (source of truth for all confidential wrappers) */
const WRAPPERS_REGISTRY_SEPOLIA = "0x2f0750Bbb0A246059d80e94c454586a7F27a128e";

/**
 * Standard USDT on Sepolia testnet.
 * This is the underlying token whose confidential wrapper is cUSDT.
 */
const USDT_SEPOLIA = "0x7169D38820dfd117C3FA1f22a697dBA58d90BA06";

/**
 * Minimal ABI fragment for the Wrappers Registry.
 * getConfidentialTokenAddress returns (bool found, address confidentialToken).
 */
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
] as const;

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  let cUSDTAddress: string;

  if (network.name === "hardhat" || network.name === "localhost") {
    /* --- Local: deploy MockERC7984 --- */
    const mock = await deploy("MockERC7984", {
      from: deployer,
      args: [],
      log: true,
      waitConfirmations: 1,
    });
    cUSDTAddress = mock.address;
    console.log(`\nMockERC7984 (cUSDT stand-in) deployed at: ${cUSDTAddress}`);
  } else {
    /* --- Sepolia: resolve real cUSDT from Wrappers Registry --- */
    console.log(`\nQuerying Wrappers Registry at ${WRAPPERS_REGISTRY_SEPOLIA}...`);
    console.log(`Looking up cUSDT for underlying USDT at ${USDT_SEPOLIA}...`);

    const provider = hre.ethers.provider;
    const registry = new hre.ethers.Contract(
      WRAPPERS_REGISTRY_SEPOLIA,
      REGISTRY_ABI,
      provider
    );

    let resolvedFromRegistry = false;
    try {
      const [found, confidentialToken] = await registry.getConfidentialTokenAddress(USDT_SEPOLIA);
      if (found && confidentialToken !== "0x0000000000000000000000000000000000000000") {
        cUSDTAddress = confidentialToken;
        resolvedFromRegistry = true;
        console.log(`✅ cUSDT resolved from registry: ${cUSDTAddress}`);
      } else {
        console.warn(`⚠️  Registry returned not-found for USDT. Deploying MockERC7984 as fallback.`);
      }
    } catch (err) {
      console.warn(`⚠️  Registry query failed: ${err}. Deploying MockERC7984 as fallback.`);
    }

    if (!resolvedFromRegistry) {
      /* Override from env if set */
      const envOverride = process.env.CUSDT_SEPOLIA_ADDRESS;
      if (envOverride) {
        cUSDTAddress = envOverride;
        console.log(`Using CUSDT_SEPOLIA_ADDRESS from env: ${cUSDTAddress}`);
      } else {
        const mock = await deploy("MockERC7984", {
          from: deployer,
          args: [],
          log: true,
          waitConfirmations: 2,
        });
        cUSDTAddress = mock.address;
        console.log(`MockERC7984 (fallback) deployed at: ${cUSDTAddress}`);
      }
    }
  }

  const registry = await deploy("ArbitraInvoiceRegistry", {
    from: deployer,
    args: [cUSDTAddress],
    log: true,
    waitConfirmations: network.name === "sepolia" ? 2 : 1,
  });

  console.log(`\nArbitraInvoiceRegistry deployed at: ${registry.address}`);
  console.log(`Network: ${network.name}`);
  console.log(`cUSDT address: ${cUSDTAddress}`);
  console.log(`\nAdd to frontend/.env.local:`);
  console.log(`NEXT_PUBLIC_REGISTRY_ADDRESS=${registry.address}`);
  console.log(`NEXT_PUBLIC_CUSDT_ADDRESS=${cUSDTAddress}`);
};

func.tags = ["ArbitraInvoiceRegistry"];
export default func;
