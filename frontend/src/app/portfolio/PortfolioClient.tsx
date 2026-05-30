/**
 * @file PortfolioClient.tsx
 * @description User portfolio dashboard listing uploaded invoices, factored investments, and dynamic visual breakdowns.
 */

"use client";

import React from "react";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { InvoiceCard } from "@/components/invoice/InvoiceCard";
import { GlassCard } from "@/components/ui/GlassCard";
import { PortfolioDonut } from "@/components/ui/PortfolioDonut";
import { FHEBadge } from "@/components/ui/FHEBadge";
import { FaucetButton } from "@/components/ui/FaucetButton";
import {
  useMockInvoiceList,
  useFactorInvoice,
  useTriggerRepayment,
} from "@/hooks/useArbitraRegistry";
import Link from "next/link";

export default function PortfolioClient() {
  const { address, isConnected } = useAccount();
  const allInvoices = useMockInvoiceList();

  const { factorInvoice, isPending: isFactoring } = useFactorInvoice();
  const { triggerRepayment, isPending: isRepaying } = useTriggerRepayment();

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
    (i) => i.isFactored && !i.isRepaid
  ).length;
  const available = mySupplierInvoices.filter((i) => !i.isFactored).length;
  const repaid = mySupplierInvoices.filter((i) => i.isRepaid).length;

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
      description="Your invoices as supplier and investor"
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-400" style={{ fontFamily: "Satoshi, sans-serif" }}>Activity Overview</h2>
          <FaucetButton />
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

        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Portfolio donut card */}
          <GlassCard className="p-5 h-fit">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white" style={{ fontFamily: "Satoshi, sans-serif" }}>Distribution</h2>
              <FHEBadge size="sm" />
            </div>
            <PortfolioDonut factored={factored} available={available} repaid={repaid} />
          </GlassCard>

          {/* Supplier & Investor lists */}
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-white" style={{ fontFamily: "Satoshi, sans-serif" }}>Your Uploaded Invoices</h2>
              {mySupplierInvoices.length === 0 ? (
                <GlassCard className="p-8 text-center">
                  <div className="flex justify-center text-slate-600 mb-2" aria-hidden="true">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div className="text-slate-400 text-sm mb-3">No invoices uploaded yet.</div>
                  <Link href="/upload">
                    <button className="neon-btn-secondary text-xs px-4 py-2 rounded-lg">
                      Upload your first invoice
                    </button>
                  </Link>
                </GlassCard>
              ) : (
                <div className="space-y-4">
                  {mySupplierInvoices.map((inv) => (
                    <InvoiceCard
                      key={inv.invoiceId.toString()}
                      invoice={inv}
                      onFactor={factorInvoice}
                      onRepay={triggerRepayment}
                      isBusy={isFactoring || isRepaying}
                      currentUserAddress={address}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-white" style={{ fontFamily: "Satoshi, sans-serif" }}>Your Factored Investments</h2>
              {myInvestorInvoices.length === 0 ? (
                <GlassCard className="p-8 text-center">
                  <div className="flex justify-center text-slate-600 mb-2" aria-hidden="true">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                  </div>
                  <div className="text-slate-400 text-sm mb-3">No investments yet.</div>
                  <Link href="/marketplace">
                    <button className="neon-btn-secondary text-xs px-4 py-2 rounded-lg">
                      Browse marketplace
                    </button>
                  </Link>
                </GlassCard>
              ) : (
                <div className="space-y-4">
                  {myInvestorInvoices.map((inv) => (
                    <InvoiceCard
                      key={inv.invoiceId.toString()}
                      invoice={inv}
                      isBusy={false}
                      currentUserAddress={address}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}
