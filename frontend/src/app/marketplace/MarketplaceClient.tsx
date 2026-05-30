/**
 * @file MarketplaceClient.tsx
 * @description Browse and factor confidential invoices on Arbitra, featuring integrated slide-up details modal with Gemini AI risk assessment and FHE decryption.
 */

"use client";

import React, { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { FHEBadge } from "@/components/ui/FHEBadge";
import { FaucetButton } from "@/components/ui/FaucetButton";
import { EncryptedValue } from "@/components/ui/EncryptedValue";
import { RiskAssessmentPanel } from "@/components/invoice/RiskAssessmentPanel";
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

type FilterTab = "all" | "available" | "factored" | "repaid";

/* Slide-Up details Modal for Marketplace Invoices */
interface MarketplaceDetailsModalProps {
  invoice: InvoiceOnChain | null;
  isOpen: boolean;
  onClose: () => void;
  onFactor: (id: bigint) => Promise<void>;
  isBusy: boolean;
  currentUserAddress: string;
}

function MarketplaceDetailsModal({
  invoice,
  isOpen,
  onClose,
  onFactor,
  isBusy,
  currentUserAddress
}: MarketplaceDetailsModalProps) {
  const { isReady: zamaReady } = useZama();
  const { data: walletClient } = useWalletClient();

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
  const isInvestor = invoice.isFactored && invoice.investor && currentUserAddress.toLowerCase() === invoice.investor.toLowerCase();
  const canDecrypt = isSupplier || isInvestor;

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

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(2, 7, 20, 0.75)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)"
            }}
          />

          {/* Details Modal container */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            style={{
              width: "100%",
              maxWidth: "600px",
              position: "relative",
              zIndex: 101,
              maxHeight: "85vh",
              overflowY: "auto"
            }}
            className="hide-scrollbar"
          >
            <GlassCard className="p-6 rounded-t-[32px] rounded-b-none border-b-0" glow="cyan">
              {/* Drag bar indicator */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
                <div style={{ width: "40px", height: "4px", borderRadius: "2px", background: "rgba(255, 255, 255, 0.15)" }} />
              </div>

              {/* Title Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                <div>
                  <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#EEF2FF", fontFamily: "Satoshi, sans-serif" }}>
                    Invoice #{invoice.invoiceId.toString()} Details
                  </h3>
                  <div style={{ fontSize: "12px", color: "#8B9CC8", marginTop: "2px" }}>
                    Tokenized on {formatTimestamp(invoice.uploadTimestamp)}
                  </div>
                </div>
                <FHEBadge />
              </div>

              {/* Details and Risk Grid */}
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Contract Addresses */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", padding: "12px", borderRadius: "12px", display: "flex", justifyContent: "space-between", textAlign: "left" }}>
                  <div>
                    <div style={{ fontSize: "10px", color: "#8B9CC8", textTransform: "uppercase", fontWeight: 600 }}>Supplier Address</div>
                    <div style={{ fontSize: "12px", color: "#EEF2FF", fontFamily: "JetBrains Mono, monospace", marginTop: "4px" }}>{shortAddress(invoice.supplier)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "10px", color: "#8B9CC8", textTransform: "uppercase", fontWeight: 600 }}>Buyer Address</div>
                    <div style={{ fontSize: "12px", color: "#EEF2FF", fontFamily: "JetBrains Mono, monospace", marginTop: "4px" }}>{shortAddress(invoice.buyer)}</div>
                  </div>
                </div>

                {/* Encrypted / Shielded Fields */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", textAlign: "left" }}>
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
                    <div style={{ fontSize: "10px", color: "#8B9CC8", textTransform: "uppercase", fontWeight: 600 }}>Discount Rate</div>
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

                {/* Decryption block for authorized accounts */}
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
                    {decryptError}
                  </div>
                )}

                {/* Gemini Risk Assessment integrated */}
                <RiskAssessmentPanel
                  invoice={invoice}
                  decryptedValues={decrypted ? {
                    faceValue: decrypted.faceValue,
                    dueDate: decrypted.dueDate,
                    discountRate: decrypted.discountRate
                  } : undefined}
                />

                {/* Factoring Action block */}
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "16px", marginTop: "4px" }}>
                  {!invoice.isFactored && !isSupplier ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "#8B9CC8", marginBottom: "4px" }}>
                        <span>Operator Approval (cUSDT):</span>
                        <span style={{ color: isApproved ? "#00FF88" : "#FFC400", fontWeight: 700 }}>
                          {isApproved ? "Approved" : "Requires Authorization"}
                        </span>
                      </div>
                      <NeonButton
                        variant="primary"
                        onClick={handleFactorClick}
                        loading={isBusy || isApproving || localBusy}
                        className="w-full"
                      >
                        {isApproved ? "Factor Invoice Now" : "Approve & Factor"}
                      </NeonButton>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.04)", borderRadius: "12px" }}>
                      <span style={{ fontSize: "12px", color: "#8B9CC8" }}>Factoring Status:</span>
                      {invoice.isRepaid ? (
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#00FF88", textTransform: "uppercase" }}>Repaid</span>
                      ) : invoice.isFactored ? (
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#00F0FF", textTransform: "uppercase" }}>
                          Factored by {shortAddress(invoice.investor)}
                        </span>
                      ) : (
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#FFC400", textTransform: "uppercase" }}>Own Invoice</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Close modal buttons */}
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
                    cursor: "pointer"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "white";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#8B9CC8";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                  }}
                >
                  Close Details
                </button>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default function MarketplaceClient() {
  const { address } = useAccount();
  const { role } = useRole();
  const mockInvoices = useMockInvoiceList();
  const { data: realInvoices, isLoading: isLoadingInvoices } = useRealInvoiceList();

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceOnChain | null>(null);
  const [busyId, setBusyId] = useState<bigint | null>(null);

  const { factorInvoice } = useFactorInvoice();

  const hasRealInvoices = realInvoices && realInvoices.length > 0;
  const invoices = hasRealInvoices ? realInvoices : mockInvoices;
  const isDemoMode = !hasRealInvoices;

  const filtered = invoices.filter((inv) => {
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

  const TABS: Array<{ id: FilterTab; label: string; count: number }> = [
    { id: "all", label: "All Assets", count: invoices.length },
    {
      id: "available",
      label: "Available",
      count: invoices.filter((i) => !i.isFactored).length
    },
    {
      id: "factored",
      label: "Factored",
      count: invoices.filter((i) => i.isFactored && !i.isRepaid).length
    },
    {
      id: "repaid",
      label: "Repaid",
      count: invoices.filter((i) => i.isRepaid).length
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
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Toolbar Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          {/* Tabs */}
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
            <FaucetButton />
          </div>
        </div>

        {/* Demo Mode Banner */}
        {isDemoMode && (
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

        {/* Invoice grid of compact mini-cards */}
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
                onClick={() => setSelectedInvoice(inv)}
                style={{ cursor: "pointer" }}
              >
                <GlassCard
                  className="p-4 flex flex-col gap-3 transition-all duration-200"
                  hover
                  glow="cyan"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-white font-mono">
                      Invoice #{inv.invoiceId.toString()}
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
                    <div className="flex justify-between items-center">
                      <span>Face Value:</span>
                      <span className="flex items-center gap-1 text-slate-300">
                        <span style={{ fontSize: "14px", letterSpacing: "1px", lineHeight: "1" }}>••••••</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-neon-cyan">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "4px",
                      fontSize: "10px",
                      color: "#00F0FF",
                      fontWeight: 700,
                      textAlign: "right",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: "4px"
                    }}
                  >
                    <span>View Details & Risk</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Slide-Up details Modal */}
      <MarketplaceDetailsModal
        invoice={selectedInvoice}
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        onFactor={handleFactor}
        isBusy={busyId !== null}
        currentUserAddress={address || ""}
      />
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </AppLayout>
  );
}
