/**
 * @file 05_deploy_sbt.ts
 * @description Hardhat deploy script for the Soulbound Token contract.
 */

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction }             from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network, ethers } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const sbt = await deploy("ArbitraSBT", {
    from: deployer,
    args: [deployer], /* initialOwner is deployer */
    log: true,
    waitConfirmations: network.name === "sepolia" ? 2 : 1,
  });

  console.log(`\nArbitraSBT deployed at: ${sbt.address}`);

  const signer = await ethers.provider.getSigner(deployer);
  try {
    const registryDeployment = await deployments.get("ArbitraInvoiceRegistry");
    const registry = await ethers.getContractAt("ArbitraInvoiceRegistry", registryDeployment.address, signer);
    if ((await registry.sbtContract()) !== sbt.address) {
      console.log("- Configuring SBTContract on InvoiceRegistry...");
      await (await registry.setSBTContract(sbt.address)).wait();
    }
  } catch (e) {
    console.log("- InvoiceRegistry not found, skipping SBTContract configuration.");
  }
};

func.tags = ["ArbitraSBT"];
export default func;
