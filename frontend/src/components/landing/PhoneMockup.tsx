/**
 * @file PhoneMockup.tsx
 * @description Interactive iPhone 15 mockup with simulated dashboard mirroring the real Arbitra UI.
 */

"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/useBreakpoint";

export function PhoneMockup() {
  const isMobile = useIsMobile();
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [activeRole, setActiveRole] = useState<"supplier" | "investor">("supplier");
  const [isScanning, setIsScanning] = useState(false);

  /* Animation variants for floating elements */
  const floatVariants = (yOffset: number, duration: number) => ({
    animate: {
      y: [0, yOffset, 0],
      transition: {
        duration,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  });

  const handleToggle = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsDecrypted((prev) => !prev);
      setIsScanning(false);
    }, 800);
  };

  return (
    <section
      style={{
        padding: "100px 24px",
        position: "relative",
        zIndex: 2,
        background: "radial-gradient(ellipse at 50% 60%, rgba(123, 47, 255, 0.08) 0%, transparent 60%)",
        overflow: "hidden"
      }}
    >
      {/* Background Floating Orbs around mockup */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "20%",
          top: "30%",
          width: "350px",
          height: "350px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0, 240, 255, 0.04) 0%, transparent 70%)",
          zIndex: 1,
          pointerEvents: "none"
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          right: "20%",
          top: "20%",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(123, 47, 255, 0.04) 0%, transparent 70%)",
          zIndex: 1,
          pointerEvents: "none"
        }}
      />

      <div style={{ maxWidth: "1100px", margin: "0 auto", textAlign: "center" }}>
        {/* Section Headers */}
        <span
          style={{
            fontFamily: "Satoshi, sans-serif",
            fontSize: "12px",
            fontWeight: 500,
            color: "#00F0FF",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            display: "block",
            marginBottom: "12px"
          }}
        >
          Confidential Execution
        </span>
        <h2
          style={{
            fontFamily: "Satoshi, sans-serif",
            fontSize: "clamp(32px, 4vw, 48px)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            marginBottom: "16px"
          }}
        >
          <span style={{ color: "#EEF2FF" }}>See it in </span>
          <span style={{ background: "linear-gradient(135deg, #00F0FF 0%, #7B2FFF 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Action
          </span>
        </h2>
        <p
          style={{
            fontFamily: "Satoshi, sans-serif",
            fontSize: "17px",
            color: "#8B9CC8",
            maxWidth: "600px",
            margin: "0 auto 60px",
            lineHeight: 1.75
          }}
        >
          Every invoice, repayment weight, and credit yield is stored as encrypted ciphertext. Investors only see what they are authorized to decrypt.
        </p>

        {/* Layout container */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            position: "relative",
            minHeight: "720px",
            zIndex: 2
          }}
        >
          {/* Left Floating Cards (Desktop only) */}
          {!isMobile && (
            <>
              {/* Floating Card 1 (Top-Left) */}
              <motion.div
                variants={floatVariants(-15, 7)}
                animate="animate"
                style={{
                  position: "absolute",
                  left: "8%",
                  top: "12%",
                  width: "220px",
                  background: "rgba(10, 16, 38, 0.85)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "16px",
                  padding: "16px",
                  textAlign: "left",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)"
                }}
              >
                <div style={{ fontSize: "10px", color: "#8B9CC8", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "8px" }}>
                  Invoice Detail
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#EEF2FF", marginBottom: "4px" }}>
                  Invoice #1
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "#8B9CC8", marginBottom: "8px" }}>
                  <span>Face Value:</span>
                  <span style={{ fontFamily: "JetBrains Mono, monospace", color: "#00F0FF", fontWeight: 500 }}>
                    {isDecrypted ? "$142,000 cUSDC" : "0x7f3a...b81e"}
                  </span>
                </div>
                <div style={{ display: "inline-flex", padding: "4px 8px", borderRadius: "100px", background: "rgba(0, 255, 136, 0.1)", border: "1px solid rgba(0,255,136,0.2)", fontSize: "10px", color: "#00FF88", fontWeight: 600 }}>
                  Factored
                </div>
              </motion.div>

              {/* Floating Card 2 (Bottom-Left) */}
              <motion.div
                variants={floatVariants(12, 9)}
                animate="animate"
                style={{
                  position: "absolute",
                  left: "5%",
                  bottom: "15%",
                  width: "240px",
                  background: "rgba(10, 16, 38, 0.85)",
                  border: "1px solid rgba(0, 240, 255, 0.25)",
                  borderRadius: "16px",
                  padding: "16px",
                  textAlign: "left",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  boxShadow: "0 0 20px rgba(0,240,255,0.08)"
                }}
              >
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#EEF2FF" }}>
                    FHE Protected
                  </span>
                </div>
                <p style={{ fontSize: "11px", color: "#8B9CC8", marginTop: "8px", lineHeight: "1.4" }}>
                  Homomorphic states prevent public nodes from parsing details of factoring bids.
                </p>
              </motion.div>
            </>
          )}

          {/* Center iPhone 15 Pro CSS Frame */}
          <div
            style={{
              width: "320px",
              height: "640px",
              borderRadius: "44px",
              background: "#020714",
              border: "12px solid #1E2330",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.8), 0 0 40px rgba(0, 240, 255, 0.15)",
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column"
            }}
          >
            {/* Dynamic Island Cutout */}
            <div
              style={{
                width: "90px",
                height: "22px",
                borderRadius: "100px",
                background: "#000000",
                position: "absolute",
                top: "8px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 30
              }}
            />

            {/* Screen Content Wrapper */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                background: "#060B18",
                padding: "36px 14px 14px",
                overflow: "hidden",
                position: "relative"
              }}
            >
              {/* Scanning laser line overlay */}
              <AnimatePresence>
                {isScanning && (
                  <motion.div
                    initial={{ top: "0%", opacity: 0 }}
                    animate={{ top: ["0%", "95%", "0%"], opacity: [0, 1, 1, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      height: "4px",
                      background: "linear-gradient(90deg, transparent, #00F0FF, transparent)",
                      boxShadow: "0 0 12px #00F0FF, 0 0 4px #00F0FF",
                      zIndex: 10,
                      pointerEvents: "none"
                    }}
                  />
                )}
              </AnimatePresence>

              {/* Mini-Dashboard Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <h3 style={{ fontSize: "14px", fontWeight: 800, color: "#EEF2FF", fontFamily: "Satoshi, sans-serif" }}>
                    Dashboard
                  </h3>
                </div>
                {/* Active Wallet Connected Display */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(0, 240, 255, 0.06)", border: "1px solid rgba(0, 240, 255, 0.15)", borderRadius: "8px", padding: "4px 8px", fontSize: "9px", color: "#00F0FF", fontWeight: 600 }}>
                  <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#00FF88" }} />
                  0x7b2f...e00f ({activeRole === "supplier" ? "Supplier" : "Investor"})
                </div>
              </div>

              {/* Simulated Role Toggle inside iPhone screen */}
              <div
                style={{
                  display: "flex",
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius: "10px",
                  padding: "2px",
                  marginBottom: "12px"
                }}
              >
                <button
                  onClick={() => setActiveRole("supplier")}
                  style={{
                    flex: 1,
                    background: activeRole === "supplier" ? "rgba(0, 240, 255, 0.08)" : "transparent",
                    border: "none",
                    borderRadius: "6px",
                    padding: "4px 0",
                    color: activeRole === "supplier" ? "#00F0FF" : "#64748B",
                    fontSize: "9px",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                >
                  Supplier Mode
                </button>
                <button
                  onClick={() => setActiveRole("investor")}
                  style={{
                    flex: 1,
                    background: activeRole === "investor" ? "rgba(123, 47, 255, 0.08)" : "transparent",
                    border: "none",
                    borderRadius: "6px",
                    padding: "4px 0",
                    color: activeRole === "investor" ? "#A87FFF" : "#64748B",
                    fontSize: "9px",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                >
                  Investor Mode
                </button>
              </div>

              {/* FHE Status badge */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 10px",
                  background: "rgba(0, 240, 255, 0.04)",
                  border: "1px solid rgba(0, 240, 255, 0.15)",
                  borderRadius: "10px",
                  fontSize: "9px",
                  color: "#00FF88",
                  marginBottom: "12px",
                  justifyContent: "center",
                  fontWeight: 600
                }}
              >
                <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#00FF88" }} />
                <span>FHE Shield Active • Zama v0.11 • Sepolia</span>
              </div>

              {/* Static screen area */}
              <div style={{ flex: 1, overflowY: "auto", marginBottom: "12px", paddingRight: "2px" }} className="hide-scrollbar">
                {/* Dynamic Stats Cards */}
                {activeRole === "supplier" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
                    <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.04)", borderRadius: "10px", padding: "8px", textAlign: "left" }}>
                      <div style={{ fontSize: "8px", color: "#8B9CC8" }}>Uploaded</div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#EEF2FF", marginTop: "2px" }}>3</div>
                    </div>
                    <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.04)", borderRadius: "10px", padding: "8px", textAlign: "left" }}>
                      <div style={{ fontSize: "8px", color: "#8B9CC8" }}>Awaiting</div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#EEF2FF", marginTop: "2px" }}>1</div>
                    </div>
                    <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.04)", borderRadius: "10px", padding: "8px", textAlign: "left", gridColumn: "span 2" }}>
                      <div style={{ fontSize: "8px", color: "#8B9CC8" }}>Total Factored Volume</div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#00FF88", marginTop: "2px", fontFamily: "JetBrains Mono, monospace" }}>
                        {isDecrypted ? "$375,000.00 cUSDC" : "0x9a8b...f2de 🔒"}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
                    <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.04)", borderRadius: "10px", padding: "8px", textAlign: "left" }}>
                      <div style={{ fontSize: "8px", color: "#8B9CC8" }}>Investments</div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#EEF2FF", marginTop: "2px" }}>2</div>
                    </div>
                    <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.04)", borderRadius: "10px", padding: "8px", textAlign: "left" }}>
                      <div style={{ fontSize: "8px", color: "#8B9CC8" }}>Yield Rate</div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#EEF2FF", marginTop: "2px" }}>14.2% APY</div>
                    </div>
                    <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.04)", borderRadius: "10px", padding: "8px", textAlign: "left", gridColumn: "span 2" }}>
                      <div style={{ fontSize: "8px", color: "#8B9CC8" }}>Confidential Factored Balance</div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#00F0FF", marginTop: "2px", fontFamily: "JetBrains Mono, monospace" }}>
                        {isDecrypted ? "$250,000.00 cUSDC" : "0x0f8c...4b12 🔒"}
                      </div>
                    </div>
                  </div>
                )}

                {/* CSS Donut Chart */}
                <div
                  style={{
                    background: "rgba(10, 16, 38, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    borderRadius: "12px",
                    padding: "10px",
                    marginBottom: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px"
                  }}
                >
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      background: "conic-gradient(#00F0FF 0% 60%, #7B2FFF 60% 85%, #00FF88 85% 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                  >
                    <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "#060B18" }} />
                  </div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{ fontSize: "9px", fontWeight: 700, color: "#EEF2FF" }}>Portfolio Distribution</div>
                    <div style={{ display: "flex", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "7px", color: "#00F0FF", display: "flex", alignItems: "center", gap: "2px" }}>
                        <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#00F0FF" }} /> Factored
                      </span>
                      <span style={{ fontSize: "7px", color: "#7B2FFF", display: "flex", alignItems: "center", gap: "2px" }}>
                        <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#7B2FFF" }} /> Available
                      </span>
                      <span style={{ fontSize: "7px", color: "#00FF88", display: "flex", alignItems: "center", gap: "2px" }}>
                        <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#00FF88" }} /> Repaid
                      </span>
                    </div>
                  </div>
                </div>

                {/* Recent Invoices list */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "9px", fontWeight: 700, color: "#EEF2FF", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Recent Invoices
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {[
                    {
                      id: "Invoice #1",
                      status: "Factored",
                      color: "#7B2FFF",
                      clear: "$142,000 cUSDC",
                      cipher: "0x7f3a...b81e"
                    },
                    {
                      id: "Invoice #2",
                      status: "Pending Attestation",
                      color: "#FFC400",
                      clear: "$89,500 cUSDC",
                      cipher: "0x0f8c...4b12"
                    },
                    {
                      id: "Invoice #3",
                      status: "Repaid",
                      color: "#00FF88",
                      clear: "$210,000 cUSDC",
                      cipher: "0x8e5f...c9d4"
                    }
                  ].map((inv) => (
                    <div
                      key={inv.id}
                      style={{
                        background: "rgba(255, 255, 255, 0.02)",
                        border: "1px solid rgba(255, 255, 255, 0.04)",
                        borderRadius: "10px",
                        padding: "8px 10px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                    >
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "#EEF2FF" }}>{inv.id}</div>
                        <span style={{ fontSize: "7px", color: inv.color, textTransform: "uppercase", fontWeight: 600 }}>
                          {inv.status}
                        </span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "#00F0FF", fontFamily: "JetBrains Mono, monospace" }}>
                          {isDecrypted ? inv.clear : inv.cipher}
                        </div>
                        <div style={{ fontSize: "7px", color: "#8B9CC8" }}>
                          cUSDC
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Decryption View Toggle */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "auto" }}>
                <button
                  onClick={handleToggle}
                  disabled={isScanning}
                  style={{
                    background: isDecrypted ? "rgba(123, 47, 255, 0.12)" : "rgba(0, 240, 255, 0.12)",
                    border: isDecrypted ? "1px solid rgba(123, 47, 255, 0.3)" : "1px solid rgba(0, 240, 255, 0.3)",
                    borderRadius: "10px",
                    padding: "8px",
                    color: isDecrypted ? "#A87FFF" : "#00F0FF",
                    fontFamily: "Satoshi, sans-serif",
                    fontSize: "10px",
                    fontWeight: 700,
                    cursor: isScanning ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    boxShadow: isDecrypted ? "0 0 10px rgba(123,47,255,0.15)" : "0 0 10px rgba(0,240,255,0.15)",
                    transition: "all 0.2s"
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    {isDecrypted ? (
                      <>
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                      </>
                    ) : (
                      <>
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </>
                    )}
                  </svg>
                  {isScanning ? "Processing FHE..." : isDecrypted ? "Encrypt View (FHE)" : "Decrypt View (Key)"}
                </button>
              </div>
            </div>
          </div>

          {/* Right Floating Cards (Desktop only) */}
          {!isMobile && (
            <>
              {/* Floating Card 3 (Top-Right) */}
              <motion.div
                variants={floatVariants(15, 8)}
                animate="animate"
                style={{
                  position: "absolute",
                  right: "8%",
                  top: "15%",
                  width: "220px",
                  background: "rgba(10, 16, 38, 0.85)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "16px",
                  padding: "16px",
                  textAlign: "left",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "10px", color: "#8B9CC8", textTransform: "uppercase", fontWeight: 600 }}>
                    Gemini Risk
                  </span>
                  <span style={{ fontSize: "10px", color: "#00FF88", fontWeight: 700 }}>LOW RISK</span>
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#EEF2FF", marginBottom: "6px" }}>
                  Score: 12 / 100
                </div>
                <div style={{ display: "inline-flex", padding: "4px 8px", borderRadius: "100px", background: "rgba(0, 240, 255, 0.1)", border: "1px solid rgba(0,240,255,0.2)", fontSize: "10px", color: "#00F0FF", fontWeight: 600 }}>
                  Recommendation: FACTOR
                </div>
              </motion.div>

              {/* Floating Card 4 (Bottom-Right) */}
              <motion.div
                variants={floatVariants(-12, 10)}
                animate="animate"
                style={{
                  position: "absolute",
                  right: "6%",
                  bottom: "18%",
                  width: "230px",
                  background: "rgba(10, 16, 38, 0.85)",
                  border: "1px solid rgba(0, 255, 136, 0.25)",
                  borderRadius: "16px",
                  padding: "16px",
                  textAlign: "left",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  boxShadow: "0 0 20px rgba(0,255,136,0.08)"
                }}
              >
                <div style={{ display: "flex", gap: "8px", alignItems: "center", color: "#00FF88", fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  cUSDC Transferred
                </div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#EEF2FF", fontFamily: "JetBrains Mono, monospace" }}>
                  - $1,250.00
                </div>
                <div style={{ fontSize: "10px", color: "#8B9CC8", marginTop: "4px" }}>
                  Settlement verified on chain
                </div>
              </motion.div>
            </>
          )}
        </div>
      </div>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </section>
  );
}
