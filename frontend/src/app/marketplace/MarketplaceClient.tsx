/*
 * @file MarketplaceClient.tsx
 * @description Browse and factor on-chain invoices on Arbitra, featuring clean tab filters,
 *              a loading state, and integration with the shared details modal.
 */

"use client";

import React, { useState } from "react";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/GlassCard";
import { FaucetLinks } from "@/components/shared/FaucetLinks";
import { InvoiceMiniCard } from "@/components/invoice/InvoiceMiniCard";
import { InvoiceDetailModal } from "@/components/shared/InvoiceDetailModal";
import {
  useMockInvoiceList,
  useRealInvoiceList
} from "@/hooks/useArbitraRegistry";
import { useRole } from "@/providers/RoleProvider";
import { InvoiceStatus, type InvoiceOnChain } from "@/lib/contracts";
import Link from "next/link";

type FilterTab = "all" | "available" | "factored" | "repaid";

export default function MarketplaceClient() {
  const { isConnected } = useAccount();
  const { role } = useRole();
  const mockInvoices = useMockInvoiceList();
  const { data: realInvoices, isLoading: isLoadingInvoices, refetch: refetchInvoices } = useRealInvoiceList();

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<bigint | undefined>(undefined);

  const hasRealInvoices = realInvoices && realInvoices.length > 0;
  const invoices = hasRealInvoices ? realInvoices : mockInvoices;
  const isDemoMode = !hasRealInvoices;

  const filtered = invoices.filter((inv) => {
    const isFactored = inv.status >= InvoiceStatus.Factored;
    const isRepaid = inv.status === InvoiceStatus.Settled;
    if (activeTab === "available") return inv.status === InvoiceStatus.Attested;
    if (activeTab === "factored") return isFactored && !isRepaid;
    if (activeTab === "repaid") return isRepaid;
    return true;
  });

  const TABS: Array<{ id: FilterTab; label: string; count: number }> = [
    { id: "all", label: "All Assets", count: invoices.length },
    {
      id: "available",
      label: "Available",
      count: invoices.filter((i) => i.status === InvoiceStatus.Attested).length
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
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        /* Toolbar Header */
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          /* Filter Categories */
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px",
              borderRadius: "14px",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.05)"
            }}
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: activeTab === tab.id ? "rgba(0, 240, 255, 0.08)" : "transparent",
                  border: activeTab === tab.id ? "1px solid rgba(0, 240, 255, 0.22)" : "1px solid transparent",
                  color: activeTab === tab.id ? "#00F0FF" : "#8B9CC8",
                  padding: "8px 16px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: 600,
                  fontFamily: "Satoshi, sans-serif",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.2s"
                }}
              >
                {tab.label}
                <span
                  style={{
                    fontSize: "11px",
                    padding: "2px 6px",
                    borderRadius: "100px",
                    background: activeTab === tab.id ? "rgba(0, 240, 255, 0.15)" : "rgba(255, 255, 255, 0.05)",
                    color: activeTab === tab.id ? "#00F0FF" : "#8B9CC8"
                  }}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-navy-800 border border-white/5 text-xs text-slate-400 font-semibold">
              Active Mode: <span className="text-white ml-1 font-bold capitalize">{role}</span>
            </div>
            <FaucetLinks />
          </div>
        </div>

        /* Demo Mode Banner */
        {isDemoMode && !isLoadingInvoices && (
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
              gap: "10px",
              textAlign: "left"
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="2" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>
              <strong>Demo Mode Active:</strong> Showing simulated invoice assets on Sepolia testnet. Connect your wallet and verify operator approvals to test the factoring workflow.
            </span>
          </div>
        )}

        /* Dynamic State Rendering */
        {isLoadingInvoices ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "260px" }}>
            /* Custom Neon Loader Spinner */
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
          <GlassCard className="p-12 text-center">
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3D4E7A" strokeWidth="1.5">
                <path d="M22 12h-6l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <div style={{ color: "#8B9CC8", fontSize: "14px", fontFamily: "Satoshi, sans-serif" }}>
              No invoices matched this registry category.
            </div>
            <div style={{ marginTop: "16px" }}>
              <Link
                href="/upload"
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#00F0FF",
                  textDecoration: "none",
                  fontFamily: "Satoshi, sans-serif"
                }}
              >
                Tokenize the first invoice &rarr;
              </Link>
            </div>
          </GlassCard>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "20px"
            }}
          >
            {filtered.map((inv) => (
              <motion.div
                key={inv.invoiceId.toString()}
                variants={itemVariants}
              >
                <InvoiceMiniCard
                  invoice={inv}
                  onClick={() => setSelectedInvoiceId(inv.invoiceId)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      /* Slide-Up details Modal */
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
