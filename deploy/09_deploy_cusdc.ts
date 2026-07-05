/*
 * @file 09_deploy_cusdc.ts
 * @description Deploy script for ArbitraConfidentialUSDC (cUSDC) ERC-7984 wrapper.
 *              On Sepolia: queries the Zama Wrappers Registry first; if cUSDC already
 *              exists for the USDC address, uses that address and skips deployment.
 *              Then wires the deployed cUSDC address into both ArbitraInvoiceRegistry
 *              and ArbitraEscrowReceiver via their respective setCUsdc setters.
 */

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction }             from "hardhat-deploy/types";
import * as dotenv from "dotenv";
import * as path from "path";

/* Load environment variables from both root and frontend. */
dotenv.config({ path: path.join(__dirname, "../frontend/.env.local") });
dotenv.config({ path: path.join(__dirname, "../frontend/.env") });
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

/*
 * Zama Wrappers Registry on Sepolia.
 * Used to discover an already-deployed canonical cUSDC address before
 * deploying a fresh instance (avoids duplicate wrapper contracts).
 */
const WRAPPERS_REGISTRY = "0x2f0750Bbb0A246059d80e94c454586a7F27a128e";
const USDC_SEPOLIA       = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const REGISTRY_ABI = [
  "function getConfidentialTokenAddress(address token) external view returns (bool found, address confidentialToken)"
];

const SET_CUSDC_ABI = [
  "function setCUsdc(address _cUsdc) external"
];

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network, ethers: hEthers } = hre;
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();
  const signer = await hEthers.provider.getSigner(deployer);

  let cUsdcAddress: string;
  let usdcAddress: string;

  if (network.name === "sepolia") {
    usdcAddress = USDC_SEPOLIA;

    /* Query the Zama Wrappers Registry for a canonical cUSDC address */
    const wrappersRegistry = new hEthers.Contract(WRAPPERS_REGISTRY, REGISTRY_ABI, signer);
    console.log(`\nQuerying Wrappers Registry at ${WRAPPERS_REGISTRY} for USDC ${USDC_SEPOLIA}...`);

    let foundFromRegistry = false;
    try {
      const [found, confidentialToken] = await wrappersRegistry.getConfidentialTokenAddress(USDC_SEPOLIA);
      if (found && confidentialToken !== hEthers.ZeroAddress) {
        cUsdcAddress = confidentialToken;
        foundFromRegistry = true;
        console.log(`- cUSDC found in Wrappers Registry: ${cUsdcAddress}. Skipping deployment.`);
      }
    } catch (e: any) {
      console.warn(`- Wrappers Registry query failed: ${e.message || e}. Deploying fresh instance.`);
    }

    if (!foundFromRegistry!) {
      console.log(`\nDeploying ArbitraConfidentialUSDC on Sepolia with underlying=${usdcAddress}...`);
      const deployment = await deploy("ArbitraConfidentialUSDC", {
        from: deployer,
        args: [usdcAddress],
        log: true,
        gasLimit: 4_000_000,
        waitConfirmations: 2,
      });
      cUsdcAddress = deployment.address;
    }
  } else {
    /* Local network: use the MockUSDC deployed by 00_deploy_registry.ts */
    const mockUSDCDeployment = await get("MockUSDC").catch(async () => {
      /* Fallback: deploy a fresh MockUSDC if none exists */
      return await deploy("MockUSDC", { from: deployer, args: [], log: true, waitConfirmations: 1 });
    });
    usdcAddress = mockUSDCDeployment.address;

    console.log(`\nDeploying ArbitraConfidentialUSDC (local) with underlying=${usdcAddress}...`);
    const deployment = await deploy("ArbitraConfidentialUSDC", {
      from: deployer,
      args: [usdcAddress],
      log: true,
      waitConfirmations: 1,
    });
    cUsdcAddress = deployment.address;
  }

  console.log(`\ncUSDC address: ${cUsdcAddress}`);

  /* Wire cUSDC into ArbitraInvoiceRegistry */
  let registryAddress: string;
  try {
    const registryDeployment = await get("ArbitraInvoiceRegistry");
    registryAddress = registryDeployment.address;
  } catch {
    registryAddress = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ?? "";
  }

  if (registryAddress && registryAddress !== hEthers.ZeroAddress) {
    console.log(`\nCalling registry.setCUsdc(${cUsdcAddress})...`);
    const registry = new hEthers.Contract(registryAddress, SET_CUSDC_ABI, signer);
    const tx1 = await registry.setCUsdc(cUsdcAddress);
    await tx1.wait();
    console.log(`- Registry wired. tx: ${tx1.hash}`);
  } else {
    console.warn("- ArbitraInvoiceRegistry not found in deployments. Set NEXT_PUBLIC_REGISTRY_ADDRESS and run manually.");
  }

  /* Wire cUSDC into ArbitraEscrowReceiver */
  let escrowAddress: string;
  try {
    const escrowDeployment = await get("ArbitraEscrowReceiver");
    escrowAddress = escrowDeployment.address;
  } catch {
    escrowAddress = process.env.NEXT_PUBLIC_ESCROW_RECEIVER_ADDRESS ?? "";
  }

  if (escrowAddress && escrowAddress !== hEthers.ZeroAddress) {
    console.log(`\nCalling escrow.setCUsdc(${cUsdcAddress})...`);
    const escrow = new hEthers.Contract(escrowAddress, SET_CUSDC_ABI, signer);
    const tx2 = await escrow.setCUsdc(cUsdcAddress);
    await tx2.wait();
    console.log(`- Escrow wired. tx: ${tx2.hash}`);
  } else {
    console.warn("- ArbitraEscrowReceiver not found in deployments. Set NEXT_PUBLIC_ESCROW_RECEIVER_ADDRESS and run manually.");
  }

  console.log(`\n=== ArbitraConfidentialUSDC deployment complete ===`);
  console.log(`cUSDC: ${cUsdcAddress}`);
  console.log(`Add to frontend/.env.local: NEXT_PUBLIC_CUSDC_ADDRESS=${cUsdcAddress}`);
};

func.tags = ["ArbitraConfidentialUSDC"];

export default func;
