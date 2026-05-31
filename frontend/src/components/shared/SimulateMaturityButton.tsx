/*
 * @file SimulateMaturityButton.tsx
 * @description Component allowing the buyer/debtor to simulate repayment of an invoice at maturity.
 *              Triggers confidentialTransferAndCall on cUSDC back to the EscrowReceiver.
 */

"use client";

import React, { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { encodeAbiParameters, parseAbiParameters } from "viem";
import {
  CUSDC_ADDRESS,
  CUSDC_ABI,
  ESCROW_RECEIVER_ADDRESS,
} from "@/lib/contracts";

interface SimulateMaturityButtonProps {
  invoiceId: bigint;
  faceValueHandle: `0x${string}`;
  debtorAddress: string;
  onSuccess?: () => void;
}

export function SimulateMaturityButton({
  invoiceId,
  faceValueHandle,
  debtorAddress,
  onSuccess
}: SimulateMaturityButtonProps) {
  const { address } = useAccount();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const { writeContractAsync, data: txHash } = useWriteContract();

  const isDebtor = address && debtorAddress && address.toLowerCase() === debtorAddress.toLowerCase();

  const handleRepay = async () => {
    if (!address || !isDebtor) return;
    setIsSubmitting(true);

    try {
      /* Encode invoice ID as bytes payload for the callback receiver */
      const dataBytes = encodeAbiParameters(
        parseAbiParameters("uint256"),
        [invoiceId]
      );

      /* Call confidentialTransferAndCall on cUSDC */
      await writeContractAsync({
        address: CUSDC_ADDRESS,
        abi: CUSDC_ABI,
        functionName: "confidentialTransferAndCall",
        args: [ESCROW_RECEIVER_ADDRESS, faceValueHandle, dataBytes],
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
      💸 Simulate Maturity Repayment
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
