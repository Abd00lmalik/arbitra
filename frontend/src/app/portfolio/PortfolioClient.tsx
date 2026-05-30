/**
 * @file PortfolioClient.tsx
 * @description Refactored Portfolio dashboard featuring clickable card grids, a slide-up detail modal with role tabs, decryption logic, and a role switcher.
 */

"use client";

import React, { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/GlassCard";
import { PortfolioDonut } from "@/components/ui/PortfolioDonut";
import { FHEBadge } from "@/components/ui/FHEBadge";
import { FaucetButton } from "@/components/ui/FaucetButton";
import { NeonButton } from "@/components/ui/NeonButton";
import { EncryptedValue } from "@/components/ui/EncryptedValue";
import {
  useMockInvoiceList,
  useFactorInvoice,
  useTriggerRepayment,
  useInvoiceHandles,
  useIsInvestorApproved,
  useSetOperator,
  useRealInvoiceList
} from "@/hooks/useArbitraRegistry";
import { useInvoiceDecrypt } from "@/hooks/useInvoiceDecrypt";
import { useZama } from "@/providers/ZamaProvider";
import { useRole } from "@/providers/RoleProvider";
import {
  formatCUSDT,
  formatTimestamp,
  formatBps,
  shortAddress,
  ARBITRA_REGISTRY_ADDRESS,
  DEFAULT_OPERATOR_EXPIRY_SECONDS,
  InvoiceOnChain
} from "@/lib/contracts";
import Link from "next/link";

/* Local sub-component for the slide-up invoice details modal */
interface InvoiceDetailsModalProps {
  invoice: InvoiceOnChain | null;
  isOpen: boolean;
  onClose: () => void;
  onFactor: (id: bigint) => Promise<void>;
  onRepay: (id: bigint) => Promise<void>;
  isBusy: boolean;
  currentUserAddress: string;
}

function InvoiceDetailsModal({
  invoice,
  isOpen,
  onClose,
  onFactor,
  onRepay,
  isBusy,
  currentUserAddress
}: InvoiceDetailsModalProps) {
  const [modalTab, setModalTab] = useState<"supplier" | "investor">("supplier");
  const { isReady: zamaReady } = useZama();
  const { data: walletClient } = useWalletClient();

  /* React hooks are called unconditionally, handle null invoice inside the hook calls */
  const invoiceIdQuery = invoice?.invoiceId ?? 0n;
  const { data: handles } = useInvoiceHandles(invoiceIdQuery);
  const { decrypted, isDecrypting, error: decryptError, decrypt } = useInvoiceDecrypt();

  const { data: isApprovedRefetch, refetch: refetchApproval } = useIsInvestorApproved(
    currentUserAddress as `0x${string}` | undefined
  );
  const isApproved = isApprovedRefetch ?? false;
  const { setOperator, isPending: isApproving } = useSetOperator();
  const [localBusy, setLocalBusy] = useState(false);

  if (!invoice) return null;

  const isSupplier = currentUserAddress.toLowerCase() === invoice.supplier.toLowerCase();
  const canDecrypt = isSupplier || (invoice.investor && currentUserAddress.toLowerCase() === invoice.investor.toLowerCase());

  const handleDecrypt = async () => {
    if (!handles || !walletClient) return;

    const signer = {
      getAddress: async () => (await walletClient.getAddresses())[0] as string,
      signTypedData: async (domain: object, types: object, value: object) => {
        return walletClient.signTypedData({
          domain: domain as Parameters<typeof walletClient.signTypedData>[0]["domain"],
          types: types as Parameters<typeof walletClient.signTypedData>[0]["types"],
          primaryType: Object.keys(types as Record<string, unknown>)[0],
          message: value as Parameters<typeof walletClient.signTypedData>[0]["message"],
          account: (await walletClient.getAddresses())[0],
        });
      },
    };

    await decrypt(
      {
        faceValueHandle: handles.faceValueHandle as `0x${string}`,
        dueDateHandle: handles.dueDateHandle as `0x${string}`,
        purchasePriceHandle: handles.purchasePriceHandle as `0x${string}`,
        discountRateHandle: handles.discountRateHandle as `0x${string}`,
      },
      signer
    );
  };

  const handleFactorClick = async () => {
    setLocalBusy(true);
    try {
      if (!isApproved) {
        const expiry = Math.floor(Date.now() / 1000) + DEFAULT_OPERATOR_EXPIRY_SECONDS;
        await setOperator(ARBITRA_REGISTRY_ADDRESS, expiry);
        if (refetchApproval) {
          await refetchApproval();
        }
      }
      await onFactor(invoice.invoiceId);
      onClose();
    } catch (err) {
      console.error("Factoring failed:", err);
    } finally {
      setLocalBusy(false);
    }
  };

  const handleRepayClick = async () => {
    setLocalBusy(true);
    try {
      await onRepay(invoice.invoiceId);
      onClose();
    } catch (err) {
      console.error("Repayment failed:", err);
    } finally {
      setLocalBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(2, 7, 20, 0.7)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)"
            }}
          />

          {/* Slide-Up Panel */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            style={{
              width: "100%",
              maxWidth: "600px",
              position: "relative",
              zIndex: 101
            }}
          >
            <GlassCard className="p-6 rounded-t-[32px] rounded-b-none border-b-0" glow="cyan">
              {/* Drag handle block */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
                <div style={{ width: "40px", height: "4px", borderRadius: "2px", background: "rgba(255, 255, 255, 0.15)" }} />
              </div>

              {/* Title & Badge */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#EEF2FF", fontFamily: "Satoshi, sans-serif" }}>
                    Invoice #{invoice.invoiceId.toString()}
                  </h3>
                  <div style={{ fontSize: "12px", color: "#8B9CC8", marginTop: "2px" }}>
                    Uploaded on {formatTimestamp(invoice.uploadTimestamp)}
                  </div>
                </div>
                <FHEBadge />
              </div>

              {/* Modal Tabs: As Supplier / As Investor */}
              <div
                style={{
                  display: "flex",
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius: "12px",
                  padding: "4px",
                  marginBottom: "20px"
                }}
              >
                <button
                  onClick={() => setModalTab("supplier")}
                  style={{
                    flex: 1,
                    background: modalTab === "supplier" ? "rgba(0, 240, 255, 0.08)" : "transparent",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px",
                    color: modalTab === "supplier" ? "#00F0FF" : "#64748B",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  As Supplier Details
                </button>
                <button
                  onClick={() => setModalTab("investor")}
                  style={{
                    flex: 1,
                    background: modalTab === "investor" ? "rgba(123, 47, 255, 0.08)" : "transparent",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px",
                    color: modalTab === "investor" ? "#A87FFF" : "#64748B",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  As Investor Details
                </button>
              </div>

              {/* Decrypted / Encrypted grid content */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {modalTab === "supplier" ? (
                  /* Supplier Tab View */
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", textAlign: "left" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", padding: "12px", borderRadius: "12px" }}>
                        <div style={{ fontSize: "10px", color: "#8B9CC8", textTransform: "uppercase", fontWeight: 600 }}>Face Value</div>
                        <div style={{ marginTop: "4px" }}>
                          <EncryptedValue
                            isDecrypted={decrypted?.faceValue !== undefined}
                            clearValue={decrypted?.faceValue !== undefined ? formatCUSDT(decrypted.faceValue) : undefined}
                            isDecrypting={isDecrypting}
                            size="sm"
                          />
                        </div>
                      </div>
                      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", padding: "12px", borderRadius: "12px" }}>
                        <div style={{ fontSize: "10px", color: "#8B9CC8", textTransform: "uppercase", fontWeight: 600 }}>Due Date</div>
                        <div style={{ marginTop: "4px" }}>
                          <EncryptedValue
                            isDecrypted={decrypted?.dueDate !== undefined}
                            clearValue={decrypted?.dueDate !== undefined ? formatTimestamp(decrypted.dueDate) : undefined}
                            isDecrypting={isDecrypting}
                            size="sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", padding: "12px", borderRadius: "12px", display: "flex", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: "10px", color: "#8B9CC8", textTransform: "uppercase", fontWeight: 600 }}>Buyer Address</div>
                        <div style={{ fontSize: "12px", color: "#EEF2FF", fontFamily: "JetBrains Mono, monospace", marginTop: "4px" }}>{shortAddress(invoice.buyer)}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "10px", color: "#8B9CC8", textTransform: "uppercase", fontWeight: 600 }}>Supplier</div>
                        <div style={{ fontSize: "12px", color: "#EEF2FF", fontFamily: "JetBrains Mono, monospace", marginTop: "4px" }}>{shortAddress(invoice.supplier)}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Investor Tab View */
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", textAlign: "left" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", padding: "12px", borderRadius: "12px" }}>
                        <div style={{ fontSize: "10px", color: "#8B9CC8", textTransform: "uppercase", fontWeight: 600 }}>Purchase Price</div>
                        <div style={{ marginTop: "4px" }}>
                          <EncryptedValue
                            isDecrypted={decrypted?.purchasePrice !== undefined}
                            clearValue={decrypted?.purchasePrice !== undefined ? formatCUSDT(decrypted.purchasePrice) : undefined}
                            isDecrypting={isDecrypting}
                            size="sm"
                          />
                        </div>
                      </div>
                      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", padding: "12px", borderRadius: "12px" }}>
                        <div style={{ fontSize: "10px", color: "#8B9CC8", textTransform: "uppercase", fontWeight: 600 }}>Discount Yield</div>
                        <div style={{ marginTop: "4px" }}>
                          <EncryptedValue
                            isDecrypted={decrypted?.discountRate !== undefined}
                            clearValue={decrypted?.discountRate !== undefined ? formatBps(decrypted.discountRate) : undefined}
                            isDecrypting={isDecrypting}
                            size="sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", padding: "12px", borderRadius: "12px" }}>
                      <div style={{ fontSize: "10px", color: "#8B9CC8", textTransform: "uppercase", fontWeight: 600 }}>Current Factored Investor</div>
                      <div style={{ fontSize: "12px", color: "#EEF2FF", fontFamily: "JetBrains Mono, monospace", marginTop: "4px" }}>
                        {invoice.isFactored ? shortAddress(invoice.investor) : "No investor (Available for factoring)"}
                      </div>
                    </div>
                  </div>
                )}

                {/* Status description */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "rgba(255, 255, 255, 0.01)", border: "1px solid rgba(255, 255, 255, 0.03)", borderRadius: "12px" }}>
                  <span style={{ fontSize: "12px", color: "#8B9CC8" }}>Factoring Status:</span>
                  {invoice.isRepaid ? (
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#00FF88", textTransform: "uppercase" }}>Repaid</span>
                  ) : invoice.isFactored ? (
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#00F0FF", textTransform: "uppercase" }}>Factored</span>
                  ) : (
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#FFC400", textTransform: "uppercase" }}>Available</span>
                  )}
                </div>

                {/* Encryption / Decryption Triggers */}
                {zamaReady && canDecrypt && !decrypted && (
                  <NeonButton
                    variant="secondary"
                    onClick={handleDecrypt}
                    loading={isDecrypting}
                    className="w-full"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "6px" }}>
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Decrypt Invoice Details (EIP-712)
                  </NeonButton>
                )}

                {decryptError && (
                  <div style={{ fontSize: "11px", color: "#FF2D6B", padding: "8px", background: "rgba(255, 45, 107, 0.05)", border: "1px solid rgba(255, 45, 107, 0.15)", borderRadius: "8px", textAlign: "center" }}>
                    Decryption Error: {decryptError.message || "Request rejected."}
                  </div>
                )}

                {/* Actions: Factor / Repay */}
                <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                  {/* Factor trigger */}
                  {!invoice.isFactored && !isSupplier && (
                    <NeonButton
                      variant="primary"
                      onClick={handleFactorClick}
                      loading={isBusy || isApproving || localBusy}
                      className="flex-1"
                    >
                      {isApproved ? "Factor Invoice" : "Approve & Factor"}
                    </NeonButton>
                  )}

                  {/* Repay trigger */}
                  {invoice.isFactored && !invoice.isRepaid && isSupplier && (
                    <NeonButton
                      variant="ghost"
                      onClick={handleRepayClick}
                      loading={isBusy || localBusy}
                      className="flex-1"
                    >
                      Trigger Repayment
                    </NeonButton>
                  )}
                </div>

                {/* Close Button */}
                <button
                  onClick={onClose}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "12px",
                    padding: "10px",
                    color: "#8B9CC8",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    marginTop: "4px"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#white";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#8B9CC8";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                  }}
                >
                  Close Panel
                </button>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default function PortfolioClient() {
  const { address, isConnected } = useAccount();
  const { role, setRole } = useRole();
  const mockInvoices = useMockInvoiceList();
  const { data: realInvoices, isLoading: isLoadingInvoices } = useRealInvoiceList();

  const { factorInvoice, isPending: isFactoring } = useFactorInvoice();
  const { triggerRepayment, isPending: isRepaying } = useTriggerRepayment();

  const hasRealInvoices = realInvoices && realInvoices.length > 0;
  const allInvoices = hasRealInvoices ? realInvoices : mockInvoices;
  const isDemoMode = !hasRealInvoices;

  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceOnChain | null>(null);

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
      description="Your invoices as supplier and investor"
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Header toolbar with role switch toggle */}
        <motion.div variants={itemVariants} className="flex items-center justify-between flex-wrap gap-4">
          {/* Switch Role Toggle */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/2 border border-white/5 text-xs">
            <button
              onClick={() => setRole("supplier")}
              className={`px-3 py-1.5 rounded-lg transition-all duration-200 ${
                role === "supplier"
                  ? "bg-neon-cyan/10 border border-neon-cyan/35 text-neon-cyan font-bold"
                  : "text-slate-400 border border-transparent hover:text-white"
              }`}
            >
              Role: Supplier
            </button>
            <button
              onClick={() => setRole("investor")}
              className={`px-3 py-1.5 rounded-lg transition-all duration-200 ${
                role === "investor"
                  ? "bg-neon-purple/10 border border-neon-purple/35 text-neon-purple font-bold"
                  : "text-slate-400 border border-transparent hover:text-white"
              }`}
            >
              Role: Investor
            </button>
          </div>

          <div className="flex items-center gap-3">
            <FaucetButton />
          </div>
        </motion.div>

        {/* Demo Mode Banner */}
        {isDemoMode && (
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
                <strong>Demo Mode Active:</strong> No on-chain invoices detected for your wallet on Sepolia. Showing simulated portfolio. Go to the <strong>Upload</strong> page to create a real encrypted invoice.
              </span>
            </div>
          </motion.div>
        )}

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

          {/* Compact clickable grid lists based on role */}
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
              /* Compact clickable grid cards */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {currentDisplayInvoices.map((inv) => (
                  <div
                    key={inv.invoiceId.toString()}
                    onClick={() => setSelectedInvoice(inv)}
                    style={{ cursor: "pointer" }}
                  >
                    <GlassCard
                      className="p-4 flex flex-col gap-3 transition-all duration-200"
                      hover
                      glow={role === "supplier" ? "cyan" : "purple"}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-white font-mono">
                          #{inv.invoiceId.toString()}
                        </span>
                        {inv.isRepaid ? (
                          <span className="badge-green">● Repaid</span>
                        ) : inv.isFactored ? (
                          <span className="badge-blue">● Factored</span>
                        ) : (
                          <span className="badge-yellow">● Available</span>
                        )}
                      </div>

                      <div className="text-xs space-y-1 text-slate-400 text-left">
                        <div className="flex justify-between">
                          <span>Supplier:</span>
                          <span className="font-mono text-slate-300">{shortAddress(inv.supplier)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Buyer:</span>
                          <span className="font-mono text-slate-300">{shortAddress(inv.buyer)}</span>
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: "4px",
                          fontSize: "10px",
                          color: role === "supplier" ? "#00F0FF" : "#A87FFF",
                          fontWeight: 700,
                          textAlign: "right",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          gap: "4px"
                        }}
                      >
                        <span>View Details</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    </GlassCard>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Slide-Up details Modal */}
      <InvoiceDetailsModal
        invoice={selectedInvoice}
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        onFactor={factorInvoice}
        onRepay={triggerRepayment}
        isBusy={isFactoring || isRepaying}
        currentUserAddress={address || ""}
      />
    </AppLayout>
  );
}
