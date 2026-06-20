/*
 * @file MarketplaceClient.tsx
 * @description Browse and factor on-chain invoices on Arbitra, featuring a top stats overview bar,
 *              sleek premium category filter tabs, a polished empty state, and details modal integration.
 */

"use client";

import React, { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/GlassCard";
import { FaucetLinks } from "@/components/shared/FaucetLinks";
import { InvoiceMiniCard } from "@/components/invoice/InvoiceMiniCard";
import { InvoiceDetailModal } from "@/components/shared/InvoiceDetailModal";
import { LockedPage } from "@/components/shared/LockedPage";
import { useRealInvoiceList } from "@/hooks/useArbitraRegistry";
import { useWeb3Auth } from "@/providers/Web3AuthProvider";
import { readSessionWallet } from "@/lib/sessionWallet";
import {
  IDENTITY_ABI,
  IDENTITY_ADDRESS,
  InvoiceStatus,
  SBT_ABI,
  SBT_ADDRESS,
  INVESTOR_SBT_ADDRESS,
  daysUntilDue,
  fromMicro
} from "@/lib/contracts";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Briefcase } from "lucide-react";

type FilterTab = "all" | "available" | "factored" | "repaid";

export default function MarketplaceClient() {
  const { wallet: web3authWallet } = useWeb3Auth();
  const { address, isConnected } = useAccount();
  const searchParams = useSearchParams();
  const newInvoiceId = searchParams.get("new");
  const [sessionWallet, setSessionWallet] = useState<`0x${string}` | null>(null);

  React.useEffect(() => {
    setSessionWallet(readSessionWallet());
  }, [web3authWallet, address, isConnected]);

  const wallet = web3authWallet ?? (isConnected && address ? address : sessionWallet);

  const { data: hasSupplierSBT, isLoading: isLoadingSupplierSBT } = useReadContract({
    address: SBT_ADDRESS as `0x${string}`,
    abi: SBT_ABI,
    functionName: "hasValidSBT",
    args: [wallet ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!wallet },
  });

  const { data: hasInvestorSBT, isLoading: isLoadingInvestorSBT } = useReadContract({
    address: INVESTOR_SBT_ADDRESS as `0x${string}`,
    abi: SBT_ABI,
    functionName: "hasValidSBT",
    args: [wallet ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!wallet },
  });

  const { data: hasEncryptedCompliance, isLoading: isLoadingCompliance } = useReadContract({
    address: IDENTITY_ADDRESS as `0x${string}`,
    abi: IDENTITY_ABI,
    functionName: "hasEncryptedCompliance",
    args: [wallet ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!wallet && hasInvestorSBT === true },
  });
  const isLoadingAccess = isLoadingSupplierSBT || isLoadingInvestorSBT || (hasInvestorSBT === true && isLoadingCompliance);

  const { data: realInvoices, isLoading: isLoadingInvoices, refetch: refetchInvoices } = useRealInvoiceList();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<bigint | undefined>(undefined);
  const invoices = realInvoices ?? [];

  if (wallet && isLoadingAccess) {
    return <LockedPage title="Checking Access" message="Reading your investor credentials from Sepolia." />;
  }

  if (wallet && hasInvestorSBT !== true) {
    if (hasSupplierSBT === true) {
      return (
        <AppLayout title="Marketplace Locked" description="Role authorization required.">
          <div className="flex justify-center items-center min-h-[60vh] py-16 px-6">
            <GlassCard className="p-8 text-center max-w-md mx-auto relative overflow-hidden" glow="purple">
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "2px",
                  background: "linear-gradient(90deg, #7B2FFF 0%, #00F0FF 100%)",
                }}
              />
              <div className="w-14 h-14 rounded-full bg-neon-purple/10 border border-neon-purple/30 flex items-center justify-center text-neon-purple mx-auto mb-4">
                <Briefcase className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2 font-heading" style={{ fontFamily: "Satoshi, sans-serif" }}>
                Verify as Investor
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                You are registered as a <strong className="text-neon-purple font-semibold">Supplier</strong>. To access RWA pools and fund invoices as an Investor, you must complete Investor KYC/accreditation checks.
              </p>
              <Link href="/register?role=investor&upgrade=true" className="w-full block">
                <button className="neon-btn-primary w-full py-3 text-xs font-semibold rounded-xl">
                  Start Investor Onboarding
                </button>
              </Link>
            </GlassCard>
          </div>
        </AppLayout>
      );
    }
    return <LockedPage title="Marketplace Locked" message="Complete business verification to access the marketplace." />;
  }

  if (wallet && hasEncryptedCompliance !== true) {
    return <LockedPage title="Marketplace Locked" message="Encrypted compliance is required before marketplace access." />;
  }

  const filtered = invoices.filter((inv) => {
    const isFactored = inv.status >= InvoiceStatus.Factored;
    const isRepaid = inv.status === InvoiceStatus.Settled;
    if (activeTab === "available") return inv.status === InvoiceStatus.Pending || inv.status === InvoiceStatus.Attested;
    if (activeTab === "factored") return isFactored && !isRepaid;
    if (activeTab === "repaid") return isRepaid;
    return true;
  });

  /*
   * Calculations for the Top Stats Overview Bar
   */
  const totalValueShielded = invoices.reduce((acc, inv) => acc + inv.faceValuePlaintext, 0n);
  const awaitingFundingCount = invoices.filter(
    (i) => i.status === InvoiceStatus.Pending || i.status === InvoiceStatus.Attested
  ).length;

  const activeCount = invoices.filter((i) => i.status !== InvoiceStatus.Settled).length;

  const activeFactored = invoices.filter((i) => i.status >= InvoiceStatus.Factored && i.status !== InvoiceStatus.Settled);
  const avgMaturity = activeFactored.length > 0
    ? Math.round(activeFactored.reduce((acc, inv) => acc + daysUntilDue(inv.maturityTimestamp), 0) / activeFactored.length)
    : 0;

  const TABS: Array<{ id: FilterTab; label: string; count: number }> = [
    { id: "all", label: "All Assets", count: invoices.length },
    {
      id: "available",
      label: "Available",
      count: invoices.filter((i) => i.status === InvoiceStatus.Pending || i.status === InvoiceStatus.Attested).length
    },
    {
      id: "factored",
      label: "Factored",
      count: invoices.filter((i) => i.status >= InvoiceStatus.Factored && i.status !== InvoiceStatus.Settled).length
    },
    {
      id: "repaid",
      label: "Repaid",
      count: invoices.filter((i) => i.status === InvoiceStatus.Settled).length
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <AppLayout
      title="Marketplace"
      description="Browse and purchase confidential real-world invoices protected by Full Homomorphic Encryption."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
        
        {/* Top Overview stats Bar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px"
          }}
        >
          {/* Card 1: Total Value Shielded */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "16px",
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
              position: "relative",
              overflow: "hidden"
            }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "3px", background: "linear-gradient(90deg, #00F0FF, transparent)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Total Value Shielded
              </span>
            </div>
            <span style={{ fontSize: "22px", fontWeight: 800, color: "#00F0FF", fontFamily: "JetBrains Mono, monospace" }}>
              ${fromMicro(totalValueShielded)} <span style={{ fontSize: "11px", color: "#64748B", fontWeight: 500 }}>USDC</span>
            </span>
          </div>

          {/* Card 2: Awaiting Funding */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "16px",
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
              position: "relative",
              overflow: "hidden"
            }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "3px", background: "linear-gradient(90deg, #A87FFF, transparent)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A87FFF" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Awaiting Funding
              </span>
            </div>
            <span style={{ fontSize: "22px", fontWeight: 800, color: "#A87FFF", fontFamily: "JetBrains Mono, monospace" }}>
              {awaitingFundingCount} <span style={{ fontSize: "11px", color: "#64748B", fontWeight: 500 }}>pools</span>
            </span>
          </div>

          {/* Card 3: Active Invoices */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "16px",
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
              position: "relative",
              overflow: "hidden"
            }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "3px", background: "linear-gradient(90deg, #00FF88, transparent)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00FF88" strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Active Invoices
              </span>
            </div>
            <span style={{ fontSize: "22px", fontWeight: 800, color: "#00FF88", fontFamily: "JetBrains Mono, monospace" }}>
              {activeCount} <span style={{ fontSize: "11px", color: "#64748B", fontWeight: 500 }}>listed</span>
            </span>
          </div>

          {/* Card 4: Avg days to Maturity */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "16px",
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
              position: "relative",
              overflow: "hidden"
            }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "3px", background: "linear-gradient(90deg, #FFBA00, transparent)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFBA00" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Avg. Days to Maturity
              </span>
            </div>
            <span style={{ fontSize: "22px", fontWeight: 800, color: "#FFBA00", fontFamily: "JetBrains Mono, monospace" }}>
              {avgMaturity > 0 ? `${avgMaturity}d` : "N/A"}
            </span>
          </div>
        </div>

        {/* Toolbar Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          {/* Filter Categories - Premium Pill Design */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px",
              borderRadius: "16px",
              background: "rgba(255, 255, 255, 0.02)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.06)"
            }}
          >
            {TABS.map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setActiveTab(tab.id)}
                  className="transition-all duration-200 hover:text-white"
                  style={{
                    background: isSelected
                      ? "linear-gradient(135deg, rgba(0, 240, 255, 0.12) 0%, rgba(123, 47, 255, 0.12) 100%)"
                      : "transparent",
                    border: isSelected
                      ? "1px solid rgba(0, 240, 255, 0.35)"
                      : "1px solid transparent",
                    color: isSelected ? "#FFFFFF" : "#8B9CC8",
                    padding: "8px 18px",
                    borderRadius: "12px",
                    fontSize: "13px",
                    fontWeight: 700,
                    fontFamily: "Satoshi, sans-serif",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: isSelected ? "0 0 15px rgba(0, 240, 255, 0.1)" : "none",
                  }}
                >
                  {tab.label}
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "2px 6px",
                      borderRadius: "8px",
                      background: isSelected ? "rgba(0, 240, 255, 0.2)" : "rgba(255, 255, 255, 0.04)",
                      border: isSelected ? "1px solid rgba(0, 240, 255, 0.2)" : "1px solid rgba(255, 255, 255, 0.04)",
                      color: isSelected ? "#00F0FF" : "#8B9CC8",
                      fontWeight: 700,
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <FaucetLinks />
          </div>
        </div>

        {/* Dynamic State Rendering */}
        {isLoadingInvoices ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "300px" }}>
            {/* Custom Neon Loader Spinner */}
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                border: "3px solid rgba(0, 240, 255, 0.1)",
                borderTopColor: "#00F0FF",
                animation: "spin 1s linear infinite",
                marginBottom: "16px"
              }}
            />
            <p style={{ color: "#8B9CC8", fontSize: "14px", fontFamily: "Satoshi, sans-serif" }}>
              Loading on-chain registry data...
            </p>
          </div>
        ) : filtered.length === 0 ? (
          /* Redesigned Premium Empty State */
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.005) 100%)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.04)",
              borderRadius: "24px",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "20px"
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "18px",
                background: "rgba(0, 240, 255, 0.04)",
                border: "1px solid rgba(0, 240, 255, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 20px rgba(0, 240, 255, 0.05)"
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <circle cx="12" cy="14" r="3" stroke="#A87FFF" />
                <path d="M12 11v3" stroke="#A87FFF" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxWidth: "400px" }}>
              <h4 style={{ color: "#EEF2FF", fontSize: "16px", fontWeight: 700, fontFamily: "Satoshi, sans-serif" }}>
                No Invoices Registered
              </h4>
              <p style={{ color: "#8B9CC8", fontSize: "13px", lineHeight: "1.5", fontFamily: "Satoshi, sans-serif" }}>
                There are currently no active real-world invoices listed in this registry category. Tokenize your first invoice to list it here.
              </p>
            </div>
            <div style={{ marginTop: "8px" }}>
              <Link
                href="/upload"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "linear-gradient(135deg, #00F0FF, #7B2FFF)",
                  color: "#FFFFFF",
                  padding: "10px 22px",
                  borderRadius: "12px",
                  fontSize: "13px",
                  fontWeight: 700,
                  textDecoration: "none",
                  boxShadow: "0 0 20px rgba(0, 240, 255, 0.25)",
                  fontFamily: "Satoshi, sans-serif",
                  transition: "all 0.2s"
                }}
                className="hover:scale-105 transition-transform"
              >
                <span>Tokenize Invoice</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </Link>
            </div>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "24px"
            }}
          >
            {filtered.map((inv) => (
              <motion.div
                key={inv.invoiceId.toString()}
                variants={itemVariants}
              >
                <InvoiceMiniCard
                  invoice={inv}
                  isNew={newInvoiceId === inv.invoiceId.toString()}
                  onClick={() => setSelectedInvoiceId(inv.invoiceId)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Slide-Up details Modal */}
      <InvoiceDetailModal
        invoiceId={selectedInvoiceId}
        isOpen={selectedInvoiceId !== undefined}
        onClose={() => setSelectedInvoiceId(undefined)}
        onActionSuccess={() => {
          if (refetchInvoices) refetchInvoices();
        }}
      />
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </AppLayout>
  );
}
