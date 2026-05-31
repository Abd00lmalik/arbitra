/**
 * @file 05_deploy_sbt.ts
 * @description Hardhat deploy script for the Soulbound Token contract.
 */

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction }             from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const sbt = await deploy("ArbitraSBT", {
    from: deployer,
    args: [deployer], /* initialOwner is deployer */
    log: true,
    waitConfirmations: network.name === "sepolia" ? 2 : 1,
  });

  console.log(`\nArbitraSBT deployed at: ${sbt.address}`);
};

func.tags = ["ArbitraSBT"];
export default func;
