/*
 * @file InvoiceDetailModal.tsx
 * @description Shared details modal for invoices featuring smooth slide-up animation,
 *              sequential investor flow (Request Access, Decrypt, Review, Deploy Capital),
 *              real FHE decryption, deterministic risk analysis fed with real decrypted values,
 *              confidential cUSDC funding, and Step 5 confidential capital deployment UX.
 */

"use client";

import React, { useEffect, useState } from "react";
import { Key, Unlock, Sparkles, Zap, CheckCircle2, ShieldCheck, AlertCircle } from "lucide-react";
import { usePublicClient, useReadContract } from "wagmi";
import { useActiveWalletClient } from "@/hooks/useActiveWalletClient";
import { generateRiskAssessment } from "@/lib/risk-assessment";
import { motion, AnimatePresence } from "framer-motion";
import {
  useInvoice,
  useFactorInvoice,
  useGrantRiskAccess,
} from "@/hooks/useArbitraRegistry";
import { useConfidentialWallet } from "@/hooks/useConfidentialWallet";
import { useInvoiceDecrypt } from "@/hooks/useInvoiceDecrypt";
import { useZama } from "@/providers/ZamaProvider";
import { NeonButton } from "../ui/NeonButton";
import { FHEBadge } from "../ui/FHEBadge";
import { EncryptedValue } from "../ui/EncryptedValue";
import {
  formatUSDC,
  formatTimestamp,
  formatBps,
  daysUntilDue,
  shortAddress,
  ARBITRA_REGISTRY_ADDRESS,
  ARBITRA_REGISTRY_ABI,
  ESCROW_RECEIVER_ADDRESS,
  ESCROW_RECEIVER_ABI,
  InvoiceStatus,
  fromMicro,
  SBT_ABI,
  INVESTOR_SBT_ADDRESS,
} from "@/lib/contracts";

interface InvoiceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: bigint | undefined;
  onActionSuccess?: () => void;
}

interface MockSettlementProof {
  paymentReference: `0x${string}`;
  paymentReferencePlain: string;
  amount: string;
  receivedAt: string;
  nonce: string;
  bankTraceId: `0x${string}`;
  bankTracePlain: string;
  signature: `0x${string}`;
}

interface SettlementSuccessState {
  txHash: `0x${string}`;
  paymentReferencePlain: string;
  bankTracePlain: string;
  settlementReceiptHash?: `0x${string}`;
}

/* Compute annualized yield % from decrypted face value, purchase price, and days to maturity */
function computeYield(faceValue: bigint, purchasePrice: bigint, daysToMaturity: number): string {
  if (purchasePrice === 0n || daysToMaturity <= 0) return "N/A";
  const gain = Number(faceValue - purchasePrice) / 1_000_000;
  const cost = Number(purchasePrice) / 1_000_000;
  if (cost <= 0) return "N/A";
  const annualized = (gain / cost) * (365 / daysToMaturity) * 100;
  return `${annualized.toFixed(2)}%`;
}

