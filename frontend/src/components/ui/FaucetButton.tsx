/**
 * @file FaucetButton.tsx
 * @description Premium onboarding help modal guiding users through Sepolia ETH, mock USDT, cUSDT wrapping, and Arbitra operator approval.
 */

"use client";

import React, { useState } from "react";
import { useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { NeonButton } from "./NeonButton";
import { GlassCard } from "./GlassCard";
import {
  ARBITRA_REGISTRY_ADDRESS,
  DEFAULT_OPERATOR_EXPIRY_SECONDS,
  shortAddress
} from "@/lib/contracts";
import {
  useIsInvestorApproved,
  useSetOperator
} from "@/hooks/useArbitraRegistry";

export function FaucetButton() {
  const [isOpen, setIsOpen] = useState(false);
  const { address, isConnected } = useAccount();

  /* Operator approval hooks */
  const { data: isApprovedRefetch, refetch: refetchApproval } = useIsInvestorApproved(
    address as `0x${string}` | undefined
  );
  const isApproved = isApprovedRefetch ?? false;

  const { setOperator, isPending: isApproving } = useSetOperator();
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const handleApprove = async () => {
    setApprovalError(null);
    try {
      const expiry = Math.floor(Date.now() / 1000) + DEFAULT_OPERATOR_EXPIRY_SECONDS;
      await setOperator(ARBITRA_REGISTRY_ADDRESS, expiry);
      if (refetchApproval) {
        await refetchApproval();
      }
    } catch (err: any) {
      console.error("Contract approval failed:", err);
      setApprovalError(err?.message || "Transaction rejected or failed.");
    }
  };

  return (
    <>
      <NeonButton
        variant="secondary"
        size="xs"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5"
        id="faucet-button"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-11-7-11S5 10.7 5 15a7 7 0 0 0 7 7z" />
        </svg>
        <span className="text-[10px] sm:text-xs tracking-wide font-semibold">Faucet & Onboarding</span>
      </NeonButton>

      <AnimatePresence>
        {isOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
              padding: "24px"
            }}
          >
            {/* Backdrop Blur overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(2, 7, 20, 0.75)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)"
              }}
            />

            {/* Modal Container */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              style={{
                width: "100%",
                maxWidth: "540px",
                position: "relative",
                zIndex: 101
              }}
            >
              <GlassCard className="p-6 relative overflow-hidden" glow="cyan">
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                  <div>
                    <span style={{ fontSize: "10px", fontWeight: 600, color: "#00F0FF", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "4px" }}>
                      Setup Guide
                    </span>
                    <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#EEF2FF", fontFamily: "Satoshi, sans-serif" }}>
                      Confidential Factoring Onboarding
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#64748B",
                      cursor: "pointer",
                      padding: "4px",
                      transition: "color 0.2s"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#EEF2FF")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#64748B")}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                {/* Steps List */}
                <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxHeight: "400px", overflowY: "auto", paddingRight: "4px" }}>
                  {/* Step 1: Get Sepolia ETH */}
                  <div style={{ display: "flex", gap: "16px" }}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      background: "rgba(0, 240, 255, 0.08)",
                      border: "1px solid rgba(0, 240, 255, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#00F0FF",
                      flexShrink: 0
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#EEF2FF", fontFamily: "Satoshi, sans-serif" }}>
                        1. Acquire Sepolia Gas ETH
                      </h4>
                      <p style={{ fontSize: "12px", color: "#8B9CC8", marginTop: "4px", lineHeight: "1.5" }}>
                        You need testnet ETH on the Sepolia network to cover contract execution transaction fees.
                      </p>
                      <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                        <a
                          href="https://sepoliafaucet.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="neon-btn-secondary text-[11px] px-3 py-1.5 rounded-lg text-decoration-none"
                          style={{ fontSize: "10px", display: "inline-block" }}
                        >
                          Alchemy Faucet
                        </a>
                        <a
                          href="https://www.infura.io/faucet/sepolia"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="neon-btn-secondary text-[11px] px-3 py-1.5 rounded-lg text-decoration-none"
                          style={{ fontSize: "10px", display: "inline-block" }}
                        >
                          Infura Faucet
                        </a>
                        <a
                          href="https://cloud.google.com/application-hosting/faucets/sepolia"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="neon-btn-secondary text-[11px] px-3 py-1.5 rounded-lg text-decoration-none"
                          style={{ fontSize: "10px", display: "inline-block" }}
                        >
                          Google Faucet
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Get Mock USDT */}
                  <div style={{ display: "flex", gap: "16px" }}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      background: "rgba(123, 47, 255, 0.08)",
                      border: "1px solid rgba(123, 47, 255, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#7B2FFF",
                      flexShrink: 0
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v12M9 9h6M9 13h6" />
                      </svg>
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#EEF2FF", fontFamily: "Satoshi, sans-serif" }}>
                        2. Request Test USDT
                      </h4>
                      <p style={{ fontSize: "12px", color: "#8B9CC8", marginTop: "4px", lineHeight: "1.5" }}>
                        Retrieve standard mock USDT tokens on Sepolia. These tokens are the basis for Zama&apos;s FHE wrappers.
                      </p>
                      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                        <a
                          href="https://faucet.testnet.zama.org"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="neon-btn-secondary text-[11px] px-3 py-1.5 rounded-lg text-decoration-none"
                          style={{ fontSize: "10px", display: "inline-block" }}
                        >
                          Zama Faucet
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Wrap to cUSDT */}
                  <div style={{ display: "flex", gap: "16px" }}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      background: "rgba(0, 255, 136, 0.08)",
                      border: "1px solid rgba(0, 255, 136, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#00FF88",
                      flexShrink: 0
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="16 3 21 3 21 8" />
                        <line x1="4" y1="20" x2="21" y2="3" />
                        <polyline points="21 16 21 21 16 21" />
                        <line x1="15" y1="15" x2="21" y2="21" />
                        <line x1="4" y1="4" x2="9" y2="9" />
                      </svg>
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#EEF2FF", fontFamily: "Satoshi, sans-serif" }}>
                        3. Wrap USDT into cUSDT
                      </h4>
                      <p style={{ fontSize: "12px", color: "#8B9CC8", marginTop: "4px", lineHeight: "1.5" }}>
                        Shield your mock USDT into Confidential USDT (cUSDT) ERC-7984 tokens using Zama&apos;s secure wrapping interface.
                      </p>
                      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                        <a
                          href="https://portfolio.zama.ai/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="neon-btn-primary text-[11px] px-4 py-1.5 rounded-lg text-decoration-none"
                          style={{ fontSize: "10px", display: "inline-block" }}
                        >
                          Zama Portfolio Wrap Page
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Step 4: Approve Arbitra Contract */}
                  <div style={{ display: "flex", gap: "16px" }}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      background: "rgba(255, 45, 107, 0.08)",
                      border: "1px solid rgba(255, 45, 107, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#FF2D6B",
                      flexShrink: 0
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                    <div style={{ textAlign: "left", flex: 1 }}>
                      <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#EEF2FF", fontFamily: "Satoshi, sans-serif" }}>
                        4. Authorize Arbitra Operator Approval
                      </h4>
                      <p style={{ fontSize: "12px", color: "#8B9CC8", marginTop: "4px", lineHeight: "1.5" }}>
                        To factor invoices or settle claims, you must authorize the Arbitra contract as a valid spender of your shielded cUSDT balances.
                      </p>

                      <div style={{ marginTop: "12px" }}>
                        {!isConnected ? (
                          <div style={{ fontSize: "11px", color: "#FFC400", background: "rgba(255, 196, 0, 0.05)", border: "1px solid rgba(255, 196, 0, 0.15)", borderRadius: "8px", padding: "8px", textAlign: "center" }}>
                            Wallet disconnected. Connect your wallet to enable contract approval.
                          </div>
                        ) : isApproved ? (
                          <div style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 12px",
                            background: "rgba(0, 255, 136, 0.08)",
                            border: "1px solid rgba(0, 255, 136, 0.2)",
                            borderRadius: "8px",
                            fontSize: "11px",
                            color: "#00FF88",
                            fontWeight: 700
                          }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00FF88" }} />
                            Arbitra Contract Approved
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <button
                              onClick={handleApprove}
                              disabled={isApproving}
                              className="neon-btn-primary px-4 py-2 text-xs rounded-lg"
                              style={{ width: "fit-content" }}
                            >
                              {isApproving ? "Confirming approval..." : "Approve Arbitra Contract"}
                            </button>
                            {approvalError && (
                              <div style={{ fontSize: "10px", color: "#FF2D6B", marginTop: "4px" }}>
                                {approvalError}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
