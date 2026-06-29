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
    let supplierSbt: any;
    let investorSbt: any;
    let investorSbtAddr: string;

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
            platformVerifier.address,
            deployer.address
        );
        await registry.waitForDeployment();
        registryAddr = await registry.getAddress();

        /* Wire all contracts together */
        await (await fpRegistry.connect(deployer).setRegistry(registryAddr)).wait();
        await (await collateralVault.connect(deployer).setRegistry(registryAddr)).wait();
        await (await escrowReceiver.connect(deployer).setRegistry(registryAddr)).wait();

        /* Deploy supplier and investor SBTs and configure investor access on registry */
        const SBTFactory = await ethers.getContractFactory("ArbitraSBT", deployer);
        supplierSbt = await SBTFactory.deploy(deployer.address);
        await supplierSbt.waitForDeployment();

        investorSbt = await SBTFactory.deploy(deployer.address);
        await investorSbt.waitForDeployment();
        investorSbtAddr = await investorSbt.getAddress();

        await (await supplierSbt.setKYBOracle(deployer.address)).wait();
        await (await investorSbt.setKYBOracle(deployer.address)).wait();
        await (await supplierSbt.mintSBT(supplier.address, "0x0000000000000000000000000000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000000000000000000000000000", 30)).wait();
        await (await investorSbt.mintSBT(investor.address, "0x0000000000000000000000000000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000000000000000000000000000", 30)).wait();
        await (await registry.setSBTContract(investorSbtAddr)).wait();

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
                    fingerprint,
                    1050n
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

            /* Step 4: Permanent assessment access */
            await (await registry.connect(investor).requestRiskAssessmentAccess(nextInvoiceId)).wait();

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

            /* Step 6: Simulate mock bank repayment with oracle-signed payment proof */
            const paymentReference = ethers.keccak256(ethers.toUtf8Bytes("ARB-LOCKBOX-INV-1"));
            const bankTraceId = ethers.keccak256(ethers.toUtf8Bytes("MOCKBANK-TRACE-1"));
            const latestPaymentBlock = await ethers.provider.getBlock("latest");
            const receivedAt = BigInt(latestPaymentBlock!.timestamp);
            const paymentNonce = 1n;
            const purchasePrice = await registry.getPurchasePricePlaintext(nextInvoiceId);
            const supplierReserve = faceValue - purchasePrice;

            const paymentDomain = {
                name: "ArbitraSettlement",
                version: "1",
                chainId: chainId,
                verifyingContract: escrowReceiverAddr
            };

            const paymentTypes = {
                PaymentReceived: [
                    { name: "invoiceId",        type: "uint256" },
                    { name: "paymentReference", type: "bytes32" },
                    { name: "amount",           type: "uint256" },
                    { name: "receivedAt",       type: "uint256" },
                    { name: "nonce",            type: "uint256" }
                ]
            };

            const paymentMessage = {
                invoiceId: nextInvoiceId,
                paymentReference,
                amount: faceValue,
                receivedAt,
                nonce: paymentNonce
            };

            const paymentSignature = await platformVerifier.signTypedData(paymentDomain, paymentTypes, paymentMessage);
            const settlementReceiptHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "bytes32", "uint256", "uint256", "uint256", "bytes32", "address"],
                    [nextInvoiceId, paymentReference, faceValue, receivedAt, paymentNonce, bankTraceId, platformVerifier.address]
                )
            );

            await expect(
                escrowReceiver.connect(bystander).repayInvoice(
                    nextInvoiceId,
                    paymentReference,
                    faceValue,
                    receivedAt,
                    paymentNonce,
                    bankTraceId,
                    paymentSignature
                )
            ).to.emit(escrowReceiver, "SettlementFinalized")
             .withArgs(nextInvoiceId, paymentReference, settlementReceiptHash);

            await expect(
                escrowReceiver.connect(bystander).repayInvoice(
                    nextInvoiceId,
                    paymentReference,
                    faceValue,
                    receivedAt,
                    paymentNonce,
                    bankTraceId,
                    paymentSignature
                )
            ).to.be.revertedWith("Arbitra: already settled");

            const investorSettlementHandle = await escrowReceiver.getConfidentialSettlementBalance(investor.address);
            const supplierSettlementHandle = await escrowReceiver.getConfidentialSettlementBalance(supplier.address);
            const platformSettlementHandle = await escrowReceiver.getConfidentialSettlementBalance(deployer.address);

            const investorSettlementBalance = await fhevm.debugger.decryptEuint(FhevmType.euint64, investorSettlementHandle);
            const supplierSettlementBalance = await fhevm.debugger.decryptEuint(FhevmType.euint64, supplierSettlementHandle);
            const platformSettlementBalance = await fhevm.debugger.decryptEuint(FhevmType.euint64, platformSettlementHandle);

            expect(investorSettlementBalance).to.equal(purchasePrice);
            expect(supplierSettlementBalance).to.equal(supplierReserve);
            expect(platformSettlementBalance).to.equal(0n);

            /* Check that escrow status is settled and supplier collateral released */
            const invAfterRepay = await registry.invoices(nextInvoiceId);
            expect(invAfterRepay.status).to.equal(3n); /* Settled */
            expect(await collateralVault.stakedCollateral(nextInvoiceId)).to.equal(0n);
            expect(await collateralVault.stakeStates(nextInvoiceId)).to.equal(5n); // STAKE_RELEASED

            const ratioHandle = await registry.getSupplierRatioHandle(supplier.address);
            const repaymentRatio = await fhevm.debugger.decryptEuint(FhevmType.euint64, ratioHandle);
            expect(repaymentRatio).to.equal(10000n);
        });

        it("should process on-chain FHE duplicate checking loop correctly", async function () {
            const faceValue = 1_000_000_000n;
            const dueDate = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);
            const fingerprint = 111222333n;
            const uniqueFingerprint = 888999000n;
            const baseRate = 300n;
            const reputationMultiplier = 5n;

            /* 1. Check uniqueness for a clean fingerprint - should be false */
            const inputUnique = fhevm.createEncryptedInput(fpRegistryAddr, supplier.address);
            inputUnique.add64(uniqueFingerprint);
            inputUnique.add64(faceValue);
            const encUnique = await inputUnique.encrypt();

            const txUnique = await fpRegistry.connect(supplier).checkInvoiceUniqueness(
                encUnique.handles[0], encUnique.inputProof,
                encUnique.handles[1], encUnique.inputProof
            );
            await txUnique.wait();

            const dupHandleUnique = await fpRegistry.getDuplicateCheckHandle(supplier.address);
            const isDupUnique = await fhevm.debugger.decryptEbool(dupHandleUnique);
            expect(isDupUnique).to.equal(false);

            /* 2. Stake and upload the fingerprint to register it */
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
                fingerprint,
                1050n
            )).wait();

            /* 3. Check duplicate for the same fingerprint - should be true */
            const inputDup = fhevm.createEncryptedInput(fpRegistryAddr, supplier.address);
            inputDup.add64(fingerprint); /* SAME FINGERPRINT */
            inputDup.add64(faceValue);
            const encDup = await inputDup.encrypt();

            const txDup = await fpRegistry.connect(supplier).checkInvoiceUniqueness(
                encDup.handles[0], encDup.inputProof,
                encDup.handles[1], encDup.inputProof
            );
            await txDup.wait();

            const dupHandleDup = await fpRegistry.getDuplicateCheckHandle(supplier.address);
            const isDup = await fhevm.debugger.decryptEbool(dupHandleDup);
            expect(isDup).to.equal(true);
        });

        it("should require investor SBT for risk assessment access", async function () {
            const faceValue = 1_000_000_000n;
            const dueDate = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);
            const fingerprint = 222333444n;
            const baseRate = 300n;
            const reputationMultiplier = 5n;
            const nextInvoiceId = 1n;

            expect(await supplierSbt.hasValidSBT(supplier.address)).to.equal(true);
            expect(await investorSbt.hasValidSBT(supplier.address)).to.equal(false);
            expect(await investorSbt.hasValidSBT(investor.address)).to.equal(true);
            expect(await registry.sbtContract()).to.equal(investorSbtAddr);

            const requiredCollateral = (faceValue * 500n) / 10000n;
            await (await mockUSDC.connect(supplier).approve(collateralVaultAddr, requiredCollateral)).wait();
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
                fingerprint,
                1050n
            )).wait();

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
            await (await registry.connect(debtor).confirmInvoice(nextInvoiceId, signature, attestationCommitment)).wait();

            await expect(
                registry.connect(supplier).requestRiskAssessmentAccess(nextInvoiceId)
            ).to.be.revertedWith("Arbitra: must hold SBT");

            await (await registry.connect(investor).requestRiskAssessmentAccess(nextInvoiceId)).wait();
        });

        it("should prevent double fingerprint registration if confirmAndRegister and uploadInvoice are both called", async function () {
            const faceValue = 1_000_000_000n;
            const dueDate = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);
            const fingerprint = 444555666n;
            const baseRate = 300n;
            const reputationMultiplier = 5n;
            const nextInvoiceId = 1n;

            /* 1. Uniqueness check preflight */
            const inputUnique = fhevm.createEncryptedInput(fpRegistryAddr, supplier.address);
            inputUnique.add64(fingerprint);
            inputUnique.add64(faceValue);
            const encUnique = await inputUnique.encrypt();
            await (await fpRegistry.connect(supplier).checkInvoiceUniqueness(
                encUnique.handles[0], encUnique.inputProof,
                encUnique.handles[1], encUnique.inputProof
            )).wait();

            /* 2. Stake collateral */
            await (await mockUSDC.connect(supplier).approve(collateralVaultAddr, 100_000_000n)).wait();
            await (await collateralVault.connect(supplier).stakeCollateral(fingerprint, faceValue)).wait();

            /* 3. Call confirmAndRegister on fpRegistry */
            const initialCount = await fpRegistry.fingerprintCount();
            await (await fpRegistry.connect(supplier).confirmAndRegister(nextInvoiceId)).wait();
            expect(await fpRegistry.fingerprintCount()).to.equal(initialCount + 1n);

            /* 4. Call uploadInvoice on registry (which internally calls registerFingerprint) */
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
                fingerprint,
                1050n
            )).wait();

            /* 5. Expect the count of fingerprints has NOT increased again */
            expect(await fpRegistry.fingerprintCount()).to.equal(initialCount + 1n);
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
                fingerprint,
                1050n
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
                fingerprint,
                1050n
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
