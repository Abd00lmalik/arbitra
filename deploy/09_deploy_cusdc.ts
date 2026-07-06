/*
 * @file 09_deploy_cusdc.ts
 * @description Deploys or discovers the Sepolia cUSDC wrapper for real Circle
 *              USDC, validates the wrapper against the intended underlying,
 *              then wires the wrapper into the fresh Arbitra vNext registry and
 *              escrow deployments.
 */

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../frontend/.env.local") });
dotenv.config({ path: path.join(__dirname, "../frontend/.env") });
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const WRAPPERS_REGISTRY = "0x2f0750Bbb0A246059d80e94c454586a7F27a128e";
const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const WRAPPERS_REGISTRY_ABI = [
  "function getConfidentialTokenAddress(address token) external view returns (bool found, address confidentialToken)",
];

const WRAPPER_ABI = [
  "function underlying() external view returns (address)",
  "function decimals() external view returns (uint8)",
];

const SETTER_AND_GETTER_ABI = [
  "function setCUsdc(address _cUsdc) external",
  "function cUsdc() external view returns (address)",
];

async function assertWrapperConfiguration(
  hre: HardhatRuntimeEnvironment,
  wrapperAddress: string,
  expectedUnderlying: string,
) {
  const wrapper = await hre.ethers.getContractAt(WRAPPER_ABI, wrapperAddress);
  const underlying = await wrapper.underlying();
  const decimals = await wrapper.decimals();

  if (underlying.toLowerCase() !== expectedUnderlying.toLowerCase()) {
    throw new Error(
      `cUSDC wrapper underlying mismatch. Expected ${expectedUnderlying}, got ${underlying}.`,
    );
  }

  if (Number(decimals) !== 6) {
    throw new Error(`cUSDC wrapper decimals mismatch. Expected 6, got ${decimals}.`);
  }
}

async function wireAndValidateTarget(
  hre: HardhatRuntimeEnvironment,
  contractName: string,
  contractAddress: string,
  wrapperAddress: string,
  signer: any,
) {
  const contract = new hre.ethers.Contract(contractAddress, SETTER_AND_GETTER_ABI, signer);
  const currentWrapper = await contract.cUsdc().catch(() => hre.ethers.ZeroAddress);

  if (currentWrapper.toLowerCase() !== wrapperAddress.toLowerCase()) {
    const tx = await contract.setCUsdc(wrapperAddress);
    await tx.wait();
  }

  const wiredWrapper = await contract.cUsdc();
  if (wiredWrapper.toLowerCase() !== wrapperAddress.toLowerCase()) {
    throw new Error(`${contractName} wiring failed. Expected ${wrapperAddress}, got ${wiredWrapper}.`);
  }
}

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network, ethers: hEthers } = hre;
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();
  const signer = await hEthers.provider.getSigner(deployer);

  const expectedUnderlying =
    network.name === "sepolia"
      ? USDC_SEPOLIA
      : (await get("MockUSDC")).address;

  let cUsdcAddress: string;

  if (network.name === "sepolia") {
    const wrappersRegistry = new hEthers.Contract(WRAPPERS_REGISTRY, WRAPPERS_REGISTRY_ABI, signer);
    const [found, confidentialToken] = await wrappersRegistry.getConfidentialTokenAddress(expectedUnderlying);

    if (found && confidentialToken !== hEthers.ZeroAddress) {
      cUsdcAddress = confidentialToken;
      console.log(`Using confidential USDC wrapper from registry: ${cUsdcAddress}`);
    } else {
      const deployment = await deploy("ArbitraConfidentialUSDC", {
        from: deployer,
        args: [expectedUnderlying],
        log: true,
        gasLimit: 4_000_000,
        waitConfirmations: 2,
      });
      cUsdcAddress = deployment.address;
      console.log(`Deployed ArbitraConfidentialUSDC wrapper: ${cUsdcAddress}`);
    }
  } else {
    const deployment = await deploy("ArbitraConfidentialUSDC", {
      from: deployer,
      args: [expectedUnderlying],
      log: true,
      waitConfirmations: 1,
    });
    cUsdcAddress = deployment.address;
    console.log(`Deployed local ArbitraConfidentialUSDC wrapper: ${cUsdcAddress}`);
  }

  await assertWrapperConfiguration(hre, cUsdcAddress, expectedUnderlying);

  const registryDeployment = await get("ArbitraInvoiceRegistry");
  const escrowDeployment = await get("ArbitraEscrowReceiver");

  await wireAndValidateTarget(hre, "ArbitraInvoiceRegistry", registryDeployment.address, cUsdcAddress, signer);
  await wireAndValidateTarget(hre, "ArbitraEscrowReceiver", escrowDeployment.address, cUsdcAddress, signer);

  console.log("\n====================================================");
  console.log("cUSDC WRAPPER READY:");
  console.log(`NEXT_PUBLIC_CUSDC_ADDRESS=${cUsdcAddress}`);
  console.log(`Wrapper underlying=${expectedUnderlying}`);
  console.log(`Registry=${registryDeployment.address}`);
  console.log(`Escrow=${escrowDeployment.address}`);
  console.log("====================================================\n");
};

func.tags = ["ArbitraConfidentialUSDC"];

export default func;
