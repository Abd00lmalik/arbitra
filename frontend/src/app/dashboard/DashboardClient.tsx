/**
 * @file DashboardClient.tsx
 * @description Main dashboard interface featuring clean metrics, dynamic role switching,
 *              Faucet links, on-chain balances, and a USDC wrapping control panel.
 */

"use client";

import React, { useState } from "react";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/GlassCard";
import { FHEBadge } from "@/components/ui/FHEBadge";
import { PortfolioDonut } from "@/components/ui/PortfolioDonut";
import { RoleToggle } from "@/components/shared/RoleToggle";
import { FaucetLinks } from "@/components/shared/FaucetLinks";
import { WrapUSDCButton } from "@/components/shared/WrapUSDCButton";
import {
  useInvoiceCount,
  useSupplierInvoices,
  useInvestorInvoices,
  useMockInvoiceList,
  useRealInvoiceList
} from "@/hooks/useArbitraRegistry";
import { useZama } from "@/providers/ZamaProvider";
import { useRole } from "@/providers/RoleProvider";
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
  const { role } = useRole();
  const mockInvoices = useMockInvoiceList();
  const { data: realInvoices, isLoading: isLoadingInvoices } = useRealInvoiceList();
  const [wrapAmount, setWrapAmount] = useState<number>(100);

  const hasRealInvoices = realInvoices && realInvoices.length > 0;
  const invoices = hasRealInvoices ? realInvoices : mockInvoices;
  const isDemoMode = !hasRealInvoices;

  const { data: invoiceCount } = useInvoiceCount();
  const { data: supplierIds } = useSupplierInvoices(
    isConnected ? address : undefined
  );
  const { data: investorIds } = useInvestorInvoices(
    isConnected ? address : undefined
  );

  const totalInvoices = isConnected && invoiceCount ? Number(invoiceCount) : invoices.length;
  const mySupplierInvoices = isConnected ? (supplierIds?.length ?? 0) : (isDemoMode ? 1 : 0);
  const myInvestorInvoices = isConnected ? (investorIds?.length ?? 0) : (isDemoMode ? 1 : 0);

  const factored = invoices.filter((i) => i.isFactored && !i.isRepaid).length;
  const available = invoices.filter((i) => !i.isFactored).length;
  const repaid = invoices.filter((i) => i.isRepaid).length;

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

        {/* Demo Mode Banner */}
        {isConnected && isDemoMode && (
          <motion.div variants={itemVariants}>
            <div
              style={{
                padding: "16px 20px",
                borderRadius: "16px",
                background: "rgba(0, 240, 255, 0.05)",
                border: "1px solid rgba(0, 240, 255, 0.2)",
                color: "#EEF2FF",
                fontSize: "13px",
                fontFamily: "Satoshi, sans-serif",
                display: "flex",
                alignItems: "center",
                gap: "10px"
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>
                <strong>Demo Mode Active:</strong> No on-chain invoices detected for your wallet on Sepolia. Showing simulated portfolio statistics. Use the <strong>Upload</strong> page to create a real encrypted invoice.
              </span>
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
                FHE Cryptographic Protocol Active (Sepolia Network)
              </span>
              <div style={{ marginLeft: "auto" }}>
                <FHEBadge />
              </div>
            </div>

            {/* Dynamic statistics cards grid based on active user role */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {role === "supplier" ? (
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
                    label="Total Factored Invoices"
                    value={factored}
                    color="#00FF88"
                    icon={
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <line x1="12" y1="1" x2="12" y2="23" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    }
                  />
                  <StatCard
                    label="Repaid Invoices"
                    value={repaid}
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
                    label="Current Net APY Yield"
                    value={myInvestorInvoices > 0 ? "14.20% APY" : "0.00% APY"}
                    delta={myInvestorInvoices > 0 ? "Premium" : undefined}
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
                    label="Confidential Factored State"
                    value="Shielded"
                    color="#00FF88"
                    icon={
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    }
                  />
                  <StatCard
                    label="Total Platform Invoices"
                    value={totalInvoices}
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
                {invoices.map((inv) => (
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
                      <FHEBadge size="sm" label="FHE Protected" animated={false} />
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
            
            {/* USDC Wrapping Utility Card */}
            <GlassCard className="p-6">
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#EEF2FF", fontFamily: "Satoshi, sans-serif", marginBottom: "12px" }}>
                Wrapping Utility
              </h3>
              <p style={{ fontSize: "12px", color: "#8B9CC8", lineHeight: "1.5", marginBottom: "16px" }}>
                Wrap your standard Sepolia USDC to Confidential USDC (cUSDC) using Zama's official wrappers registry before factoring.
              </p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "10px", color: "#8B9CC8", fontWeight: 600, textTransform: "uppercase" }}>Amount to Wrap (USDC)</label>
                  <input
                    type="number"
                    value={wrapAmount}
                    onChange={(e) => setWrapAmount(Number(e.target.value))}
                    style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "10px",
                      padding: "8px 12px",
                      fontSize: "13px",
                      color: "#white",
                      fontFamily: "JetBrains Mono, monospace",
                      outline: "none"
                    }}
                  />
                </div>
                <WrapUSDCButton amountUSDC={wrapAmount} />
              </div>
            </GlassCard>

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

            {/* Platform Security Specifications */}
            <GlassCard className="p-6">
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#EEF2FF", fontFamily: "Satoshi, sans-serif", marginBottom: "20px" }}>
                Confidential Infrastructure
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  {
                    label: "Privacy Protocol",
                    value: "Fully Homomorphic Encryption (FHE)",
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="1.5">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    )
                  },
                  {
                    label: "Confidential Asset",
                    value: "Confidential USDC (cUSDC)",
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7B2FFF" strokeWidth="1.5">
                        <rect x="4" y="4" width="16" height="16" rx="2" />
                        <rect x="9" y="9" width="6" height="6" />
                      </svg>
                    )
                  },
                  {
                    label: "Access Control Permit",
                    value: "Secure Wallet Auth Permit",
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00FF88" strokeWidth="1.5">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    )
                  },
                  {
                    label: "Status Monitor",
                    value: "Active Transaction Verification",
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
