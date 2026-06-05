/**
 * @file DashboardClient.tsx
 * @description Public-first dashboard landing page that becomes authenticated workspace once onboarding is complete.
 */

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAccount, useReadContract } from "wagmi";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/GlassCard";
import { WalletAddressCard } from "@/components/ui/WalletAddressCard";
import { LockedPage } from "@/components/shared/LockedPage";
import { useWeb3Auth } from "@/providers/Web3AuthProvider";
import {
  fromMicro,
  IDENTITY_ABI,
  IDENTITY_ADDRESS,
  InvoiceStatus,
  shortAddress,
  SBT_ABI,
  SBT_ADDRESS,
} from "@/lib/contracts";
import {
  useInvoiceCount,
  useInvestorInvoices,
  useRealInvoiceList,
  useSupplierInvoices,
  useUSDCBalance,
} from "@/hooks/useArbitraRegistry";

function PublicDashboardLanding() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(0,240,255,0.12) 0%, transparent 30%), radial-gradient(circle at 85% 20%, rgba(255,186,0,0.10) 0%, transparent 24%), #030814",
        padding: "32px 22px 48px",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 24 }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                color: "#00F0FF",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 10,
              }}
            >
              Arbitra Dashboard
            </div>
            <h1
              style={{
                margin: 0,
                color: "#EEF2FF",
                fontFamily: "Satoshi, sans-serif",
                fontSize: "clamp(34px, 5vw, 56px)",
                lineHeight: 1.05,
                letterSpacing: "-0.04em",
              }}
            >
              Confidential invoice finance, without exposing your data.
            </h1>
          </div>

          <Link
            href="/register?next=/dashboard"
            style={{
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 52,
              padding: "0 24px",
              borderRadius: 14,
              background: "#00F0FF",
              color: "#020714",
              fontWeight: 800,
              fontSize: 14,
              boxShadow: "0 0 24px rgba(0,240,255,0.2)",
            }}
          >
            Login
          </Link>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.3fr) minmax(320px, 0.9fr)",
            gap: 22,
          }}
        >
          <GlassCard className="p-8" glow="cyan">
            <div style={{ display: "grid", gap: 20 }}>
              <div>
                <div style={{ color: "#FFCF6B", fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
                  Dashboard Landing Page
                </div>
                <p style={{ color: "#8B9CC8", lineHeight: 1.8, fontSize: 15, margin: 0 }}>
                  Enter through the dashboard first, then choose email or wallet authentication. Business verification unlocks the invoice marketplace, submission, underwriting, and tokenization flows.
                </p>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 14,
                }}
              >
                {[
                  { label: "Authentication", value: "Email or Wallet" },
                  { label: "Compliance", value: "Mock KYB Oracle" },
                  { label: "Privacy", value: "FHE after KYB" },
                  { label: "Access", value: "SBT-gated Marketplace" },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.06)",
                      background: "rgba(255,255,255,0.02)",
                      padding: 16,
                    }}
                  >
                    <div style={{ color: "#8B9CC8", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {item.label}
                    </div>
                    <div style={{ color: "#EEF2FF", fontSize: 16, fontWeight: 700, marginTop: 8 }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-8" glow="cyan">
            <div style={{ display: "grid", gap: 16 }}>
              <h2 style={{ color: "#EEF2FF", margin: 0, fontSize: 22, fontWeight: 800 }}>How access unlocks</h2>
              {[
                "Visit dashboard landing page",
                "Click Login",
                "Authenticate with email",
                "Generate embedded wallet",
                "Complete mock business verification",
                "Mint SBT and unlock marketplace",
              ].map((step, index) => (
                <div key={step} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "rgba(0,240,255,0.12)",
                      color: "#00F0FF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: 12,
                    }}
                  >
                    {index + 1}
                  </div>
                  <span style={{ color: "#C9D4F0", fontSize: 14 }}>{step}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </main>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

function StatCard({ label, value, sub, color = "#00F0FF" }: StatCardProps) {
  return (
    <GlassCard className="p-6" hover glow="cyan">
      <div style={{ fontSize: 28, fontWeight: 700, color, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#8B9CC8", fontWeight: 600 }}>{label}</div>
      {sub ? <div style={{ fontSize: 11, color: "#4F6495", marginTop: 4 }}>{sub}</div> : null}
    </GlassCard>
  );
}

function AuthenticatedDashboard({ wallet }: { wallet: `0x${string}` }) {
  const [walletOpen, setWalletOpen] = useState(false);
  const { address, isConnected } = useAccount();
  const { data: realInvoices } = useRealInvoiceList();
  const { data: invoiceCount } = useInvoiceCount();
  const { data: supplierIds } = useSupplierInvoices(isConnected ? address : undefined);
  const { data: investorIds } = useInvestorInvoices(isConnected ? address : undefined);
  const { data: usdcBalance } = useUSDCBalance(isConnected ? address : undefined);
  const { data: hasSBT } = useReadContract({
    address: SBT_ADDRESS as `0x${string}`,
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

  const invoices = realInvoices ?? [];
  const totalOnChain = invoiceCount ? Number(invoiceCount) : 0;
  const myUploaded = supplierIds ? (supplierIds as bigint[]).length : 0;
  const myInvested = investorIds ? (investorIds as bigint[]).length : 0;
  const usdcHuman = usdcBalance ? fromMicro(usdcBalance as bigint) : "0.00";
  const available = invoices.filter((item) => item.status === InvoiceStatus.Pending || item.status === InvoiceStatus.Attested).length;
  const factored = invoices.filter((item) => item.status === InvoiceStatus.Factored).length;
  const settled = invoices.filter((item) => item.status === InvoiceStatus.Settled).length;
  const isVerifiedBusiness = hasSBT === true && hasEncryptedCompliance === true;

  if (wallet && hasSBT !== true) {
    return <LockedPage title="Dashboard Locked" message="Complete business verification to access the dashboard." />;
  }

  if (wallet && hasEncryptedCompliance !== true) {
    return <LockedPage title="Dashboard Locked" message="Encrypted compliance is required before dashboard access." />;
  }

  return (
    <AppLayout
      title="Dashboard"
      description="Overview of your account, marketplace readiness, and on-chain invoice activity."
    >
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <GlassCard className="p-6" glow="cyan">
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ color: "#00F0FF", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Wallet Connected: {shortAddress(wallet)}
                </div>
                <div style={{ color: isVerifiedBusiness ? "#00FF88" : "#FFCF6B", fontSize: 14, fontWeight: 700 }}>
                  Account Status: {isVerifiedBusiness ? "Verified Business" : "Compliance Required"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setWalletOpen(true)}
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.04)",
                    color: "#C9D4F0",
                    borderRadius: 10,
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  My Wallet
                </button>
                <Link
                  href="/upload"
                  style={{
                    textDecoration: "none",
                    padding: "10px 16px",
                    borderRadius: 10,
                    background: "#00F0FF",
                    color: "#020714",
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  Request Financing
                </Link>
                {!isVerifiedBusiness && (
                  <Link
                    href="/register?next=/dashboard"
                    style={{
                      textDecoration: "none",
                      padding: "10px 16px",
                      borderRadius: 10,
                      background: "#FFBA00",
                      color: "#020714",
                      fontWeight: 800,
                      fontSize: 13,
                    }}
                  >
                    Complete Compliance
                  </Link>
                )}
              </div>
            </div>

            {walletOpen && (
              <div
                onClick={() => setWalletOpen(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 80,
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "flex-end",
                  padding: "76px 24px 24px",
                  background: "rgba(2,7,20,0.45)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    width: "min(390px, 100%)",
                    borderRadius: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ color: "#EEF2FF", fontSize: 14, fontWeight: 800 }}>My Wallet</span>
                    <button
                      type="button"
                      onClick={() => setWalletOpen(false)}
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: 10,
                        color: "#8B9CC8",
                        cursor: "pointer",
                        padding: "6px 10px",
                      }}
                    >
                      Close
                    </button>
                  </div>
                  <WalletAddressCard walletAddress={wallet} />
                </div>
              </div>
            )}

            {wallet && !isVerifiedBusiness && (
              <div
                style={{
                  background: "rgba(255,186,0,0.06)",
                  border: "1px solid rgba(255,186,0,0.22)",
                  borderRadius: 16,
                  padding: "16px 20px",
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFBA00" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <div>
                    <p
                      style={{
                        color: "#FFBA00",
                        fontSize: 14,
                        fontWeight: 700,
                        fontFamily: "Satoshi,sans-serif",
                        margin: 0,
                      }}
                    >
                      Dashboard Locked - Encrypted Compliance Required to Continue
                    </p>
                    <p style={{ color: "#8B9CC8", fontSize: 12, marginTop: 3, margin: 0 }}>
                      Account Status:{" "}
                      <span style={{ color: "#FFBA00", fontWeight: 600 }}>Compliance Required</span>
                    </p>
                  </div>
                </div>
                <a
                  href="/register"
                  style={{
                    background: "#FFBA00",
                    color: "#020714",
                    borderRadius: 11,
                    padding: "9px 20px",
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "Satoshi,sans-serif",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  Start Verification {"\u2192"}
                </a>
              </div>
            )}
          </div>
        </GlassCard>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total On-Chain" value={totalOnChain} sub="Invoices in registry" color="#00FF88" />
          <StatCard label="My Uploaded" value={myUploaded} sub="Supplier activity" />
          <StatCard label="My Investments" value={myInvested} sub="Investor activity" color="#A87FFF" />
          <StatCard label="USDC Balance" value={`$${usdcHuman}`} sub="Sepolia USDC" color="#00FF88" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Available" value={available} sub="Open opportunities" />
          <StatCard label="Factored" value={factored} sub="In active financing" color="#00FF88" />
          <StatCard label="Settled" value={settled} sub="Completed invoices" color="#7AD9FF" />
        </div>
      </motion.div>
    </AppLayout>
  );
}

export default function DashboardClient() {
  const { wallet: web3authWallet, isLoggedIn, isInitializing } = useWeb3Auth();
  const { address, isConnected } = useAccount();
  const wallet = web3authWallet ?? (isConnected && address ? address : null);

  if (isInitializing && !isConnected) return null;
  if (!wallet || (!isLoggedIn && !isConnected)) return null;

  return <AuthenticatedDashboard wallet={wallet} />;
}
