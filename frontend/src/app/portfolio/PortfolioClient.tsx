/*
 * @file PortfolioClient.tsx
 * @description User portfolio dashboard displaying on-chain invoices owned or funded by the connected address,
 *              supporting compact card lists, role tabs, and integrated details modal.
 */

"use client";

import React, { useState } from "react";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/GlassCard";
import { PortfolioDonut } from "@/components/ui/PortfolioDonut";
import { FHEBadge } from "@/components/ui/FHEBadge";
import { RoleToggle } from "@/components/shared/RoleToggle";
import { FaucetLinks } from "@/components/shared/FaucetLinks";
import { InvoiceMiniCard } from "@/components/invoice/InvoiceMiniCard";
import { InvoiceDetailModal } from "@/components/shared/InvoiceDetailModal";
import {
  useRealInvoiceList
} from "@/hooks/useArbitraRegistry";
import { useRole } from "@/providers/RoleProvider";
import { InvoiceStatus } from "@/lib/contracts";
import Link from "next/link";

export default function PortfolioClient() {
  const { address, isConnected } = useAccount();
  const { role } = useRole();
  const { data: realInvoices, isLoading: isLoadingInvoices, refetch: refetchInvoices } = useRealInvoiceList();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<bigint | undefined>(undefined);
  const allInvoices = realInvoices ?? [];

  /* Filter invoices for the connected user */
  const mySupplierInvoices = allInvoices.filter(
    (inv) => inv.supplier?.toLowerCase() === address?.toLowerCase()
  );
  const myInvestorInvoices = allInvoices.filter(
    (inv) =>
      inv.investor?.toLowerCase() === address?.toLowerCase() &&
      inv.investor !== "0x0000000000000000000000000000000000000000"
  );

  const factored = [...mySupplierInvoices, ...myInvestorInvoices].filter(
    (i) => i.status >= InvoiceStatus.Factored && i.status !== InvoiceStatus.Settled
  ).length;
  const available = mySupplierInvoices.filter((i) => i.status < InvoiceStatus.Factored).length;
  const repaid = mySupplierInvoices.filter((i) => i.status === InvoiceStatus.Settled).length;

  const currentDisplayInvoices = role === "supplier" ? mySupplierInvoices : myInvestorInvoices;

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

  if (!isConnected) {
    return (
      <AppLayout title="Portfolio" description="Your personal invoice activity">
        <GlassCard className="p-12 text-center max-w-md mx-auto">
          <div className="flex justify-center text-neon-purple mb-4" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="18" y1="8" x2="23" y2="13" />
              <line x1="23" y1="8" x2="18" y2="13" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white mb-2" style={{ fontFamily: "Satoshi, sans-serif" }}>Connect Your Wallet</h2>
          <p className="text-sm text-slate-400 mb-6">
            Connect your wallet to see your invoices as supplier or investor.
          </p>
          <Link href="/">
            <button className="neon-btn-primary px-6 py-2.5 text-sm rounded-xl">
              Connect Wallet
            </button>
          </Link>
        </GlassCard>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Portfolio"
      description="Track and decrypt invoices you created or funded confidentiality."
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Header toolbar with role switcher */}
        <motion.div variants={itemVariants} className="flex items-center justify-between flex-wrap gap-4 bg-navy-950/40 p-4 border border-white/5 rounded-2xl">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Switch Mode:</span>
            <RoleToggle />
          </div>

          <div className="flex items-center gap-3">
            <FaucetLinks />
          </div>
        </motion.div>



        {/* Header stats grid */}
        <motion.div variants={itemVariants} className="grid grid-cols-3 gap-4">
          <GlassCard className="p-4 text-center" hover glow="cyan">
            <div className="text-2xl font-bold text-neon-cyan font-mono">{mySupplierInvoices.length}</div>
            <div className="text-xs text-slate-500 mt-1">As Supplier</div>
          </GlassCard>
          <GlassCard className="p-4 text-center" hover glow="purple">
            <div className="text-2xl font-bold text-neon-purple font-mono">{myInvestorInvoices.length}</div>
            <div className="text-xs text-slate-500 mt-1">As Investor</div>
          </GlassCard>
          <GlassCard className="p-4 text-center" hover glow="cyan">
            <div className="text-2xl font-bold text-neon-green font-mono">{repaid}</div>
            <div className="text-xs text-slate-500 mt-1">Repaid</div>
          </GlassCard>
        </motion.div>

        {/* Distribution & List Content */}
        {isLoadingInvoices ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "260px" }}>
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
              Loading on-chain portfolio details...
            </p>
          </div>
        ) : (
          <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Portfolio donut card */}
            <GlassCard className="p-5 h-fit">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white" style={{ fontFamily: "Satoshi, sans-serif" }}>Distribution</h2>
                <FHEBadge size="sm" />
              </div>
              <PortfolioDonut factored={factored} available={available} repaid={repaid} />
            </GlassCard>

            {/* Compact grid lists */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-sm font-semibold text-white" style={{ fontFamily: "Satoshi, sans-serif" }}>
                {role === "supplier" ? "Your Uploaded Invoices" : "Your Factored Investments"} ({currentDisplayInvoices.length})
              </h2>

              {currentDisplayInvoices.length === 0 ? (
                <GlassCard className="p-12 text-center">
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div className="text-slate-400 text-sm mb-4">
                    {role === "supplier" ? "No invoices uploaded yet." : "No factored investments yet."}
                  </div>
                  {role === "supplier" ? (
                    <Link href="/upload">
                      <button className="neon-btn-secondary text-xs px-4 py-2 rounded-lg">
                        Upload your first invoice
                      </button>
                    </Link>
                  ) : (
                    <Link href="/marketplace">
                      <button className="neon-btn-secondary text-xs px-4 py-2 rounded-lg">
                        Browse marketplace
                      </button>
                    </Link>
                  )}
                </GlassCard>
              ) : (
                /* Compact clickable cards list */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {currentDisplayInvoices.map((inv) => (
                    <InvoiceMiniCard
                      key={inv.invoiceId.toString()}
                      invoice={inv}
                      onClick={() => setSelectedInvoiceId(inv.invoiceId)}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>

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
