/**
 * @file DashboardClient.tsx
 * @description Main dashboard interface featuring role-specific stats cards, portfolio distribution charts, transaction lists, and security engine specs.
 */

"use client";

import React, { useState } from "react";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/GlassCard";
import { FHEBadge } from "@/components/ui/FHEBadge";
import { FaucetButton } from "@/components/ui/FaucetButton";
import { PortfolioDonut } from "@/components/ui/PortfolioDonut";
import {
  useInvoiceCount,
  useSupplierInvoices,
  useInvestorInvoices,
  useMockInvoiceList,
} from "@/hooks/useArbitraRegistry";
import { useZama } from "@/providers/ZamaProvider";
import Link from "next/link";

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: string;
  icon: React.ReactNode;
  color?: string;
}

function StatCard({ label, value, delta, icon, color = "#00F0FF" }: StatCardProps) {
  return (
    <GlassCard className="p-6" hover glow="cyan">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
        <div style={{ color }}>{icon}</div>
        {delta && (
          <span
            style={{
              fontSize: "10px",
              fontWeight: 600,
              padding: "4px 8px",
              borderRadius: "100px",
              background: "rgba(0, 255, 136, 0.1)",
              border: "1px solid rgba(0, 255, 136, 0.2)",
              color: "#00FF88"
            }}
          >
            {delta}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: "24px",
          fontWeight: 700,
          color: "#EEF2FF",
          fontFamily: "Satoshi, sans-serif",
          marginBottom: "6px"
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: "12px", color: "#8B9CC8", fontWeight: 500 }}>{label}</div>
    </GlassCard>
  );
}

