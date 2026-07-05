/* SPDX-License-Identifier: MIT */
/**
 * @file ArbitraConfidentialUSDC.test.ts
 * @description Unit tests for the ArbitraConfidentialUSDC (cUSDC) ERC-7984 wrapper.
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ArbitraConfidentialUSDC wrapper", function () {
    let mockUSDC: any;
    let cUsdc: any;
    let deployer: HardhatEthersSigner;
    let investor: HardhatEthersSigner;
    let supplier: HardhatEthersSigner;

    beforeEach(async function () {
        [deployer, investor, supplier] = await ethers.getSigners();

        /* Deploy Mock USDC */
        const MockUSDCFactory = await ethers.getContractFactory("MockUSDC", deployer);
        mockUSDC = await MockUSDCFactory.deploy();
        await mockUSDC.waitForDeployment();

        /* Deploy Confidential USDC wrapper */
        const CUsdcFactory = await ethers.getContractFactory("ArbitraConfidentialUSDC", deployer);
        cUsdc = await CUsdcFactory.deploy(await mockUSDC.getAddress());
        await cUsdc.waitForDeployment();
    });

    it("should deploy correctly with name, symbol and underlying", async function () {
        expect(await cUsdc.name()).to.equal("Confidential USDC");
        expect(await cUsdc.symbol()).to.equal("cUSDC");
        expect(await cUsdc.underlying()).to.equal(await mockUSDC.getAddress());
    });

    it("should allow wrapping underlying USDC into cUSDC", async function () {
        const wrapAmount = ethers.parseUnits("1000", 6);
        
        /* Fund investor with USDC */
        await (await mockUSDC.mint(investor.address, wrapAmount)).wait();
        
        /* Approve wrapper */
        await (await mockUSDC.connect(investor).approve(await cUsdc.getAddress(), wrapAmount)).wait();

        /* Wrap USDC into cUSDC */
        const tx = await cUsdc.connect(investor).wrap(investor.address, wrapAmount);
        await tx.wait();

        /* Verify USDC balance got pulled from investor */
        expect(await mockUSDC.balanceOf(investor.address)).to.equal(0n);
        expect(await mockUSDC.balanceOf(await cUsdc.getAddress())).to.equal(wrapAmount);
    });

    it("should allow setting registry as approved operator", async function () {
        const until = Math.floor(Date.now() / 1000) + 3600; /* 1 hour */
        const registryMock = deployer.address;

        /* Set operator */
        const tx = await cUsdc.connect(investor).setOperator(registryMock, until);
        await tx.wait();

        /* Verify operator status */
        expect(await cUsdc.isOperator(investor.address, registryMock)).to.equal(true);
    });
});
