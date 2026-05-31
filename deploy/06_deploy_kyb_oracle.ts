/**
 * @file 06_deploy_kyb_oracle.ts
 * @description Hardhat deploy script for MockKYBOracle, linking it to SBT and wiring the circular dependency.
 */

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction }             from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network, ethers } = hre;
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();

  const sbtDeployment = await get("ArbitraSBT");

  let oracleBackend = process.env.ORACLE_BACKEND_ADDRESS;
  if (!oracleBackend) {
    if (network.name === "sepolia") {
      throw new Error("ORACLE_BACKEND_ADDRESS not set in env");
    } else {
      /* For local testing: use a known signer account */
      const signers = await ethers.getSigners();
      oracleBackend = signers[8] ? signers[8].address : deployer;
    }
  }

  const oracle = await deploy("MockKYBOracle", {
    from: deployer,
    args: [deployer, sbtDeployment.address, oracleBackend],
    log: true,
    waitConfirmations: network.name === "sepolia" ? 2 : 1,
  });

  console.log(`\nMockKYBOracle deployed at: ${oracle.address}`);
  console.log(`Oracle backend authorized: ${oracleBackend}`);

  /* Wire back the circular oracle reference on ArbitraSBT */
  const signer = await ethers.provider.getSigner(deployer);
  const sbtContract = await ethers.getContractAt("ArbitraSBT", sbtDeployment.address, signer);
  const currentOracle = await sbtContract.kybOracle();
  if (currentOracle !== oracle.address) {
    console.log(`Configuring kybOracle link on ArbitraSBT to: ${oracle.address}...`);
    const tx = await sbtContract.setKYBOracle(oracle.address);
    await tx.wait();
    console.log(`- Linked successfully!`);
  }
};

func.tags = ["MockKYBOracle"];
func.dependencies = ["ArbitraSBT"];
export default func;
