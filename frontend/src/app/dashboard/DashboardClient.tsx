"use client";

import { useAccount } from "wagmi";
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
  icon: string;
  color?: "cyan" | "purple" | "green" | "pink";
}

function StatCard({ label, value, delta, icon, color = "cyan" }: StatCardProps) {
  const colorStyle = {
    cyan: "#00F0FF",
    purple: "#7B2FFF",
    green: "#00FF88",
    pink: "#FF2D9B",
  }[color];

  return (
    <GlassCard className="p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl" aria-hidden="true">{icon}</span>
        {delta && (
          <span className="badge-green text-[10px]" role="status">{delta}</span>
        )}
      </div>
      <div className="text-2xl font-bold text-white mb-1" style={{ color: colorStyle }}>
        {value}
      </div>
      <div className="text-xs text-slate-500">{label}</div>
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

  /* Compute donut distribution from mock for demo */
  const factored = mockInvoices.filter((i) => i.isFactored && !i.isRepaid).length;
  const available = mockInvoices.filter((i) => !i.isFactored).length;
  const repaid = mockInvoices.filter((i) => i.isRepaid).length;

  return (
    <AppLayout
      title="Dashboard"
      description="Your encrypted invoice portfolio at a glance"
    >
      {/* Connection warning */}
      {!isConnected && (
        <div
          className="mb-6 p-4 rounded-xl text-sm"
          style={{
            background: "rgba(123,47,255,0.1)",
            border: "1px solid rgba(123,47,255,0.2)",
            color: "#7B2FFF",
          }}
          role="alert"
        >
          Connect your wallet to view your personalized dashboard.
        </div>
      )}

      {/* FHE status bar */}
      <div
        className="mb-6 flex flex-wrap items-center gap-3 p-3 rounded-xl"
        style={{ background: "rgba(0,240,255,0.04)", border: "1px solid rgba(0,240,255,0.08)" }}
        role="status"
        aria-label={`FHE status: ${zamaReady ? "active" : "initializing"}`}
      >
        <div
          className={`w-2 h-2 rounded-full ${zamaReady ? "bg-neon-green animate-pulse" : "bg-amber-400 animate-pulse"}`}
          aria-hidden="true"
        />
        <span className="text-xs text-slate-400 mr-2">
          Zama FHEVM: <span className={zamaReady ? "text-neon-green" : "text-amber-400"}>
            {zamaReady ? "Active — All invoice data encrypted with FHE" : "Initializing SDK..."}
          </span>
        </span>
        <FaucetButton />
        <div className="ml-auto">
          <FHEBadge />
        </div>
      </div>

      {/* Stat cards */}
      <section aria-label="Statistics" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon="📄"
          label="Total Invoices on Chain"
          value={totalInvoices || "—"}
          color="cyan"
        />
        <StatCard
          icon="📤"
          label="My Uploaded Invoices"
          value={mySupplierInvoices}
          color="purple"
        />
        <StatCard
          icon="💼"
          label="My Factored Invoices"
          value={myInvestorInvoices}
          color="green"
        />
        <StatCard
          icon="🔒"
          label="Encryption Level"
          value="euint64"
          color="pink"
        />
      </section>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Portfolio donut */}
        <GlassCard className="p-5 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Portfolio Distribution</h2>
            <FHEBadge size="sm" />
          </div>
          <PortfolioDonut factored={factored} available={available} repaid={repaid} />
        </GlassCard>

        {/* Recent invoices */}
        <GlassCard className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-white mb-4">Recent Invoices (Demo Data)</h2>
          <div className="space-y-3">
            {mockInvoices.map((inv) => (
              <div
                key={inv.invoiceId.toString()}
                className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                    style={{ background: "rgba(0,240,255,0.1)" }}
                    aria-hidden="true"
                  >
                    #{inv.invoiceId.toString()}
                  </div>
                  <div>
                    <div className="text-sm text-white font-medium">
                      Invoice #{inv.invoiceId.toString()}
                    </div>
                    <div className="text-xs text-slate-500">
                      Supplier: {inv.supplier.slice(0, 8)}...
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <FHEBadge size="sm" label="Encrypted" animated={false} />
                  {inv.isRepaid ? (
                    <span className="badge-green">Repaid</span>
                  ) : inv.isFactored ? (
                    <span className="badge-blue">Factored</span>
                  ) : (
                    <span className="badge-yellow">Available</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <a href="/marketplace" className="text-xs text-neon-cyan hover:text-neon-cyan/80 transition-colors">
              View all invoices in Marketplace →
            </a>
          </div>
        </GlassCard>

        {/* FHE tech details */}
        <GlassCard className="p-5 lg:col-span-3">
          <h2 className="text-sm font-semibold text-white mb-4">FHE Architecture</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "Encryption Type",
                value: "Zama FHEVM v0.11",
                icon: "🔐",
              },
              {
                label: "Data Types",
                value: "euint64 (64-bit)",
                icon: "💻",
              },
              {
                label: "Decryption Method",
                value: "EIP-712 UserDecrypt",
                icon: "✍️",
              },
              {
                label: "Network",
                value: "Ethereum Sepolia",
                icon: "⛓️",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="p-3 rounded-xl flex items-start gap-3"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <span className="text-xl" aria-hidden="true">{item.icon}</span>
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">{item.label}</div>
                  <div className="text-sm text-white font-medium">{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </AppLayout>
  );
}
