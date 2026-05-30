/**
 * @file UploadClient.tsx
 * @description Upload page client-side wrapper. Displays the invoice submission wizard and explaining sidebars.
 */

"use client";

import React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { UploadInvoiceForm } from "@/components/invoice/UploadInvoiceForm";
import { GlassCard } from "@/components/ui/GlassCard";
import { FHEBadge } from "@/components/ui/FHEBadge";
import { FaucetLinks } from "@/components/shared/FaucetLinks";

export default function UploadClient() {
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

          {/* Demo limit callout */}
          <GlassCard className="p-4">
            <div className="flex items-start gap-3">
              <span className="text-amber-400 mt-0.5 flex-shrink-0" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
              <div>
                <div className="text-sm font-medium text-amber-400 mb-1">
                  Demo Invoice Size Limit
                </div>
                <div className="text-xs text-slate-500 leading-relaxed">
                  This demo uses <code className="text-neon-cyan">euint64</code> for face values.
                  Due to intermediate multiplication overflow, the maximum safe invoice size is{" "}
                  <strong className="text-white">$3,356 cUSDC</strong> at a 15% discount rate and
                  365-day maturity. Production deployments would use euint128 or intermediate
                  scaling to support larger amounts.
                </div>
              </div>
            </div>
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
