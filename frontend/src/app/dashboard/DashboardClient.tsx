/**
 * @file DashboardClient.tsx
 * @description Main dashboard interface with glassmorphic stats cards, portfolio donut charts, recent invoices, and FHE system specs.
 */

"use client";

import React from "react";
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

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: string;
  icon: React.ReactNode;
  color?: string;
}

function StatCard({ label, value, delta, icon, color = "#00F0FF" }: StatCardProps) {
  return (
    <GlassCard className="p-6">
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
        style={{ display: "flex", flexDirection: "column", gap: "24px" }}
      >
        {/* Connection warning */}
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

        {/* FHE status bar */}
        <motion.div variants={itemVariants}>
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
              Zama FHEVM Shield:{" "}
              <span style={{ color: zamaReady ? "#00FF88" : "#FFC400", fontWeight: 600 }}>
                {zamaReady ? "FHE Active - Zero plaintext onchain" : "Initializing SDK..."}
              </span>
            </span>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
              <FaucetButton />
              <FHEBadge />
            </div>
          </div>
        </motion.div>

        {/* Stat cards */}
        <motion.div
          variants={itemVariants}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px"
          }}
        >
          <StatCard
            label="Total Invoices on Chain"
            value={totalInvoices || 2}
            color="#00F0FF"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            }
          />
          <StatCard
            label="My Uploaded Invoices"
            value={mySupplierInvoices}
            color="#7B2FFF"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            }
          />
          <StatCard
            label="My Factored Invoices"
            value={myInvestorInvoices}
            color="#00FF88"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            }
          />
          <StatCard
            label="Private Data Type"
            value="euint64"
            color="#FF2D6B"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            }
          />
        </motion.div>

        {/* Main Content Grid */}
        <motion.div
          variants={itemVariants}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "24px"
          }}
          className="lg:grid-cols-3"
        >
          {/* Portfolio Donut */}
          <GlassCard className="p-6 lg:col-span-1">
            <div style={{ display: "flex", justifycontent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#EEF2FF", fontFamily: "Satoshi, sans-serif" }}>
                Portfolio Distribution
              </h3>
              <FHEBadge size="sm" />
            </div>
            <PortfolioDonut factored={factored} available={available} repaid={repaid} />
          </GlassCard>

          {/* Recent Invoices list */}
          <GlassCard className="p-6 lg:col-span-2">
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
                    <div>
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
              <a
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
              </a>
            </div>
          </GlassCard>
        </motion.div>

        {/* FHE Tech Architecture Details */}
        <motion.div variants={itemVariants}>
          <GlassCard className="p-6">
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#EEF2FF", fontFamily: "Satoshi, sans-serif", marginBottom: "20px" }}>
              FHE Cryptographic Engine
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              {[
                {
                  label: "Cryptographic Base",
                  value: "TFHE-rs (Zama FHEVM)",
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="1.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  )
                },
                {
                  label: "Encrypted Types",
                  value: "euint64 (64-bit unsigned)",
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7B2FFF" strokeWidth="1.5">
                      <rect x="4" y="4" width="16" height="16" rx="2" />
                      <rect x="9" y="9" width="6" height="6" />
                    </svg>
                  )
                },
                {
                  label: "Proof Access",
                  value: "EIP-712 Decryption",
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00FF88" strokeWidth="1.5">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  )
                },
                {
                  label: "Execution Mode",
                  value: "Self-Relayed Decryption",
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
                    padding: "16px",
                    borderRadius: "16px",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.04)"
                  }}
                >
                  <div>{item.icon}</div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#8B9CC8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#EEF2FF", fontFamily: "Satoshi, sans-serif", marginTop: "2px" }}>
                      {item.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @media (min-width: 1024px) {
          .lg\\:grid-cols-3 {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
          .lg\\:col-span-1 {
            grid-column: span 1 / span 1 !important;
          }
          .lg\\:col-span-2 {
            grid-column: span 2 / span 2 !important;
          }
          .lg\\:col-span-3 {
            grid-column: span 3 / span 3 !important;
          }
        }
      `}</style>
    </AppLayout>
  );
}
