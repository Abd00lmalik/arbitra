/*
 * @file InvoiceDetailModal.tsx
 * @description Shared details modal for invoices featuring smooth slide-up animation,
 *              sequential investor flow (Request Access → Decrypt → Analyze → Deploy Capital),
 *              real FHE decryption, deterministic risk analysis fed with real decrypted values,
 *              USDC balance pre-flight check, and Step 5 confidential capital deployment UX.
 */

"use client";

import React, { useState } from "react";
import { Key, Unlock, Sparkles, Zap, CheckCircle2, ShieldCheck, AlertCircle } from "lucide-react";
import { usePublicClient, useReadContract } from "wagmi";
import { useActiveWalletClient } from "@/hooks/useActiveWalletClient";
import { motion, AnimatePresence } from "framer-motion";
import {
  useInvoice,
  useIsInvestorApproved,
  useSetOperator,
  useFactorInvoice,
  useGrantRiskAccess,
  useUSDCBalance,
} from "@/hooks/useArbitraRegistry";
import { useInvoiceDecrypt } from "@/hooks/useInvoiceDecrypt";
import { useRiskAssessment } from "@/hooks/useRiskAssessment";
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
  USDC_ADDRESS,
  USDC_ABI,
  DEFAULT_OPERATOR_EXPIRY_SECONDS,
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

  const { data: settlementCommitments, refetch: refetchSettlementCommitments } = useReadContract({
    address: ESCROW_RECEIVER_ADDRESS,
    abi: ESCROW_RECEIVER_ABI,
    functionName: "getSettlementCommitments",
    args: invoiceId !== undefined ? [invoiceId] : undefined,
    query: { enabled: invoiceId !== undefined },
  });

  /* Decryption hook */
  const { decrypted, isDecrypting, error: decryptError, decrypt } = useInvoiceDecrypt();

  /* AI risk assessment hook */
  const { assessment, isLoading: isRiskLoading, error: riskError, fetchAssessment } = useRiskAssessment();

  /* Action hooks */
  const { factorInvoice, isPending: isFactoringPending } = useFactorInvoice();
  const { grantAccess, isPending: isGrantPending } = useGrantRiskAccess();

  /* Operator / USDC approval check */
  const { data: isApprovedRefetch, refetch: refetchApproval } = useIsInvestorApproved(
    currentUserAddress as `0x${string}` | undefined
  );
  const isApproved = isApprovedRefetch ?? false;
  const { setOperator, isPending: isApproving } = useSetOperator();

  /* USDC balance for pre-flight check */
  const { data: usdcBalanceRaw } = useUSDCBalance(currentUserAddress as `0x${string}` | undefined);
  const usdcBalance = usdcBalanceRaw ? (usdcBalanceRaw as bigint) : 0n;

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

  if (!isOpen || invoiceId === undefined || !invoice) return null;

  const isFactored = invoice.status >= InvoiceStatus.Factored;
  const isRepaid = invoice.status === InvoiceStatus.Settled;
  const isDisputed = invoice.status === InvoiceStatus.Disputed;

  const isSupplier = currentUserAddress?.toLowerCase() === invoice.supplier?.toLowerCase();
  const isInvestor = currentUserAddress?.toLowerCase() === invoice.investor?.toLowerCase();
  const isDebtor = currentUserAddress?.toLowerCase() === invoice.debtor?.toLowerCase();

  /* Decryption is allowed if: supplier, factored investor, or has been granted risk access this session */
  const canDecrypt = isSupplier || isInvestor || hasGrantedAccess;

  /* Real yield calculation after decryption */
  const daysLeft = daysUntilDue(invoice.maturityTimestamp);
  const realYield =
    decrypted?.faceValue && decrypted?.purchasePrice
      ? computeYield(decrypted.faceValue, decrypted.purchasePrice, daysLeft)
      : null;

  const estimatedPurchasePrice = decrypted?.purchasePrice ?? 0n;
  const hasEnoughUSDC = estimatedPurchasePrice > 0n && usdcBalance >= estimatedPurchasePrice;

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
          return walletClient!.signTypedData({
            domain: domain as Parameters<typeof walletClient.signTypedData>[0]["domain"],
            types: types as Parameters<typeof walletClient.signTypedData>[0]["types"],
            primaryType: Object.keys(types as Record<string, unknown>)[0],
            message: value as Parameters<typeof walletClient.signTypedData>[0]["message"],
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
      },
      signer
    );
  };

  /* Grant FHE access for prospective investor — permanent FHE.allow on-chain */
  const handleGrantAccess = async () => {
    setLocalBusy(true);
    setGrantError(null);
    try {
      if (!publicClient) throw new Error("Sepolia public client unavailable.");

      let txHash: `0x${string}`;

      if (isEmbedded) {
        /* Web3Auth embedded wallet — must use ethers.js, not wagmi writeContractAsync */
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
        /* External wallet (MetaMask / WalletConnect) — wagmi works fine */
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

  /* AI risk assessment — triggered after decryption with real values */
  const handleRiskAnalyze = async () => {
    const dueDays = decrypted?.dueDate ? daysUntilDue(decrypted.dueDate) : daysLeft;
    const faceValueStr = decrypted?.faceValue
      ? `$${(Number(decrypted.faceValue) / 1_000_000).toFixed(2)}`
      : undefined;
    const discountRateBps = decrypted?.discountRate ? Number(decrypted.discountRate) : undefined;

    /* Do not pass hardcoded repayment ratio — let Deterministic see "no history" for an honest output */
    await fetchAssessment({
      invoiceId: Number(invoice.invoiceId),
      supplierAddress: invoice.supplier,
      buyerAddress: invoice.debtor,
      uploadTimestamp: Number(invoice.uploadTimestamp),
      isFactored: isFactored,
      isRepaid: isRepaid,
      faceValueHint: faceValueStr,
      dueDaysHint: dueDays,
      discountRateBpsHint: discountRateBps,
    });
  };

  /* Step 5: Deploy USDC Escrow Capital — full USDC approval + factor sequence */
  const handleFactorClick = async () => {
    setLocalBusy(true);
    setFactorError(null);
    setFactorSuccess(null);

    try {
      if (!publicClient) throw new Error("Sepolia public client unavailable.");
      if (estimatedPurchasePrice === 0n) {
        throw new Error("Decrypt the confidential purchase price before deploying capital.");
      }

      if (usdcBalance < estimatedPurchasePrice) {
        throw new Error(
          `Insufficient USDC. You have $${fromMicro(usdcBalance)} but need $${fromMicro(estimatedPurchasePrice)}. Get test USDC at faucet.circle.com.`
        );
      }

      if (isEmbedded) {
        /*
         * Web3Auth embedded wallet path.
         * wagmi's writeContractAsync does NOT dispatch through the Web3Auth EIP-1193
         * provider — transactions must go through ethers.js instead.
         */
        const { ethers } = await import("ethers");
        const signer = await getEmbeddedSigner();

        /* Step 1: USDC max approval if not already set */
        if (!isApproved) {
          const usdcContract = new ethers.Contract(
            USDC_ADDRESS,
            USDC_ABI,
            signer
          );
          const MAX_UINT256 = ethers.MaxUint256;
          const approveTx = await usdcContract["approve"](ARBITRA_REGISTRY_ADDRESS, MAX_UINT256);
          await approveTx.wait();
          await refetchApproval();
        }

        /* Step 2: Factor the invoice — USDC moves investor → supplier on-chain */
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
        /*
         * External wallet path (MetaMask / WalletConnect).
         * wagmi hooks work correctly here.
         */

        /* Step 1: USDC approval if not already approved */
        if (!isApproved) {
          const expiry = Math.floor(Date.now() / 1000) + DEFAULT_OPERATOR_EXPIRY_SECONDS;
          const approvalTxHash = await setOperator(ARBITRA_REGISTRY_ADDRESS, expiry);
          await publicClient.waitForTransactionReceipt({ hash: approvalTxHash });
          await refetchApproval();
        }

        /* Step 2: Factor invoice — USDC transfers to supplier */
        const factorTxHash = await factorInvoice(invoice.invoiceId);
        await publicClient.waitForTransactionReceipt({ hash: factorTxHash });
      }

      const disbursedStr = decrypted?.purchasePrice
        ? `$${fromMicro(decrypted.purchasePrice)} USDC`
        : `Invoice #${invoice.invoiceId}`;

      setFactorSuccess({ disbursed: disbursedStr, invoiceIdStr: `#${invoice.invoiceId}` });
      await refetchInvoice();
      if (onActionSuccess) onActionSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Factoring failed";
      const clean = msg.includes("User rejected") || msg.includes("user rejected")
        ? "Transaction cancelled by user."
        : msg.includes("Insufficient USDC")
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
        });
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

  /* Determine investor step: 0=grant, 1=decrypt, 2=analyze, 3=deploy */
  const investorStep = !canDecrypt ? 0 : !decrypted ? 1 : !assessment ? 2 : 3;
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
                    <span className="text-neon-green">● Settled</span>
                  ) : isDisputed ? (
                    <span className="text-neon-pink">● Disputed</span>
                  ) : isFactored ? (
                    <span className="text-neon-purple">● Factored (Awaiting Maturity)</span>
                  ) : invoice.status === InvoiceStatus.Attested ? (
                    <span className="text-neon-cyan">● Attested (Ready to Factor)</span>
                  ) : (
                    <span className="text-yellow-400">● Pending Debtor Attestation</span>
                  )}
                </span>
              </div>
            </div>

            {/* ─── INVESTOR SEQUENTIAL FLOW (Prospective) ─── */}
            {isProspectiveInvestor && invoice.status === InvoiceStatus.Attested && (
              <div className="rounded-2xl border border-neon-purple/20 bg-gradient-to-br from-neon-purple/5 to-transparent overflow-hidden">
                {/* Step Progress Bar */}
                <div className="flex border-b border-white/5">
                  {["Request Access", "Decrypt", "Analyze Risk", "Deploy Capital"].map((label, idx) => (
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
                      {idx < investorStep ? "✓ " : idx === investorStep ? "→ " : ""}{label}
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
                        Submit an on-chain transaction to grant your wallet permanent permission to decrypt this invoice's encrypted financial parameters (face value, yield, due date).
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
                            ⚠️ You must complete Investor onboarding before requesting FHE access.
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
                          ⚠️ {grantError}
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
                        Your wallet now has on-chain decrypt permission. Sign an EIP-712 message to privately reveal the real face value, purchase price, yield, and maturity date — only visible to you.
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
                        <p className="text-xs text-yellow-400">Zama SDK initializing — please wait...</p>
                      )}
                      {decryptError && (
                        <div className="p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20 text-neon-pink text-xs text-left">
                          ⚠️ {decryptError}
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEP 2: Analyze risk */}
                  {investorStep === 2 && (
                    <div className="text-center space-y-3">
                      <div className="flex justify-center py-1">
                        <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse" />
                      </div>
                      <h4 className="text-sm font-bold text-white">AI Counterparty Risk Analysis</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Run the deterministic risk model on the real decrypted parameters to get a risk score, credit label, and investment recommendation before committing capital.
                      </p>
                      <NeonButton
                          variant="primary"
                          size="sm"
                          loading={isRiskLoading}
                          onClick={handleRiskAnalyze}
                          className="w-full bg-indigo-600 border-indigo-500"
                      >
                        {isRiskLoading ? "Calculating risk profile..." : "Run Risk Analysis"}
                      </NeonButton>
                      {riskError && (
                        <div className="p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20 text-neon-pink text-xs text-left">
                          ⚠️ {riskError}
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEP 3: Deploy Capital */}
                  {investorStep === 3 && !factorSuccess && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-white text-center flex items-center justify-center gap-1.5">
                        <Zap className="w-4 h-4 text-amber-400" /> Deploy USDC Escrow Capital
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed text-center">
                        Sign an EIP-712 transaction to transfer USDC to escrow. Funds are released to the supplier upon confirmation. The registry records your ownership of this invoice RWA.
                      </p>
                      {/* USDC Balance check */}
                      <div className="flex justify-between items-center p-2.5 rounded-xl bg-white/2 border border-white/5 text-xs">
                        <span className="text-slate-400">Your USDC Balance</span>
                        <span className={`font-mono font-bold ${hasEnoughUSDC ? "text-neon-green" : "text-neon-pink"}`}>
                          ${fromMicro(usdcBalance)} USDC {!hasEnoughUSDC && "⚠️"}
                        </span>
                      </div>
                      {decrypted?.purchasePrice && (
                        <div className="flex justify-between items-center p-2.5 rounded-xl bg-white/2 border border-white/5 text-xs">
                          <span className="text-slate-400">Capital Required (Purchase Price)</span>
                          <span className="font-mono font-bold text-white">${fromMicro(decrypted.purchasePrice)} USDC</span>
                        </div>
                      )}
                      {estimatedPurchasePrice === 0n ? (
                        <div className="p-3 rounded-xl bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs">
                          Decrypt the confidential purchase price before deploying capital.
                        </div>
                      ) : !hasEnoughUSDC && (
                        <div className="p-3 rounded-xl bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs">
                          Insufficient USDC. Get test tokens at{" "}
                          <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" className="underline">
                            faucet.circle.com
                          </a>
                        </div>
                      )}
                      <NeonButton
                        variant="primary"
                        size="md"
                        loading={isFactoringPending || isApproving || localBusy}
                        onClick={handleFactorClick}
                        disabled={!hasEnoughUSDC}
                        className="w-full bg-gradient-to-r from-neon-purple to-indigo-600 border-neon-purple/50"
                      >
                        {isApproving
                          ? "Approving USDC Spend..."
                          : isFactoringPending || localBusy
                          ? `Transferring${decrypted?.purchasePrice ? ` $${fromMicro(decrypted.purchasePrice)}` : ""} to Supplier...`
                          : isApproved
                          ? "Deploy USDC Escrow Capital"
                          : "Approve USDC & Deploy Capital"}
                      </NeonButton>
                      {factorError && (
                        <div className="p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20 text-neon-pink text-xs">
                          ⚠️ {factorError}
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
                        <span className="font-bold text-white">{factorSuccess.disbursed}</span> disbursed to supplier.
                        Invoice {factorSuccess.invoiceIdStr} is now registered to your wallet as an on-chain RWA asset.
                      </p>
                      <div className="p-3 rounded-xl bg-neon-green/10 border border-neon-green/20 text-neon-green text-xs text-left space-y-1">
                        <div>✓ USDC transferred to supplier escrow</div>
                        <div>✓ Invoice RWA ownership recorded on-chain</div>
                        <div>✓ Repayment tracked via encrypted escrow receiver</div>
                      </div>
                      <NeonButton variant="secondary" size="sm" onClick={onClose} className="w-full">
                        Close Panel
                      </NeonButton>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── ENCRYPTED VALUE GRID ─── */}
            <div className="grid grid-cols-2 gap-3.5">
              {[
                {
                  label: "Face Value",
                  clear: decrypted?.faceValue !== undefined ? formatUSDC(decrypted.faceValue) : undefined,
                  icon: "💰",
                },
                {
                  label: "Purchase Price",
                  clear: decrypted?.purchasePrice !== undefined ? formatUSDC(decrypted.purchasePrice) : undefined,
                  icon: "🏷️",
                },
                {
                  label: "Due Date",
                  clear: decrypted?.dueDate !== undefined ? formatTimestamp(decrypted.dueDate) : undefined,
                  icon: "📅",
                },
                {
                  label: "Discount Rate",
                  clear: decrypted?.discountRate !== undefined ? formatBps(decrypted.discountRate) : undefined,
                  icon: "📊",
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
                <span style={{ fontSize: "14px", marginTop: "-2px" }}>⚠️</span>
                <div>
                  <span className="font-bold text-slate-400">FHE Protected:</span> Face value, purchase price, discount rate and due date are homomorphically encrypted on-chain. Only authorized wallets can decrypt. Yields shown on preview cards are placeholders — real yield is computed after decryption.
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

            {/* ─── AI RISK ASSESSMENT (shown to non-suppliers after decryption in non-sequential views) ─── */}
            {!isSupplier && decrypted && (
              <div className="p-4.5 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-navy-950/40 border border-indigo-500/20">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px]">✨</span>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400">Deterministic Risk Profile</h4>
                  </div>
                  <span className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">LOCAL</span>
                </div>

                {!assessment ? (
                  <div className="text-center py-2.5">
                    <p className="text-xs text-slate-400 mb-3">
                      Run deterministic counterparty risk analysis using real decrypted parameters.
                    </p>
                    <NeonButton
                      variant="primary"
                      size="sm"
                      loading={isRiskLoading}
                      onClick={handleRiskAnalyze}
                      className="bg-indigo-600 border-indigo-500 text-xs px-4"
                    >
                      Analyze Risk
                    </NeonButton>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Credit Score Risk Label:</span>
                      <span
                        className={`text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                          assessment.riskLabel === "Low"
                            ? "bg-neon-green/10 text-neon-green border border-neon-green/20"
                            : assessment.riskLabel === "Medium"
                            ? "bg-yellow-400/10 text-yellow-400 border border-yellow-400/20"
                            : "bg-neon-pink/10 text-neon-pink border border-neon-pink/20"
                        }`}
                      >
                        {assessment.riskLabel} Risk ({assessment.riskScore}/100)
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed font-medium">{assessment.summary}</p>

                    <div className="space-y-1.5">
                      <span className="text-[10px] text-indigo-300 uppercase tracking-widest font-bold">Key Risk Signals:</span>
                      <ul className="space-y-1">
                        {assessment.factors.map((factor, i) => (
                          <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                            <span className="text-indigo-400 mt-0.5">▪</span>
                            <span>{factor}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/2 border border-white/5 mt-1.5">
                      <span className="text-[10px] text-slate-400 font-bold block mb-1 uppercase">Recommendation:</span>
                      <p className="text-xs text-indigo-200 leading-normal italic">{assessment.recommendation}</p>
                    </div>
                  </div>
                )}
                {riskError && !isProspectiveInvestor && (
                  <div className="mt-3 p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20 text-neon-pink text-xs">
                    {riskError}
                  </div>
                )}
              </div>
            )}

            {/* ─── ON-CHAIN TRUST & CRYPTOGRAPHIC SECURITY ATTESTATIONS ─── */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/20 to-teal-950/20 border border-emerald-500/10 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px]">🔒</span>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">On-Chain Cryptographic & Safety Profile</h4>
                </div>
                <span className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">Secured</span>
              </div>

              <div className="space-y-2.5 text-xs">
                {/* 1. Debtor Attestation */}
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-400">🛡️</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between font-bold text-slate-200">
                      <span>Debtor Attestation (Plaid Link)</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${invoice.isEmailVerified ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20" : "bg-yellow-400/10 text-yellow-400 border border-yellow-400/20"}`}>
                        {invoice.isEmailVerified ? "Verified ✓" : "Pending Attestation ⌛"}
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
                  <span className="mt-0.5 text-emerald-400">💎</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between font-bold text-slate-200">
                      <span>Supplier Default Collateral</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${invoice.collateralStaked ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20" : "bg-red-400/10 text-red-400 border border-red-400/20"}`}>
                        {invoice.collateralStaked ? "Staked (5% Vault) ✓" : "Uncollateralized ❌"}
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
                  <span className="mt-0.5 text-emerald-400">🏦</span>
                  <div className="flex-1">
                    <div className="flex justify-between font-bold text-slate-200">
                      <span>Escrow Settlement Safety</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                        Active Escrow ✓
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                      Purchase capital is held securely in the ArbitraEscrowReceiver contract and programmatically released to the supplier.
                    </p>
                  </div>
                </div>

                {/* 4. Zama FHEVM Shielded Financials */}
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-400">🔮</span>
                  <div className="flex-1">
                    <div className="flex justify-between font-bold text-slate-200">
                      <span>FHE Privacy Compliance</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                        Zama FHEVM Shielded ✓
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                      Sensitive financial parameters (Face Value, Tenor, Discount Rate) are kept confidential using Zama FHEVM homomorphic encryption.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── ADDRESSES BLOCK ─── */}
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
                <span className="font-mono text-slate-300">{isRepaid ? "Settled ✓" : `${daysLeft} days`}</span>
              </div>
            </div>
          </div>

          {/* Footer Action Buttons — only for non-sequential (supplier/active investor) */}
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
