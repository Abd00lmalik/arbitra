import { expect } from "chai";
import { ethers } from "hardhat";
import { fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ArbitraInvoiceRegistry", function () {
  /* Contract instances */
  let registry: any;
  let mockCUSDT: any;
  let registryAddr: string;
  let cUSDTAddr: string;

  /* Signers */
  let deployer: HardhatEthersSigner;
  let supplier: HardhatEthersSigner;
  let investor: HardhatEthersSigner;
  let buyer: HardhatEthersSigner;

  /* Deploy fresh contracts before each test */
  beforeEach(async function () {
    [deployer, supplier, investor, buyer] = await ethers.getSigners();

    /* Deploy MockERC7984 (cUSDT stand-in) */
    const MockERC7984Factory = await ethers.getContractFactory("MockERC7984", deployer);
    mockCUSDT = await MockERC7984Factory.deploy();
    await mockCUSDT.waitForDeployment();
    cUSDTAddr = await mockCUSDT.getAddress();

    /* Deploy ArbitraInvoiceRegistry */
    const RegistryFactory = await ethers.getContractFactory(
      "ArbitraInvoiceRegistry",
      deployer
    );
    registry = await RegistryFactory.deploy(cUSDTAddr);
    await registry.waitForDeployment();
    registryAddr = await registry.getAddress();

    /* Mint cUSDT to investor using plaintext mint (test helper).
       2000 USDT = 2_000_000_000 micro-units (6 decimals). */
    const mintTx = await mockCUSDT
      .connect(investor)
      .mint(investor.address, 2_000_000_000n);
    await mintTx.wait();

    /* Investor approves registry as operator on cUSDT.
       ERC-7984 uses time-bounded setOperator instead of approve(address).
       Expiry: 24 hours from now. */
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 86_400);
    const approveTx = await mockCUSDT
      .connect(investor)
      .setOperator(registryAddr, expiry);
    await approveTx.wait();
  });

  /* ------------------------------------------------------------------ */
  /* Upload                                                               */
  /* ------------------------------------------------------------------ */

  describe("uploadInvoice", function () {
    it("should upload an invoice and emit InvoiceUploaded event", async function () {
      const faceValue = 1_000_000_000n; /* 1000 USDT */
      const dueDate   = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400); /* 30 days */

      const input = fhevm.createEncryptedInput(registryAddr, supplier.address);
      input.add64(faceValue);
      input.add64(dueDate);
      const enc = await input.encrypt();

      await expect(
        registry
          .connect(supplier)
          .uploadInvoice(
            enc.handles[0], enc.inputProof,
            enc.handles[1], enc.inputProof,
            buyer.address
          )
      )
        .to.emit(registry, "InvoiceUploaded")
        .withArgs(1n, supplier.address, buyer.address, (val: bigint) => val > 0n);
    });

    it("should increment invoiceCount after upload", async function () {
      const faceValue = 500_000_000n;
      const dueDate   = BigInt(Math.floor(Date.now() / 1000) + 15 * 86400);

      const input = fhevm.createEncryptedInput(registryAddr, supplier.address);
      input.add64(faceValue);
      input.add64(dueDate);
      const enc = await input.encrypt();

      await (
        await registry
          .connect(supplier)
          .uploadInvoice(
            enc.handles[0], enc.inputProof,
            enc.handles[1], enc.inputProof,
            buyer.address
          )
      ).wait();

      const count = await registry.invoiceCount();
      expect(count).to.equal(1n);
    });

    it("should store invoice with correct plaintext fields", async function () {
      const faceValue = 1_000_000_000n;
      const dueDate   = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);

      const input = fhevm.createEncryptedInput(registryAddr, supplier.address);
      input.add64(faceValue);
      input.add64(dueDate);
      const enc = await input.encrypt();

      await (
        await registry
          .connect(supplier)
          .uploadInvoice(
            enc.handles[0], enc.inputProof,
            enc.handles[1], enc.inputProof,
            buyer.address
          )
      ).wait();

      const inv = await registry.invoices(1n);
      expect(inv.supplier).to.equal(supplier.address);
      expect(inv.buyer).to.equal(buyer.address);
      expect(inv.investor).to.equal(ethers.ZeroAddress);
      expect(inv.isFactored).to.equal(false);
      expect(inv.isRepaid).to.equal(false);
    });

    it("should allow supplier to decrypt their own face value", async function () {
      const faceValue = 1_000_000_000n;
      const dueDate   = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);

      const input = fhevm.createEncryptedInput(registryAddr, supplier.address);
      input.add64(faceValue);
      input.add64(dueDate);
      const enc = await input.encrypt();

      await (
        await registry
          .connect(supplier)
          .uploadInvoice(
            enc.handles[0], enc.inputProof,
            enc.handles[1], enc.inputProof,
            buyer.address
          )
      ).wait();

      const handles = await registry.getInvoiceHandles(1n);
      const clearFaceValue = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        handles.faceValueHandle,
        registryAddr,
        supplier
      );

      expect(clearFaceValue).to.equal(faceValue);
    });

    it("should revert on zero buyer address", async function () {
      const faceValue = 1_000_000_000n;
      const dueDate   = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);

      const input = fhevm.createEncryptedInput(registryAddr, supplier.address);
      input.add64(faceValue);
      input.add64(dueDate);
      const enc = await input.encrypt();

      await expect(
        registry
          .connect(supplier)
          .uploadInvoice(
            enc.handles[0], enc.inputProof,
            enc.handles[1], enc.inputProof,
            ethers.ZeroAddress
          )
      ).to.be.revertedWith("Arbitra: zero buyer");
    });

    it("should index the invoice under the supplier's address", async function () {
      const faceValue = 1_000_000_000n;
      const dueDate   = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);

      const input = fhevm.createEncryptedInput(registryAddr, supplier.address);
      input.add64(faceValue);
      input.add64(dueDate);
      const enc = await input.encrypt();

      await (
        await registry
          .connect(supplier)
          .uploadInvoice(
            enc.handles[0], enc.inputProof,
            enc.handles[1], enc.inputProof,
            buyer.address
          )
      ).wait();

      const ids = await registry.getSupplierInvoices(supplier.address);
      expect(ids.length).to.equal(1);
      expect(ids[0]).to.equal(1n);
    });
  });

  /* ------------------------------------------------------------------ */
  /* Factor                                                               */
  /* ------------------------------------------------------------------ */

  describe("factorInvoice", function () {
    let invoiceId: bigint;

    beforeEach(async function () {
      /* Upload one invoice as supplier */
      const faceValue = 100_000_000n; /* 100 USDT - well within safe max */
      const dueDate   = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);

      const input = fhevm.createEncryptedInput(registryAddr, supplier.address);
      input.add64(faceValue);
      input.add64(dueDate);
      const enc = await input.encrypt();

      const tx = await registry
        .connect(supplier)
        .uploadInvoice(
          enc.handles[0], enc.inputProof,
          enc.handles[1], enc.inputProof,
          buyer.address
        );
      await tx.wait();
      invoiceId = 1n;
    });

    it("should factor an invoice and emit InvoiceFactored", async function () {
      await expect(registry.connect(investor).factorInvoice(invoiceId))
        .to.emit(registry, "InvoiceFactored")
        .withArgs(invoiceId, investor.address, (val: bigint) => val > 0n);
    });

    it("should mark invoice as factored after purchase", async function () {
      await (await registry.connect(investor).factorInvoice(invoiceId)).wait();
      const inv = await registry.invoices(invoiceId);
      expect(inv.isFactored).to.equal(true);
      expect(inv.investor).to.equal(investor.address);
    });

    it("should revert when supplier tries to factor own invoice", async function () {
      await expect(
        registry.connect(supplier).factorInvoice(invoiceId)
      ).to.be.revertedWith("Arbitra: supplier cannot factor own invoice");
    });

    it("should revert on double factoring", async function () {
      await (await registry.connect(investor).factorInvoice(invoiceId)).wait();
      await expect(
        registry.connect(investor).factorInvoice(invoiceId)
      ).to.be.revertedWith("Arbitra: already factored");
    });

    it("should index invoice under investor address", async function () {
      await (await registry.connect(investor).factorInvoice(invoiceId)).wait();
      const ids = await registry.getInvestorInvoices(investor.address);
      expect(ids.length).to.equal(1);
      expect(ids[0]).to.equal(invoiceId);
    });

    it("should revert if investor has not set operator", async function () {
      /* buyer has not called setOperator — should revert with custom error */
      await expect(
        registry.connect(buyer).factorInvoice(invoiceId)
      ).to.be.revertedWithCustomError(registry, "InvestorNotApprovedOperator");
    });

    it("should return isInvestorApproved correctly", async function () {
      /* investor approved in beforeEach */
      expect(await registry.isInvestorApproved(investor.address)).to.equal(true);
      /* buyer has not approved */
      expect(await registry.isInvestorApproved(buyer.address)).to.equal(false);
    });
  });

  /* ------------------------------------------------------------------ */
  /* Repayment                                                            */
  /* ------------------------------------------------------------------ */

  describe("triggerRepayment", function () {
    let invoiceId: bigint;

    beforeEach(async function () {
      /* Upload and factor an invoice */
      const faceValue = 100_000_000n;
      const dueDate   = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);

      const input = fhevm.createEncryptedInput(registryAddr, supplier.address);
      input.add64(faceValue);
      input.add64(dueDate);
      const enc = await input.encrypt();

      await (
        await registry
          .connect(supplier)
          .uploadInvoice(
            enc.handles[0], enc.inputProof,
            enc.handles[1], enc.inputProof,
            buyer.address
          )
      ).wait();
      invoiceId = 1n;

      await (await registry.connect(investor).factorInvoice(invoiceId)).wait();
    });

    it("should repay invoice and emit InvoiceRepaid", async function () {
      await expect(registry.connect(supplier).triggerRepayment(invoiceId))
        .to.emit(registry, "InvoiceRepaid")
        .withArgs(invoiceId, supplier.address, (val: bigint) => val > 0n);
    });

    it("should mark invoice as repaid", async function () {
      await (await registry.connect(supplier).triggerRepayment(invoiceId)).wait();
      const inv = await registry.invoices(invoiceId);
      expect(inv.isRepaid).to.equal(true);
    });

    it("should revert when non-supplier calls repayment", async function () {
      await expect(
        registry.connect(investor).triggerRepayment(invoiceId)
      ).to.be.revertedWith("Arbitra: not supplier");
    });

    it("should revert on double repayment", async function () {
      await (await registry.connect(supplier).triggerRepayment(invoiceId)).wait();
      await expect(
        registry.connect(supplier).triggerRepayment(invoiceId)
      ).to.be.revertedWith("Arbitra: already repaid");
    });

    it("should revert repayment on unfactored invoice", async function () {
      /* Upload a second invoice but do not factor it */
      const faceValue = 50_000_000n;
      const dueDate   = BigInt(Math.floor(Date.now() / 1000) + 10 * 86400);

      const input = fhevm.createEncryptedInput(registryAddr, supplier.address);
      input.add64(faceValue);
      input.add64(dueDate);
      const enc = await input.encrypt();

      await (
        await registry
          .connect(supplier)
          .uploadInvoice(
            enc.handles[0], enc.inputProof,
            enc.handles[1], enc.inputProof,
            buyer.address
          )
      ).wait();

      await expect(
        registry.connect(supplier).triggerRepayment(2n)
      ).to.be.revertedWith("Arbitra: not factored");
    });
  });

  /* ------------------------------------------------------------------ */
  /* View functions                                                       */
  /* ------------------------------------------------------------------ */

  describe("getAllInvoiceIds", function () {
    it("should return all invoice IDs in order", async function () {
      /* Upload two invoices */
      for (let i = 0; i < 2; i++) {
        const faceValue = BigInt(100_000_000 * (i + 1));
        const dueDate   = BigInt(Math.floor(Date.now() / 1000) + (i + 1) * 10 * 86400);

        const input = fhevm.createEncryptedInput(registryAddr, supplier.address);
        input.add64(faceValue);
        input.add64(dueDate);
        const enc = await input.encrypt();

        await (
          await registry
            .connect(supplier)
            .uploadInvoice(
              enc.handles[0], enc.inputProof,
              enc.handles[1], enc.inputProof,
              buyer.address
            )
        ).wait();
      }

      const ids = await registry.getAllInvoiceIds();
      expect(ids.length).to.equal(2);
      expect(ids[0]).to.equal(1n);
      expect(ids[1]).to.equal(2n);
    });
  });

  /* ------------------------------------------------------------------ */
  /* Supplier stats                                                        */
  /* ------------------------------------------------------------------ */

  describe("supplier credit stats", function () {
    it("should initialize stats on first upload", async function () {
      const faceValue = 100_000_000n;
      const dueDate   = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);

      const input = fhevm.createEncryptedInput(registryAddr, supplier.address);
      input.add64(faceValue);
      input.add64(dueDate);
      const enc = await input.encrypt();

      await (
        await registry
          .connect(supplier)
          .uploadInvoice(
            enc.handles[0], enc.inputProof,
            enc.handles[1], enc.inputProof,
            buyer.address
          )
      ).wait();

      const stats = await registry.supplierStats(supplier.address);
      expect(stats.initialized).to.equal(true);
    });

    it("should return non-zero ratio handle after a repayment", async function () {
      /* Upload, factor, repay */
      const faceValue = 100_000_000n;
      const dueDate   = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);

      const input = fhevm.createEncryptedInput(registryAddr, supplier.address);
      input.add64(faceValue);
      input.add64(dueDate);
      const enc = await input.encrypt();

      await (
        await registry
          .connect(supplier)
          .uploadInvoice(
            enc.handles[0], enc.inputProof,
            enc.handles[1], enc.inputProof,
            buyer.address
          )
      ).wait();

      await (await registry.connect(investor).factorInvoice(1n)).wait();
      await (await registry.connect(supplier).triggerRepayment(1n)).wait();

      const ratioHandle = await registry.getSupplierRatioHandle(supplier.address);
      expect(ratioHandle).to.not.equal(ethers.ZeroHash);
    });
  });
});
