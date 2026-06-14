const { ethers, fhevm } = require("hardhat");

async function main() {
  await fhevm.initializeCLIApi();
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const supplier = signers[1];
  const investor = signers[2];
  const debtor = signers[3];

  console.log("Deployer:", deployer.address);
  console.log("Supplier:", supplier.address);
  console.log("Investor:", investor.address);

  // Deploy Mock USDC
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddr = await usdc.getAddress();

  // Deploy Fingerprint Registry
  const FingerprintRegistry = await ethers.getContractFactory("ArbitraFingerprintRegistry");
  const fpRegistry = await FingerprintRegistry.deploy();
  await fpRegistry.waitForDeployment();
  const fpRegistryAddr = await fpRegistry.getAddress();

  // Deploy Risk Calculator
  const RiskCalculator = await ethers.getContractFactory("ArbitraRiskCalculator");
  const riskCalc = await RiskCalculator.deploy();
  await riskCalc.waitForDeployment();
  const riskCalcAddr = await riskCalc.getAddress();

  // Deploy Collateral Vault
  const CollateralVault = await ethers.getContractFactory("ArbitraCollateralVault");
  const collateralVault = await CollateralVault.deploy(usdcAddr);
  await collateralVault.waitForDeployment();
  const collateralVaultAddr = await collateralVault.getAddress();

  // Deploy Escrow Receiver
  const EscrowReceiver = await ethers.getContractFactory("ArbitraEscrowReceiver");
  const escrowReceiver = await EscrowReceiver.deploy(usdcAddr);
  await escrowReceiver.waitForDeployment();
  const escrowReceiverAddr = await escrowReceiver.getAddress();

  // Deploy Invoice Registry
  const InvoiceRegistry = await ethers.getContractFactory("ArbitraInvoiceRegistry");
  const registry = await InvoiceRegistry.deploy(
    usdcAddr,
    fpRegistryAddr,
    riskCalcAddr,
    collateralVaultAddr,
    escrowReceiverAddr,
    deployer.address // platform verifier
  );
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();

  await fpRegistry.setRegistry(registryAddr);
  await collateralVault.setRegistry(registryAddr);

  // Prepare input for upload
  const faceValue = 1000n;
  const dueDate = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);
  const fingerprint = 123456n;
  const baseRate = 100n;
  const repMult = 2n;

  // Approve and stake
  await usdc.mint(supplier.address, 1000000n);
  await usdc.connect(supplier).approve(collateralVaultAddr, 1000000n);
  await collateralVault.connect(supplier).stakeCollateral(fingerprint, faceValue);

  const input = fhevm.createEncryptedInput(registryAddr, supplier.address);
  input.add64(faceValue);
  input.add64(dueDate);
  input.add64(fingerprint);
  input.add64(baseRate);
  input.add64(repMult);
  const enc = await input.encrypt();

  // Upload invoice
  await registry.connect(supplier).uploadInvoice(
    enc.handles[0], enc.inputProof,
    enc.handles[1], enc.inputProof,
    enc.handles[2], enc.inputProof,
    enc.handles[3], enc.inputProof,
    enc.handles[4], enc.inputProof,
    debtor.address,
    true,
    faceValue,
    fingerprint
  );

  console.log("Invoice uploaded successfully. Total on-chain:", await registry.invoiceCount());

  // Try reading the invoices mapping from supplier
  console.log("Reading from Supplier...");
  const supplierResult = await registry.connect(supplier).invoices(1);
  console.log("Supplier read success! Status:", supplierResult.status);

  // Try reading the invoices mapping from investor
  console.log("Reading from Investor...");
  try {
    const investorResult = await registry.connect(investor).invoices(1);
    console.log("Investor read success! Status:", investorResult.status);
  } catch (err) {
    console.error("Investor read failed!", err);
  }
}

async function run() {
  await main();
}

run();
