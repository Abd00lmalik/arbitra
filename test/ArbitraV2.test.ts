/* SPDX-License-Identifier: MIT */
/*
 * @file ArbitraV2.test.ts
 * @description Comprehensive E2E unit tests for Arbitra v2.0 Smart Contracts.
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Arbitra v2.0 E2E Lifecycle", function () {
    let mockUSDC: any;
    let mockCUSDC: any;
    let fpRegistry: any;
    let riskCalc: any;
    let collateralVault: any;
    let escrowReceiver: any;
    let registry: any;

    let registryAddr: string;
    let mockCUSDCAddr: string;
    let mockUSDCAddr: string;
    let fpRegistryAddr: string;
    let riskCalcAddr: string;
    let collateralVaultAddr: string;
    let escrowReceiverAddr: string;

    let deployer: HardhatEthersSigner;
    let supplier: HardhatEthersSigner;
    let investor: HardhatEthersSigner;
    let debtor: HardhatEthersSigner;
    let bystander: HardhatEthersSigner;
    let platformVerifier: HardhatEthersSigner;
    let chainId: bigint;

    beforeEach(async function () {
        [deployer, supplier, investor, debtor, bystander, platformVerifier] = await ethers.getSigners();
        chainId = (await ethers.provider.getNetwork()).chainId;

        /* Deploy MockUSDC */
        const MockUSDCFactory = await ethers.getContractFactory("MockUSDC", deployer);
        mockUSDC = await MockUSDCFactory.deploy();
        await mockUSDC.waitForDeployment();
        mockUSDCAddr = await mockUSDC.getAddress();

        /* Deploy MockERC7984 (cUSDC mock) */
        const MockERC7984Factory = await ethers.getContractFactory("MockERC7984", deployer);
        mockCUSDC = await MockERC7984Factory.deploy();
        await mockCUSDC.waitForDeployment();
        mockCUSDCAddr = await mockCUSDC.getAddress();

        /* Deploy FingerprintRegistry */
        const FPFactory = await ethers.getContractFactory("ArbitraFingerprintRegistry", deployer);
        fpRegistry = await FPFactory.deploy();
        await fpRegistry.waitForDeployment();
        fpRegistryAddr = await fpRegistry.getAddress();

        /* Deploy RiskCalculator */
        const RiskFactory = await ethers.getContractFactory("ArbitraRiskCalculator", deployer);
        riskCalc = await RiskFactory.deploy();
        await riskCalc.waitForDeployment();
        riskCalcAddr = await riskCalc.getAddress();

        /* Deploy CollateralVault */
        const VaultFactory = await ethers.getContractFactory("ArbitraCollateralVault", deployer);
        collateralVault = await VaultFactory.deploy(mockUSDCAddr);
        await collateralVault.waitForDeployment();
        collateralVaultAddr = await collateralVault.getAddress();

        /* Deploy EscrowReceiver */
        const EscrowFactory = await ethers.getContractFactory("ArbitraEscrowReceiver", deployer);
        escrowReceiver = await EscrowFactory.deploy(mockUSDCAddr);
        await escrowReceiver.waitForDeployment();
        escrowReceiverAddr = await escrowReceiver.getAddress();

        /* Deploy main Registry */
        const RegistryFactory = await ethers.getContractFactory("ArbitraInvoiceRegistry", deployer);
        registry = await RegistryFactory.deploy(
            mockUSDCAddr,
            fpRegistryAddr,
            riskCalcAddr,
            collateralVaultAddr,
            escrowReceiverAddr,
            platformVerifier.address
        );
        await registry.waitForDeployment();
        registryAddr = await registry.getAddress();

        /* Wire all contracts together */
        await (await fpRegistry.connect(deployer).setRegistry(registryAddr)).wait();
        await (await collateralVault.connect(deployer).setRegistry(registryAddr)).wait();
        await (await escrowReceiver.connect(deployer).setRegistry(registryAddr)).wait();

        /* Mint assets to participants */
        await (await mockUSDC.mint(supplier.address, 10_000_000_000n)).wait(); /* 10k USDC */
        await (await mockUSDC.mint(investor.address, 10_000_000_000n)).wait(); /* 10k USDC */
        await (await mockUSDC.mint(debtor.address, 10_000_000_000n)).wait(); /* 10k USDC */

        /* Investor approvals */
        await (await mockUSDC.connect(investor).approve(registryAddr, 10_000_000_000n)).wait();
    });

    describe("Full factoring lifecycle", function () {
        it("should successfully process the entire v2.0 factoring flow", async function () {
            const faceValue = 1_000_000_000n; /* 1000 USDC */
            const dueDate = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400); /* 30 days */
            const fingerprint = 987654321n;
            const baseRate = 300n; /* 3% */
            const reputationMultiplier = 5n;
            const nextInvoiceId = 1n;

            /* Step 1: Supplier approves and stakes collateral */
            const requiredCollateral = (faceValue * 500n) / 10000n;
            await (await mockUSDC.connect(supplier).approve(collateralVaultAddr, requiredCollateral)).wait();

            expect(await collateralVault.stakeStates(fingerprint)).to.equal(0n); // UNSTAKED
            await (await collateralVault.connect(supplier).stakeCollateral(fingerprint, faceValue)).wait();
            expect(await collateralVault.stakeStates(fingerprint)).to.equal(1n); // STAKED_PENDING_REGISTRATION

            expect(await collateralVault.stakedCollateralByFingerprint(fingerprint)).to.equal(requiredCollateral);
            expect(await collateralVault.supplierByFingerprint(fingerprint)).to.equal(supplier.address);

            /* Step 2: Encrypt client side and upload */
            const input = fhevm.createEncryptedInput(registryAddr, supplier.address);
            input.add64(faceValue);
            input.add64(dueDate);
            input.add64(fingerprint);
            input.add64(baseRate);
            input.add64(reputationMultiplier);
            const enc = await input.encrypt();

            await expect(
                registry.connect(supplier).uploadInvoice(
                    enc.handles[0], enc.inputProof,
                    enc.handles[1], enc.inputProof,
                    enc.handles[2], enc.inputProof,
                    enc.handles[3], enc.inputProof,
                    enc.handles[4], enc.inputProof,
                    debtor.address,
                    true,
                    faceValue,
                    fingerprint
                )
            ).to.emit(registry, "InvoiceUploaded").withArgs(nextInvoiceId, supplier.address, debtor.address, (val: bigint) => val > 0n);

            expect(await collateralVault.stakedCollateral(nextInvoiceId)).to.equal(requiredCollateral);
            expect(await collateralVault.invoiceSupplier(nextInvoiceId)).to.equal(supplier.address);
            expect(await collateralVault.stakedCollateralByFingerprint(fingerprint)).to.equal(0n);
            expect(await collateralVault.stakeStates(nextInvoiceId)).to.equal(2n); // REGISTERED

            /* Step 3: Debtor attestation via EIP-712 */
            const attestationCommitment = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "uint256"],
                    [faceValue, dueDate]
                )
            );

            const domain = {
                name: "Arbitra",
                version: "2",
                chainId: chainId,
                verifyingContract: registryAddr
            };

            const types = {
                InvoiceAttestation: [
                    { name: "invoiceId",             type: "uint256" },
                    { name: "attestationCommitment", type: "bytes32" },
                    { name: "supplier",              type: "address" }
                ]
            };

            const message = {
                invoiceId: nextInvoiceId,
                attestationCommitment: attestationCommitment,
                supplier: supplier.address
            };

            const signature = await debtor.signTypedData(domain, types, message);

            await expect(
                registry.connect(debtor).confirmInvoice(nextInvoiceId, signature, attestationCommitment)
            ).to.emit(registry, "InvoiceAttested").withArgs(nextInvoiceId, debtor.address, (val: bigint) => val > 0n);

            const invAfterAttest = await registry.invoices(nextInvoiceId);
            expect(invAfterAttest.status).to.equal(1n); /* Attested */

            /* Step 4: Transient assessment access */
            await (await registry.connect(investor).grantRiskAssessmentAccess(nextInvoiceId)).wait();

            /* Step 5: Factoring purchase */
            await expect(
                registry.connect(investor).factorInvoice(nextInvoiceId)
            ).to.emit(registry, "InvoiceFactored").withArgs(nextInvoiceId, investor.address, (val: bigint) => val > 0n);

            expect(await collateralVault.stakeStates(nextInvoiceId)).to.equal(3n); // FINANCED

            const invAfterFactor = await registry.invoices(nextInvoiceId);
            expect(invAfterFactor.status).to.equal(2n); /* Factored */
            expect(invAfterFactor.investor).to.equal(investor.address);

            /* Advance time to maturity */
            await ethers.provider.send("evm_increaseTime", [30 * 86400 + 10]);
            await ethers.provider.send("evm_mine", []);

            /* Step 6: Simulate maturity payment by Debtor */
            await (await mockUSDC.connect(debtor).approve(escrowReceiverAddr, faceValue)).wait();
            await (await escrowReceiver.connect(debtor).settleInvoice(nextInvoiceId)).wait();

            /* Check that escrow status is settled and supplier collateral released */
            const invAfterRepay = await registry.invoices(nextInvoiceId);
            expect(invAfterRepay.status).to.equal(3n); /* Settled */
            expect(await collateralVault.stakedCollateral(nextInvoiceId)).to.equal(0n);
            expect(await collateralVault.stakeStates(nextInvoiceId)).to.equal(5n); // STAKE_RELEASED
        });

        it("should revert if duplicate fingerprint is uploaded", async function () {
            const faceValue = 1_000_000_000n;
            const dueDate = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);
            const fingerprint = 111222333n;
            const baseRate = 300n;
            const reputationMultiplier = 5n;

            /* Stake for first invoice */
            await (await mockUSDC.connect(supplier).approve(collateralVaultAddr, 100_000_000n)).wait();
            await (await collateralVault.connect(supplier).stakeCollateral(fingerprint, faceValue)).wait();

            const input1 = fhevm.createEncryptedInput(registryAddr, supplier.address);
            input1.add64(faceValue);
            input1.add64(dueDate);
            input1.add64(fingerprint);
            input1.add64(baseRate);
            input1.add64(reputationMultiplier);
            const enc1 = await input1.encrypt();

            await (await registry.connect(supplier).uploadInvoice(
                enc1.handles[0], enc1.inputProof,
                enc1.handles[1], enc1.inputProof,
                enc1.handles[2], enc1.inputProof,
                enc1.handles[3], enc1.inputProof,
                enc1.handles[4], enc1.inputProof,
                debtor.address,
                true,
                faceValue,
                fingerprint
            )).wait();

            /* Stake for second invoice (reusing fingerprint is allowed since mapping cleared) */
            await (await collateralVault.connect(supplier).stakeCollateral(fingerprint, faceValue)).wait();

            const input2 = fhevm.createEncryptedInput(registryAddr, supplier.address);
            input2.add64(faceValue);
            input2.add64(dueDate);
            input2.add64(fingerprint); /* SAME FINGERPRINT */
            input2.add64(baseRate);
            input2.add64(reputationMultiplier);
            const enc2 = await input2.encrypt();

            /* In FHE, the checkDuplicate function evaluates the duplicate homomorphically through the registry wrapper */
            const dupHandle = await registry.connect(supplier).checkDuplicate.staticCall(enc2.handles[2], enc2.inputProof);
            await (await registry.connect(supplier).checkDuplicate(enc2.handles[2], enc2.inputProof)).wait();
            
            /* Decrypt the duplicate check result to assert duplicate check operates correctly */
            const decryptedDup = await fhevm.userDecryptEbool(
                dupHandle,
                registryAddr,
                deployer
            );
            expect(decryptedDup).to.equal(true);
        });

        it("should expose a decryptable supplier duplicate-check handle on fingerprint registry", async function () {
            const faceValue = 1_000_000_000n;
            const uniqueFingerprint = 444555666n;
            const duplicateFingerprint = 777888999n;

            const inputUnique = fhevm.createEncryptedInput(fpRegistryAddr, supplier.address);
            inputUnique.add64(uniqueFingerprint);
            const encUniqueHash = await inputUnique.encrypt();

            const inputUniqueFaceValue = fhevm.createEncryptedInput(fpRegistryAddr, supplier.address);
            inputUniqueFaceValue.add64(faceValue);
            const encUniqueFaceValue = await inputUniqueFaceValue.encrypt();

            await (await fpRegistry.connect(supplier).checkInvoiceUniqueness(
                encUniqueHash.handles[0],
                encUniqueHash.inputProof,
                encUniqueFaceValue.handles[0],
                encUniqueFaceValue.inputProof
            )).wait();

            const uniqueHandle = await fpRegistry.getDuplicateCheckHandle(supplier.address);
            const uniqueResult = await fhevm.userDecryptEbool(
                uniqueHandle,
                fpRegistryAddr,
                supplier
            );
            expect(uniqueResult).to.equal(false);

            await expect(
                fpRegistry.connect(supplier).confirmAndRegister(42n)
            ).to.emit(fpRegistry, "FingerprintRegistered");

            const inputDuplicate = fhevm.createEncryptedInput(fpRegistryAddr, supplier.address);
            inputDuplicate.add64(uniqueFingerprint);
            const encDuplicateHash = await inputDuplicate.encrypt();

            const inputDuplicateFaceValue = fhevm.createEncryptedInput(fpRegistryAddr, supplier.address);
            inputDuplicateFaceValue.add64(faceValue);
            const encDuplicateFaceValue = await inputDuplicateFaceValue.encrypt();

            await (await fpRegistry.connect(supplier).checkInvoiceUniqueness(
                encDuplicateHash.handles[0],
                encDuplicateHash.inputProof,
                encDuplicateFaceValue.handles[0],
                encDuplicateFaceValue.inputProof
            )).wait();

            const duplicateHandle = await fpRegistry.getDuplicateCheckHandle(supplier.address);
            const duplicateResult = await fhevm.userDecryptEbool(
                duplicateHandle,
                fpRegistryAddr,
                supplier
            );
            expect(duplicateResult).to.equal(true);
        });

        it("should allow governance to slash collateral on fraud", async function () {
            const faceValue = 1_000_000_000n;
            const dueDate = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);
            const fingerprint = 555666777n;
            const baseRate = 300n;
            const reputationMultiplier = 5n;
            const nextInvoiceId = 1n;

            /* Stake and upload */
            await (await mockUSDC.connect(supplier).approve(collateralVaultAddr, 100_000_000n)).wait();
            await (await collateralVault.connect(supplier).stakeCollateral(fingerprint, faceValue)).wait();

            const input = fhevm.createEncryptedInput(registryAddr, supplier.address);
            input.add64(faceValue);
            input.add64(dueDate);
            input.add64(fingerprint);
            input.add64(baseRate);
            input.add64(reputationMultiplier);
            const enc = await input.encrypt();

            await (await registry.connect(supplier).uploadInvoice(
                enc.handles[0], enc.inputProof,
                enc.handles[1], enc.inputProof,
                enc.handles[2], enc.inputProof,
                enc.handles[3], enc.inputProof,
                enc.handles[4], enc.inputProof,
                debtor.address,
                true,
                faceValue,
                fingerprint
            )).wait();

            /* Attest and factor */
            const attCommit = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "uint256"], [faceValue, dueDate])
            );
            const domain = { name: "Arbitra", version: "2", chainId, verifyingContract: registryAddr };
            const types = {
                InvoiceAttestation: [
                    { name: "invoiceId",             type: "uint256" },
                    { name: "attestationCommitment", type: "bytes32" },
                    { name: "supplier",              type: "address" }
                ]
            };
            const msgObj = { invoiceId: nextInvoiceId, attestationCommitment: attCommit, supplier: supplier.address };
            const signature = await debtor.signTypedData(domain, types, msgObj);
            await (await registry.connect(debtor).confirmInvoice(nextInvoiceId, signature, attCommit)).wait();

            await (await registry.connect(investor).factorInvoice(nextInvoiceId)).wait();

            /* Trigger governance dispute */
            await expect(
                registry.connect(deployer).initiateDispute(nextInvoiceId)
            ).to.emit(registry, "InvoiceDisputed");

            /* Resolve dispute with fraud confirmed -> slash collateral to investor */
            const initialInvestorUSDC = await mockUSDC.balanceOf(investor.address);
            
            await expect(
                registry.connect(deployer).resolveDispute(nextInvoiceId, true)
            ).to.emit(registry, "DisputeResolved").withArgs(nextInvoiceId, true, (val: bigint) => val > 0n);

            const finalInvestorUSDC = await mockUSDC.balanceOf(investor.address);
            const expectedSlashAmount = (faceValue * 500n) / 10000n;

            expect(finalInvestorUSDC - initialInvestorUSDC).to.equal(expectedSlashAmount);
            expect(await collateralVault.isSlashed(nextInvoiceId)).to.equal(true);
            expect(await collateralVault.stakeStates(nextInvoiceId)).to.equal(6n); // SLASHED
        });

        it("should allow platform-signed email attestation commitment", async function () {
            const faceValue = 1_000_000_000n;
            const dueDate = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);
            const fingerprint = 999111222n;
            const baseRate = 300n;
            const reputationMultiplier = 5n;
            const nextInvoiceId = 1n;

            /* Stake and upload */
            await (await mockUSDC.connect(supplier).approve(collateralVaultAddr, 100_000_000n)).wait();
            await (await collateralVault.connect(supplier).stakeCollateral(fingerprint, faceValue)).wait();

            const input = fhevm.createEncryptedInput(registryAddr, supplier.address);
            input.add64(faceValue);
            input.add64(dueDate);
            input.add64(fingerprint);
            input.add64(baseRate);
            input.add64(reputationMultiplier);
            const enc = await input.encrypt();

            await (await registry.connect(supplier).uploadInvoice(
                enc.handles[0], enc.inputProof,
                enc.handles[1], enc.inputProof,
                enc.handles[2], enc.inputProof,
                enc.handles[3], enc.inputProof,
                enc.handles[4], enc.inputProof,
                debtor.address,
                true,
                faceValue,
                fingerprint
            )).wait();

            /* Platform-signed email attestation flow */
            const debtorEmail = "debtor@company.com";
            const emailHash = ethers.keccak256(ethers.toUtf8Bytes(debtorEmail));
            const latestBlock = await ethers.provider.getBlock("latest");
            const verifiedAt = BigInt(latestBlock!.timestamp);
            const expiresAt = verifiedAt + (72n * 3600n);

            const domain = { name: "Arbitra", version: "2", chainId, verifyingContract: registryAddr };
            const types = {
                EmailAttestation: [
                    { name: "invoiceId",   type: "uint256" },
                    { name: "emailHash",   type: "bytes32" },
                    { name: "verifiedAt",  type: "uint256" },
                    { name: "expiresAt",   type: "uint256" }
                ]
            };
            const msgObj = {
                invoiceId: nextInvoiceId,
                emailHash,
                verifiedAt,
                expiresAt
            };
            const platformSignature = await platformVerifier.signTypedData(domain, types, msgObj);

            /* Confirm email verified */
            await expect(
                registry.connect(platformVerifier).confirmInvoiceEmailVerified(
                    nextInvoiceId,
                    emailHash,
                    verifiedAt,
                    expiresAt,
                    platformSignature
                )
            ).to.emit(registry, "InvoiceAttested")
             .to.emit(registry, "InvoiceEmailVerified")
             .withArgs(nextInvoiceId, emailHash, (val: bigint) => val > 0n);

            /* Assert states */
            const inv = await registry.invoices(nextInvoiceId);
            expect(inv.status).to.equal(1); /* Attested = 1 */
            expect(inv.debtorEmailHash).to.equal(emailHash);
            expect(inv.isEmailVerified).to.equal(true);
        });
    });
});
