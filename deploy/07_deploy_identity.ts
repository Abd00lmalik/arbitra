/**
 * @file 07_deploy_identity.ts
 * @description Hardhat deploy script for ArbitraIdentity, linking it to the SBT.
 */

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction }             from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();

  const sbtDeployment = await get("ArbitraSBT");

  const identity = await deploy("ArbitraIdentity", {
    from: deployer,
    args: [deployer, sbtDeployment.address],
    log: true,
    waitConfirmations: network.name === "sepolia" ? 2 : 1,
  });

  console.log(`\nArbitraIdentity deployed at: ${identity.address}`);
};

func.tags = ["ArbitraIdentity"];
func.dependencies = ["ArbitraSBT"];
export default func;
