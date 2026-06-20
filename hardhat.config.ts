/*
 * @file hardhat.config.ts
 * @description Hardhat configuration for Arbitra v2.0 smart contract compilation and deployment.
 */

import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "hardhat-deploy";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const DEPLOYER_PRIVATE_KEY =
  process.env.DEPLOYER_PRIVATE_KEY || "0x" + "0".repeat(64);

const config = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    sepolia: {
      url: "https://ethereum-sepolia-rpc.publicnode.com",
      chainId: 11155111,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
  },
  namedAccounts: {
    deployer: { default: 0 },
  },
  fhevm: {
    network: "sepolia",
  },
};

export default config;
