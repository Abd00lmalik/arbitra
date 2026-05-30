/**
 * @file MarketplaceClient.tsx
 * @description Browse and factor confidential invoices on Arbitra, featuring Gemini AI risk sidebars.
 */

"use client";

import React, { useState } from "react";
import { useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { InvoiceCard } from "@/components/invoice/InvoiceCard";
import { RiskAssessmentPanel } from "@/components/invoice/RiskAssessmentPanel";
import { GlassCard } from "@/components/ui/GlassCard";
import { useMockInvoiceList, useFactorInvoice, useTriggerRepayment } from "@/hooks/useArbitraRegistry";
import type { InvoiceOnChain } from "@/lib/contracts";

type FilterTab = "all" | "available" | "factored" | "repaid";

export default function MarketplaceClient() {
  const { address } = useAccount();
  const mockInvoices = useMockInvoiceList();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceOnChain | null>(null);
  const [busyId, setBusyId] = useState<bigint | null>(null);

  const { factorInvoice } = useFactorInvoice();
  const { triggerRepayment } = useTriggerRepayment();

  const filtered = mockInvoices.filter((inv) => {
    if (activeTab === "available") return !inv.isFactored;
    if (activeTab === "factored") return inv.isFactored && !inv.isRepaid;
    if (activeTab === "repaid") return inv.isRepaid;
    return true;
  });

  const handleFactor = async (invoiceId: bigint) => {
    setBusyId(invoiceId);
    try {
      await factorInvoice(invoiceId);
    } catch (err) {
      console.error("Factor failed:", err);
    } finally {
      setBusyId(null);
    }
  };

  const handleRepay = async (invoiceId: bigint) => {
    setBusyId(invoiceId);
    try {
      await triggerRepayment(invoiceId);
    } catch (err) {
      console.error("Repay failed:", err);
    } finally {
      setBusyId(null);
    }
  };

  const TABS: Array<{ id: FilterTab; label: string; count: number }> = [
    { id: "all", label: "All Assets", count: mockInvoices.length },
    {
      id: "available",
      label: "Available",
      count: mockInvoices.filter((i) => !i.isFactored).length
    },
    {
      id: "factored",
      label: "Factored",
      count: mockInvoices.filter((i) => i.isFactored && !i.isRepaid).length
    },
    {
      id: "repaid",
      label: "Repaid",
      count: mockInvoices.filter((i) => i.isRepaid).length
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
      description="Browse and purchase confidential real-world invoices using Fully Homomorphic Encryption."
    >
      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", position: "relative" }}>
        {/* Main column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Tabs header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px",
              borderRadius: "14px",
              marginBottom: "24px",
              width: "fit-content",
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

          {/* Invoice grid */}
          {filtered.length === 0 ? (
            <GlassCard className="p-12 text-center">
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3D4E7A" strokeWidth="1.5">
                  <path d="M22 12h-6l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <div style={{ color: "#8B9CC8", fontSize: "14px", fontFamily: "Satoshi, sans-serif" }}>
                No invoices in this registry category yet.
              </div>
              <div style={{ marginTop: "16px" }}>
                <a
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
                </a>
              </div>
            </GlassCard>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "20px"
              }}
            >
              {filtered.map((inv) => (
                <motion.div
                  key={inv.invoiceId.toString()}
                  variants={itemVariants}
                  onClick={() => setSelectedInvoice(inv)}
                  style={{
                    cursor: "pointer",
                    outline: selectedInvoice?.invoiceId === inv.invoiceId ? "1px solid rgba(0, 240, 255, 0.3)" : "none",
                    borderRadius: "24px"
                  }}
                >
                  <InvoiceCard
                    invoice={inv}
                    onFactor={handleFactor}
                    onRepay={handleRepay}
                    isBusy={busyId === inv.invoiceId}
                    currentUserAddress={address}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Sidebar for Risk Assessment */}
        <AnimatePresence>
          {selectedInvoice && (
            <motion.aside
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              style={{
                width: "320px",
                flexShrink: 0,
                position: "sticky",
                top: "80px",
                display: "flex",
                flexDirection: "column",
                gap: "16px"
              }}
            >
              <GlassCard className="p-4" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#EEF2FF", fontFamily: "Satoshi, sans-serif" }}>
                  Selected: Invoice #{selectedInvoice.invoiceId.toString()}
                </span>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#8B9CC8",
                    cursor: "pointer",
                    fontSize: "12px",
                    padding: "4px"
                  }}
                  aria-label="Close sidebar"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </GlassCard>

              <RiskAssessmentPanel invoice={selectedInvoice} />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
