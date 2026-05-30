/**
 * @file InvoiceCard.tsx
 * @description Renders individual invoice details with interactive decryption modal triggers, factoring approval flows, and visual maturity progress bars.
 */

"use client";

import React, { useState } from "react";
import { useWalletClient } from "wagmi";
import type { InvoiceOnChain } from "@/lib/contracts";
import {
  formatCUSDT,
  formatTimestamp,
  formatBps,
  shortAddress,
  ARBITRA_REGISTRY_ADDRESS,
  DEFAULT_OPERATOR_EXPIRY_SECONDS,
} from "@/lib/contracts";
import { GlassCard } from "../ui/GlassCard";
import { NeonButton } from "../ui/NeonButton";
import { FHEBadge } from "../ui/FHEBadge";
import { EncryptedValue } from "../ui/EncryptedValue";
import { DecryptionModal } from "../ui/DecryptionModal";
import {
  useInvoiceHandles,
  useIsInvestorApproved,
  useSetOperator,
} from "@/hooks/useArbitraRegistry";
import { useInvoiceDecrypt } from "@/hooks/useInvoiceDecrypt";
import { useZama } from "@/providers/ZamaProvider";

interface InvoiceCardProps {
  invoice: InvoiceOnChain;
  onFactor?: (id: bigint) => Promise<void>;
  onRepay?: (id: bigint) => Promise<void>;
  isBusy?: boolean;
  currentUserAddress?: string;
}

