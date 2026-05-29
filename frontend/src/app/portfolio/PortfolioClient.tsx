"use client";

import { useAccount } from "wagmi";
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

  if (!isConnected) {
    return (
      <AppLayout title="Portfolio" description="Your personal invoice activity">
        <GlassCard className="p-12 text-center max-w-md mx-auto">
          <div className="text-4xl mb-4" aria-hidden="true">🔌</div>
          <h2 className="text-lg font-bold text-white mb-2">Connect Your Wallet</h2>
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-400">Activity Overview</h2>
        <FaucetButton />
      </div>

      {/* Header stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-neon-cyan">{mySupplierInvoices.length}</div>
          <div className="text-xs text-slate-500 mt-1">As Supplier</div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-neon-purple">{myInvestorInvoices.length}</div>
          <div className="text-xs text-slate-500 mt-1">As Investor</div>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-neon-green">{repaid}</div>
          <div className="text-xs text-slate-500 mt-1">Repaid</div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Portfolio donut */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Distribution</h2>
            <FHEBadge size="sm" />
          </div>
          <PortfolioDonut factored={factored} available={available} repaid={repaid} />
        </GlassCard>

        {/* Supplier invoices */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold text-white">Your Uploaded Invoices</h2>
          {mySupplierInvoices.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <div className="text-3xl mb-2" aria-hidden="true">📤</div>
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

          <h2 className="text-sm font-semibold text-white mt-6">Your Factored Investments</h2>
          {myInvestorInvoices.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <div className="text-3xl mb-2" aria-hidden="true">💼</div>
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
    </AppLayout>
  );
}