export default function DashboardClient() {
  const { address, isConnected } = useAccount();
  const { isReady: zamaReady } = useZama();
  const mockInvoices = useMockInvoiceList();

  const { data: invoiceCount } = useInvoiceCount();
  const { data: supplierIds } = useSupplierInvoices(
    isConnected ? address : undefined
  );
  const { data: investorIds } = useInvestorInvoices(
    isConnected ? address : undefined
  );

  /* Global Switch Role Toggle state */
  const [activeRole, setActiveRole] = useState<"supplier" | "investor">("supplier");

  const totalInvoices = invoiceCount ? Number(invoiceCount) : 0;
  const mySupplierInvoices = supplierIds?.length ?? 0;
  const myInvestorInvoices = investorIds?.length ?? 0;

  const factored = mockInvoices.filter((i) => i.isFactored && !i.isRepaid).length;
  const available = mockInvoices.filter((i) => !i.isFactored).length;
  const repaid = mockInvoices.filter((i) => i.isRepaid).length;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <AppLayout
      title="Dashboard"
      description="Confidential overview of your tokenized invoices and factoring yield."
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Header Toolbar with switch role toggle */}
        <motion.div variants={itemVariants} className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/2 border border-white/5 text-xs">
            <button
              onClick={() => setActiveRole("supplier")}
              className={`px-3 py-1.5 rounded-lg transition-all duration-200 ${
                activeRole === "supplier"
                  ? "bg-neon-cyan/10 border border-neon-cyan/35 text-neon-cyan font-bold"
                  : "text-slate-400 border border-transparent hover:text-white"
              }`}
            >
              Role: Supplier
            </button>
            <button
              onClick={() => setActiveRole("investor")}
              className={`px-3 py-1.5 rounded-lg transition-all duration-200 ${
                activeRole === "investor"
                  ? "bg-neon-purple/10 border border-neon-purple/35 text-neon-purple font-bold"
                  : "text-slate-400 border border-transparent hover:text-white"
              }`}
            >
              Role: Investor
            </button>
          </div>

          <div className="flex items-center gap-3">
            <FaucetButton />
          </div>
        </motion.div>

        {/* Warning notification when wallet is disconnected */}
        {!isConnected && (
          <motion.div variants={itemVariants}>
            <div
              style={{
                padding: "16px 20px",
                borderRadius: "16px",
                background: "rgba(123, 47, 255, 0.08)",
                border: "1px solid rgba(123, 47, 255, 0.25)",
                color: "#EEF2FF",
                fontSize: "14px",
                fontFamily: "Satoshi, sans-serif"
              }}
            >
              Please connect your Web3 wallet to authorize secure EIP-712 decryption requests and load your factoring dashboard.
            </div>
          </motion.div>
        )}

        {/* Outer 2/3 Left vs 1/3 Right Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Column (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer-Facing FHE Shielding pill (No raw debug logs) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "16px",
                padding: "16px 20px",
                borderRadius: "16px",
                background: "rgba(10, 16, 38, 0.85)",
                border: "1px solid rgba(255, 255, 255, 0.05)",
                backdropFilter: "blur(20px)"
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: zamaReady ? "#00FF88" : "#FFC400",
                  boxShadow: zamaReady ? "0 0 10px #00FF88" : "0 0 10px #FFC400",
                  animation: "pulse 2s ease-in-out infinite"
                }}
              />
              <span style={{ fontSize: "13px", color: "#8B9CC8", fontFamily: "Satoshi, sans-serif" }}>
                FHEVM Shielding:{" "}
                <span style={{ color: zamaReady ? "#00FF88" : "#FFC400", fontWeight: 600 }}>
                  {zamaReady ? "Active (Zero plaintext on-chain)" : "Securing Node Connection..."}
                </span>
              </span>
              <div style={{ marginLeft: "auto" }}>
                <FHEBadge />
              </div>
            </div>

            {/* Dynamic statistics cards grid based on active user role */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeRole === "supplier" ? (
                <>
                  <StatCard
                    label="My Uploaded Invoices"
                    value={mySupplierInvoices}
                    color="#00F0FF"
                    icon={
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    }
                  />
                  <StatCard
                    label="Awaiting Factoring"
                    value={available}
                    color="#7B2FFF"
                    icon={
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    }
                  />
                  <StatCard
                    label="Total Factored Volume"
                    value={mySupplierInvoices > 0 ? `$${(mySupplierInvoices * 125000).toLocaleString()}` : "$0.00"}
                    delta="+14.2%"
                    color="#00FF88"
                    icon={
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <line x1="12" y1="1" x2="12" y2="23" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    }
                  />
                  <StatCard
                    label="Repaid Volume"
                    value={repaid > 0 ? `$${(repaid * 125000).toLocaleString()}` : "$0.00"}
                    color="#FF2D6B"
                    icon={
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    }
                  />
                </>
              ) : (
                <>
                  <StatCard
                    label="Active Factored Investments"
                    value={myInvestorInvoices}
                    color="#00F0FF"
                    icon={
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                      </svg>
                    }
                  />
                  <StatCard
                    label="Average Yield Rate"
                    value="14.20% APR"
                    delta="Premium"
                    color="#7B2FFF"
                    icon={
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                      </svg>
                    }
                  />
                  <StatCard
                    label="Confidential Factored Balance"
                    value={myInvestorInvoices > 0 ? `$${(myInvestorInvoices * 125000).toLocaleString()}` : "$0.00"}
                    color="#00FF88"
                    icon={
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    }
                  />
                  <StatCard
                    label="Total factoring volume on chain"
                    value={totalInvoices || 2}
                    color="#FF2D6B"
                    icon={
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <line x1="22" y1="12" x2="2" y2="12" />
                        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                      </svg>
                    }
                  />
                </>
              )}
            </div>

            {/* Recent Invoices list */}
            <GlassCard className="p-6">
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#EEF2FF", fontFamily: "Satoshi, sans-serif", marginBottom: "20px" }}>
                Recent Invoices
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {mockInvoices.map((inv) => (
                  <div
                    key={inv.invoiceId.toString()}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "16px",
                      borderRadius: "16px",
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.04)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "10px",
                          background: "rgba(0, 240, 255, 0.08)",
                          border: "1px solid rgba(0, 240, 255, 0.15)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#00F0FF",
                          fontFamily: "JetBrains Mono, monospace"
                        }}
                      >
                        #{inv.invoiceId.toString()}
                      </div>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: "#EEF2FF", fontFamily: "Satoshi, sans-serif" }}>
                          Invoice #{inv.invoiceId.toString()}
                        </div>
                        <div style={{ fontSize: "11px", color: "#8B9CC8", fontFamily: "JetBrains Mono, monospace", marginTop: "2px" }}>
                          Supplier: {inv.supplier.slice(0, 10)}...
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <FHEBadge size="sm" label="Encrypted" animated={false} />
                      {inv.isRepaid ? (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            padding: "4px 10px",
                            borderRadius: "100px",
                            background: "rgba(0, 255, 136, 0.1)",
                            color: "#00FF88",
                            border: "1px solid rgba(0, 255, 136, 0.2)"
                          }}
                        >
                          Repaid
                        </span>
                      ) : inv.isFactored ? (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            padding: "4px 10px",
                            borderRadius: "100px",
                            background: "rgba(0, 240, 255, 0.1)",
                            color: "#00F0FF",
                            border: "1px solid rgba(0, 240, 255, 0.2)"
                          }}
                        >
                          Factored
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            padding: "4px 10px",
                            borderRadius: "100px",
                            background: "rgba(255, 196, 0, 0.1)",
                            color: "#FFC400",
                            border: "1px solid rgba(255, 196, 0, 0.2)"
                          }}
                        >
                          Available
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "20px", textAlign: "center" }}>
                <Link
                  href="/marketplace"
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#00F0FF",
                    textDecoration: "none",
                    fontFamily: "Satoshi, sans-serif"
                  }}
                >
                  Browse Marketplace Invoices &rarr;
                </Link>
              </div>
            </GlassCard>
          </div>

          {/* Right Column (1/3 width) */}
          <div className="space-y-6">
            {/* Portfolio Donut */}
            <GlassCard className="p-6">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#EEF2FF", fontFamily: "Satoshi, sans-serif" }}>
                  Portfolio Distribution
                </h3>
                <FHEBadge size="sm" />
              </div>
              <PortfolioDonut factored={factored} available={available} repaid={repaid} />
            </GlassCard>

            {/* Secured Node Configurations (Replaced tech specs jargon) */}
            <GlassCard className="p-6">
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#EEF2FF", fontFamily: "Satoshi, sans-serif", marginBottom: "20px" }}>
                Homomorphic Security Engine
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  {
                    label: "Security Standard",
                    value: "128-Bit FHE (TFHE-rs)",
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="1.5">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    )
                  },
                  {
                    label: "Encryption Protocol",
                    value: "Confidential cUSDT ERC-7984",
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7B2FFF" strokeWidth="1.5">
                        <rect x="4" y="4" width="16" height="16" rx="2" />
                        <rect x="9" y="9" width="6" height="6" />
                      </svg>
                    )
                  },
                  {
                    label: "Access Controls",
                    value: "EIP-712 Signed Permit",
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00FF88" strokeWidth="1.5">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    )
                  },
                  {
                    label: "Node Connection Status",
                    value: "Active Secure Coprocessor",
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF2D6B" strokeWidth="1.5">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                      </svg>
                    )
                  }
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 16px",
                      borderRadius: "16px",
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.04)"
                    }}
                  >
                    <div style={{ flexShrink: 0 }}>{item.icon}</div>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: "10px", color: "#8B9CC8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#EEF2FF", fontFamily: "Satoshi, sans-serif", marginTop: "2px" }}>
                        {item.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      </motion.div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </AppLayout>
  );
}
