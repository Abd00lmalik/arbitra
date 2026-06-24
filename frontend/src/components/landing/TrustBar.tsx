/**
 * @file TrustBar.tsx
 * @description Horizontal trust bar listing core protocols and technical partners.
 */

"use client";

import React from "react";
import { motion } from "framer-motion";

export function TrustBar() {
  const containerVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      style={{
        width: "100%",
        background: "rgba(255, 255, 255, 0.015)",
        borderTop: "1px solid rgba(255, 255, 255, 0.05)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
        padding: "24px 16px",
        position: "relative",
        zIndex: 10
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px"
        }}
      >
        {/* Item 1 */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "140px" }}>
          <span style={{ fontSize: "11px", color: "#8B9CC8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
            Built on
          </span>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#00F0FF", fontFamily: "Satoshi, sans-serif" }}>
            Zama FHEVM
          </span>
        </div>

        {/* Divider 1 */}
        <div style={{ color: "rgba(255, 255, 255, 0.1)", display: "var(--desktop-divider-display, block)" }} className="desktop-divider">|</div>

        {/* Item 2 */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "140px" }}>
          <span style={{ fontSize: "11px", color: "#8B9CC8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
            Protected by
          </span>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#7B2FFF", fontFamily: "Satoshi, sans-serif" }}>
            FHE Encryption
          </span>
        </div>

        {/* Divider 2 */}
        <div style={{ color: "rgba(255, 255, 255, 0.1)", display: "var(--desktop-divider-display, block)" }} className="desktop-divider">|</div>

        {/* Item 3 */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "140px" }}>
          <span style={{ fontSize: "11px", color: "#8B9CC8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
            Settled via
          </span>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#00FF88", fontFamily: "Satoshi, sans-serif" }}>
            USDC Sepolia
          </span>
        </div>

        {/* Divider 3 */}
        <div style={{ color: "rgba(255, 255, 255, 0.1)", display: "var(--desktop-divider-display, block)" }} className="desktop-divider">|</div>

        {/* Item 4 */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "140px" }}>
          <span style={{ fontSize: "11px", color: "#8B9CC8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
            Underwriting
          </span>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#00F0FF", fontFamily: "Satoshi, sans-serif" }}>
            Deterministic Model
          </span>
        </div>

        {/* Divider 4 */}
        <div style={{ color: "rgba(255, 255, 255, 0.1)", display: "var(--desktop-divider-display, block)" }} className="desktop-divider">|</div>

        {/* Item 5 */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "140px" }}>
          <span style={{ fontSize: "11px", color: "#8B9CC8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
            RWA Protocol
          </span>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#7B2FFF", fontFamily: "Satoshi, sans-serif" }}>
            ERC-7984 Standard
          </span>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .desktop-divider {
            display: none !important;
          }
          /* On mobile, show only Zama, FHE, and ERC-7984 to fit screen cleanly */
          div > div:nth-child(7),
          div > div:nth-child(8),
          div > div:nth-child(9),
          div > div:nth-child(10),
          div > div:nth-child(11) {
            display: none !important;
          }
        }
      `}</style>
    </motion.div>
  );
}
