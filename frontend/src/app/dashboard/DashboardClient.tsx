/**
 * @file DashboardClient.tsx
 * @description Main dashboard interface featuring clean metrics, dynamic role switching,
 *              Faucet links, on-chain balances, and real on-chain portfolio statistics.
 */

"use client";

import React from "react";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/GlassCard";
import { FHEBadge } from "@/components/ui/FHEBadge";
import { PortfolioDonut } from "@/components/ui/PortfolioDonut";
import { RoleToggle } from "@/components/shared/RoleToggle";
import { FaucetLinks } from "@/components/shared/FaucetLinks";
import {
  useInvoiceCount,
  useSupplierInvoices,
  useInvestorInvoices,
  useRealInvoiceList,
  useUSDCBalance
} from "@/hooks/useArbitraRegistry";
import { useZama } from "@/providers/ZamaProvider";
import { useRole } from "@/providers/RoleProvider";
import Link from "next/link";
import { InvoiceStatus, fromMicro, shortAddress, STATUS_LABEL, STATUS_COLOR } from "@/lib/contracts";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color?: string;
}

function StatCard({ label, value, sub, icon, color = "#00F0FF" }: StatCardProps) {
  return (
    <GlassCard className="p-6" hover glow="cyan">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <div
        style={{
          fontSize: "28px",
          fontWeight: 700,
          color: "#EEF2FF",
          fontFamily: "Satoshi, sans-serif",
          marginBottom: "6px"
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: "12px", color: "#8B9CC8", fontWeight: 500 }}>{label}</div>
      {sub && (
        <div style={{ fontSize: "11px", color: "#4F6495", marginTop: "4px" }}>{sub}</div>
      )}
    </GlassCard>
  );
}

