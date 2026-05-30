/**
 * @file InvoiceDetailModal.tsx
 * @description Shared details modal for invoices featuring smooth slide-up animation,
 *              role-based viewing tabs, decryption hooks, and AI-powered risk assessment.
 */

"use client";

import React, { useState, useEffect, useRef } from "react";
import { useWalletClient, useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { useRole } from "@/providers/RoleProvider";
import {
  useInvoice,
  useInvoiceHandles,
  useIsInvestorApproved,
  useSetOperator,
  useFactorInvoice,
  useTriggerRepayment
} from "@/hooks/useArbitraRegistry";
import { useInvoiceDecrypt } from "@/hooks/useInvoiceDecrypt";
import { useRiskAssessment } from "@/hooks/useRiskAssessment";
import { useZama } from "@/providers/ZamaProvider";
import { GlassCard } from "../ui/GlassCard";
import { NeonButton } from "../ui/NeonButton";
import { FHEBadge } from "../ui/FHEBadge";
import { EncryptedValue } from "../ui/EncryptedValue";
import {
  formatCUSDC,
  formatTimestamp,
  formatBps,
  daysUntilDue,
  shortAddress,
  ARBITRA_REGISTRY_ADDRESS,
  DEFAULT_OPERATOR_EXPIRY_SECONDS
} from "@/lib/contracts";

interface InvoiceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: bigint | undefined;
  onActionSuccess?: () => void;
}

