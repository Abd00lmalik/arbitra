/*
 * @file ConfidentialWalletStateFrontend.test.ts
 * @description Regression tests for the frontend cUSDC wallet balance state machine.
 */

import { expect } from "chai";
import path from "path";

const ModuleLib = require("module");

process.env.NODE_PATH = path.resolve(__dirname, "../frontend/node_modules");
ModuleLib.Module._initPaths();

const {
  deriveConfidentialBalanceState,
} = require("../frontend/src/lib/confidentialWalletState");
const contractsModulePath = require.resolve("../frontend/src/lib/contracts");
const { ZERO_ENCRYPTED_VALUE } = require(contractsModulePath);
const { NoCiphertextError } = require("@zama-fhe/sdk");

describe("Frontend confidential wallet state", function () {
  const wrapperAddress = "0xBf7BF8aF778fA83cCfb6e18B53ACa13A0a0A0Fe1";
  const nonZeroHandle =
    "0x0000000000000000000000000000000000000000000000000000000000000001";

  it("treats a zero ciphertext handle as never shielded", function () {
    const state = deriveConfidentialBalanceState({
      wrapperAddress,
      isWrapperValid: true,
      hasPermit: false,
      rawHandle: ZERO_ENCRYPTED_VALUE,
      isLoading: false,
    });

    expect(state.kind).to.equal("never_shielded");
  });

  it("maps NoCiphertextError to the wallet empty state", function () {
    const state = deriveConfidentialBalanceState({
      wrapperAddress,
      isWrapperValid: true,
      hasPermit: true,
      rawHandle: nonZeroHandle,
      isLoading: false,
      error: new NoCiphertextError("No ciphertext for this account"),
    });

    expect(state.kind).to.equal("never_shielded");
  });

  it("keeps a decrypted zero balance distinct from never shielded", function () {
    const state = deriveConfidentialBalanceState({
      wrapperAddress,
      isWrapperValid: true,
      hasPermit: true,
      rawHandle: nonZeroHandle,
      isLoading: false,
      balance: 0n,
    });

    expect(state.kind).to.equal("zero_balance");
    if (state.kind === "zero_balance") {
      expect(state.balance).to.equal(0n);
    }
  });

  it("falls back to the deployed cUSDC wrapper when env toggles are missing", function () {
    const previousUseEnv = process.env.NEXT_PUBLIC_USE_ENV_CONTRACT_ADDRESSES;
    const previousCusdcAddress = process.env.NEXT_PUBLIC_CUSDC_ADDRESS;

    delete process.env.NEXT_PUBLIC_USE_ENV_CONTRACT_ADDRESSES;
    delete process.env.NEXT_PUBLIC_CUSDC_ADDRESS;
    delete require.cache[contractsModulePath];

    const reloadedContracts = require(contractsModulePath);

    expect(reloadedContracts.CUSDC_ADDRESS).to.equal(wrapperAddress);

    if (previousUseEnv === undefined) {
      delete process.env.NEXT_PUBLIC_USE_ENV_CONTRACT_ADDRESSES;
    } else {
      process.env.NEXT_PUBLIC_USE_ENV_CONTRACT_ADDRESSES = previousUseEnv;
    }

    if (previousCusdcAddress === undefined) {
      delete process.env.NEXT_PUBLIC_CUSDC_ADDRESS;
    } else {
      process.env.NEXT_PUBLIC_CUSDC_ADDRESS = previousCusdcAddress;
    }

    delete require.cache[contractsModulePath];
    require(contractsModulePath);
  });
});