export default function DashboardClient() {
  const { address, isConnected } = useAccount();
  const { isReady: zamaReady } = useZama();
  const { role } = useRole();
  const { data: realInvoices, isLoading: isLoadingInvoices } = useRealInvoiceList();

  const invoices = realInvoices ?? [];

  const { data: invoiceCount } = useInvoiceCount();
  const { data: supplierIds } = useSupplierInvoices(
    isConnected ? address : undefined
  );
  const { data: investorIds } = useInvestorInvoices(
    isConnected ? address : undefined
  );
  const { data: usdcBalance } = useUSDCBalance(
    isConnected ? address : undefined
  );

  const totalOnChain = invoiceCount ? Number(invoiceCount) : 0;
  const myUploaded = supplierIds ? (supplierIds as bigint[]).length : 0;
  const myInvested = investorIds ? (investorIds as bigint[]).length : 0;
  const usdcHuman = usdcBalance ? fromMicro(usdcBalance as bigint) : "0.00";

  const factored = invoices.filter((i) => i.status === InvoiceStatus.Factored).length;
  const available = invoices.filter((i) => i.status === InvoiceStatus.Pending || i.status === InvoiceStatus.Attested).length;
  const repaid = invoices.filter((i) => i.status === InvoiceStatus.Settled).length;

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

  const stats = [
    {
      label: "Total On-Chain",
      value: totalOnChain > 0 ? totalOnChain.toString() : "0",
      sub: "invoices in registry",
      color: "#00FF88",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="22" y1="12" x2="2" y2="12" />
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      )
    },
    {
      label: "My Uploaded",
      value: isConnected ? myUploaded.toString() : "—",
      sub: "as supplier",
      color: "#00F0FF",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      )
    },
    {
      label: "My Investments",
      value: isConnected ? myInvested.toString() : "—",
      sub: "as investor",
      color: "#A87FFF",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      )
    },
    {
      label: "USDC Balance",
      value: isConnected ? `$${usdcHuman}` : "—",
      sub: "Sepolia USDC",
      color: "#00FF88",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="6" x2="12" y2="18" />
          <line x1="12" y1="12" x2="16" y2="8" />
          <line x1="12" y1="12" x2="8" y2="16" />
        </svg>
      )
    }
  ];

  return (
    <AppLayout
      title="Dashboard"
      description="Overview of your tokenized invoices, factored yield, and confidential balance."
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Header Toolbar containing role toggle and faucet links */}
        <motion.div variants={itemVariants} className="flex items-center justify-between flex-wrap gap-4 bg-navy-950/40 p-4 border border-white/5 rounded-2xl">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Switch Mode:</span>
            <RoleToggle />
          </div>

          <div className="flex items-center gap-3">
            <FaucetLinks />
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

        {/* Column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Column (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Clean Shield banner */}
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
                  boxShadow: zamaReady ? "0 0 10px #00FF88" : "0 0 10px #FFC400"
                }}
              />
              <span style={{ fontSize: "13px", color: "#8B9CC8", fontFamily: "Satoshi, sans-serif", fontWeight: 600 }}>
                Privacy Protection Protocol Active (Sepolia Network)
              </span>
              <div style={{ marginLeft: "auto" }}>
                <FHEBadge />
              </div>
            </div>

            {/* Dynamic statistics cards grid - real data, no APY, no Secured */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stats.map((s) => (
                <StatCard
                  key={s.label}
                  label={s.label}
                  value={s.value}
                  sub={s.sub}
                  color={s.color}
                  icon={s.icon}
                />
              ))}
            </div>

            {/* Recent Invoices list */}
            <GlassCard className="p-6">
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#EEF2FF", fontFamily: "Satoshi, sans-serif", marginBottom: "20px" }}>
                Recent Invoices
              </h3>
              {isLoadingInvoices ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "150px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      border: "3px solid rgba(0, 240, 255, 0.1)",
                      borderTopColor: "#00F0FF",
                      animation: "spin 1s linear infinite",
                      marginBottom: "12px"
                    }}
                  />
                  <p style={{ color: "#8B9CC8", fontSize: "13px", fontFamily: "Satoshi, sans-serif" }}>
                    Loading recent invoices...
                  </p>
                </div>
              ) : invoices.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#8B9CC8", fontSize: "13px" }}>
                  No on-chain invoices detected. Use the Upload page to tokenize an invoice.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {invoices.slice(-5).reverse().map((inv) => (
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
                            Supplier: {shortAddress(inv.supplier)}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <FHEBadge size="sm" label="FHE Protected" animated={false} />
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            padding: "4px 10px",
                            borderRadius: "100px",
                            background: `${STATUS_COLOR[inv.status]}15`,
                            color: STATUS_COLOR[inv.status],
                            border: `1px solid ${STATUS_COLOR[inv.status]}30`
                          }}
                        >
                          {STATUS_LABEL[inv.status]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
              {invoices.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#8B9CC8", fontSize: "13px" }}>
                  No invoice data available.
                </div>
              ) : (
                <PortfolioDonut factored={factored} available={available} repaid={repaid} />
              )}
            </GlassCard>

            {/* Platform Security Specifications */}
            <GlassCard className="p-6">
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#EEF2FF", fontFamily: "Satoshi, sans-serif", marginBottom: "20px" }}>
                Confidential Infrastructure
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  {
                    label: "Cryptography Status",
                    value: "Fully Private Calculations",
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="1.5">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    )
                  },
                  {
                    label: "Asset Protection",
                    value: "Standard USDC Ledger",
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7B2FFF" strokeWidth="1.5">
                        <rect x="4" y="4" width="16" height="16" rx="2" />
                        <rect x="9" y="9" width="6" height="6" />
                      </svg>
                    )
                  },
                  {
                    label: "Authentication",
                    value: "Wallet Authorization",
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00FF88" strokeWidth="1.5">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    )
                  },
                  {
                    label: "Integrity Monitor",
                    value: "Continuous Verification",
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
    </AppLayout>
  );
}
