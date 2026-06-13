/*
 * @file VerifyClient.tsx
 * @description Client component for debtor attestation of a confidential invoice.
 *              Supports both Web2 (secure email link magic attestation) and Web3 (wallet sign) paths.
 */

"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useAccount, useWalletClient, useChainId, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { useSearchParams } from "next/navigation";
import { keccak256, encodeAbiParameters, parseAbiParameters } from "viem";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { FHEBadge } from "@/components/ui/FHEBadge";
import { useInvoice, useConfirmInvoice } from "@/hooks/useArbitraRegistry";
import { useZama } from "@/providers/ZamaProvider";
import { userDecryptHandles } from "@/lib/zama";
import { PlaidModal } from "@/components/shared/PlaidModal";
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

function VerifyClientContent({ invoiceId }: VerifyClientProps) {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { data: walletClient } = useWalletClient();
  const { instance, isReady: zamaReady } = useZama();
  const { confirmInvoice, isPending: confirmPending, txHash: web3TxHash } = useConfirmInvoice();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const { data: invoice, isLoading: invoiceLoading, refetch: refetchInvoice } = useInvoice(invoiceId);

  const [verifyMode, setVerifyMode] = useState<"web2" | "web3" | null>(null);
  const [tokenValidating, setTokenValidating] = useState<boolean>(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [emailHash, setEmailHash] = useState<string | null>(null);

  const [cachedDetails, setCachedDetails] = useState<{
    faceValue: bigint;
    dueDate: bigint;
  } | null>(null);

  const [decryptedData, setDecryptedData] = useState<{
    faceValue: bigint;
    dueDate: bigint;
  } | null>(null);

  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [attestError, setAttestError] = useState<string | null>(null);
  const [isDecrypted, setIsDecrypted] = useState<boolean>(false);
  const [successAttesting, setSuccessAttesting] = useState<boolean>(false);
  const [submittingWeb2, setSubmittingWeb2] = useState<boolean>(false);
  const [web2TxHash, setWeb2TxHash] = useState<string | null>(null);
  const [isPlaidOpen, setIsPlaidOpen] = useState<boolean>(false);

  const getDownloadUrl = () => {
    const params = new URLSearchParams();
    params.set("invoiceId", invoiceId.toString());
    if (token) {
      params.set("token", token);
    }
    
    const plainVal = cachedDetails?.faceValue || decryptedData?.faceValue;
    const plainDue = cachedDetails?.dueDate || decryptedData?.dueDate;
    
    if (plainVal) {
      params.set("faceValue", plainVal.toString());
    }
    if (plainDue) {
      params.set("dueDate", plainDue.toString());
    }
    if (invoice) {
      params.set("supplier", invoice.supplier);
      params.set("debtor", invoice.debtor);
      params.set("emailVerified", invoice.isEmailVerified ? "true" : "false");
    }
    return `/api/download-noa?${params.toString()}`;
  };

  const handlePlaidSuccess = () => {
    setIsPlaidOpen(false);
    if (verifyMode === "web2") {
      handleWeb2Attest();
    } else {
      handleWeb3Attest();
    }
  };

  const isDebtor = address && invoice && address.toLowerCase() === invoice.debtor.toLowerCase();

  /* Validate token on mount if present */
  useEffect(() => {
    if (token) {
      const validateToken = async () => {
        setTokenValidating(true);
        setTokenError(null);
        try {
          const res = await fetch("/api/verify-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              invoiceId: Number(invoiceId),
              token,
            }),
          });
          const data = await res.json();
          if (data.valid) {
            setMaskedEmail(data.maskedEmail);
            setEmailHash(data.emailHash);
            if (data.faceValue && data.dueDate) {
              setCachedDetails({
                faceValue: BigInt(data.faceValue),
                dueDate: BigInt(data.dueDate),
              });
            }
            setVerifyMode("web2");
          } else {
            setTokenError(data.error || "Verification token is invalid or expired.");
            setVerifyMode("web3");
          }
        } catch (err) {
          console.error(err);
          setTokenError("Failed to validate verification token.");
          setVerifyMode("web3");
        } finally {
          setTokenValidating(false);
        }
      };
      validateToken();
    } else {
      setVerifyMode("web3");
    }
  }, [token, invoiceId]);

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
        signTypedData: async (domain: object, types: object, message: object) => {
          return walletClient.signTypedData({
            domain: domain as Parameters<typeof walletClient.signTypedData>[0]["domain"],
            types: types as Parameters<typeof walletClient.signTypedData>[0]["types"],
            primaryType: "ReencryptionRequest",
            message: message as Parameters<typeof walletClient.signTypedData>[0]["message"],
            account: address!,
          });
        }
      };

      const clearValues = await userDecryptHandles(instance, handlesToDecrypt, mockSigner);

      const valClear = BigInt(clearValues[invoice.faceValue] as string | bigint);
      const dueClear = BigInt(clearValues[invoice.dueDate] as string | bigint);

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

  /* Run EIP-712 signature attestation and submit transaction for Web3 flow */
  const handleWeb3Attest = async () => {
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

  /* Run attestation via Platform Verifier API for Web2 flow */
  const handleWeb2Attest = async () => {
    if (!token) return;
    setSubmittingWeb2(true);
    setAttestError(null);

    try {
      const res = await fetch("/api/attest-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: Number(invoiceId),
          token,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessAttesting(true);
        setWeb2TxHash(data.txHash);
        refetchInvoice();
      } else {
        setAttestError(data.error || "Failed to attest invoice via platform service.");
      }
    } catch (err: any) {
      console.error(err);
      setAttestError(err.message || "An unexpected error occurred during attestation.");
    } finally {
      setSubmittingWeb2(false);
    }
  };

  if (invoiceLoading || tokenValidating) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-8 h-8 rounded-full border-2 border-neon-cyan/20 border-t-neon-cyan animate-spin" />
        <span className="text-xs text-slate-500">
          {tokenValidating ? "Validating email verification link..." : "Retrieving smart contract records..."}
        </span>
      </div>
    );
  }

  if (!invoice) {
    return (
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
    );
  }

  if (invoice.status !== InvoiceStatus.Pending) {
    const finalTxHash = web2TxHash || web3TxHash;
    return (
      <div className="max-w-md mx-auto space-y-6">
        <GlassCard className="p-8 text-center relative overflow-hidden">
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "2px",
              background: "linear-gradient(90deg, #00FF88 0%, #00F0FF 100%)",
            }}
          />
          <div className="mx-auto w-12 h-12 rounded-full bg-neon-green/10 border border-neon-green/30 flex items-center justify-center text-neon-green mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-white font-bold text-lg font-heading" style={{ fontFamily: "Satoshi, sans-serif" }}>
            Attestation Confirmed
          </h2>
          <p className="text-xs text-slate-400 mt-2 max-w-xs mx-auto leading-relaxed">
            Invoice #{invoiceId.toString()} has been verified by the debtor. It is now eligible for trade finance factoring in the marketplace.
          </p>

          <div className="mt-6 p-4 rounded-xl bg-white/2 border border-white/5 space-y-3 text-left text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <span className="text-slate-500">Maturity Status</span>
              <span className="text-neon-green font-semibold">Active & Attested</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <span className="text-slate-500">Verification Path</span>
              <span className="text-white font-medium">
                {invoice.isEmailVerified ? "📧 Secure Email Attestation" : "🔑 EIP-712 Wallet Signature"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Supplier (Seller)</span>
              <span className="text-white font-mono">{truncateAddress(invoice.supplier)}</span>
            </div>
          </div>

          <div className="mt-4 p-4 rounded-xl bg-neon-purple/5 border border-neon-purple/10 text-left text-xs space-y-2">
            <span className="font-semibold text-neon-purple block">⚖️ Legal SPV & Receivables Transfer</span>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              This invoice has been legally assigned to the Arbitra Factoring SPV registry. The payment obligation is now owed directly to the collateral vault at address <strong className="font-mono text-white">{truncateAddress(ARBITRA_REGISTRY_ADDRESS)}</strong>.
            </p>
          </div>

          {finalTxHash && (
            <div className="mt-4 text-left">
              <span className="text-[10px] text-slate-600 block mb-1">Transaction Hash:</span>
              <p className="text-[10px] font-mono text-neon-cyan break-all bg-white/2 p-2.5 rounded-lg border border-white/5">
                {finalTxHash}
              </p>
            </div>
          )}

          <a
            href={getDownloadUrl()}
            className="w-full neon-btn-secondary py-3.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 mt-5 hover:shadow-[0_0_15px_rgba(0,240,255,0.15)] transition-all animate-pulse"
          >
            <svg className="w-4 h-4 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Notice of Assignment (NOA) PDF
          </a>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Verification Path Selector or State Banner */}
      {token && verifyMode === "web2" && (
        <div className="p-4 rounded-xl bg-neon-cyan/5 border border-neon-cyan/15 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5 text-neon-cyan">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-cyan opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-cyan"></span>
            </span>
            <span>Identity Verified: <strong className="font-mono text-white">{maskedEmail}</strong></span>
          </div>
          <span className="bg-neon-cyan/10 text-neon-cyan text-[9px] font-bold px-2 py-0.5 rounded border border-neon-cyan/20">
            EMAIL FLOW
          </span>
        </div>
      )}

      {tokenError && (
        <div className="p-4 rounded-xl bg-neon-pink/5 border border-neon-pink/15 text-xs text-neon-pink space-y-2">
          <p className="font-semibold">⚠️ {tokenError}</p>
          <p className="text-[11px] text-slate-500">
            You can still verify this invoice by connecting your Ethereum wallet directly if your address matches the registered debtor.
          </p>
        </div>
      )}

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
          <h2 className="text-base font-bold text-white font-heading" style={{ fontFamily: "Satoshi, sans-serif" }}>
            Invoice Attestation
          </h2>
          <FHEBadge />
        </div>

        {/* Core details mapping */}
        <div className="space-y-3 border-t border-white/5 pt-4 text-xs">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <span className="text-slate-500">Supplier (Seller)</span>
            <span className="text-white font-mono">{truncateAddress(invoice.supplier)}</span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <span className="text-slate-500">Registered Debtor</span>
            <span className="text-white font-mono">{truncateAddress(invoice.debtor)}</span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <span className="text-slate-500">Upload Date</span>
            <span className="text-white font-mono">{formatTimestamp(invoice.uploadTimestamp)}</span>
          </div>

          {/* Web2 Attestation Mode */}
          {verifyMode === "web2" && cachedDetails && (
            <div className="space-y-4 mt-4">
              <div className="bg-white/2 rounded-xl p-4 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Extracted Details (Cleartext)</span>
                  <span className="text-[10px] text-slate-500">Provided by secure cache</span>
                </div>
                <div className="space-y-2.5 pt-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Face Value</span>
                    <span className="text-neon-cyan font-mono font-semibold">
                      ${fromMicroUnits(cachedDetails.faceValue)} USDC
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Maturity Date</span>
                    <span className="text-neon-purple font-mono">
                      {new Date(Number(cachedDetails.dueDate) * 1000).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-white/2 border border-white/5 rounded-xl flex gap-3 text-xs leading-relaxed text-slate-400">
                <svg className="w-4 h-4 text-neon-cyan mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  Please confirm that the face value and due date match your records. Clicking confirm authorizes the platform verifier to post this attestation on-chain.
                </span>
              </div>

              {attestError && (
                <div className="p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20 text-neon-pink text-xs">
                  {attestError}
                </div>
              )}

              <button
                onClick={() => setIsPlaidOpen(true)}
                disabled={submittingWeb2}
                className="w-full neon-btn-primary py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              >
                {submittingWeb2 ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    Submitting Attestation...
                  </>
                ) : (
                  "✓ Confirm Details & Attest"
                )}
              </button>

              <button
                onClick={() => setVerifyMode("web3")}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors pt-2 block"
              >
                Prefer to sign with an Ethereum wallet? Switch to Web3 Mode
              </button>
            </div>
          )}

          {/* Web3 Attestation Mode */}
          {verifyMode === "web3" && (
            <div className="space-y-4 mt-4">
              <div className="bg-white/2 rounded-xl p-4 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">FHE Confidential Values</span>
                  <span className="text-[10px] text-slate-500 font-mono">ON-CHAIN FHE</span>
                </div>

                {!isDecrypted ? (
                  <div className="py-4 text-center space-y-3">
                    <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs mx-auto">
                      The face value and due date are homomorphically encrypted. Only the designated debtor wallet can decrypt them locally.
                    </p>
                    {isConnected ? (
                      isDebtor ? (
                        <button
                          onClick={handleDecrypt}
                          disabled={!zamaReady}
                          className="neon-btn-secondary px-6 py-2 rounded-xl text-xs font-semibold"
                        >
                          🔓 Decrypt Values Locally
                        </button>
                      ) : (
                        <div className="text-[10px] text-neon-pink font-medium bg-neon-pink/10 border border-neon-pink/20 rounded-lg p-2.5">
                          Connected wallet {truncateAddress(address || "")} is not authorized. Please switch to the registered debtor wallet {truncateAddress(invoice.debtor)}.
                        </div>
                      )
                    ) : (
                      <button
                        onClick={() => connect({ connector: injected() })}
                        className="neon-btn-primary px-6 py-2.5 rounded-xl text-xs font-semibold"
                      >
                        Connect Debtor Wallet
                      </button>
                    )}
                    {decryptError && (
                      <p className="text-[10px] text-neon-pink mt-1">{decryptError}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5 pt-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Decrypted Face Value</span>
                      <span className="text-neon-cyan font-mono font-semibold">
                        ${fromMicroUnits(decryptedData!.faceValue)} USDC
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Decrypted Due Date</span>
                      <span className="text-neon-purple font-mono">
                        {new Date(Number(decryptedData!.dueDate) * 1000).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {isDecrypted && (
                <>
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
                    onClick={() => setIsPlaidOpen(true)}
                    disabled={confirmPending}
                    className="w-full neon-btn-primary py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    {confirmPending ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                        Submitting to Sepolia...
                      </>
                    ) : (
                      "✍️ Sign Attestation & Confirm"
                    )}
                  </button>
                </>
              )}

              {token && (
                <button
                  onClick={() => setVerifyMode("web2")}
                  className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors pt-2 block"
                >
                  Return to Web2 email verification mode
                </button>
              )}
            </div>
          )}
        </div>
      </GlassCard>

      <PlaidModal
        isOpen={isPlaidOpen}
        onClose={() => setIsPlaidOpen(false)}
        onSuccess={handlePlaidSuccess}
      />
    </div>
  );
}

export default function VerifyClient({ invoiceId }: VerifyClientProps) {
  return (
    <AppLayout
      title={`Verify Invoice #${invoiceId.toString()}`}
      description="Review cryptographically shielded invoice details and execute attestation"
    >
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-neon-cyan/20 border-t-neon-cyan animate-spin" />
        </div>
      }>
        <VerifyClientContent invoiceId={invoiceId} />
      </Suspense>
    </AppLayout>
  );
}
