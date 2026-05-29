"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
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

  const { factorInvoice, isPending: isFactoring } = useFactorInvoice();
  const { triggerRepayment, isPending: isRepaying } = useTriggerRepayment();

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
    { id: "all", label: "All", count: mockInvoices.length },
    {
      id: "available",
      label: "Available",
      count: mockInvoices.filter((i) => !i.isFactored).length,
    },
    {
      id: "factored",
      label: "Factored",
      count: mockInvoices.filter((i) => i.isFactored && !i.isRepaid).length,
    },
    {
      id: "repaid",
      label: "Repaid",
      count: mockInvoices.filter((i) => i.isRepaid).length,
    },
  ];

  return (
    <AppLayout
      title="Marketplace"
      description="Browse and factor confidential invoices on Arbitra"
    >
      <div className="flex gap-6">
        {/* Main column */}
        <div className="flex-1 min-w-0">
          {/* Tabs */}
          <div
            className="flex items-center gap-1 p-1 rounded-xl mb-6 w-fit"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            role="tablist"
            aria-label="Invoice filter"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${
                    activeTab === tab.id
                      ? "text-white"
                      : "text-slate-500 hover:text-slate-300"
                  }
                `}
                style={
                  activeTab === tab.id
                    ? {
                        background: "rgba(0,240,255,0.1)",
                        border: "1px solid rgba(0,240,255,0.2)",
                        color: "#00F0FF",
                      }
                    : {}
                }
              >
                {tab.label}
                <span
                  className="ml-2 text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.1)" }}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Invoice grid */}
          {filtered.length === 0 ? (
            <GlassCard className="p-12 text-center">
              <div className="text-4xl mb-3" aria-hidden="true">📭</div>
              <div className="text-slate-400 text-sm">No invoices in this category yet.</div>
              <div className="mt-4">
                <a href="/upload" className="text-neon-cyan text-sm hover:underline">
                  Upload the first invoice →
                </a>
              </div>
            </GlassCard>
          ) : (
            <div
              className="grid grid-cols-1 xl:grid-cols-2 gap-4"
              role="list"
              aria-label="Invoice list"
            >
              {filtered.map((inv) => (
                <div key={inv.invoiceId.toString()} role="listitem">
                  <div onClick={() => setSelectedInvoice(inv)} className="cursor-pointer">
                    <InvoiceCard
                      invoice={inv}
                      onFactor={handleFactor}
                      onRepay={handleRepay}
                      isBusy={busyId === inv.invoiceId}
                      currentUserAddress={address}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar — risk panel for selected invoice */}
        {selectedInvoice && (
          <aside className="w-80 flex-shrink-0 space-y-4" aria-label="Risk assessment sidebar">
            <GlassCard className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-white">
                  Invoice #{selectedInvoice.invoiceId.toString()}
                </span>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="text-slate-500 hover:text-white text-xs"
                  aria-label="Close sidebar"
                >
                  ✕
                </button>
              </div>
              <div className="text-xs text-slate-500">
                Click &ldquo;Analyze Risk&rdquo; below to get an AI assessment.
              </div>
            </GlassCard>

            <RiskAssessmentPanel invoice={selectedInvoice} />
          </aside>
        )}
      </div>
    </AppLayout>
  );
}
