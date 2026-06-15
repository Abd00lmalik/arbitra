/*
 * @file UploadClient.tsx
 * @description Upload page client-side wrapper. Displays the invoice submission wizard and explaining sidebars.
 */

"use client";

import React from "react";
import { useAccount, useReadContract } from "wagmi";
import { AppLayout } from "@/components/layout/AppLayout";
import { UploadInvoiceForm } from "@/components/invoice/UploadInvoiceForm";
import { LockedPage } from "@/components/shared/LockedPage";
import { GlassCard } from "@/components/ui/GlassCard";
import { FHEBadge } from "@/components/ui/FHEBadge";
import { FaucetLinks } from "@/components/shared/FaucetLinks";
import { useWeb3Auth } from "@/providers/Web3AuthProvider";
import { IDENTITY_ABI, IDENTITY_ADDRESS, SBT_ABI, SBT_ADDRESS, INVESTOR_SBT_ADDRESS } from "@/lib/contracts";
import Link from "next/link";

export default function UploadClient() {
  const { wallet: web3authWallet } = useWeb3Auth();
  const { address, isConnected } = useAccount();
  const wallet = web3authWallet ?? (isConnected && address ? address : null);
  const { data: hasSBT } = useReadContract({
    address: SBT_ADDRESS as `0x${string}`,
    abi: SBT_ABI,
    functionName: "hasValidSBT",
    args: [wallet ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!wallet },
  });
  const { data: hasInvestorSBT } = useReadContract({
    address: INVESTOR_SBT_ADDRESS as `0x${string}`,
    abi: SBT_ABI,
    functionName: "hasValidSBT",
    args: [wallet ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!wallet },
  });
  const { data: hasEncryptedCompliance } = useReadContract({
    address: IDENTITY_ADDRESS as `0x${string}`,
    abi: IDENTITY_ABI,
    functionName: "hasEncryptedCompliance",
    args: [wallet ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!wallet && hasSBT === true },
  });

  if (wallet && hasSBT !== true) {
    if (hasInvestorSBT === true) {
      return (
        <AppLayout title="Upload Locked" description="Role authorization required.">
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
            <GlassCard className="p-8 text-center max-w-md mx-auto" glow="cyan">
              <div className="text-3xl mb-4">🏭</div>
              <h2 className="text-lg font-bold text-white mb-2" style={{ fontFamily: "Satoshi, sans-serif" }}>
                Verify as Supplier
              </h2>
              <p className="text-sm text-slate-400 mb-6">
                You are registered as an **Investor**. To upload and finance invoices, you must complete Supplier business verification.
              </p>
              <Link href="/register?role=supplier&upgrade=true">
                <button className="neon-btn-primary px-6 py-2.5 text-sm rounded-xl">
                  Start Supplier Onboarding
                </button>
              </Link>
            </GlassCard>
          </div>
        </AppLayout>
      );
    }
    return <LockedPage title="Upload Locked" message="Complete business verification to request financing." />;
  }

  if (wallet && hasEncryptedCompliance !== true) {
    return <LockedPage title="Upload Locked" message="Encrypted compliance is required before invoice financing." />;
  }

  return (
    <AppLayout
      title="Upload Invoice"
      description="Encrypt and tokenize an invoice for factoring — face values are never exposed publicly on-chain"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl">
        {/* Form column */}
        <div>
          <UploadInvoiceForm />
        </div>

        {/* Explainer column */}
        <div className="space-y-4">
          {/* Faucet callout */}
          <GlassCard className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-neon-cyan flex-shrink-0" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-11-7-11S5 10.7 5 15a7 7 0 0 0 7 7z" />
                </svg>
              </span>
              <div>
                <div className="text-sm font-medium text-white">Need Test Assets?</div>
                <div className="text-xs text-slate-500">Get Circle USDC faucet tokens and Sepolia ETH to interact with the platform.</div>
              </div>
            </div>
            <FaucetLinks />
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-neon-cyan" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 1.5L13 4v5c0 3-2.2 5.5-5 6C5.2 14.5 3 12 3 9V4L8 1.5z" stroke="currentColor" strokeWidth="1.2" />
                <path d="M5.5 8L7 9.5L10.5 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h2 className="text-sm font-semibold text-white">How FHE Protects Your Invoice</h2>
            </div>

            <ol className="space-y-4" aria-label="FHE protection steps">
              {[
                {
                  step: "1",
                  title: "Client-side encryption",
                  desc: "Your face value and due date are encrypted in your browser using Zama's FHEVM SDK before any network request.",
                },
                {
                  step: "2",
                  title: "ZK proof generation",
                  desc: "A zero-knowledge proof is generated alongside the ciphertext, proving you know the plaintext without revealing it.",
                },
                {
                  step: "3",
                  title: "On-chain FHE computation",
                  desc: "The smart contract computes your purchase price and discount rate directly on the ciphertexts using homomorphic arithmetic.",
                },
                {
                  step: "4",
                  title: "ACL-gated decryption",
                  desc: "Only you (supplier) and the investor (after factoring) can request decryption via EIP-712 signed permits.",
                },
              ].map((item) => (
                <li key={item.step} className="flex gap-4">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                    style={{
                      background: "linear-gradient(135deg, rgba(0,240,255,0.2), rgba(123,47,255,0.2))",
                      border: "1px solid rgba(0,240,255,0.3)",
                      color: "#00F0FF",
                    }}
                    aria-label={`Step ${item.step}`}
                  >
                    {item.step}
                  </div>
                  <div>
                    <div className="text-sm text-white font-medium mb-0.5">{item.title}</div>
                    <div className="text-xs text-slate-500 leading-relaxed">{item.desc}</div>
                  </div>
                </li>
              ))}
            </ol>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FHEBadge />
              <span className="text-xs text-slate-400">Zama FHEVM v0.11</span>
            </div>
            <div className="text-xs text-slate-500 leading-relaxed">
              Invoice data is stored as <code className="text-neon-cyan">euint64</code> ciphertexts.
              The coprocessor computes purchase prices homomorphically:
            </div>
            <pre
              className="mt-2 p-2 rounded-lg text-[10px] font-mono text-neon-cyan overflow-x-auto"
              style={{ background: "rgba(0,240,255,0.05)", border: "1px solid rgba(0,240,255,0.1)" }}
            >
{`P = V * (1 - d * t)
P = FHE.sub(
  faceValue,
  FHE.div(
    FHE.mul(FHE.mul(V, d), t),
    BPS_DAYS_DENOM
  )
)`}
            </pre>
          </GlassCard>
        </div>
      </div>
    </AppLayout>
  );
}
