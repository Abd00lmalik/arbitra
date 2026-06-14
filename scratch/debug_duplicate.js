const hre = require("hardhat");
const { ethers, fhevm } = hre;

async function main() {
    const [deployer, supplier, investor, debtor, bystander, platformVerifier] = await ethers.getSigners();
    console.log("Deploying contracts...");

    /* Deploy MockUSDC */
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC", deployer);
    const mockUSDC = await MockUSDCFactory.deploy();
    await mockUSDC.waitForDeployment();
    const mockUSDCAddr = await mockUSDC.getAddress();

    /* Deploy MockERC7984 (cUSDC mock) */
    const MockERC7984Factory = await ethers.getContractFactory("MockERC7984", deployer);
    const mockCUSDC = await MockERC7984Factory.deploy();
    await mockCUSDC.waitForDeployment();
    const mockCUSDCAddr = await mockCUSDC.getAddress();

    /* Deploy FingerprintRegistry */
    const FPFactory = await ethers.getContractFactory("ArbitraFingerprintRegistry", deployer);
    const fpRegistry = await FPFactory.deploy();
    await fpRegistry.waitForDeployment();
    const fpRegistryAddr = await fpRegistry.getAddress();

    /* Deploy RiskCalculator */
    const RiskFactory = await ethers.getContractFactory("ArbitraRiskCalculator", deployer);
    const riskCalc = await RiskFactory.deploy();
    await riskCalc.waitForDeployment();
    const riskCalcAddr = await riskCalc.getAddress();

    /* Deploy CollateralVault */
    const VaultFactory = await ethers.getContractFactory("ArbitraCollateralVault", deployer);
    const collateralVault = await VaultFactory.deploy(mockUSDCAddr);
    await collateralVault.waitForDeployment();
    const collateralVaultAddr = await collateralVault.getAddress();

    /* Deploy EscrowReceiver */
    const EscrowFactory = await ethers.getContractFactory("ArbitraEscrowReceiver", deployer);
    const escrowReceiver = await EscrowFactory.deploy(mockUSDCAddr);
    await escrowReceiver.waitForDeployment();
    const escrowReceiverAddr = await escrowReceiver.getAddress();

    /* Deploy main Registry */
    const RegistryFactory = await ethers.getContractFactory("ArbitraInvoiceRegistry", deployer);
    const registry = await RegistryFactory.deploy(
        mockUSDCAddr,
        fpRegistryAddr,
        riskCalcAddr,
        collateralVaultAddr,
        escrowReceiverAddr,
        platformVerifier.address
    );
    await registry.waitForDeployment();
    const registryAddr = await registry.getAddress();

    /* Wire all contracts together */
    await (await fpRegistry.connect(deployer).setRegistry(registryAddr)).wait();
    await (await collateralVault.connect(deployer).setRegistry(registryAddr)).wait();
    await (await escrowReceiver.connect(deployer).setRegistry(registryAddr)).wait();

    // Initialize coprocessor
    console.log("Initializing FHEVM coprocessor mock...");
    await fhevm.assertCoprocessorInitialized(registry, "ArbitraInvoiceRegistry");
    await fhevm.assertCoprocessorInitialized(fpRegistry, "ArbitraFingerprintRegistry");

    /* Mint assets to participants */
    await (await mockUSDC.mint(supplier.address, 10_000_000_000n)).wait(); /* 10k USDC */

    const faceValue = 1_000_000_000n;
    const dueDate = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);
    const duplicateFingerprint = 111222333n;
    const uniqueFingerprint = 888999000n;
    const baseRate = 300n;
    const reputationMultiplier = 5n;

    /* Stake and upload the duplicate fingerprint first */
    await (await mockUSDC.connect(supplier).approve(collateralVaultAddr, 100_000_000n)).wait();
    await (await collateralVault.connect(supplier).stakeCollateral(duplicateFingerprint, faceValue)).wait();

    const input1 = fhevm.createEncryptedInput(registryAddr, supplier.address);
    input1.add64(faceValue);
    input1.add64(dueDate);
    input1.add64(duplicateFingerprint);
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
        duplicateFingerprint
    )).wait();

    console.log("First invoice uploaded.");

    // Check unique fingerprint
    console.log("Checking unique fingerprint...");
    const inputUnique = fhevm.createEncryptedInput(registryAddr, supplier.address);
    inputUnique.add64(uniqueFingerprint);
    const encUnique = await inputUnique.encrypt();

    const isUniqueHandle = await registry.connect(supplier).checkDuplicate.staticCall(
        encUnique.handles[0], encUnique.inputProof
    );
    const isUnique = await fhevm.debugger.decryptEbool(isUniqueHandle);
    console.log("isUnique result:", isUnique);

    // Check duplicate fingerprint
    console.log("Checking duplicate fingerprint...");
    const inputDup = fhevm.createEncryptedInput(registryAddr, supplier.address);
    inputDup.add64(duplicateFingerprint);
    const encDup = await inputDup.encrypt();

    try {
        const isDupHandle = await registry.connect(supplier).checkDuplicate.staticCall(
            encDup.handles[0], encDup.inputProof
        );
        console.log("isDupHandle:", isDupHandle);
        const isDup = await fhevm.debugger.decryptEbool(isDupHandle);
        console.log("isDup result:", isDup);
    } catch (e) {
        console.error("Failed to check duplicate:", e);
    }
}

main().catch(console.error);
