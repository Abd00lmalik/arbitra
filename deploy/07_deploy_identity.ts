/**
 * @file 07_deploy_identity.ts
 * @description Hardhat deploy script for ArbitraIdentity, linking it to the SBT
 *              and configuring the authorized gasless compliance relayer.
 */

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction }             from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, ethers, getNamedAccounts, network } = hre;
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();

  const sbtDeployment = await get("ArbitraSBT");
  let complianceRelayer = process.env.COMPLIANCE_RELAYER_ADDRESS;

  if (!complianceRelayer && process.env.VERIFIER_PRIVATE_KEY) {
    const normalizedVerifierKey = process.env.VERIFIER_PRIVATE_KEY.trim().startsWith("0x")
      ? process.env.VERIFIER_PRIVATE_KEY.trim()
      : `0x${process.env.VERIFIER_PRIVATE_KEY.trim()}`;
    complianceRelayer = new ethers.Wallet(normalizedVerifierKey).address;
  }

  if (!complianceRelayer) {
    complianceRelayer = process.env.ORACLE_BACKEND_ADDRESS;
  }

  if (!complianceRelayer) {
    if (network.name === "sepolia") {
      throw new Error(
        "COMPLIANCE_RELAYER_ADDRESS, VERIFIER_PRIVATE_KEY, or ORACLE_BACKEND_ADDRESS must be set in env",
      );
    }

    const signers = await ethers.getSigners();
    complianceRelayer = signers[8] ? signers[8].address : deployer;
  }

  const identity = await deploy("ArbitraIdentity", {
    from: deployer,
    args: [deployer, sbtDeployment.address, complianceRelayer],
    log: true,
    waitConfirmations: network.name === "sepolia" ? 2 : 1,
  });

  console.log(`\nArbitraIdentity deployed at: ${identity.address}`);
  console.log(`Compliance relayer authorized: ${complianceRelayer}`);
};

func.tags = ["ArbitraIdentity"];
func.dependencies = ["ArbitraSBT"];
export default func;
