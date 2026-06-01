"use client";

import { useEffect, useRef } from "react";
import { NeonButton } from "./NeonButton";
import { FHEBadge } from "./FHEBadge";
import { EncryptedValue } from "./EncryptedValue";
import { formatUSDC, formatTimestamp, formatBps } from "@/lib/contracts";

interface DecryptedValues {
  faceValue?: bigint;
  dueDate?: bigint;
  purchasePrice?: bigint;
  discountRate?: bigint;
}

interface DecryptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDecrypt: () => void;
  isDecrypting: boolean;
  decrypted: DecryptedValues | null;
  error: string | null;
  invoiceId: bigint;
  canDecrypt: boolean;
}

export function DecryptionModal({
  isOpen,
  onClose,
  onDecrypt,
  isDecrypting,
  decrypted,
  error,
  invoiceId,
  canDecrypt,
}: DecryptionModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const fields = [
    {
      label: "Face Value",
      value: decrypted?.faceValue,
      formatter: formatUSDC,
      icon: "💰",
    },
    {
      label: "Due Date",
      value: decrypted?.dueDate,
      formatter: (v: bigint) => formatTimestamp(v),
      icon: "📅",
    },
    {
      label: "Purchase Price",
      value: decrypted?.purchasePrice,
      formatter: formatUSDC,
      icon: "🏷️",
    },
    {
      label: "Discount Rate",
      value: decrypted?.discountRate,
      formatter: (v: bigint) => formatBps(v),
      icon: "📊",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="decrypt-modal-title"
    >
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-md glass-card p-6 z-10 animate-slide-up">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2
                id="decrypt-modal-title"
                className="text-lg font-bold text-white"
              >
                Decrypt Invoice #{invoiceId.toString()}
              </h2>
              <FHEBadge />
            </div>
            <p className="text-xs text-slate-500">
              Sign with your wallet to decrypt encrypted fields
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors p-1 -mt-1 -mr-1"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-3 mb-6">
          {fields.map((field) => (
            <div
              key={field.label}
              className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-base" aria-hidden="true">{field.icon}</span>
                <span className="text-sm text-slate-400">{field.label}</span>
              </div>
              <div>
                {decrypted && field.value !== undefined ? (
                  <EncryptedValue
                    isDecrypted={true}
                    clearValue={field.formatter(field.value as bigint)}
                  />
                ) : (
                  <EncryptedValue
                    isDecrypting={isDecrypting}
                    isDecrypted={false}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20 text-neon-pink text-xs">
            {error}
          </div>
        )}

        {/* Info when no permission */}
        {!canDecrypt && !decrypted && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
            You need ACL permission to decrypt. Only the supplier and investor
            (after factoring) can decrypt invoice values.
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <NeonButton
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="flex-1"
          >
            Close
          </NeonButton>
          {!decrypted && canDecrypt && (
            <NeonButton
              variant="primary"
              size="sm"
              loading={isDecrypting}
              onClick={onDecrypt}
              className="flex-1"
              id="decrypt-button"
            >
              {isDecrypting ? "Signing..." : "Sign & Decrypt"}
            </NeonButton>
          )}
        </div>

        {/* FHE explanation */}
        <p className="mt-4 text-xs text-center text-slate-600">
          Decryption requires your EIP-712 signature. Data never leaves your device unencrypted.
        </p>
      </div>
    </div>
  );
}
