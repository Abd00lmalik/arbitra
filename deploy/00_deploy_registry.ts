/*
 * @file 00_deploy_registry.ts
 * @description Deploy script for all Arbitra v2.0 contracts and their inter-contract wiring.
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
 * Official Circle USDC on Sepolia.
 * The confidential wrapper is resolved or deployed separately in
 * deploy/09_deploy_cusdc.ts.
 */
const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network, ethers: hEthers } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const forceFreshSepoliaStack = process.env.ARBITRA_FORCE_FRESH_STACK === "true";
  let usdcAddress: string;

  if (network.name === "sepolia") {
    usdcAddress = USDC_SEPOLIA;
  } else {
    /* For local testing: deploy MockUSDC */
    const mockUSDC = await deploy("MockUSDC", {
      from: deployer, args: [], log: true, waitConfirmations: 1,
    });
    usdcAddress = mockUSDC.address;
    console.log(`(local) MockUSDC at ${usdcAddress}`);
  }

  let fpRegistryAddress: string;
  let riskCalcAddress: string;
  let vaultAddress: string;
  let escrowAddress: string;

  if (network.name === "sepolia") {
    if (forceFreshSepoliaStack) {
      console.log("\nARBITRA_FORCE_FRESH_STACK=true - deleting saved Sepolia deployment records for clean-state reset...");
      await deployments.delete("ArbitraFingerprintRegistry");
      await deployments.delete("ArbitraRiskCalculator");
      await deployments.delete("ArbitraCollateralVault");
      await deployments.delete("ArbitraEscrowReceiver");
      await deployments.delete("ArbitraInvoiceRegistry");
    }

    console.log(`\nDeploying FingerprintRegistry on Sepolia...`);
    const fpRegistryDeployment = await deploy("ArbitraFingerprintRegistry", {
      from: deployer,
      args: [],
      log: true,
      gasLimit: 3500000,
      waitConfirmations: 2,
    });
    fpRegistryAddress = fpRegistryDeployment.address;

    console.log(`\nDeploying RiskCalculator on Sepolia...`);
    const riskCalcDeployment = await deploy("ArbitraRiskCalculator", {
      from: deployer,
      args: [],
      log: true,
      gasLimit: 3500000,
      waitConfirmations: 2,
    });
    riskCalcAddress = riskCalcDeployment.address;

    console.log(`\nDeploying CollateralVault on Sepolia...`);
    const vaultDeployment = await deploy("ArbitraCollateralVault", {
      from: deployer,
      args: [usdcAddress],
      log: true,
      gasLimit: 3500000,
      waitConfirmations: 2,
    });
    vaultAddress = vaultDeployment.address;

    /* Deploy the NEW ArbitraEscrowReceiver bytecode on Sepolia */
    console.log(`\nDeploying EscrowReceiver on Sepolia...`);
    const escrowDeployment = await deploy("ArbitraEscrowReceiver", {
      from: deployer,
      args: [usdcAddress],
      log: true,
      gasLimit: 3500000,
      waitConfirmations: 2,
    });
    escrowAddress = escrowDeployment.address;
  } else {
    /* 1. Deploy FingerprintRegistry */
    const fpRegistryDeployment = await deploy("ArbitraFingerprintRegistry", {
      from: deployer, args: [], log: true, waitConfirmations: 1,
    });
    fpRegistryAddress = fpRegistryDeployment.address;

    /* 2. Deploy RiskCalculator */
    const riskCalcDeployment = await deploy("ArbitraRiskCalculator", {
      from: deployer, args: [], log: true, waitConfirmations: 1,
    });
    riskCalcAddress = riskCalcDeployment.address;

    /* 3. Deploy CollateralVault */
    const vaultDeployment = await deploy("ArbitraCollateralVault", {
      from: deployer, args: [usdcAddress], log: true, waitConfirmations: 1,
    });
    vaultAddress = vaultDeployment.address;

    /* 4. Deploy EscrowReceiver */
    const escrowDeployment = await deploy("ArbitraEscrowReceiver", {
      from: deployer, args: [usdcAddress], log: true, waitConfirmations: 1,
    });
    escrowAddress = escrowDeployment.address;
  }

  /* 5. Deploy main InvoiceRegistry */
  let platformVerifier = process.env.PLATFORM_VERIFIER_ADDRESS;
  const verifierPrivateKey = process.env.VERIFIER_PRIVATE_KEY;
  if (!platformVerifier && verifierPrivateKey && verifierPrivateKey.startsWith("0x")) {
    try {
      const verifierWallet = new hEthers.Wallet(verifierPrivateKey);
      platformVerifier = verifierWallet.address;
      console.log(`- Derived platformVerifier address from VERIFIER_PRIVATE_KEY: ${platformVerifier}`);
    } catch (e: any) {
      console.warn(`- Failed to derive platformVerifier from VERIFIER_PRIVATE_KEY: ${e.message}`);
    }
  }

  if (!platformVerifier) {
    if (network.name === "sepolia") {
      throw new Error("PLATFORM_VERIFIER_ADDRESS or VERIFIER_PRIVATE_KEY not set in env");
    } else {
      /* For local testing, use a known account (e.g. signer 9 or deployer) */
      const signers = await hEthers.getSigners();
      platformVerifier = signers[9] ? signers[9].address : deployer;
      console.log(`- Using local test verifier (signer 9 / deployer): ${platformVerifier}`);
    }
  }

  const registryDeployment = await deploy("ArbitraInvoiceRegistry", {
    from: deployer,
    args: [
      usdcAddress,
      fpRegistryAddress,
      riskCalcAddress,
      vaultAddress,
      escrowAddress,
      platformVerifier,
      deployer
    ],
    log: true,
    gasLimit: network.name === "sepolia" ? 5000000 : undefined,
    waitConfirmations: network.name === "sepolia" ? 2 : 1,
  });

  /* Wire up contracts if not done already */
  const signer = await hEthers.provider.getSigner(deployer);
  const fpRegistry = await hEthers.getContractAt("ArbitraFingerprintRegistry", fpRegistryAddress, signer);
  const collateralVault = await hEthers.getContractAt("ArbitraCollateralVault", vaultAddress, signer);
  const escrowReceiver = await hEthers.getContractAt("ArbitraEscrowReceiver", escrowAddress, signer);
  const registry = await hEthers.getContractAt("ArbitraInvoiceRegistry", registryDeployment.address, signer);

  console.log("\nWiring up contracts...");
  
  if ((await fpRegistry.arbitraRegistry()) !== registryDeployment.address) {
    console.log("- Setting Registry on FingerprintRegistry...");
    await (await fpRegistry.setRegistry(registryDeployment.address)).wait();
  }
  if ((await collateralVault.arbitraRegistry()) !== registryDeployment.address) {
    console.log("- Setting Registry on CollateralVault...");
    await (await collateralVault.setRegistry(registryDeployment.address)).wait();
  }
  if ((await escrowReceiver.arbitraRegistry()) !== registryDeployment.address) {
    console.log("- Setting Registry on EscrowReceiver...");
    await (await escrowReceiver.setRegistry(registryDeployment.address)).wait();
  }

  /* Robust target contracts wiring checks. */
  const currentFpRegistry = await registry.fpRegistry();
  const currentRiskCalc = await registry.riskCalc();
  const currentVault = await registry.collateralVault();
  const currentEscrow = await registry.escrowReceiver();

  if (
    currentFpRegistry !== fpRegistryAddress ||
    currentRiskCalc !== riskCalcAddress ||
    currentVault !== vaultAddress ||
    currentEscrow !== escrowAddress
  ) {
    console.log("- Configuring target contracts on InvoiceRegistry...");
    await (await registry.setContracts(
      fpRegistryAddress,
      riskCalcAddress,
      vaultAddress,
      escrowAddress
    )).wait();
  }

  /* Fix platformVerifier mismatch */
  if (platformVerifier) {
    const currentVerifier = await registry.platformVerifier();
    if (currentVerifier.toLowerCase() !== platformVerifier.toLowerCase()) {
      console.log(`- Updating platformVerifier from ${currentVerifier} to ${platformVerifier}...`);
      await (await registry.setPlatformVerifier(platformVerifier)).wait();
      console.log("- platformVerifier updated successfully.");
    } else {
      console.log(`- platformVerifier already correct: ${currentVerifier}`);
    }
  }

  try {
    let sbtDeployment;
    try {
      sbtDeployment = await deployments.get("ArbitraInvestorSBT");
    } catch {
      sbtDeployment = await deployments.get("ArbitraSBT");
    }
    if ((await registry.sbtContract()) !== sbtDeployment.address) {
      console.log(`- Configuring investor risk-access SBT on InvoiceRegistry: ${sbtDeployment.address}...`);
      await (await registry.setSBTContract(sbtDeployment.address)).wait();
    }
  } catch (e) {
    console.log("- No Arbitra SBT deployment found, skipping SBTContract configuration.");
  }

  console.log("\n====================================================");
  console.log("DEPLOYMENT COMPLETE - ADD TO VERCEL ENV VARIABLES:");
  console.log(`NEXT_PUBLIC_REGISTRY_ADDRESS=${registryDeployment.address}`);
  console.log(`NEXT_PUBLIC_USDC_ADDRESS=${usdcAddress}`);
  console.log(`NEXT_PUBLIC_RISK_CALC_ADDRESS=${riskCalcAddress}`);
  console.log(`NEXT_PUBLIC_FINGERPRINT_REGISTRY_ADDRESS=${fpRegistryAddress}`);
  console.log(`NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS=${vaultAddress}`);
  console.log(`NEXT_PUBLIC_ESCROW_RECEIVER_ADDRESS=${escrowAddress}`);
  console.log("NEXT_PUBLIC_CUSDC_ADDRESS=<run deploy/09_deploy_cusdc.ts>");
  console.log("====================================================\n");
};

func.tags = ["ArbitraInvoiceRegistry", "FingerprintRegistry", "RiskCalculator", "CollateralVault", "EscrowReceiver"];
export default func;
