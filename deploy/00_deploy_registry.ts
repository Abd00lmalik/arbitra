/*
 * @file 00_deploy_registry.ts
 * @description Deploy script for all Arbitra v2.0 contracts and their inter-contract wiring.
 */

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction }             from "hardhat-deploy/types";

/*
 * Zama Wrappers Registry on Sepolia.
 * USDC on Sepolia (official Circle): 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
 * USDT on Sepolia (Zama underlying): 0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0
 */
const WRAPPERS_REGISTRY = "0x2f0750Bbb0A246059d80e94c454586a7F27a128e";
const USDC_SEPOLIA       = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const USDT_SEPOLIA       = "0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0";

/* Minimal ABI for getConfidentialTokenAddress */
const REGISTRY_ABI = [
  "function getConfidentialTokenAddress(address token) external view returns (bool found, address confidentialToken)"
];

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network, ethers: hEthers } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const signer = await hEthers.provider.getSigner(deployer);

  let cUSDCAddress: string;
  let usdcAddress: string;

  if (network.name === "sepolia") {
    usdcAddress = USDC_SEPOLIA;
    /* Query the Zama Wrappers Registry for the canonical cUSDC address */
    const registryContract = new hEthers.Contract(
      WRAPPERS_REGISTRY, REGISTRY_ABI,
      signer
    );
    
    console.log(`\nQuerying wrappers registry at ${WRAPPERS_REGISTRY} for USDC ${USDC_SEPOLIA}...`);
    try {
      const [found, confidentialToken] = await registryContract.getConfidentialTokenAddress(USDC_SEPOLIA);
      if (found && confidentialToken !== hEthers.ZeroAddress) {
        cUSDCAddress = confidentialToken;
        console.log(`- cUSDC address from Zama Wrappers Registry: ${cUSDCAddress}`);
      } else {
        console.log(`- cUSDC not found in Zama Wrappers Registry for USDC. Querying cUSDT as fallback...`);
        const [usdtFound, usdtConfidentialToken] = await registryContract.getConfidentialTokenAddress(USDT_SEPOLIA);
        if (usdtFound && usdtConfidentialToken !== hEthers.ZeroAddress) {
          cUSDCAddress = usdtConfidentialToken;
          console.log(`- Using cUSDT from Wrappers Registry as cUSDC fallback: ${cUSDCAddress}`);
        } else {
          cUSDCAddress = "0x4E7B06D78965594eB5EF5414c357ca21E1554491"; /* hardcoded fallback */
          console.log(`- Using hardcoded cUSDT address as fallback: ${cUSDCAddress}`);
        }
      }
    } catch (e: any) {
      console.warn(`- Registry query failed: ${e.message || e}. Using hardcoded fallback.`);
      cUSDCAddress = "0x4E7B06D78965594eB5EF5414c357ca21E1554491"; /* cUSDT fallback */
    }
  } else {
    /* For local testing: deploy MockUSDC */
    const mockUSDC = await deploy("MockUSDC", {
      from: deployer, args: [], log: true, waitConfirmations: 1,
    });
    usdcAddress = mockUSDC.address;

    /* Deploy MockERC7984 for cUSDC mock */
    const mockCUSDC = await deploy("MockERC7984", {
      from: deployer, args: [], log: true, waitConfirmations: 1,
    });
    cUSDCAddress = mockCUSDC.address;
    console.log(`(local) MockUSDC at ${usdcAddress}, MockERC7984 at ${cUSDCAddress}`);
  }

  let fpRegistryAddress: string;
  let riskCalcAddress: string;
  let vaultAddress: string;
  let escrowAddress: string;

  if (network.name === "sepolia") {
    /* Reuse pre-deployed addresses to conserve Sepolia ETH due to high gas prices */
    console.log(`\nDeploying FingerprintRegistry on Sepolia...`);
    const fpRegistryDeployment = await deploy("ArbitraFingerprintRegistry", {
      from: deployer,
      args: [],
      log: true,
      gasLimit: 1500000,
      waitConfirmations: 2,
    });
    fpRegistryAddress = fpRegistryDeployment.address;

    riskCalcAddress   = "0xFb9F6fFaf309843ad103c6aD99eD36Ba80335434";
    vaultAddress      = "0x1e8fdFAC6ecaac3fcf186B30A947000e4d604e88";
    console.log(`\nReusing pre-deployed Sepolia components:`);
    console.log(`- RiskCalculator: ${riskCalcAddress}`);
    console.log(`- CollateralVault: ${vaultAddress}`);

    console.log(`\nDeploying EscrowReceiver on Sepolia...`);
    const escrowDeployment = await deploy("ArbitraEscrowReceiver", {
      from: deployer,
      args: [usdcAddress],
      log: true,
      gasLimit: 1500000,
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
  if (!platformVerifier) {
    if (network.name === "sepolia") {
      throw new Error("PLATFORM_VERIFIER_ADDRESS not set in env");
    } else {
      /* For local testing, use a known account (e.g. signer 9 or deployer) */
      const signers = await hEthers.getSigners();
      platformVerifier = signers[9] ? signers[9].address : deployer;
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
      platformVerifier
    ],
    log: true,
    gasLimit: network.name === "sepolia" ? 4000000 : undefined,
    waitConfirmations: network.name === "sepolia" ? 2 : 1,
  });

  /* Wire up contracts if not done already */
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
  if ((await registry.fpRegistry()) !== fpRegistryAddress) {
    console.log("- Configuring target contracts on InvoiceRegistry...");
    await (await registry.setContracts(
      fpRegistryAddress,
      riskCalcAddress,
      vaultAddress,
      escrowAddress
    )).wait();
  }

  try {
    const sbtDeployment = await deployments.get("ArbitraSBT");
    if ((await registry.sbtContract()) !== sbtDeployment.address) {
      console.log("- Configuring SBTContract on InvoiceRegistry...");
      await (await registry.setSBTContract(sbtDeployment.address)).wait();
    }
  } catch (e) {
    console.log("- ArbitraSBT deployment not found, skipping SBTContract configuration.");
  }

  console.log("\n====================================================");
  console.log("DEPLOYMENT COMPLETE - ADD TO VERCEL ENV VARIABLES:");
  console.log(`NEXT_PUBLIC_REGISTRY_ADDRESS=${registryDeployment.address}`);
  console.log(`NEXT_PUBLIC_CUSDC_ADDRESS=${cUSDCAddress}`);
  console.log(`NEXT_PUBLIC_USDC_ADDRESS=${usdcAddress}`);
  console.log(`NEXT_PUBLIC_RISK_CALC_ADDRESS=${riskCalcAddress}`);
  console.log(`NEXT_PUBLIC_FINGERPRINT_REGISTRY_ADDRESS=${fpRegistryAddress}`);
  console.log(`NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS=${vaultAddress}`);
  console.log(`NEXT_PUBLIC_ESCROW_RECEIVER_ADDRESS=${escrowAddress}`);
  console.log("====================================================\n");
};

func.tags = ["ArbitraInvoiceRegistry", "FingerprintRegistry", "RiskCalculator", "CollateralVault", "EscrowReceiver"];
export default func;
