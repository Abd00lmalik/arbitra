import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/*
 * Seed mock data for demo purposes.
 * Creates 2 sample invoices with different suppliers.
 * Only runs on hardhat/localhost, skipped on Sepolia.
 */
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Skipping mock data seeding on non-local network.");
    return;
  }

  const { deployments, ethers } = hre;
  /* Access fhevm from hre for encrypted input creation */
  const fhevm = (hre as any).fhevm;

  const signers = await ethers.getSigners();
  const supplier1 = signers[1];
  const supplier2 = signers[2];
  const buyer1 = signers[3];

  const registryDeployment = await deployments.get("ArbitraInvoiceRegistry");
  const registry = await ethers.getContractAt(
    "ArbitraInvoiceRegistry",
    registryDeployment.address,
    supplier1
  );

  const registryAddr = await registry.getAddress();

  try {
    /* Invoice 1: 1000 cUSDT, due in 30 days */
    const faceValue1 = 1_000_000_000n;
    const dueDate1 = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);

    const input1 = fhevm.createEncryptedInput(registryAddr, supplier1.address);
    input1.add64(faceValue1);
    input1.add64(dueDate1);
    const enc1 = await input1.encrypt();

    const tx1 = await registry.uploadInvoice(
      enc1.handles[0],
      enc1.inputProof,
      enc1.handles[1],
      enc1.inputProof,
      buyer1.address
    );
    await tx1.wait();
    console.log("Seeded invoice #1 (1000 cUSDT, 30-day maturity)");

    /* Invoice 2: 500 cUSDT, due in 15 days (different supplier) */
    const faceValue2 = 500_000_000n;
    const dueDate2 = BigInt(Math.floor(Date.now() / 1000) + 15 * 86400);

    const registryS2 = registry.connect(supplier2);
    const input2 = fhevm.createEncryptedInput(registryAddr, supplier2.address);
    input2.add64(faceValue2);
    input2.add64(dueDate2);
    const enc2 = await input2.encrypt();

    const tx2 = await registryS2.uploadInvoice(
      enc2.handles[0],
      enc2.inputProof,
      enc2.handles[1],
      enc2.inputProof,
      buyer1.address
    );
    await tx2.wait();
    console.log("Seeded invoice #2 (500 cUSDT, 15-day maturity)");
    console.log("Mock data seeding complete.");
  } catch (err: any) {
    console.warn("⚠️ Skipping mock data seeding: FHEVM plugin not initialized or not supported in this deploy context.", err.message || err);
  }
};

func.tags = ["MockData"];
func.dependencies = ["ArbitraInvoiceRegistry"];
export default func;