export function InvoiceCard({
  invoice,
  onFactor,
  onRepay,
  isBusy = false,
  currentUserAddress,
}: InvoiceCardProps) {
  const [showDecryptModal, setShowDecryptModal] = useState(false);
  const { isReady: zamaReady } = useZama();
  const { data: walletClient } = useWalletClient();

  /* Fetch encrypted handles */
  const { data: handles } = useInvoiceHandles(invoice.invoiceId);

  /* Decryption hook */
  const { decrypted, isDecrypting, error: decryptError, decrypt } = useInvoiceDecrypt();

  /* Operator approval hooks */
  const { data: isApprovedRefetch, refetch: refetchApproval } = useIsInvestorApproved(
    currentUserAddress as `0x${string}` | undefined
  );
  const isApproved = isApprovedRefetch ?? false;

  const { setOperator, isPending: isApproving } = useSetOperator();
  const [localBusy, setLocalBusy] = useState(false);

  const isSupplier =
    currentUserAddress?.toLowerCase() === invoice.supplier?.toLowerCase();
  const isInvestor =
    currentUserAddress?.toLowerCase() === invoice.investor?.toLowerCase();
  const canDecrypt = isSupplier || isInvestor;

  const statusBadge = invoice.isRepaid
    ? <span className="badge-green" role="status">● Repaid</span>
    : invoice.isFactored
    ? <span className="badge-blue" role="status">● Factored</span>
    : <span className="badge-yellow" role="status">● Available</span>;

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
          account: (await walletClient.getAddresses())[0],
        });
      },
    };

    await decrypt(
      {
        faceValueHandle: handles.faceValueHandle as `0x${string}`,
        dueDateHandle: handles.dueDateHandle as `0x${string}`,
        purchasePriceHandle: handles.purchasePriceHandle as `0x${string}`,
        discountRateHandle: handles.discountRateHandle as `0x${string}`,
      },
      signer
    );
  };

  const handleFactorClick = async () => {
    if (!onFactor) return;
    setLocalBusy(true);
    try {
      if (!isApproved) {
        console.log(`Setting ArbitraInvoiceRegistry as operator on cUSDT...`);
        const expiry = Math.floor(Date.now() / 1000) + DEFAULT_OPERATOR_EXPIRY_SECONDS;
        const tx = await setOperator(ARBITRA_REGISTRY_ADDRESS, expiry);
        console.log(`Operator set tx:`, tx);
        if (refetchApproval) {
          await refetchApproval();
        }
      }
      console.log(`Executing factoring purchase for invoice #${invoice.invoiceId}...`);
      await onFactor(invoice.invoiceId);
    } catch (err) {
      console.error("Factoring purchase failed:", err);
    } finally {
      setLocalBusy(false);
    }
  };

  /* Maturity bar calculations */
  const renderMaturityBar = () => {
    if (!invoice.isFactored || invoice.isRepaid) return null;

    if (decrypted?.dueDate !== undefined) {
      const due = Number(decrypted.dueDate);
      const upload = Number(invoice.uploadTimestamp);
      const now = Math.floor(Date.now() / 1000);
      const total = due - upload;
      const elapsed = now - upload;
      const progress = total > 0 ? Math.max(0, Math.min(100, (elapsed / total) * 100)) : 0;
      const daysLeft = total > 0 ? Math.max(0, Math.floor((due - now) / 86400)) : 0;

      return (
        <div className="mt-3 p-2 rounded-xl bg-white/2 border border-white/5">
          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
            <span className="font-semibold">Maturity Progress ({daysLeft} days left)</span>
            <span className="text-neon-cyan font-mono">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      );
    }

    /* Fallback: locked shimmer bar when due date is still encrypted */
    return (
      <div className="mt-3 p-2 rounded-xl bg-white/2 border border-white/5">
        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span className="flex items-center gap-1 font-semibold">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Maturity Timeline
          </span>
          <span className="text-neon-cyan font-mono text-[9px] uppercase tracking-wider">FHE SECURE</span>
        </div>
        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-neon-cyan/10 via-neon-purple/20 to-neon-cyan/10 absolute inset-0"
            style={{
              width: "100%",
              animation: "shimmerBar 2s infinite linear",
              backgroundSize: "200% 100%"
            }}
          />
        </div>
        <style>{`
          @keyframes shimmerBar {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
        `}</style>
      </div>
    );
  };

  return (
    <>
      <GlassCard className="p-5 flex flex-col gap-4" hover glow="cyan">
        /* Header row */
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base font-bold text-white">
                #{invoice.invoiceId.toString()}
              </span>
              {statusBadge}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Supplier:</span>
              <span className="font-mono text-slate-400">{shortAddress(invoice.supplier)}</span>
            </div>
          </div>
          <FHEBadge />
        </div>

        /* Encrypted fields grid */
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              label: "Face Value",
              handle: handles?.faceValueHandle,
              clearValue: decrypted?.faceValue !== undefined ? formatCUSDT(decrypted.faceValue) : undefined,
            },
            {
              label: "Purchase Price",
              handle: handles?.purchasePriceHandle,
              clearValue: decrypted?.purchasePrice !== undefined ? formatCUSDT(decrypted.purchasePrice) : undefined,
            },
            {
              label: "Due Date",
              handle: handles?.dueDateHandle,
              clearValue: decrypted?.dueDate !== undefined ? formatTimestamp(decrypted.dueDate) : undefined,
            },
            {
              label: "Discount Rate",
              handle: handles?.discountRateHandle,
              clearValue: decrypted?.discountRate !== undefined ? formatBps(decrypted.discountRate) : undefined,
            },
          ].map((field) => (
            <div
              key={field.label}
              className="p-2.5 rounded-lg"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-semibold">
                {field.label}
              </div>
              <EncryptedValue
                isDecrypted={field.clearValue !== undefined}
                clearValue={field.clearValue}
                isDecrypting={isDecrypting}
                size="sm"
              />
            </div>
          ))}
        </div>

        /* Maturity bar display if factored */
        {renderMaturityBar()}

        /* Buyer row */
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Buyer: <span className="font-mono text-slate-400">{shortAddress(invoice.buyer)}</span></span>
          <span>Uploaded: {formatTimestamp(invoice.uploadTimestamp)}</span>
        </div>

        /* Actions */
        <div className="flex gap-2 pt-1">
          /* Decrypt */
          {zamaReady && canDecrypt && !decrypted && (
            <NeonButton
              variant="secondary"
              size="sm"
              onClick={() => setShowDecryptModal(true)}
              className="flex-1"
              id={`decrypt-invoice-${invoice.invoiceId}`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 7V5a4 4 0 018 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <rect x="2" y="7" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="8" cy="11" r="1.5" fill="currentColor" />
              </svg>
              Decrypt
            </NeonButton>
          )}

          /* Factor */
          {!invoice.isFactored && !isSupplier && onFactor && (
            <NeonButton
              variant="primary"
              size="sm"
              loading={isBusy || isApproving || localBusy}
              onClick={handleFactorClick}
              className="flex-1"
              id={`factor-invoice-${invoice.invoiceId}`}
            >
              {isApproved ? "Factor Invoice" : "Approve & Factor"}
            </NeonButton>
          )}

          /* Repay */
          {invoice.isFactored && !invoice.isRepaid && isSupplier && onRepay && (
            <NeonButton
              variant="ghost"
              size="sm"
              loading={isBusy}
              onClick={() => onRepay(invoice.invoiceId)}
              className="flex-1"
              id={`repay-invoice-${invoice.invoiceId}`}
            >
              Repay
            </NeonButton>
          )}
        </div>
      </GlassCard>

      /* Decryption modal */
      <DecryptionModal
        isOpen={showDecryptModal}
        onClose={() => setShowDecryptModal(false)}
        onDecrypt={handleDecrypt}
        isDecrypting={isDecrypting}
        decrypted={decrypted}
        error={decryptError}
        invoiceId={invoice.invoiceId}
        canDecrypt={canDecrypt}
      />
    </>
  );
}
