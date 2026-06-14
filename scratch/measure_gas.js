const hre = require("hardhat");

async function main() {
  const [deployer, supplier, investor, debtor, bystander, platformVerifier] = await hre.ethers.getSigners();
  console.log("Deploying contracts...");
  
  // Deploy MockUSDC
  const MockUSDCFactory = await hre.ethers.getContractFactory("MockUSDC", deployer);
  const mockUSDC = await MockUSDCFactory.deploy();
  await mockUSDC.waitForDeployment();
  const mockUSDCAddr = await mockUSDC.getAddress();

  // Deploy FingerprintRegistry
  const FPFactory = await hre.ethers.getContractFactory("ArbitraFingerprintRegistry", deployer);
  const fpRegistry = await FPFactory.deploy();
  await fpRegistry.waitForDeployment();
  const fpRegistryAddr = await fpRegistry.getAddress();

  // Deploy RiskCalculator
  const RiskFactory = await hre.ethers.getContractFactory("ArbitraRiskCalculator", deployer);
  const riskCalc = await RiskFactory.deploy();
  await riskCalc.waitForDeployment();
  const riskCalcAddr = await riskCalc.getAddress();

  // Deploy CollateralVault
  const VaultFactory = await hre.ethers.getContractFactory("ArbitraCollateralVault", deployer);
  const collateralVault = await VaultFactory.deploy(mockUSDCAddr);
  await collateralVault.waitForDeployment();
  const collateralVaultAddr = await collateralVault.getAddress();

  // Deploy EscrowReceiver
  const EscrowFactory = await hre.ethers.getContractFactory("ArbitraEscrowReceiver", deployer);
  const escrowReceiver = await EscrowFactory.deploy(mockUSDCAddr);
  await escrowReceiver.waitForDeployment();
  const escrowReceiverAddr = await escrowReceiver.getAddress();

  // Deploy main Registry
  const RegistryFactory = await hre.ethers.getContractFactory("ArbitraInvoiceRegistry", deployer);
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

  // Wire all contracts together
  await (await fpRegistry.connect(deployer).setRegistry(registryAddr)).wait();
  await (await collateralVault.connect(deployer).setRegistry(registryAddr)).wait();
  await (await escrowReceiver.connect(deployer).setRegistry(registryAddr)).wait();

  // Mint USDC & approve
  console.log("Setting up USDC collateral...");
  const faceValue = 1000_000_000n; // 1000 USDC
  const requiredCollateral = (faceValue * 500n) / 10000n; // 5%
  await mockUSDC.mint(supplier.address, requiredCollateral * 2n);
  await mockUSDC.connect(supplier).approve(collateralVaultAddr, requiredCollateral * 2n);

  // Stake collateral
  console.log("Staking collateral...");
  const txStake = await collateralVault.connect(supplier).stakeCollateral(1n, faceValue);
  await txStake.wait();

  // Create FHE inputs
  console.log("Encrypting inputs...");
  const fhevm = hre.fhevm;
  await fhevm.initializeCLIApi();
  const input = fhevm.createEncryptedInput(registryAddr, supplier.address);
  input.add64(faceValue); // face value
  input.add64(BigInt(Math.floor(Date.now() / 1000) + 30 * 86400)); // due date
  input.add64(123456n); // fingerprint
  input.add64(500n); // base rate (5%)
  input.add64(100n); // reputation multiplier (1x)
  const enc = await input.encrypt();

  console.log("Calling uploadInvoice...");
  const txUpload = await registry.connect(supplier).uploadInvoice(
    enc.handles[0], enc.inputProof,
    enc.handles[1], enc.inputProof,
    enc.handles[2], enc.inputProof,
    enc.handles[3], enc.inputProof,
    enc.handles[4], enc.inputProof,
    debtor.address,
    true,
    faceValue
  );
  
  const receipt = await txUpload.wait();
  console.log("\n====================================");
  console.log("Actual gas used by uploadInvoice:", receipt.gasUsed.toString());
  console.log("====================================");
}

main().catch(console.error);
