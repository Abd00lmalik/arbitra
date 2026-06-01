/**
 * @file DashboardClient.tsx
 * @description Public-first dashboard landing page that becomes authenticated workspace once onboarding is complete.
 */

"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAccount, useReadContract } from "wagmi";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/GlassCard";
import { useWeb3Auth } from "@/providers/Web3AuthProvider";
import {
  fromMicro,
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

export default function DashboardClient() {
  const { address, isConnected } = useAccount();
  const { wallet, isLoggedIn } = useWeb3Auth();
  const { data: realInvoices } = useRealInvoiceList();
  const { data: invoiceCount } = useInvoiceCount();
  const { data: supplierIds } = useSupplierInvoices(isConnected ? address : undefined);
  const { data: investorIds } = useInvestorInvoices(isConnected ? address : undefined);
  const { data: usdcBalance } = useUSDCBalance(isConnected ? address : undefined);

  const { data: hasSBT } = useReadContract({
    address: SBT_ADDRESS,
    abi: SBT_ABI,
    functionName: "hasValidSBT",
    args: [wallet ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!wallet },
  });

  if (!isLoggedIn || !wallet) {
    return <PublicDashboardLanding />;
  }

  const invoices = realInvoices ?? [];
  const totalOnChain = invoiceCount ? Number(invoiceCount) : 0;
  const myUploaded = supplierIds ? (supplierIds as bigint[]).length : 0;
  const myInvested = investorIds ? (investorIds as bigint[]).length : 0;
  const usdcHuman = usdcBalance ? fromMicro(usdcBalance as bigint) : "0.00";
  const available = invoices.filter((item) => item.status === InvoiceStatus.Pending || item.status === InvoiceStatus.Attested).length;
  const factored = invoices.filter((item) => item.status === InvoiceStatus.Factored).length;
  const settled = invoices.filter((item) => item.status === InvoiceStatus.Settled).length;

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
                <div style={{ color: hasSBT ? "#00FF88" : "#FFCF6B", fontSize: 14, fontWeight: 700 }}>
                  Account Status: {hasSBT ? "Verified Business" : "Unverified Business"}
                </div>
              </div>
              {!hasSBT && (
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
                  Start Verification
                </Link>
              )}
            </div>

            {!hasSBT && (
              <div
                style={{
                  borderRadius: 14,
                  border: "1px solid rgba(255,186,0,0.24)",
                  background: "rgba(255,186,0,0.06)",
                  padding: 14,
                  color: "#FFCF6B",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                Invoice Marketplace Locked - Business Verification Required to Continue
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