export function InvoiceDetailModal({
  isOpen,
  onClose,
  invoiceId,
  onActionSuccess
}: InvoiceDetailModalProps) {
  const { address: currentUserAddress } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { role: globalRole } = useRole();
  const { isReady: zamaReady } = useZama();

  /* Switchable role tab inside the modal */
  const [viewRole, setViewRole] = useState<"supplier" | "investor">("supplier");

  /* Fetch core data */
  const { data: invoiceData, refetch: refetchInvoice } = useInvoice(invoiceId);
  const { data: handles } = useInvoiceHandles(invoiceId);

  /* Decryption hook */
  const { decrypted, isDecrypting, error: decryptError, decrypt } = useInvoiceDecrypt();

  /* AI risk assessment hook */
  const { assessment, isLoading: isRiskLoading, error: riskError, fetchAssessment } = useRiskAssessment();

  /* Action hooks */
  const { factorInvoice, isPending: isFactoringPending } = useFactorInvoice();
  const { triggerRepayment, isPending: isRepayPending } = useTriggerRepayment();

  /* Operator check for factoring */
  const { data: isApprovedRefetch, refetch: refetchApproval } = useIsInvestorApproved(
    currentUserAddress as `0x${string}` | undefined
  );
  const isApproved = isApprovedRefetch ?? false;
  const { setOperator, isPending: isApproving } = useSetOperator();
  const [localBusy, setLocalBusy] = useState(false);

  /* Set default role view from global state */
  useEffect(() => {
    if (isOpen && globalRole) {
      setViewRole(globalRole);
    }
  }, [isOpen, globalRole]);

  if (!isOpen || invoiceId === undefined || !invoiceData) return null;

  /* Reconstruct structured invoice details */
  const invoice = {
    invoiceId,
    faceValue: invoiceData[0] as `0x${string}`,
    dueDate: invoiceData[1] as `0x${string}`,
    purchasePrice: invoiceData[2] as `0x${string}`,
    discountRate: invoiceData[3] as `0x${string}`,
    supplier: invoiceData[4] as string,
    investor: invoiceData[5] as string,
    buyer: invoiceData[6] as string,
    isFactored: invoiceData[7] as boolean,
    isRepaid: invoiceData[8] as boolean,
    uploadTimestamp: BigInt(invoiceData[9] as bigint)
  };

  const isSupplier = currentUserAddress?.toLowerCase() === invoice.supplier?.toLowerCase();
  const isInvestor = currentUserAddress?.toLowerCase() === invoice.investor?.toLowerCase();
  const canDecrypt = isSupplier || isInvestor || (viewRole === "investor" && invoice.investor === "0x0000000000000000000000000000000000000000");

  /* EIP-712 dynamic decryption execution */
  const handleDecrypt = async () => {
    if (!handles || !walletClient) return;

    const signer = {
      getAddress: async () => (await walletClient.getAddresses())[0] as string,
      signTypedData: async (domain: object, types: object, value: object) => {
        return walletClient.signTypedData({
          domain: domain as Parameters<typeof walletClient.signTypedData>[0]["domain"],
          types: types as Parameters<typeof walletClient.signTypedData>[0]["types"],
          primaryType: Object.keys(types as Record<string, unknown>)[0],
          message: value as Parameters<typeof walletClient.signTypedData>[0]["message"],
          account: (await walletClient.getAddresses())[0]
        });
      }
    };

    await decrypt(
      {
        faceValueHandle: handles.faceValueHandle as `0x${string}`,
        dueDateHandle: handles.dueDateHandle as `0x${string}`,
        purchasePriceHandle: handles.purchasePriceHandle as `0x${string}`,
        discountRateHandle: handles.discountRateHandle as `0x${string}`
      },
      signer
    );
  };

  /* AI risk assessment trigger */
  const handleRiskAnalyze = async () => {
    const dueDays = decrypted?.dueDate ? daysUntilDue(decrypted.dueDate) : 30;
    const faceValueStr = decrypted?.faceValue ? `$${(Number(decrypted.faceValue) / 1000000).toFixed(2)}` : undefined;
    const discountRateBps = decrypted?.discountRate ? Number(decrypted.discountRate) : undefined;

    await fetchAssessment({
      invoiceId: Number(invoice.invoiceId),
      supplierAddress: invoice.supplier,
      buyerAddress: invoice.buyer,
      uploadTimestamp: Number(invoice.uploadTimestamp),
      isFactored: invoice.isFactored,
      isRepaid: invoice.isRepaid,
      faceValueHint: faceValueStr,
      dueDaysHint: dueDays,
      discountRateBpsHint: discountRateBps,
      repaymentRatioBpsHint: 9500 /* Default mock supplier reputation ratio */
    });
  };

  /* Factor action sequence */
  const handleFactorClick = async () => {
    setLocalBusy(true);
    try {
      if (!isApproved) {
        const expiry = Math.floor(Date.now() / 1000) + DEFAULT_OPERATOR_EXPIRY_SECONDS;
        await setOperator(ARBITRA_REGISTRY_ADDRESS, expiry);
        await refetchApproval();
      }
      await factorInvoice(invoice.invoiceId);
      await refetchInvoice();
      if (onActionSuccess) onActionSuccess();
    } catch (err) {
      console.error("Factoring failed:", err);
    } finally {
      setLocalBusy(false);
    }
  };

  /* Repay action sequence */
  const handleRepayClick = async () => {
    setLocalBusy(true);
    try {
      await triggerRepayment(invoice.invoiceId);
      await refetchInvoice();
      if (onActionSuccess) onActionSuccess();
    } catch (err) {
      console.error("Repayment failed:", err);
    } finally {
      setLocalBusy(false);
    }
  };

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
                <FHEBadge size="sm" />
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

          {/* Interactive Role Switcher Tabs */}
          <div className="flex bg-white/3 border border-white/5 p-1 rounded-xl gap-1 mb-5">
            <button
              onClick={() => setViewRole("supplier")}
              className={`flex-1 py-2.5 text-center text-xs font-bold rounded-lg transition-all ${
                viewRole === "supplier"
                  ? "bg-neon-cyan text-navy-950 shadow-lg font-extrabold"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              As Supplier
            </button>
            <button
              onClick={() => setViewRole("investor")}
              className={`flex-1 py-2.5 text-center text-xs font-bold rounded-lg transition-all ${
                viewRole === "investor"
                  ? "bg-neon-purple text-white shadow-lg font-extrabold"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              As Investor
            </button>
          </div>

          {/* Scrollable Modal Content */}
          <div className="flex-1 overflow-y-auto space-y-5 pr-1 -mr-2 scrollbar-thin">
            
            {/* Wallet status information banner */}
            <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-white/2 border border-white/5 text-xs text-slate-400">
              <div className="flex justify-between items-center">
                <span>Active Wallet Context:</span>
                <span className="font-mono text-slate-200">{currentUserAddress ? shortAddress(currentUserAddress) : "Disconnected"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Registry Verified Role:</span>
                <span className="capitalize font-bold text-white">
                  {isSupplier ? "Supplier (Creator)" : isInvestor ? "Investor (Lender)" : "Viewer"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Invoice Status:</span>
                <span className="font-semibold text-white">
                  {invoice.isRepaid ? (
                    <span className="text-neon-green">● Repaid</span>
                  ) : invoice.isFactored ? (
                    <span className="text-neon-purple">● Factored (Awaiting Due Date)</span>
                  ) : (
                    <span className="text-yellow-400">● Unfactored (Available)</span>
                  )}
                </span>
              </div>
            </div>

            {/* Encrypted Value Grid */}
            <div className="grid grid-cols-2 gap-3.5">
              {[
                {
                  label: "Face Value",
                  clear: decrypted?.faceValue !== undefined ? formatCUSDC(decrypted.faceValue) : undefined,
                  icon: "💰"
                },
                {
                  label: "Purchase Price",
                  clear: decrypted?.purchasePrice !== undefined ? formatCUSDC(decrypted.purchasePrice) : undefined,
                  icon: "🏷️"
                },
                {
                  label: "Due Date",
                  clear: decrypted?.dueDate !== undefined ? formatTimestamp(decrypted.dueDate) : undefined,
                  icon: "📅"
                },
                {
                  label: "Discount Rate",
                  clear: decrypted?.discountRate !== undefined ? formatBps(decrypted.discountRate) : undefined,
                  icon: "📊"
                }
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

            {/* Decrypt Actions Area */}
            {!decrypted && (
              <div className="p-4 rounded-2xl bg-white/2 border border-white/5 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-white mb-0.5">Encrypted Under FHE</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    This invoice's exact parameters are encrypted on-chain. Only authorized roles (Supplier / Investor) can request decryption.
                  </p>
                </div>
                {zamaReady && canDecrypt && (
                  <NeonButton
                    variant="secondary"
                    size="sm"
                    loading={isDecrypting}
                    onClick={handleDecrypt}
                    className="flex-shrink-0"
                  >
                    Decrypt Details
                  </NeonButton>
                )}
              </div>
            )}

            {/* Error alerts */}
            {decryptError && (
              <div className="p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20 text-neon-pink text-xs">
                {decryptError}
              </div>
            )}

            {/* AI Risk Assessment Block (Only for Investor perspective) */}
            {viewRole === "investor" && (
              <div className="p-4.5 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-navy-950/40 border border-indigo-500/20">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px]">✨</span>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400">Gemini AI Risk Profile</h4>
                  </div>
                  <span className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">FLASH-2.0</span>
                </div>

                {!assessment ? (
                  <div className="text-center py-2.5">
                    <p className="text-xs text-slate-400 mb-3">
                      Run AI analysis of the counterparty risk using metadata and available decrypted parameters.
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

                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                      {assessment.summary}
                    </p>

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
                      <p className="text-xs text-indigo-200 leading-normal italic">
                        {assessment.recommendation}
                      </p>
                    </div>
                  </div>
                )}
                {riskError && (
                  <div className="mt-3 p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20 text-neon-pink text-xs">
                    {riskError}
                  </div>
                )}
              </div>
            )}

            {/* Contextual counterparty Addresses */}
            <div className="p-3.5 rounded-2xl bg-white/2 border border-white/5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Supplier:</span>
                <span className="font-mono text-slate-300">{shortAddress(invoice.supplier)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Buyer (Debtor):</span>
                <span className="font-mono text-slate-300">{shortAddress(invoice.buyer)}</span>
              </div>
              {invoice.isFactored && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Purchasing Investor:</span>
                  <span className="font-mono text-slate-300">{shortAddress(invoice.investor)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Contextual Modal Action Buttons Footer */}
          <div className="mt-6 pt-4 border-t border-white/5 flex gap-3">
            <NeonButton
              variant="secondary"
              size="md"
              onClick={onClose}
              className="flex-1"
            >
              Close Panel
            </NeonButton>

            {/* Action for Supplier (Repayment) */}
            {viewRole === "supplier" && invoice.isFactored && !invoice.isRepaid && isSupplier && (
              <NeonButton
                variant="primary"
                size="md"
                loading={isRepayPending || localBusy}
                onClick={handleRepayClick}
                className="flex-1"
              >
                Repay Factored Invoice
              </NeonButton>
            )}

            {/* Action for Investor (Factoring) */}
            {viewRole === "investor" && !invoice.isFactored && !isSupplier && (
              <NeonButton
                variant="primary"
                size="md"
                loading={isFactoringPending || isApproving || localBusy}
                onClick={handleFactorClick}
                className="flex-1 bg-neon-purple text-white border-neon-purple hover:bg-neon-purple/80"
              >
                {isApproved ? "Factor Invoice" : "Approve & Factor"}
              </NeonButton>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
