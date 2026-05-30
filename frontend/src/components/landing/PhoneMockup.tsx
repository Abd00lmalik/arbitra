/**
 * @file PhoneMockup.tsx
 * @description Interactive iPhone 15 mockup with encryption toggle showing live dashboard states, marketplace, and AI risk tabs.
 */

"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/useBreakpoint";

type PhoneTab = "dashboard" | "marketplace" | "risk";

export function PhoneMockup() {
  const isMobile = useIsMobile();
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [activePhoneTab, setActivePhoneTab] = useState<PhoneTab>("dashboard");
  const [factoredInvoices, setFactoredInvoices] = useState<Record<string, boolean>>({
    "ARB-004": false,
    "ARB-005": false,
  });

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

  const handleFactorSimulated = (id: string) => {
    setFactoredInvoices((prev) => ({ ...prev, [id]: true }));
  };

  /* Calculated stats based on interactive factoring */
  const totalBalance = 8750 + 
    (factoredInvoices["ARB-004"] ? 4200 : 0) + 
    (factoredInvoices["ARB-005"] ? 1800 : 0);

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
                  ARB-001
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "#8B9CC8", marginBottom: "8px" }}>
                  <span>Face Value:</span>
                  <span style={{ fontFamily: "JetBrains Mono, monospace", color: "#00F0FF", fontWeight: 500 }}>
                    {isDecrypted ? "$5,000" : "🔒 FHE"}
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
                overflow: "hidden"
              }}
            >
              {/* Mini-Dashboard Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <div style={{ fontSize: "9px", color: "#8B9CC8", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left" }}>Welcome</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#EEF2FF", fontFamily: "Satoshi, sans-serif" }}>
                    {activePhoneTab === "dashboard" && "Dashboard"}
                    {activePhoneTab === "marketplace" && "Marketplace"}
                    {activePhoneTab === "risk" && "Risk Engine"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(0, 240, 255, 0.06)", border: "1px solid rgba(0, 240, 255, 0.15)", borderRadius: "8px", padding: "4px 8px", fontSize: "10px", color: "#00F0FF", fontWeight: 600 }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00FF88" }} />
                  0x7F...3B
                </div>
              </div>

              {/* Dynamic screen area */}
              <div style={{ flex: 1, overflowY: "auto", marginBottom: "12px", paddingRight: "2px" }} className="hide-scrollbar">
                <AnimatePresence mode="wait">
                  {activePhoneTab === "dashboard" && (
                    <motion.div
                      key="dashboard"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {/* Portfolio Ring & Stats Card */}
                      <div
                        style={{
                          background: "rgba(10, 16, 38, 0.6)",
                          border: "1px solid rgba(255, 255, 255, 0.05)",
                          borderRadius: "16px",
                          padding: "12px",
                          marginBottom: "12px",
                          display: "flex",
                          alignItems: "center",
                          gap: "12px"
                        }}
                      >
                        {/* Conic Donut Chart */}
                        <div
                          style={{
                            width: "60px",
                            height: "60px",
                            borderRadius: "50%",
                            background: `conic-gradient(#00F0FF 0% ${factoredInvoices["ARB-004"] ? "75%" : "60%"}, #7B2FFF ${factoredInvoices["ARB-004"] ? "75%" : "60%"} 85%, rgba(255,255,255,0.05) 85% 100%)`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                        >
                          <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "#0A1026" }} />
                        </div>

                        {/* Portfolio stats */}
                        <div style={{ flex: 1, textAlign: "left" }}>
                          <span style={{ fontSize: "9px", color: "#8B9CC8" }}>Portfolio Value</span>
                          <div
                            style={{
                              fontSize: "16px",
                              fontWeight: 700,
                              color: "#00F0FF",
                              fontFamily: "JetBrains Mono, monospace",
                              marginTop: "2px"
                            }}
                          >
                            {isDecrypted ? `$${totalBalance.toLocaleString()}` : "🔒 FHE"}
                          </div>
                          <div style={{ fontSize: "9px", color: "#00FF88", marginTop: "2px" }}>
                            +12.4% yield APR
                          </div>
                        </div>
                      </div>

                      {/* Invoices list title */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "#EEF2FF", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Asset Registry
                        </span>
                        <span style={{ fontSize: "9px", color: "#8B9CC8" }}>
                          Active: {3 + (factoredInvoices["ARB-004"] ? 1 : 0) + (factoredInvoices["ARB-005"] ? 1 : 0)}
                        </span>
                      </div>

                      {/* Invoices */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {[
                          { id: "ARB-001", val: "$5,000", badge: "badge-green", color: "#00FF88" },
                          { id: "ARB-002", val: "$2,500", badge: "badge-blue", color: "#00F0FF" },
                          { id: "ARB-003", val: "$1,250", badge: "badge-yellow", color: "#FFC400" },
                          ...(factoredInvoices["ARB-004"] ? [{ id: "ARB-004", val: "$4,200", badge: "badge-green", color: "#00FF88" }] : []),
                          ...(factoredInvoices["ARB-005"] ? [{ id: "ARB-005", val: "$1,800", badge: "badge-green", color: "#00FF88" }] : [])
                        ].map((inv) => (
                          <div
                            key={inv.id}
                            style={{
                              background: "rgba(255, 255, 255, 0.02)",
                              border: "1px solid rgba(255, 255, 255, 0.04)",
                              borderRadius: "12px",
                              padding: "8px 10px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center"
                            }}
                          >
                            <div style={{ textAlign: "left" }}>
                              <div style={{ fontSize: "10px", fontWeight: 700, color: "#EEF2FF" }}>{inv.id}</div>
                              <div style={{ fontSize: "8px", color: "#8B9CC8" }}>Factoring cUSDT</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: "10px", fontWeight: 700, color: "#00F0FF", fontFamily: "JetBrains Mono, monospace" }}>
                                {isDecrypted ? inv.val : "🔒 FHE"}
                              </div>
                              <span style={{ fontSize: "8px", color: inv.color, textTransform: "uppercase", fontWeight: 600 }}>
                                Verified
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {activePhoneTab === "marketplace" && (
                    <motion.div
                      key="marketplace"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      style={{ display: "flex", flexDirection: "column", gap: "10px" }}
                    >
                      <div style={{ fontSize: "10px", color: "#8B9CC8", textAlign: "left" }}>
                        Select available invoices to purchase at a homomorphically calculated discount.
                      </div>

                      {[
                        { id: "ARB-004", val: "$4,200", disc: "12% discount", yield: "+6.8% APR" },
                        { id: "ARB-005", val: "$1,800", disc: "8% discount", yield: "+5.1% APR" }
                      ].map((inv) => (
                        <div
                          key={inv.id}
                          style={{
                            background: "rgba(255, 255, 255, 0.02)",
                            border: "1px solid rgba(255, 255, 255, 0.05)",
                            borderRadius: "14px",
                            padding: "12px",
                            textAlign: "left",
                            position: "relative"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "#EEF2FF" }}>{inv.id}</span>
                            <span style={{ fontSize: "9px", color: "#00F0FF", fontFamily: "JetBrains Mono, monospace" }}>
                              {isDecrypted ? inv.val : "🔒 FHE"}
                            </span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#8B9CC8", marginBottom: "10px" }}>
                            <span>{inv.disc}</span>
                            <span style={{ color: "#00FF88" }}>{inv.yield}</span>
                          </div>

                          {factoredInvoices[inv.id] ? (
                            <div
                              style={{
                                width: "100%",
                                padding: "6px 0",
                                background: "rgba(0, 255, 136, 0.08)",
                                border: "1px solid rgba(0, 255, 136, 0.2)",
                                borderRadius: "8px",
                                color: "#00FF88",
                                fontSize: "10px",
                                fontWeight: 700,
                                textAlign: "center"
                              }}
                            >
                              Factored Successfully
                            </div>
                          ) : (
                            <button
                              onClick={() => handleFactorSimulated(inv.id)}
                              style={{
                                width: "100%",
                                padding: "6px 0",
                                background: "linear-gradient(135deg, #00F0FF, #7B2FFF)",
                                border: "none",
                                borderRadius: "8px",
                                color: "white",
                                fontSize: "10px",
                                fontWeight: 700,
                                cursor: "pointer",
                                boxShadow: "0 0 10px rgba(0, 240, 255, 0.2)"
                              }}
                            >
                              Factor Invoice
                            </button>
                          )}
                        </div>
                      ))}
                    </motion.div>
                  )}

                  {activePhoneTab === "risk" && (
                    <motion.div
                      key="risk"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      style={{ display: "flex", flexDirection: "column", gap: "12px", textAlign: "left" }}
                    >
                      <div
                        style={{
                          background: "rgba(123, 47, 255, 0.08)",
                          border: "1px solid rgba(123, 47, 255, 0.2)",
                          borderRadius: "14px",
                          padding: "12px"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <span style={{ fontSize: "10px", fontWeight: 700, color: "#EEF2FF" }}>Gemini Credit Score</span>
                          <span style={{ fontSize: "10px", color: "#00FF88", fontWeight: 700 }}>VERIFIED</span>
                        </div>
                        <div style={{ fontSize: "20px", fontWeight: 800, color: "#EEF2FF", marginBottom: "4px" }}>
                          94.2% Repay
                        </div>
                        <div style={{ fontSize: "9px", color: "#8B9CC8" }}>
                          Calculated securely on-chain using FHE credit history matrices.
                        </div>
                      </div>

                      <div
                        style={{
                          background: "rgba(255, 255, 255, 0.02)",
                          border: "1px solid rgba(255, 255, 255, 0.04)",
                          borderRadius: "14px",
                          padding: "12px"
                        }}
                      >
                        <div style={{ fontSize: "10px", color: "#8B9CC8", textTransform: "uppercase", marginBottom: "6px" }}>AI Risk Report</div>
                        <p style={{ fontSize: "9px", color: "#EEF2FF", lineHeight: "1.4" }}>
                          Analysis of encrypted counterparty default indicates low systemic risk. Recommended factoring range yields 12% APR with high capital velocity.
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <div style={{ flex: 1, padding: "8px", background: "rgba(0, 240, 255, 0.05)", border: "1px solid rgba(0, 240, 255, 0.1)", borderRadius: "10px", textAlign: "center" }}>
                          <div style={{ fontSize: "8px", color: "#8B9CC8" }}>Risk Rating</div>
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "#00F0FF", marginTop: "2px" }}>A+ Stable</div>
                        </div>
                        <div style={{ flex: 1, padding: "8px", background: "rgba(0, 255, 136, 0.05)", border: "1px solid rgba(0, 255, 136, 0.1)", borderRadius: "10px", textAlign: "center" }}>
                          <div style={{ fontSize: "8px", color: "#8B9CC8" }}>LTV Ratio</div>
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "#00FF88", marginTop: "2px" }}>88.5%</div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Toggle & Tabbar navigation */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "auto" }}>
                {/* EIP-712 Decryption Toggle */}
                <button
                  onClick={() => setIsDecrypted(!isDecrypted)}
                  style={{
                    background: isDecrypted ? "rgba(123, 47, 255, 0.12)" : "rgba(0, 240, 255, 0.12)",
                    border: isDecrypted ? "1px solid rgba(123, 47, 255, 0.3)" : "1px solid rgba(0, 240, 255, 0.3)",
                    borderRadius: "12px",
                    padding: "8px",
                    color: isDecrypted ? "#A87FFF" : "#00F0FF",
                    fontFamily: "Satoshi, sans-serif",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    boxShadow: isDecrypted ? "0 0 10px rgba(123,47,255,0.15)" : "0 0 10px rgba(0,240,255,0.15)",
                    transition: "all 0.2s"
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
                  {isDecrypted ? "Encrypt View (FHE)" : "Decrypt View (Key)"}
                </button>

                {/* Inner Tab bar */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    borderRadius: "12px",
                    padding: "4px"
                  }}
                >
                  {[
                    { id: "dashboard", label: "Dash", path: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
                    { id: "marketplace", label: "Trade", path: "M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" },
                    { id: "risk", label: "Risk", path: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActivePhoneTab(tab.id as PhoneTab)}
                      style={{
                        flex: 1,
                        background: activePhoneTab === tab.id ? "rgba(0, 240, 255, 0.08)" : "transparent",
                        border: "none",
                        borderRadius: "8px",
                        padding: "6px 0",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "2px",
                        transition: "all 0.15s"
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={activePhoneTab === tab.id ? "#00F0FF" : "#64748B"}
                        strokeWidth="2"
                      >
                        <path d={tab.path} />
                      </svg>
                      <span style={{ fontSize: "8px", fontWeight: 600, color: activePhoneTab === tab.id ? "#00F0FF" : "#64748B" }}>
                        {tab.label}
                      </span>
                    </button>
                  ))}
                </div>
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
                  <span style={{ fontSize: "10px", color: "#00FF88", fontWeight: 700 }}>HIGH CONF</span>
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#EEF2FF", marginBottom: "6px" }}>
                  Score: 4 / 10
                </div>
                <div style={{ display: "inline-flex", padding: "4px 8px", borderRadius: "100px", background: "rgba(0, 240, 255, 0.1)", border: "1px solid rgba(0,240,255,0.2)", fontSize: "10px", color: "#00F0FF", fontWeight: 600 }}>
                  Recommendation: BUY
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
                  cUSDT Transferred
                </div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#EEF2FF", fontFamily: "JetBrains Mono, monospace" }}>
                  - $933.97
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
