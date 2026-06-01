/**
 * @file SimulateMaturityButton.tsx
 * @description Component allowing the buyer/debtor to simulate repayment of an invoice at maturity.
 *              Triggers USDC approval and settleInvoice on the EscrowReceiver.
 */

"use client";

import React, { useState } from "react";
import { useWriteContract, useAccount } from "wagmi";
import {
  USDC_ADDRESS,
  USDC_ABI,
  ESCROW_RECEIVER_ADDRESS,
  ESCROW_RECEIVER_ABI,
} from "@/lib/contracts";

interface SimulateMaturityButtonProps {
  invoiceId: bigint;
  faceValuePlaintext: bigint;
  debtorAddress: string;
  onSuccess?: () => void;
}

export function SimulateMaturityButton({
  invoiceId,
  faceValuePlaintext,
  debtorAddress,
  onSuccess
}: SimulateMaturityButtonProps) {
  const { address } = useAccount();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const { writeContractAsync } = useWriteContract();

  const isDebtor = address && debtorAddress && address.toLowerCase() === debtorAddress.toLowerCase();

  const handleRepay = async () => {
    if (!address || !isDebtor) return;
    setIsSubmitting(true);

    try {
      /* 1. Approve EscrowReceiver to spend USDC */
      await writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "approve",
        args: [ESCROW_RECEIVER_ADDRESS, faceValuePlaintext],
      });

      /* 2. Call settleInvoice on EscrowReceiver */
      await writeContractAsync({
        address: ESCROW_RECEIVER_ADDRESS,
        abi: ESCROW_RECEIVER_ABI,
        functionName: "settleInvoice",
        args: [invoiceId],
      });

      setIsSubmitting(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (e) {
      console.error("[SimulateMaturityButton] Error:", e);
      setIsSubmitting(false);
    }
  };

  if (!isDebtor) return null;

  return (
    <button
      onClick={handleRepay}
      disabled={isSubmitting}
      className="neon-btn-primary px-4 py-2 text-xs rounded-xl flex items-center gap-2"
    >
      {isSubmitting && (
        <span
          className="w-3.5 h-3.5 rounded-full border border-current border-t-transparent animate-spin"
          style={{ display: "inline-block" }}
        />
      )}
      Simulate Maturity Repayment
      <style>{`
        .neon-btn-primary {
          background: linear-gradient(135deg, #00f0ff 0%, #7b2fff 100%);
          border: 1px solid rgba(0, 240, 255, 0.4);
          color: #0c152b;
          font-weight: 700;
          font-family: "Satoshi", sans-serif;
          transition: all 0.2s ease-in-out;
          cursor: pointer;
        }
        .neon-btn-primary:hover {
          box-shadow: 0 0 12px rgba(0, 240, 255, 0.35);
          transform: translateY(-1px);
        }
        .neon-btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 0.8s linear infinite;
        }
      `}</style>
    </button>
  );
}
