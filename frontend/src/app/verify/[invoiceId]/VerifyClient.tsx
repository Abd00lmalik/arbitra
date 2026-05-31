/*
 * @file VerifyClient.tsx
 * @description Client component for debtor attestation of a confidential invoice.
 *              Allows debtor to decrypt FHE parameters local-first, verify details,
 *              and sign EIP-712 attestation to commit to the smart contract.
 */

"use client";

import React, { useState, useEffect } from "react";
import { useAccount, useWalletClient, useChainId } from "wagmi";
import { keccak256, encodeAbiParameters, parseAbiParameters } from "viem";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { FHEBadge } from "@/components/ui/FHEBadge";
import { useInvoice, useConfirmInvoice } from "@/hooks/useArbitraRegistry";
import { useZama } from "@/providers/ZamaProvider";
import { userDecryptHandles } from "@/lib/zama";
import {
  ARBITRA_REGISTRY_ADDRESS,
  InvoiceStatus,
  fromMicroUnits,
  formatTimestamp,
  truncateAddress
} from "@/lib/contracts";

interface VerifyClientProps {
  invoiceId: bigint;
}

export default function VerifyClient({ invoiceId }: VerifyClientProps) {
  const chainId = useChainId();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { instance, isReady: zamaReady } = useZama();
  const { confirmInvoice, isPending: confirmPending, txHash } = useConfirmInvoice();

  const { data: rawInvoice, isLoading: invoiceLoading, refetch: refetchInvoice } = useInvoice(invoiceId);

  const [decryptedData, setDecryptedData] = useState<{
    faceValue: bigint;
    dueDate: bigint;
  } | null>(null);

  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [attestError, setAttestError] = useState<string | null>(null);
  const [isDecrypted, setIsDecrypted] = useState<boolean>(false);
  const [successAttesting, setSuccessAttesting] = useState<boolean>(false);

  /* Parse rawInvoice from readContract */
  const invoice = rawInvoice ? {
    faceValue: rawInvoice[0] as `0x${string}`,
    dueDate: rawInvoice[1] as `0x${string}`,
    purchasePrice: rawInvoice[2] as `0x${string}`,
    discountRateBps: rawInvoice[3] as `0x${string}`,
    fingerprintHash: rawInvoice[4] as `0x${string}`,
    supplier: rawInvoice[5] as string,
    investor: rawInvoice[6] as string,
    debtor: rawInvoice[7] as string,
    uploadTimestamp: BigInt(rawInvoice[8] as string),
    maturityTimestamp: BigInt(rawInvoice[9] as string),
    status: Number(rawInvoice[10]) as InvoiceStatus,
    geminiUnderwritingEnabled: rawInvoice[11] as boolean,
    debtorAttestationHash: rawInvoice[12] as `0x${string}`,
    collateralStaked: rawInvoice[13] as boolean,
  } : null;

  const isDebtor = address && invoice && address.toLowerCase() === invoice.debtor.toLowerCase();

  /* Perform local FHE EIP-712 decryption */
  const handleDecrypt = async () => {
    if (!instance || !walletClient || !invoice) return;
    setDecryptError(null);

    try {
      const handlesToDecrypt = [
        { handle: invoice.faceValue, contractAddress: ARBITRA_REGISTRY_ADDRESS },
        { handle: invoice.dueDate, contractAddress: ARBITRA_REGISTRY_ADDRESS },
      ];

      /* Mock signer object matching userDecryptHandles requirements */
      const mockSigner = {
        getAddress: async () => address!,
        signTypedData: async (domain: any, types: any, message: any) => {
          return walletClient.signTypedData({
            domain,
            types,
            primaryType: "ReencryptionRequest",
            message,
            account: address!,
          });
        }
      };

      const clearValues = await userDecryptHandles(instance, handlesToDecrypt, mockSigner);

      const valClear = BigInt(clearValues[invoice.faceValue] as string);
      const dueClear = BigInt(clearValues[invoice.dueDate] as string);

      setDecryptedData({
        faceValue: valClear,
        dueDate: dueClear,
      });
      setIsDecrypted(true);
    } catch (e: any) {
      console.error(e);
      setDecryptError(e.message || "Failed to decrypt handles locally.");
    }
  };

  /* Run EIP-712 signature attestation and submit transaction */
  const handleAttest = async () => {
    if (!walletClient || !address || !invoice || !decryptedData) return;
    setAttestError(null);

    try {
      /* Calculate attestation commitment: keccak256(abi.encode(amount, maturity)) */
      const attCommit = keccak256(
        encodeAbiParameters(
          parseAbiParameters("uint256, uint256"),
          [decryptedData.faceValue, decryptedData.dueDate]
        )
      );

      /* Get signature from wallet */
      const signature = await walletClient.signTypedData({
        account: address,
        domain: {
          name: "Arbitra",
          version: "2",
          chainId: chainId,
          verifyingContract: ARBITRA_REGISTRY_ADDRESS,
        },
        types: {
          InvoiceAttestation: [
            { name: "invoiceId",             type: "uint256" },
            { name: "attestationCommitment", type: "bytes32" },
            { name: "supplier",              type: "address" },
          ],
        },
        primaryType: "InvoiceAttestation",
        message: {
          invoiceId: invoiceId,
          attestationCommitment: attCommit,
          supplier: invoice.supplier,
        },
      });

      /* Call smart contract confirmInvoice */
      await confirmInvoice(invoiceId, signature, attCommit);
      setSuccessAttesting(true);
      refetchInvoice();
    } catch (e: any) {
      console.error(e);
      setAttestError(e.message || "Failed to submit attestation transaction.");
    }
  };

  if (invoiceLoading) {
    return (
      <AppLayout title="Invoice Verification" description="Loading invoice details...">
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-8 h-8 rounded-full border-2 border-neon-cyan/20 border-t-neon-cyan animate-spin" />
          <span className="text-xs text-slate-500">Retrieving smart contract records...</span>
        </div>
      </AppLayout>
    );
  }

  if (!invoice) {
    return (
      <AppLayout title="Invoice Verification" description="Record not found">
        <GlassCard className="p-8 text-center max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 rounded-full bg-neon-pink/10 border border-neon-pink/20 flex items-center justify-center text-neon-pink mx-auto">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <h2 className="text-white font-bold text-base">Invoice Not Found</h2>
          <p className="text-xs text-slate-500">We could not find any active invoice with ID #{invoiceId.toString()}.</p>
        </GlassCard>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={`Verify Invoice #${invoiceId.toString()}`}
      description="Review cryptographically shielded invoice details and execute EIP-712 attestation"
    >
      <div className="max-w-md mx-auto space-y-6">
        <GlassCard className="p-6 relative overflow-hidden">
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "2px",
              background: "linear-gradient(90deg, #00F0FF 0%, #7B2FFF 100%)",
            }}
          />

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white">Invoice Details</h2>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
              invoice.status === InvoiceStatus.Pending
                ? "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                : invoice.status === InvoiceStatus.Attested
                ? "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20"
                : "bg-neon-green/10 text-neon-green border border-neon-green/20"
            }`}>
              {InvoiceStatus[invoice.status]}
            </span>
          </div>

          <div className="space-y-3 border-t border-white/5 pt-4 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <span className="text-slate-500">Supplier (Seller)</span>
              <span className="text-white font-mono">{truncateAddress(invoice.supplier)}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <span className="text-slate-500">Debtor (Buyer)</span>
              <span className="text-white font-mono">{truncateAddress(invoice.debtor)}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <span className="text-slate-500">Upload Date</span>
              <span className="text-white font-mono">{formatTimestamp(invoice.uploadTimestamp)}</span>
            </div>

            {/* FHE Fields Decryption Block */}
            <div className="bg-white/2 rounded-xl p-4 border border-white/5 mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">FHE Confidential Values</span>
                <FHEBadge size="sm" />
              </div>

              {!isDecrypted ? (
                <div className="py-4 text-center space-y-3">
                  <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs mx-auto">
                    The face value and due date are homomorphically encrypted. Only the designated debtor can decrypt them.
                  </p>
                  {isDebtor ? (
                    <NeonButton
                      variant="primary"
                      onClick={handleDecrypt}
                      disabled={!zamaReady}
                      className="text-xs px-6 py-2"
                    >
                      🔓 Decrypt Values Locally
                    </NeonButton>
                  ) : (
                    <div className="text-[10px] text-neon-pink font-medium bg-neon-pink/10 border border-neon-pink/20 rounded-lg p-2">
                      Connected wallet is not authorized to decrypt this invoice.
                    </div>
                  )}
                  {decryptError && (
                    <p className="text-[10px] text-neon-pink mt-1">{decryptError}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Decrypted Face Value</span>
                    <span className="text-neon-cyan font-mono font-semibold">
                      ${fromMicroUnits(decryptedData!.faceValue)} USDC
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Decrypted Due Date</span>
                    <span className="text-neon-purple font-mono">
                      {new Date(Number(decryptedData!.dueDate) * 1000).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Submission and Attestation Logic */}
          {isDecrypted && invoice.status === InvoiceStatus.Pending && (
            <div className="mt-6 border-t border-white/5 pt-6 space-y-4">
              <div className="p-3 bg-neon-cyan/5 border border-neon-cyan/10 rounded-xl flex gap-3 text-xs leading-relaxed text-slate-400">
                <svg className="w-4 h-4 text-neon-cyan mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>
                  By signing, you attest that the decrypted face value and maturity date match the purchase contract. This signature is verified on-chain via EIP-712 cryptography.
                </span>
              </div>

              {attestError && (
                <div className="p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20 text-neon-pink text-xs">
                  {attestError}
                </div>
              )}

              <button
                onClick={handleAttest}
                disabled={confirmPending}
                className="w-full neon-btn-primary py-3 rounded-xl text-sm"
              >
                {confirmPending ? "Submitting..." : "✍️ Sign Attestation & Confirm"}
              </button>
            </div>
          )}

          {invoice.status !== InvoiceStatus.Pending && (
            <div className="mt-6 border-t border-white/5 pt-6 text-center space-y-2">
              <div className="mx-auto w-10 h-10 rounded-full bg-neon-green/10 border border-neon-green/20 flex items-center justify-center text-neon-green">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 className="text-white text-sm font-semibold">Attestation Confirmed</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                The invoice has been verified by the debtor and is now eligible for trade finance factoring.
              </p>
              {txHash && (
                <p className="text-[10px] font-mono text-neon-cyan mt-1 break-all bg-white/2 p-2 rounded-lg border border-white/5">
                  {txHash}
                </p>
              )}
            </div>
          )}
        </GlassCard>
      </div>
    </AppLayout>
  );
}