export function InvoiceDetailModal({
  isOpen,
  onClose,
  invoiceId,
  onActionSuccess,
}: InvoiceDetailModalProps) {
  const { walletClient, activeWallet: currentUserAddress, isEmbedded, getEmbeddedSigner } = useActiveWalletClient();
  const publicClient = usePublicClient();
  const { isReady: zamaReady } = useZama();

  /* Fetch core data */
  const { data: invoice, refetch: refetchInvoice } = useInvoice(invoiceId);
  const decryptContextKey = invoiceId !== undefined ? invoiceId.toString() : undefined;

  const { data: settlementCommitments, refetch: refetchSettlementCommitments } = useReadContract({
    address: ESCROW_RECEIVER_ADDRESS,
    abi: ESCROW_RECEIVER_ABI,
    functionName: "getSettlementCommitments",
    args: invoiceId !== undefined ? [invoiceId] : undefined,
    query: { enabled: invoiceId !== undefined },
  });

  /* Decryption hook */
  const { decrypted, isDecrypting, error: decryptError, decrypt, resetDecrypt } = useInvoiceDecrypt(decryptContextKey);

  /* Action hooks */
  const { factorInvoice, isPending: isFactoringPending } = useFactorInvoice();
  const { grantAccess, isPending: isGrantPending } = useGrantRiskAccess();

  const confidentialWallet = useConfidentialWallet(currentUserAddress as `0x${string}` | undefined);

  /* Query Investor SBT to gate FHE access requests */
  const { data: hasInvestorSBT } = useReadContract({
    address: INVESTOR_SBT_ADDRESS as `0x${string}`,
    abi: SBT_ABI,
    functionName: "hasValidSBT",
    args: [currentUserAddress ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!currentUserAddress },
  });

  /* Local UI state */
  const [localBusy, setLocalBusy] = useState(false);
  const [hasGrantedAccess, setHasGrantedAccess] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [factorError, setFactorError] = useState<string | null>(null);
  const [factorSuccess, setFactorSuccess] = useState<{ disbursed: string; invoiceIdStr: string } | null>(null);
  const [settlementBusy, setSettlementBusy] = useState(false);
  const [settlementError, setSettlementError] = useState<string | null>(null);
  const [settlementSuccess, setSettlementSuccess] = useState<SettlementSuccessState | null>(null);

  useEffect(() => {
    setLocalBusy(false);
    setHasGrantedAccess(false);
    setGrantError(null);
    setFactorError(null);
    setFactorSuccess(null);
    setSettlementBusy(false);
    setSettlementError(null);
    setSettlementSuccess(null);
    resetDecrypt();
  }, [invoiceId, isOpen, resetDecrypt]);

  if (!isOpen || invoiceId === undefined || !invoice) return null;

  const isFactored = invoice.status >= InvoiceStatus.Factored;
  const isRepaid = invoice.status === InvoiceStatus.Settled;
  const isDisputed = invoice.status === InvoiceStatus.Disputed;

  const isSupplier = currentUserAddress?.toLowerCase() === invoice.supplier?.toLowerCase();
  const isInvestor = currentUserAddress?.toLowerCase() === invoice.investor?.toLowerCase();
  const isDebtor = currentUserAddress?.toLowerCase() === invoice.debtor?.toLowerCase();

  /* Decryption is allowed if: supplier, factored investor, or has been granted risk access this session */
  const canDecrypt = isSupplier || isInvestor || hasGrantedAccess;
  const hasHandle = (handle: `0x${string}` | undefined) =>
    Boolean(handle) && handle !== "0x0000000000000000000000000000000000000000000000000000000000000000";
  const hasUnderwritingHandles = hasHandle(invoice.riskScore) && hasHandle(invoice.riskBand);

  /* Real yield calculation after decryption */
  const daysLeft = daysUntilDue(invoice.maturityTimestamp);
  const realYield =
    decrypted?.faceValue && decrypted?.purchasePrice
      ? computeYield(decrypted.faceValue, decrypted.purchasePrice, daysLeft)
      : null;

  const estimatedPurchasePrice = decrypted?.purchasePrice ?? 0n;
  const confidentialBalanceState = confidentialWallet.balanceState;
  const confidentialBalance =
    confidentialBalanceState.kind === "ready" || confidentialBalanceState.kind === "zero_balance"
      ? confidentialBalanceState.balance
      : 0n;
  const hasEnoughConfidentialCapital =
    estimatedPurchasePrice > 0n && confidentialBalance >= estimatedPurchasePrice;
  const underwritingScore = decrypted?.riskScore !== undefined ? Number(decrypted.riskScore) : null;
  const underwritingBand = decrypted?.riskBand !== undefined ? Number(decrypted.riskBand) : null;
  const hasFinalUnderwriting = underwritingScore !== null && underwritingBand !== null;
  const legacyUnderwriting =
    decrypted && underwritingScore === null
      ? generateRiskAssessment({
          invoiceId: Number(invoice.invoiceId),
          supplierAddress: invoice.supplier,
          buyerAddress: invoice.debtor,
          uploadTimestamp: Number(invoice.uploadTimestamp),
          isFactored,
          isRepaid,
          faceValueHint: decrypted.faceValue?.toString(),
          dueDaysHint: daysLeft,
          discountRateBpsHint: decrypted.discountRate !== undefined ? Number(decrypted.discountRate) : undefined,
        })
      : null;
  const underwritingLabel =
    underwritingBand === 0
      ? "Low"
      : underwritingBand === 1
      ? "Medium"
      : underwritingBand === 2
      ? "High"
      : null;
  const displayedUnderwritingScore =
    underwritingScore ?? legacyUnderwriting?.riskScore ?? null;
  const displayedUnderwritingLabel = underwritingLabel ?? legacyUnderwriting?.riskLabel ?? null;
  const displayedUnderwritingClass =
    displayedUnderwritingLabel === "Low"
      ? "bg-neon-green/10 text-neon-green border border-neon-green/20"
      : displayedUnderwritingLabel === "Medium"
      ? "bg-yellow-400/10 text-yellow-400 border border-yellow-400/20"
      : displayedUnderwritingLabel === "High"
      ? "bg-neon-pink/10 text-neon-pink border border-neon-pink/20"
      : null;
  const canDeployCapital =
    estimatedPurchasePrice > 0n &&
    hasFinalUnderwriting &&
    confidentialBalanceState.kind !== "loading" &&
    confidentialBalanceState.kind !== "not_configured" &&
    confidentialBalanceState.kind !== "wrapper_invalid" &&
    confidentialBalanceState.kind !== "error" &&
    confidentialBalanceState.kind !== "never_shielded" &&
    (confidentialBalanceState.kind === "needs_permit" || hasEnoughConfidentialCapital);

  /* EIP-712 dynamic decryption execution */
  const handleDecrypt = async () => {
    if (!walletClient && !isEmbedded) return;

    const signer = {
      getAddress: async () => currentUserAddress as string,
      signTypedData: async (domain: object, types: object, value: object) => {
        if (isEmbedded) {
          const embSigner = await getEmbeddedSigner();
          const cleanTypes = { ...types } as any;
          delete cleanTypes.EIP712Domain;
          return embSigner.signTypedData(domain, cleanTypes, value);
        } else {
          const externalWalletClient = walletClient;
          if (!externalWalletClient) throw new Error("Connect a wallet to decrypt this invoice.");
          return externalWalletClient.signTypedData({
            domain: domain as any,
            types: types as any,
            primaryType: Object.keys(types as Record<string, unknown>)[0],
            message: value as any,
            account: currentUserAddress as `0x${string}`,
          });
        }
      },
    };

    await decrypt(
      {
        faceValueHandle: invoice.faceValue,
        dueDateHandle: invoice.dueDate,
        purchasePriceHandle: invoice.purchasePrice,
        discountRateHandle: invoice.discountRateBps,
        riskScoreHandle: invoice.riskScore,
        riskBandHandle: invoice.riskBand,
      },
      signer
    );
  };

  /* Grant FHE access for prospective investor - permanent FHE.allow on-chain */
  const handleGrantAccess = async () => {
    setLocalBusy(true);
    setGrantError(null);
    try {
      if (!publicClient) throw new Error("Sepolia public client unavailable.");

      let txHash: `0x${string}`;

      if (isEmbedded) {
        /* Web3Auth embedded wallet - must use ethers.js, not wagmi writeContractAsync */
        const { ethers } = await import("ethers");
        const signer = await getEmbeddedSigner();
        const contract = new ethers.Contract(
          ARBITRA_REGISTRY_ADDRESS,
          ARBITRA_REGISTRY_ABI,
          signer
        );
        const tx = await contract["requestRiskAssessmentAccess"](invoice.invoiceId);
        const receipt = await tx.wait();
        txHash = receipt.hash as `0x${string}`;
      } else {
        /* External wallet (MetaMask / WalletConnect) - wagmi works fine */
        txHash = await grantAccess(invoice.invoiceId);
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }

      setHasGrantedAccess(true);
      await refetchInvoice();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Access grant failed";
      const clean = msg.includes("User rejected") || msg.includes("user rejected")
        ? "Transaction cancelled by user."
        : msg.slice(0, 200);
      setGrantError(clean);
    } finally {
      setLocalBusy(false);
    }
  };

  /* Step 5: Deploy confidential cUSDC capital through the vNext registry flow */
  const handleFactorClick = async () => {
    setLocalBusy(true);
    setFactorError(null);
    setFactorSuccess(null);

    try {
      if (!publicClient) throw new Error("Sepolia public client unavailable.");
      if (estimatedPurchasePrice === 0n) {
        throw new Error("Decrypt the confidential purchase price before deploying confidential capital.");
      }
      if (!hasFinalUnderwriting) {
        throw new Error("Encrypted underwriting is unavailable for this invoice. Capital deployment is blocked until final FHE risk output is returned.");
      }

      if (confidentialBalanceState.kind === "not_configured" || confidentialBalanceState.kind === "wrapper_invalid") {
        throw new Error(confidentialBalanceState.message);
      }

      if (confidentialBalanceState.kind === "needs_permit") {
        await confidentialWallet.grantPermit();
        throw new Error("cUSDC balance unlocked. Review your confidential balance, then deploy capital.");
      }

      if (confidentialBalanceState.kind === "never_shielded") {
        throw new Error("Shield public USDC into cUSDC from My Wallet before funding this invoice.");
      }

      if (confidentialBalanceState.kind === "loading") {
        throw new Error("Your confidential cUSDC balance is still decrypting. Please wait a moment and retry.");
      }

      if (confidentialBalanceState.kind === "error") {
        throw new Error(confidentialBalanceState.message);
      }

      if (confidentialBalance < estimatedPurchasePrice) {
        throw new Error(
          `Insufficient cUSDC. Available: $${fromMicro(confidentialBalance)} cUSDC. Required: $${fromMicro(estimatedPurchasePrice)} cUSDC.`,
        );
      }

      if (!confidentialWallet.isOperatorApproved) {
        await confidentialWallet.setRegistryOperator();
      }

      if (isEmbedded) {
        /*
         * Web3Auth embedded wallet path.
         * wagmi's writeContractAsync does NOT dispatch through the Web3Auth EIP-1193
         * provider - transactions must go through ethers.js instead.
         */
        const { ethers } = await import("ethers");
        const signer = await getEmbeddedSigner();

        /* Step 2: Factor the invoice - encrypted cUSDC moves investor to escrow */
        const registryContract = new ethers.Contract(
          ARBITRA_REGISTRY_ADDRESS,
          ARBITRA_REGISTRY_ABI,
          signer
        );
        const factorTx = await registryContract["factorInvoice"](invoice.invoiceId, {
          gasLimit: 1_000_000n,
        });
        const receipt = await factorTx.wait();
        if (!receipt || receipt.status !== 1) {
          throw new Error("factorInvoice transaction reverted on-chain.");
        }
      } else {
        /* External wallet path (MetaMask / WalletConnect). */
        const factorTxHash = await factorInvoice(invoice.invoiceId);
        await publicClient.waitForTransactionReceipt({ hash: factorTxHash });
      }

      const disbursedStr = decrypted?.purchasePrice
        ? `$${fromMicro(decrypted.purchasePrice)} cUSDC`
        : `Invoice #${invoice.invoiceId}`;

      setFactorSuccess({ disbursed: disbursedStr, invoiceIdStr: `#${invoice.invoiceId}` });
      await refetchInvoice();
      if (onActionSuccess) onActionSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Factoring failed";
      const clean = msg.includes("User rejected") || msg.includes("user rejected")
        ? "Transaction cancelled by user."
        : msg.includes("Insufficient cUSDC")
        ? msg
        : msg.slice(0, 220);
      setFactorError(clean);
    } finally {
      setLocalBusy(false);
    }
  };

  const handleSimulateRepayment = async () => {
    setSettlementBusy(true);
    setSettlementError(null);
    setSettlementSuccess(null);

    try {
      if (!publicClient) throw new Error("Sepolia public client unavailable.");
      if (!invoice.faceValuePlaintext || invoice.faceValuePlaintext === 0n) {
        throw new Error("Invoice face value is unavailable for mock lockbox reconciliation.");
      }

      const webhookResponse = await fetch("/api/mock-bank-webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.invoiceId.toString(),
          amount: invoice.faceValuePlaintext.toString(),
        }),
      });
      const webhookPayload = await webhookResponse.json();
      if (!webhookResponse.ok || !webhookPayload?.proof) {
        throw new Error(webhookPayload?.error || "Mock bank webhook failed.");
      }

      const proof = webhookPayload.proof as MockSettlementProof;
      let txHash: `0x${string}`;

      if (isEmbedded) {
        const { ethers } = await import("ethers");
        const signer = await getEmbeddedSigner();
        const escrowContract = new ethers.Contract(
          ESCROW_RECEIVER_ADDRESS,
          ESCROW_RECEIVER_ABI,
          signer
        );
        const tx = await escrowContract["repayInvoice"](
          invoice.invoiceId,
          proof.paymentReference,
          BigInt(proof.amount),
          BigInt(proof.receivedAt),
          BigInt(proof.nonce),
          proof.bankTraceId,
          proof.signature,
          { gasLimit: 1_200_000n }
        );
        const receipt = await tx.wait();
        if (!receipt || receipt.status !== 1) {
          throw new Error("repayInvoice transaction reverted on-chain.");
        }
        txHash = receipt.hash as `0x${string}`;
      } else {
        if (!walletClient || !currentUserAddress) {
          throw new Error("Connect a wallet to submit the settlement proof.");
        }
        txHash = await walletClient.writeContract({
          account: currentUserAddress as `0x${string}`,
          address: ESCROW_RECEIVER_ADDRESS,
          abi: ESCROW_RECEIVER_ABI,
          functionName: "repayInvoice",
          args: [
            invoice.invoiceId,
            proof.paymentReference,
            BigInt(proof.amount),
            BigInt(proof.receivedAt),
            BigInt(proof.nonce),
            proof.bankTraceId,
            proof.signature,
          ],
        } as any);
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }

      const commitmentResult = await refetchSettlementCommitments();
      await refetchInvoice();
      if (onActionSuccess) onActionSuccess();

      setSettlementSuccess({
        txHash,
        paymentReferencePlain: proof.paymentReferencePlain,
        bankTracePlain: proof.bankTracePlain,
        settlementReceiptHash: commitmentResult.data?.[2] as `0x${string}` | undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Settlement simulation failed";
      const clean = msg.includes("User rejected") || msg.includes("user rejected")
        ? "Transaction cancelled by user."
        : msg.slice(0, 220);
      setSettlementError(clean);
    } finally {
      setSettlementBusy(false);
    }
  };

  /* Determine investor step: 0=grant, 1=decrypt, 2=review, 3=deploy */
  const investorStep = !canDecrypt ? 0 : !decrypted ? 1 : !hasFinalUnderwriting ? 2 : 3;
  const isProspectiveInvestor = !isSupplier && !isDebtor && !isFactored;
  const isActiveInvestor = !isSupplier && !isDebtor && isFactored && isInvestor;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-navy-950/85 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal Container */}
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 26, stiffness: 220 }}
          className="relative w-full max-w-lg bg-navy-900/90 border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 sm:p-7 z-10 overflow-hidden shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh]"
        >
          {/* Header Row */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] uppercase font-bold tracking-widest text-neon-cyan px-2 py-0.5 rounded bg-neon-cyan/10">
                  Invoice details
                </span>
                <span className="text-sm font-mono text-slate-400">
                  #{invoice.invoiceId.toString()}
                </span>
              </div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                Stable Invoice Registry
                <FHEBadge />
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto space-y-5 pr-1 -mr-2 scrollbar-thin">

            {/* Wallet Info Banner */}
            <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-white/2 border border-white/5 text-xs text-slate-400">
              <div className="flex justify-between items-center">
                <span>Active Wallet Context:</span>
                <span className="font-mono text-slate-200">{currentUserAddress ? shortAddress(currentUserAddress) : "Disconnected"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Registry Verified Role:</span>
                <span className="capitalize font-bold text-white">
                  {isSupplier ? "Supplier (Creator)" : isInvestor ? "Investor (Lender)" : isDebtor ? "Debtor (Buyer)" : "Prospective Investor"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Invoice Status:</span>
                <span className="font-semibold text-white">
                  {isRepaid ? (
                    <span className="text-neon-green">Settled</span>
                  ) : isDisputed ? (
                    <span className="text-neon-pink">Disputed</span>
                  ) : isFactored ? (
                    <span className="text-neon-purple">Factored (Awaiting Maturity)</span>
                  ) : invoice.status === InvoiceStatus.Attested ? (
                    <span className="text-neon-cyan">Attested (Ready to Factor)</span>
                  ) : (
                    <span className="text-yellow-400">Pending Debtor Attestation</span>
                  )}
                </span>
              </div>
            </div>

            {/* --- INVESTOR SEQUENTIAL FLOW (Prospective) --- */}
            {isProspectiveInvestor && invoice.status === InvoiceStatus.Attested && (
              <div className="rounded-2xl border border-neon-purple/20 bg-gradient-to-br from-neon-purple/5 to-transparent overflow-hidden">
                {/* Step Progress Bar */}
                <div className="flex border-b border-white/5">
                  {["Request Access", "Decrypt", "Review Result", "Deploy Capital"].map((label, idx) => (
                    <div
                      key={idx}
                      className={`flex-1 py-2 text-center text-[9px] font-bold uppercase tracking-widest transition-all ${
                        idx < investorStep
                          ? "text-neon-green bg-neon-green/5"
                          : idx === investorStep
                          ? "text-neon-purple bg-neon-purple/10"
                          : "text-slate-600"
                      }`}
                    >
                      {idx < investorStep ? "Done: " : idx === investorStep ? "Now: " : ""}{label}
                    </div>
                  ))}
                </div>

                <div className="p-4">
                  {/* STEP 0: Request Decrypt Access */}
                  {investorStep === 0 && (
                    <div className="text-center space-y-3">
                      <div className="flex justify-center py-1">
                        <Key className="w-8 h-8 text-neon-cyan" />
                      </div>
                      <h4 className="text-sm font-bold text-white">Request FHE Decrypt Access</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Submit an on-chain transaction to grant your wallet permanent permission to decrypt this invoice&apos;s encrypted financial parameters (face value, yield, due date).
                      </p>
                      {hasInvestorSBT ? (
                        <NeonButton
                          variant="primary"
                          size="sm"
                          loading={isGrantPending || localBusy}
                          onClick={handleGrantAccess}
                          className="w-full"
                        >
                          {isGrantPending || localBusy ? "Submitting On-Chain..." : "Grant My Wallet Decrypt Access"}
                        </NeonButton>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-yellow-400">
                            Warning You must complete Investor onboarding before requesting FHE access.
                          </p>
                          <a href="/register?role=investor&upgrade=true">
                            <NeonButton variant="primary" size="sm" className="w-full bg-neon-purple border-neon-purple/50">
                              Verify as Investor
                            </NeonButton>
                          </a>
                        </div>
                      )}
                      {grantError && (
                        <div className="p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20 text-neon-pink text-xs text-left">
                          Warning {grantError}
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEP 1: Decrypt */}
                  {investorStep === 1 && (
                    <div className="text-center space-y-3">
                      <div className="flex justify-center py-1">
                        <Unlock className="w-8 h-8 text-neon-purple" />
                      </div>
                      <h4 className="text-sm font-bold text-white">Decrypt Invoice Parameters</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Your wallet now has on-chain decrypt permission. Sign an EIP-712 message to privately reveal the real face value, purchase price, yield, and maturity date - only visible to you.
                      </p>
                      {zamaReady ? (
                        <NeonButton
                          variant="primary"
                          size="sm"
                          loading={isDecrypting}
                          onClick={handleDecrypt}
                          className="w-full"
                        >
                          {isDecrypting ? "Decrypting via Zama Relayer..." : "Decrypt Financial Details"}
                        </NeonButton>
                      ) : (
                        <p className="text-xs text-yellow-400">Zama SDK initializing - please wait...</p>
                      )}
                      {decryptError && (
                        <div className="p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20 text-neon-pink text-xs text-left">
                          Warning {decryptError}
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEP 2: Review confidential underwriting result */}
                  {investorStep === 2 && (
                    <div className="text-center space-y-3">
                      <div className="flex justify-center py-1">
                        <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse" />
                      </div>
                      <h4 className="text-sm font-bold text-white">Confidential Underwriting Pending</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {hasUnderwritingHandles
                          ? "The registry returned underwriting handles, but they did not decrypt for this wallet yet. Request access again or refresh after the ACL transaction is indexed."
                          : "This invoice was created on a registry version that does not expose final encrypted underwriting handles. Capital deployment is blocked until the invoice is uploaded on the upgraded registry."}
                      </p>
                      {legacyUnderwriting && (
                        <div className="p-3 rounded-xl bg-yellow-400/10 border border-yellow-400/20 text-yellow-300 text-xs text-left">
                          Local deterministic review: {legacyUnderwriting.riskLabel} risk ({legacyUnderwriting.riskScore}/100). This is informational only and cannot unlock deployment.
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEP 3: Deploy Capital */}
                  {investorStep === 3 && !factorSuccess && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-white text-center flex items-center justify-center gap-1.5">
                        <Zap className="w-4 h-4 text-amber-400" /> Deploy Confidential cUSDC Capital
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed text-center">
                        Fund this invoice with shielded cUSDC. Arbitra moves encrypted capital from your wallet to escrow, then escrow forwards encrypted cUSDC to the supplier while recording your invoice RWA ownership.
                      </p>
                      <p className="text-[11px] text-slate-500 leading-relaxed text-center">
                        Use My Wallet to shield public USDC into cUSDC first. If this is your first confidential action, Arbitra will also request the ERC-7984 operator approval needed to route encrypted capital through the registry.
                      </p>
                      {/* Confidential capital readiness */}
                      <div className="flex justify-between items-center p-2.5 rounded-xl bg-white/2 border border-white/5 text-xs">
                        <span className="text-slate-400">Your Shieldable USDC Balance</span>
                        <span className="font-mono font-bold text-white">
                          ${fromMicro(confidentialWallet.usdcBalance ?? 0n)} USDC
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-2.5 rounded-xl bg-white/2 border border-white/5 text-xs">
                        <span className="text-slate-400">Your Confidential cUSDC Balance</span>
                        <span
                          className={`font-mono font-bold ${
                            hasEnoughConfidentialCapital || confidentialBalanceState.kind === "needs_permit"
                              ? "text-neon-green"
                              : "text-neon-pink"
                          }`}
                        >
                          {confidentialBalanceState.kind === "ready" || confidentialBalanceState.kind === "zero_balance"
                            ? `$${fromMicro(confidentialBalance)} cUSDC`
                            : confidentialBalanceState.kind === "loading"
                            ? "Decrypting..."
                            : confidentialBalanceState.kind === "needs_permit"
                            ? "Unlock to decrypt"
                            : confidentialBalanceState.kind === "never_shielded"
                            ? "Not yet shielded"
                            : "Unavailable"}
                        </span>
                      </div>
                      {decrypted?.purchasePrice && (
                        <div className="flex justify-between items-center p-2.5 rounded-xl bg-white/2 border border-white/5 text-xs">
                          <span className="text-slate-400">Confidential Capital Required</span>
                          <span className="font-mono font-bold text-white">${fromMicro(decrypted.purchasePrice)} cUSDC</span>
                        </div>
                      )}
                      {estimatedPurchasePrice === 0n ? (
                        <div className="p-3 rounded-xl bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs">
                          Decrypt the confidential purchase price before deploying cUSDC capital.
                        </div>
                      ) : !hasFinalUnderwriting ? (
                        <div className="p-3 rounded-xl bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs">
                          Final encrypted underwriting is required before capital can be deployed.
                        </div>
                      ) : confidentialBalanceState.kind === "not_configured" ||
                        confidentialBalanceState.kind === "wrapper_invalid" ? (
                        <div className="p-3 rounded-xl bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs">
                          {confidentialBalanceState.message}
                        </div>
                      ) : confidentialBalanceState.kind === "error" ? (
                        <div className="p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20 text-neon-pink text-xs">
                          {confidentialBalanceState.message}
                        </div>
                      ) : confidentialBalanceState.kind === "loading" ? (
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs">
                          Arbitra is still decrypting your cUSDC balance. Wait for the confidential balance check to finish before deploying capital.
                        </div>
                      ) : confidentialBalanceState.kind === "needs_permit" ? (
                        <div className="p-3 rounded-xl bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs">
                          Unlock your confidential cUSDC balance first so Arbitra can verify available capital.
                        </div>
                      ) : confidentialBalanceState.kind === "never_shielded" ? (
                        <div className="p-3 rounded-xl bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs">
                          No cUSDC balance exists for this wallet yet. Shield public USDC from My Wallet before funding the invoice.
                        </div>
                      ) : !hasEnoughConfidentialCapital ? (
                        <div className="p-3 rounded-xl bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs">
                          Insufficient confidential capital. Shield more USDC into cUSDC, then retry. Public USDC test funds are available at{" "}
                          <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" className="underline">
                            faucet.circle.com
                          </a>
                        </div>
                      ) : !confidentialWallet.isOperatorApproved ? (
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs">
                          The registry still needs ERC-7984 operator rights on your cUSDC. Arbitra will request that time-bounded operator approval during funding.
                        </div>
                      ) : null}
                      {confidentialWallet.operatorError && (
                        <div className="p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20 text-neon-pink text-xs">
                          {confidentialWallet.operatorError}
                        </div>
                      )}
                      <NeonButton
                        variant="primary"
                        size="md"
                        loading={isFactoringPending || confidentialWallet.operatorPhase === "pending" || localBusy}
                        onClick={handleFactorClick}
                        disabled={!canDeployCapital}
                        className="w-full bg-gradient-to-r from-neon-purple to-indigo-600 border-neon-purple/50"
                      >
                        {confidentialBalanceState.kind === "needs_permit"
                          ? "Unlock cUSDC Balance"
                          : confidentialWallet.operatorPhase === "pending"
                          ? "Authorizing cUSDC Operator..."
                          : isFactoringPending || localBusy
                          ? `Deploying${decrypted?.purchasePrice ? ` $${fromMicro(decrypted.purchasePrice)}` : ""} cUSDC...`
                          : confidentialWallet.isOperatorApproved
                          ? "Deploy Confidential cUSDC Capital"
                          : "Authorize cUSDC Operator & Deploy"}
                      </NeonButton>
                      {factorError && (
                        <div className="p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20 text-neon-pink text-xs">
                          Warning {factorError}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUCCESS: Financing Approved */}
                  {factorSuccess && (
                    <div className="text-center space-y-3 py-2">
                      <div className="flex justify-center py-1">
                        <CheckCircle2 className="w-10 h-10 text-neon-green" />
                      </div>
                      <h4 className="text-sm font-bold text-neon-green">Financing Approved</h4>
                      <p className="text-xs text-slate-300">
                        <span className="font-bold text-white">{factorSuccess.disbursed}</span> deployed as confidential supplier funding.
                        Invoice {factorSuccess.invoiceIdStr} is now registered to your wallet as an on-chain RWA asset.
                      </p>
                      <div className="p-3 rounded-xl bg-neon-green/10 border border-neon-green/20 text-neon-green text-xs text-left space-y-1">
                        <div>Investor cUSDC transferred confidentially to escrow</div>
                        <div>Escrow forwarded encrypted cUSDC to the supplier</div>
                        <div>Supplier can now view or unshield the received cUSDC from My Wallet</div>
                        <div>Invoice RWA ownership recorded on-chain</div>
                        <div>Repayment remains tracked through the encrypted escrow receiver</div>
                      </div>
                      <NeonButton variant="secondary" size="sm" onClick={onClose} className="w-full">
                        Close Panel
                      </NeonButton>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- ENCRYPTED VALUE GRID --- */}
            <div className="grid grid-cols-2 gap-3.5">
              {[
                {
                  label: "Face Value",
                  clear: decrypted?.faceValue !== undefined ? formatUSDC(decrypted.faceValue) : undefined,
                  icon: "FV",
                },
                {
                  label: "Purchase Price",
                  clear: decrypted?.purchasePrice !== undefined ? formatUSDC(decrypted.purchasePrice) : undefined,
                  icon: "PP",
                },
                {
                  label: "Due Date",
                  clear: decrypted?.dueDate !== undefined ? formatTimestamp(decrypted.dueDate) : undefined,
                  icon: "DD",
                },
                {
                  label: "Discount Rate",
                  clear: decrypted?.discountRate !== undefined ? formatBps(decrypted.discountRate) : undefined,
                  icon: "DR",
                },
              ].map((field, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-white/2 border border-white/5 flex flex-col justify-between min-h-[75px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">{field.label}</span>
                    <span className="text-sm">{field.icon}</span>
                  </div>
                  <div className="mt-1.5">
                    <EncryptedValue
                      isDecrypted={field.clear !== undefined}
                      clearValue={field.clear}
                      isDecrypting={isDecrypting}
                      size="sm"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Real Yield Display (after decryption) */}
            {realYield && (
              <div className="p-3.5 rounded-2xl bg-neon-green/5 border border-neon-green/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-neon-green block mb-0.5">
                    Real Annualized Yield
                  </span>
                  <span className="text-[11px] text-slate-400">Computed from decrypted face value, purchase price, and maturity</span>
                </div>
                <span className="text-xl font-black text-neon-green font-mono">{realYield}</span>
              </div>
            )}

            {isFactored && (
              <div className="p-4 rounded-2xl bg-cyan-950/20 border border-neon-cyan/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-neon-cyan">
                      Settlement Reconciliation
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Mock SPV lockbox webhook, oracle proof, and confidential payout ledger.
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono border ${
                    isRepaid
                      ? "bg-neon-green/10 text-neon-green border-neon-green/20"
                      : "bg-yellow-400/10 text-yellow-400 border-yellow-400/20"
                  }`}>
                    {isRepaid ? "SETTLED" : "READY"}
                  </span>
                </div>

                {!isRepaid && (
                  <NeonButton
                    variant="primary"
                    size="sm"
                    loading={settlementBusy}
                    onClick={handleSimulateRepayment}
                    className="w-full bg-gradient-to-r from-neon-cyan to-emerald-500 border-neon-cyan/50"
                  >
                    {settlementBusy ? "Reconciling Mock Lockbox..." : "Simulate Repayment"}
                  </NeonButton>
                )}

                {settlementError && (
                  <div className="p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20 text-neon-pink text-xs">
                    {settlementError}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2 text-[11px]">
                  <div className="flex justify-between gap-3 p-2.5 rounded-xl bg-white/2 border border-white/5">
                    <span className="text-slate-500">Payment Reference</span>
                    <span className="font-mono text-slate-300 truncate">
                      {settlementSuccess?.paymentReferencePlain || (settlementCommitments?.[0] && settlementCommitments[0] !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? shortAddress(settlementCommitments[0]) : "-")}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 p-2.5 rounded-xl bg-white/2 border border-white/5">
                    <span className="text-slate-500">Mock Bank Trace</span>
                    <span className="font-mono text-slate-300 truncate">
                      {settlementSuccess?.bankTracePlain || (settlementCommitments?.[1] && settlementCommitments[1] !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? shortAddress(settlementCommitments[1]) : "-")}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 p-2.5 rounded-xl bg-white/2 border border-white/5">
                    <span className="text-slate-500">Oracle Proof Tx</span>
                    <span className="font-mono text-slate-300 truncate">
                      {settlementSuccess?.txHash ? shortAddress(settlementSuccess.txHash) : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 p-2.5 rounded-xl bg-white/2 border border-white/5">
                    <span className="text-slate-500">Settlement Receipt</span>
                    <span className="font-mono text-slate-300 truncate">
                      {settlementSuccess?.settlementReceiptHash
                        ? shortAddress(settlementSuccess.settlementReceiptHash)
                        : settlementCommitments?.[2] && settlementCommitments[2] !== "0x0000000000000000000000000000000000000000000000000000000000000000"
                        ? shortAddress(settlementCommitments[2])
                        : "-"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* FHE Disclaimer (shown before decrypt) */}
            {!decrypted && (
              <div className="p-3 rounded-2xl bg-white/2 border border-white/5 text-[11px] text-slate-500 leading-normal flex items-start gap-2">
                <span style={{ fontSize: "14px", marginTop: "-2px" }}>Warning</span>
                <div>
                  <span className="font-bold text-slate-400">FHE Protected:</span> Face value, purchase price, discount rate and due date are homomorphically encrypted on-chain. Only authorized wallets can decrypt. Yields shown on preview cards are placeholders - real yield is computed after decryption.
                </div>
              </div>
            )}

            {/* Decrypt button for Supplier / Factored Investor (not in the sequential flow) */}
            {!isProspectiveInvestor && !decrypted && canDecrypt && zamaReady && (
              <div className="p-4 rounded-2xl bg-white/2 border border-white/5 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-white mb-0.5">Decrypt Your Invoice</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Sign an EIP-712 message to reveal the real financial parameters.
                  </p>
                </div>
                <NeonButton
                  variant="secondary"
                  size="sm"
                  loading={isDecrypting}
                  onClick={handleDecrypt}
                  className="flex-shrink-0"
                >
                  Decrypt Details
                </NeonButton>
              </div>
            )}

            {/* Decrypt Error Alert (supplier/investor path) */}
            {decryptError && !isProspectiveInvestor && (
              <div className="p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20 text-neon-pink text-xs">
                {decryptError}
              </div>
            )}

            {/* Confidential underwriting result shown after authorized decryption */}
            {!isSupplier && decrypted && (
              <div className="p-4.5 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-navy-950/40 border border-indigo-500/20">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400">Confidential Underwriting Result</h4>
                  </div>
                  <span className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">FHE</span>
                </div>

                {displayedUnderwritingScore !== null && displayedUnderwritingLabel ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-400">
                        {underwritingScore !== null ? "Final encrypted risk output:" : "Legacy deterministic risk output:"}
                      </span>
                      <span className={`text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded ${displayedUnderwritingClass}`}>
                        {displayedUnderwritingLabel} Risk ({displayedUnderwritingScore}/100)
                      </span>
                    </div>
                    {underwritingScore !== null ? (
                      <p className="text-xs text-slate-300 leading-relaxed font-medium">
                        This score is computed on-chain from encrypted repayment history, encrypted default count, encrypted invoice value, encrypted tenor, and encrypted supplier reputation. Raw underwriting inputs are not decrypted for investor review.
                      </p>
                    ) : (
                      <p className="text-xs text-slate-300 leading-relaxed font-medium">
                        This invoice was created on a registry version that does not expose final underwriting handles. The deterministic review below is informational only and cannot unlock capital deployment.
                      </p>
                    )}
                    {legacyUnderwriting && (
                      <div className="space-y-1">
                        {legacyUnderwriting.factors.slice(0, 2).map((factor) => (
                          <p key={factor} className="text-[11px] text-slate-400 leading-normal">
                            {factor}
                          </p>
                        ))}
                      </div>
                    )}
                    <div className="p-3.5 rounded-xl bg-white/2 border border-white/5 mt-1.5">
                      <span className="text-[10px] text-slate-400 font-bold block mb-1 uppercase">Selective Disclosure</span>
                      <p className="text-xs text-indigo-200 leading-normal italic">
                        {underwritingScore !== null
                          ? "Your wallet received ACL access to final invoice terms and the final underwriting output only."
                          : "Your wallet received ACL access to the invoice terms only; upgraded registry invoices are required for encrypted underwriting output handles."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-2.5">
                    <p className="text-xs text-slate-400">
                      No final underwriting output was returned for this invoice. Existing invoices may need migration to the upgraded registry.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* On-chain trust and cryptographic security attestations */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/20 to-teal-950/20 border border-emerald-500/10 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">On-Chain Cryptographic & Safety Profile</h4>
                </div>
                <span className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">Secured</span>
              </div>

              <div className="space-y-2.5 text-xs">
                {/* 1. Debtor Attestation */}
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-400">1</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between font-bold text-slate-200">
                      <span>Debtor Attestation (Plaid Link)</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${invoice.isEmailVerified ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20" : "bg-yellow-400/10 text-yellow-400 border border-yellow-400/20"}`}>
                        {invoice.isEmailVerified ? "Verified" : "Pending Attestation"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                      {invoice.isEmailVerified
                        ? "Debtor has signed an on-chain cryptographic attestation confirming invoice validity and agreement to pay escrow."
                        : "Invoice has not yet been confirmed by the debtor. Factoring involves counterparty verification risk."}
                    </p>
                  </div>
                </div>

                {/* 2. Collateral Vault Protection */}
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-400">2</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between font-bold text-slate-200">
                      <span>Supplier Default Collateral</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${invoice.collateralStaked ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20" : "bg-red-400/10 text-red-400 border border-red-400/20"}`}>
                        {invoice.collateralStaked ? "Staked (5% Vault)" : "Uncollateralized"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                      {invoice.collateralStaked
                        ? "5% of face value is locked in ArbitraCollateralVault as first-loss protection for the investor."
                        : "Supplier did not stake collateral for this invoice. High risk in case of buyer insolvency."}
                    </p>
                  </div>
                </div>

                {/* 3. Escrow Capital Protection */}
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-400">3</span>
                  <div className="flex-1">
                    <div className="flex justify-between font-bold text-slate-200">
                      <span>Escrow Settlement Safety</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                        Active Escrow
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                      Purchase capital is held securely in the ArbitraEscrowReceiver contract and programmatically released to the supplier.
                    </p>
                  </div>
                </div>

                {/* 4. Zama FHEVM Shielded Financials */}
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-400">4</span>
                  <div className="flex-1">
                    <div className="flex justify-between font-bold text-slate-200">
                      <span>FHE Privacy Compliance</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                        Zama FHEVM Shielded
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                      Sensitive financial parameters (Face Value, Tenor, Discount Rate) are kept confidential using Zama FHEVM homomorphic encryption.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* --- ADDRESSES BLOCK --- */}
            <div className="p-3.5 rounded-2xl bg-white/2 border border-white/5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Supplier:</span>
                <span className="font-mono text-slate-300">{shortAddress(invoice.supplier)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Buyer (Debtor):</span>
                <span className="font-mono text-slate-300">{shortAddress(invoice.debtor)}</span>
              </div>
              {isFactored && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Investor:</span>
                  <span className="font-mono text-slate-300">{shortAddress(invoice.investor)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Days to Maturity:</span>
                <span className="font-mono text-slate-300">{isRepaid ? "Settled" : `${daysLeft} days`}</span>
              </div>
            </div>
          </div>

          {/* Footer Action Buttons - only for non-sequential (supplier/active investor) */}
          {!isProspectiveInvestor && !factorSuccess && (
            <div className="mt-6 pt-4 border-t border-white/5 flex gap-3">
              <NeonButton
                variant="secondary"
                size="md"
                onClick={onClose}
                className="flex-1"
              >
                Close Panel
              </NeonButton>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
