/**
 * @file 08_deploy_investor_sbt.ts
 * @description Hardhat deploy script to instantiate a separate SBT and Oracle for investors (Option B).
 *              Configures the circular reference between the investor token and oracle,
 *              and updates the core InvoiceRegistry contract to gate investor assessments using this token.
 */

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction }             from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network, ethers } = hre;
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("\n==================================================");
  console.log("Deploying Investor Identity Infrastructure (Option B)...");
  console.log("==================================================");

  /* 1. Deploy ArbitraInvestorSBT */
  const sbt = await deploy("ArbitraInvestorSBT", {
    contract: "ArbitraSBT",
    from: deployer,
    args: [deployer], /* initialOwner */
    log: true,
    waitConfirmations: network.name === "sepolia" ? 2 : 1,
  });
  console.log(`ArbitraInvestorSBT deployed at: ${sbt.address}`);

  /* 2. Configure Oracle Backend Address */
  let oracleBackend = process.env.ORACLE_BACKEND_ADDRESS;
  if (!oracleBackend && process.env.VERIFIER_PRIVATE_KEY) {
    const normalizedVerifierKey = process.env.VERIFIER_PRIVATE_KEY.trim().startsWith("0x")
      ? process.env.VERIFIER_PRIVATE_KEY.trim()
      : `0x${process.env.VERIFIER_PRIVATE_KEY.trim()}`;
    oracleBackend = new ethers.Wallet(normalizedVerifierKey).address;
  }

  if (!oracleBackend) {
    if (network.name === "sepolia") {
      throw new Error("ORACLE_BACKEND_ADDRESS or VERIFIER_PRIVATE_KEY must be set in env");
    } else {
      const signers = await ethers.getSigners();
      oracleBackend = signers[8] ? signers[8].address : deployer;
    }
  }

  /* 3. Deploy MockKYBOracleInvestor */
  const oracle = await deploy("MockKYBOracleInvestor", {
    contract: "MockKYBOracle",
    from: deployer,
    args: [deployer, sbt.address, oracleBackend],
    log: true,
    waitConfirmations: network.name === "sepolia" ? 2 : 1,
  });
  console.log(`MockKYBOracleInvestor deployed at: ${oracle.address}`);
  console.log(`Oracle backend authorized: ${oracleBackend}`);

  /* 4. Wire back the circular oracle reference on ArbitraInvestorSBT */
  const signer = await ethers.provider.getSigner(deployer);
  const sbtContract = await ethers.getContractAt("ArbitraSBT", sbt.address, signer);
  const currentOracle = await sbtContract.kybOracle();
  if (currentOracle !== oracle.address) {
    console.log(`Configuring kybOracle link on ArbitraInvestorSBT to: ${oracle.address}...`);
    const tx = await sbtContract.setKYBOracle(oracle.address);
    await tx.wait();
    console.log(`- Linked successfully!`);
  }

  /* 5. Configure sbtContract on ArbitraInvoiceRegistry */
  try {
    const registryDeployment = await get("ArbitraInvoiceRegistry");
    const registry = await ethers.getContractAt("ArbitraInvoiceRegistry", registryDeployment.address, signer);
    const currentRegistrySBT = await registry.sbtContract();
    
    if (currentRegistrySBT !== sbt.address) {
      console.log(`Updating sbtContract on InvoiceRegistry to Investor SBT: ${sbt.address}...`);
      const tx = await registry.setSBTContract(sbt.address);
      await tx.wait();
      console.log(`- InvoiceRegistry updated successfully!`);
    } else {
      console.log("- InvoiceRegistry already configured with Investor SBT.");
    }
  } catch (e) {
    console.log("- InvoiceRegistry not found, skipping SBT configuration.");
  }

  /* 6. Configure investorSbtContract on ArbitraIdentity */
  try {
    const identityDeployment = await get("ArbitraIdentity");
    const identity = await ethers.getContractAt("ArbitraIdentity", identityDeployment.address, signer);
    const currentInvestorSBT = await identity.investorSbtContract();
    
    if (currentInvestorSBT !== sbt.address) {
      console.log(`Updating investorSbtContract on ArbitraIdentity to Investor SBT: ${sbt.address}...`);
      const tx = await identity.setInvestorSBTContract(sbt.address);
      await tx.wait();
      console.log(`- ArbitraIdentity updated successfully!`);
    } else {
      console.log("- ArbitraIdentity already configured with Investor SBT.");
    }
  } catch (e) {
    console.log("- ArbitraIdentity not found, skipping Investor SBT configuration.");
  }
  
  console.log("Investor Onboarding Infrastructure deployment complete.\n");
};

func.tags = ["ArbitraInvestorSBT"];
func.dependencies = ["ArbitraInvoiceRegistry", "ArbitraIdentity"];
export default func;
