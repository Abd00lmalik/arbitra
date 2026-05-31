/* SPDX-License-Identifier: MIT */
/**
 * @file ArbitraOnboarding.test.ts
 * @description Unit and E2E tests for the Arbitra Supplier Onboarding flow,
 *              covering ArbitraSBT, MockKYBOracle, and ArbitraIdentity.
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Arbitra Onboarding E2E Lifecycle", function () {
    let sbtContract: any;
    let oracleContract: any;
    let identityContract: any;

    let sbtAddr: string;
    let oracleAddr: string;
    let identityAddr: string;

    let deployer: HardhatEthersSigner;
    let supplier: HardhatEthersSigner;
    let bystander: HardhatEthersSigner;
    let oracleBackend: HardhatEthersSigner;
    let chainId: bigint;

    beforeEach(async function () {
        [deployer, supplier, bystander, oracleBackend] = await ethers.getSigners();
        chainId = (await ethers.provider.getNetwork()).chainId;

        /* 1. Deploy ArbitraSBT */
        const SBTFactory = await ethers.getContractFactory("ArbitraSBT", deployer);
        sbtContract = await SBTFactory.deploy(deployer.address);
        await sbtContract.waitForDeployment();
        sbtAddr = await sbtContract.getAddress();

        /* 2. Deploy MockKYBOracle */
        const OracleFactory = await ethers.getContractFactory("MockKYBOracle", deployer);
        oracleContract = await OracleFactory.deploy(deployer.address, sbtAddr, oracleBackend.address);
        await oracleContract.waitForDeployment();
        oracleAddr = await oracleContract.getAddress();

        /* 3. Wire circular reference on SBT */
        await (await sbtContract.connect(deployer).setKYBOracle(oracleAddr)).wait();

        /* 4. Deploy ArbitraIdentity */
        const IdentityFactory = await ethers.getContractFactory("ArbitraIdentity", deployer);
        identityContract = await IdentityFactory.deploy(deployer.address, sbtAddr);
        await identityContract.waitForDeployment();
        identityAddr = await identityContract.getAddress();
    });

    describe("MockKYBOracle EIP-712 Verification & Nonce Safety", function () {
        it("should successfully verify EIP-712 signature and mint SBT", async function () {
            const verificationId = ethers.keccak256(ethers.toUtf8Bytes("KYB-MOCK-12345"));
            const attestationHash = ethers.keccak256(ethers.toUtf8Bytes("{'status':'verified'}"));
            const riskScore = 25; /* Low risk */
            const timestamp = Math.floor(Date.now() / 1000);
            const currentNonce = await oracleContract.nonces(supplier.address);

            /* Prepare EIP-712 domain and message */
            const domain = {
                name: "Arbitra",
                version: "2",
                chainId: chainId,
                verifyingContract: oracleAddr
            };

            const types = {
                KYBAttestation: [
                    { name: "wallet",           type: "address" },
                    { name: "verificationId",   type: "bytes32" },
                    { name: "attestationHash",  type: "bytes32" },
                    { name: "riskScore",        type: "uint8"   },
                    { name: "timestamp",        type: "uint256" },
                    { name: "nonce",            type: "uint256" },
                ]
            };

            const message = {
                wallet: supplier.address,
                verificationId,
                attestationHash,
                riskScore,
                timestamp,
                nonce: currentNonce
            };

            const signature = await oracleBackend.signTypedData(domain, types, message);

            /* Submit verification attestation */
            await expect(
                oracleContract.connect(supplier).submitKYBAttestation(
                    supplier.address,
                    verificationId,
                    attestationHash,
                    riskScore,
                    timestamp,
                    signature
                )
            ).to.emit(oracleContract, "KYBAttestationSubmitted")
             .withArgs(supplier.address, verificationId, riskScore, (t: bigint) => t > 0n);

            /* Confirm SBT exists */
            expect(await sbtContract.hasValidSBT(supplier.address)).to.be.true;

            const record = await sbtContract.sbtRecords(1);
            expect(record.wallet).to.equal(supplier.address);
            expect(record.riskScoreBucket).to.equal(0); /* Low risk bucket */
        });

        it("should revert if EIP-712 signature is replayed (nonce safety)", async function () {
            const verificationId = ethers.keccak256(ethers.toUtf8Bytes("KYB-MOCK-12345"));
            const attestationHash = ethers.keccak256(ethers.toUtf8Bytes("{'status':'verified'}"));
            const riskScore = 25;
            const timestamp = Math.floor(Date.now() / 1000);
            const currentNonce = await oracleContract.nonces(supplier.address);

            const domain = {
                name: "Arbitra",
                version: "2",
                chainId: chainId,
                verifyingContract: oracleAddr
            };

            const types = {
                KYBAttestation: [
                    { name: "wallet",           type: "address" },
                    { name: "verificationId",   type: "bytes32" },
                    { name: "attestationHash",  type: "bytes32" },
                    { name: "riskScore",        type: "uint8"   },
                    { name: "timestamp",        type: "uint256" },
                    { name: "nonce",            type: "uint256" },
                ]
            };

            const message = {
                wallet: supplier.address,
                verificationId,
                attestationHash,
                riskScore,
                timestamp,
                nonce: currentNonce
            };

            const signature = await oracleBackend.signTypedData(domain, types, message);

            /* First submission succeeds */
            await oracleContract.connect(supplier).submitKYBAttestation(
                supplier.address,
                verificationId,
                attestationHash,
                riskScore,
                timestamp,
                signature
            );

            /* Second submission reverts due to used attestation hash */
            await expect(
                oracleContract.connect(supplier).submitKYBAttestation(
                    supplier.address,
                    verificationId,
                    attestationHash,
                    riskScore,
                    timestamp,
                    signature
                )
            ).to.be.revertedWith("MockKYBOracle: attestation replayed");
        });

        it("should revert if timestamp has expired (> 5 minutes)", async function () {
            const verificationId = ethers.keccak256(ethers.toUtf8Bytes("KYB-MOCK-12345"));
            const attestationHash = ethers.keccak256(ethers.toUtf8Bytes("{'status':'verified'}"));
            const riskScore = 25;
            const timestamp = Math.floor(Date.now() / 1000) - 301; /* 5 min and 1 sec ago */
            const currentNonce = await oracleContract.nonces(supplier.address);

            const domain = {
                name: "Arbitra",
                version: "2",
                chainId: chainId,
                verifyingContract: oracleAddr
            };

            const types = {
                KYBAttestation: [
                    { name: "wallet",           type: "address" },
                    { name: "verificationId",   type: "bytes32" },
                    { name: "attestationHash",  type: "bytes32" },
                    { name: "riskScore",        type: "uint8"   },
                    { name: "timestamp",        type: "uint256" },
                    { name: "nonce",            type: "uint256" },
                ]
            };

            const message = {
                wallet: supplier.address,
                verificationId,
                attestationHash,
                riskScore,
                timestamp,
                nonce: currentNonce
            };

            const signature = await oracleBackend.signTypedData(domain, types, message);

            await expect(
                oracleContract.connect(supplier).submitKYBAttestation(
                    supplier.address,
                    verificationId,
                    attestationHash,
                    riskScore,
                    timestamp,
                    signature
                )
            ).to.be.revertedWith("MockKYBOracle: attestation expired");
        });

        it("should revert if signature is signed by unauthorized address", async function () {
            const verificationId = ethers.keccak256(ethers.toUtf8Bytes("KYB-MOCK-12345"));
            const attestationHash = ethers.keccak256(ethers.toUtf8Bytes("{'status':'verified'}"));
            const riskScore = 25;
            const timestamp = Math.floor(Date.now() / 1000);
            const currentNonce = await oracleContract.nonces(supplier.address);

            const domain = {
                name: "Arbitra",
                version: "2",
                chainId: chainId,
                verifyingContract: oracleAddr
            };

            const types = {
                KYBAttestation: [
                    { name: "wallet",           type: "address" },
                    { name: "verificationId",   type: "bytes32" },
                    { name: "attestationHash",  type: "bytes32" },
                    { name: "riskScore",        type: "uint8"   },
                    { name: "timestamp",        type: "uint256" },
                    { name: "nonce",            type: "uint256" },
                ]
            };

            const message = {
                wallet: supplier.address,
                verificationId,
                attestationHash,
                riskScore,
                timestamp,
                nonce: currentNonce
            };

            /* Signed by supplier instead of oracleBackend */
            const signature = await supplier.signTypedData(domain, types, message);

            await expect(
                oracleContract.connect(supplier).submitKYBAttestation(
                    supplier.address,
                    verificationId,
                    attestationHash,
                    riskScore,
                    timestamp,
                    signature
                )
            ).to.be.revertedWith("MockKYBOracle: invalid oracle signature");
        });
    });

    describe("ArbitraSBT Non-Transferability", function () {
        beforeEach(async function () {
            /* Mint an SBT to supplier first */
            const verificationId = ethers.keccak256(ethers.toUtf8Bytes("KYB-MOCK-12345"));
            const attestationHash = ethers.keccak256(ethers.toUtf8Bytes("{'status':'verified'}"));
            const riskScore = 25;
            const timestamp = Math.floor(Date.now() / 1000);
            const currentNonce = await oracleContract.nonces(supplier.address);

            const domain = {
                name: "Arbitra",
                version: "2",
                chainId: chainId,
                verifyingContract: oracleAddr
            };

            const types = {
                KYBAttestation: [
                    { name: "wallet",           type: "address" },
                    { name: "verificationId",   type: "bytes32" },
                    { name: "attestationHash",  type: "bytes32" },
                    { name: "riskScore",        type: "uint8"   },
                    { name: "timestamp",        type: "uint256" },
                    { name: "nonce",            type: "uint256" },
                ]
            };

            const message = {
                wallet: supplier.address,
                verificationId,
                attestationHash,
                riskScore,
                timestamp,
                nonce: currentNonce
            };

            const signature = await oracleBackend.signTypedData(domain, types, message);
            await oracleContract.connect(supplier).submitKYBAttestation(
                supplier.address,
                verificationId,
                attestationHash,
                riskScore,
                timestamp,
                signature
            );
        });

        it("should prevent transferring the SBT (transferFrom)", async function () {
            await expect(
                sbtContract.connect(supplier).transferFrom(supplier.address, bystander.address, 1n)
            ).to.be.revertedWith("ArbitraSBT: soulbound - non-transferable");
        });

        it("should prevent transferring the SBT (safeTransferFrom)", async function () {
            await expect(
                sbtContract.connect(supplier)["safeTransferFrom(address,address,uint256)"](supplier.address, bystander.address, 1n)
            ).to.be.revertedWith("ArbitraSBT: soulbound - non-transferable");
        });

        it("should prevent approving the SBT", async function () {
            await expect(
                sbtContract.connect(supplier).approve(bystander.address, 1n)
            ).to.be.revertedWith("ArbitraSBT: soulbound - approvals disabled");
        });

        it("should allow owner to revoke the SBT", async function () {
            await expect(
                sbtContract.connect(deployer).revokeSBT(supplier.address)
            ).to.emit(sbtContract, "SBTRevoked")
             .withArgs(supplier.address, 1n, (t: bigint) => t > 0n);

            expect(await sbtContract.hasValidSBT(supplier.address)).to.be.false;
        });

        it("should prevent non-owner from revoking the SBT", async function () {
            await expect(
                sbtContract.connect(bystander).revokeSBT(supplier.address)
            ).to.be.revertedWithCustomError(sbtContract, "OwnableUnauthorizedAccount");
        });
    });

    describe("ArbitraIdentity FHE Compliance Storage & Access Gating", function () {
        let verificationId: string;
        let attestationHash: string;
        let riskScore: number;
        let timestamp: number;
        let signature: string;

        beforeEach(async function () {
            verificationId = ethers.keccak256(ethers.toUtf8Bytes("KYB-MOCK-12345"));
            attestationHash = ethers.keccak256(ethers.toUtf8Bytes("{'status':'verified'}"));
            riskScore = 25;
            timestamp = Math.floor(Date.now() / 1000);
            const currentNonce = await oracleContract.nonces(supplier.address);

            const domain = {
                name: "Arbitra",
                version: "2",
                chainId: chainId,
                verifyingContract: oracleAddr
            };

            const types = {
                KYBAttestation: [
                    { name: "wallet",           type: "address" },
                    { name: "verificationId",   type: "bytes32" },
                    { name: "attestationHash",  type: "bytes32" },
                    { name: "riskScore",        type: "uint8"   },
                    { name: "timestamp",        type: "uint256" },
                    { name: "nonce",            type: "uint256" },
                ]
            };

            const message = {
                wallet: supplier.address,
                verificationId,
                attestationHash,
                riskScore,
                timestamp,
                nonce: currentNonce
            };

            signature = await oracleBackend.signTypedData(domain, types, message);
        });

        it("should revert if attempting to submit FHE compliance without a valid SBT", async function () {
            const input = fhevm.createEncryptedInput(identityAddr, supplier.address);
            input.add32(123456789n); /* taxID */
            input.addBool(true); /* kybStatus */
            input.add8(BigInt(riskScore)); /* riskScore */
            const enc = await input.encrypt();

            await expect(
                identityContract.connect(supplier).submitEncryptedCompliance(
                    enc.handles[0], enc.inputProof,
                    enc.handles[1], enc.inputProof,
                    enc.handles[2], enc.inputProof
                )
            ).to.be.revertedWith("ArbitraIdentity: no valid SBT");
        });

        it("should successfully store encrypted compliance attributes if caller holds SBT", async function () {
            /* Mint SBT first */
            await oracleContract.connect(supplier).submitKYBAttestation(
                supplier.address,
                verificationId,
                attestationHash,
                riskScore,
                timestamp,
                signature
            );

            /* Encrypt data */
            const input = fhevm.createEncryptedInput(identityAddr, supplier.address);
            input.add32(123456789n); /* taxID */
            input.addBool(true); /* kybStatus */
            input.add8(BigInt(riskScore)); /* riskScore */
            const enc = await input.encrypt();

            /* Submit encrypted compliance */
            await expect(
                identityContract.connect(supplier).submitEncryptedCompliance(
                    enc.handles[0], enc.inputProof,
                    enc.handles[1], enc.inputProof,
                    enc.handles[2], enc.inputProof
                )
            ).to.emit(identityContract, "EncryptedComplianceSubmitted")
             .withArgs(supplier.address, (t: bigint) => t > 0n);

            expect(await identityContract.hasEncryptedCompliance(supplier.address)).to.be.true;

            const handles = await identityContract.getEncryptedHandles(supplier.address);
            expect(handles.taxIDHandle).to.equal(ethers.hexlify(enc.handles[0]));
            expect(handles.kybHandle).to.equal(ethers.hexlify(enc.handles[1]));
            expect(handles.riskHandle).to.equal(ethers.hexlify(enc.handles[2]));
        });
    });
});
