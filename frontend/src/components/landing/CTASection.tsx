/**
 * @file CTASection.tsx
 * @description Final call-to-action section with stats, links to launch app and Sepolia Faucets.
 */

"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";

export function CTASection() {
  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.97 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      style={{
        padding: "120px 24px 80px",
        position: "relative",
        zIndex: 2,
        background: "radial-gradient(circle at 50% 30%, rgba(0, 240, 255, 0.08) 0%, #020714 60%)",
        textAlign: "center",
        borderTop: "1px solid rgba(255, 255, 255, 0.04)"
      }}
    >
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        {/* Eyebrow */}
        <span
          style={{
            fontFamily: "Satoshi, sans-serif",
            fontSize: "12px",
            fontWeight: 500,
            color: "#00F0FF",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            display: "block",
            marginBottom: "16px"
          }}
        >
          Get Started Today
        </span>

        {/* Headline */}
        <h2
          style={{
            fontFamily: "Satoshi, sans-serif",
            fontSize: "clamp(36px, 5vw, 56px)",
            fontWeight: 900,
            color: "#EEF2FF",
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            marginBottom: "24px"
          }}
        >
          Start Factoring Privately.
        </h2>

        {/* Subheadline */}
        <p
          style={{
            fontFamily: "Satoshi, sans-serif",
            fontSize: "18px",
            color: "#8B9CC8",
            lineHeight: 1.7,
            maxWidth: "600px",
            margin: "0 auto 40px"
          }}
        >
          Join suppliers and investors using Arbitra on Sepolia testnet. No KYC. No intermediaries. Full homomorphic privacy.
        </p>

        {/* Action buttons */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: "80px"
          }}
        >
          <Link href="/dashboard" style={{ textDecoration: "none" }}>
            <motion.span
              whileHover={{ scale: 1.04, boxShadow: "0 0 30px rgba(0, 240, 255, 0.45)" }}
              whileTap={{ scale: 0.97 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                height: "54px",
                padding: "0 32px",
                background: "#00F0FF",
                color: "#020714",
                borderRadius: "14px",
                fontSize: "15px",
                fontWeight: 700,
                fontFamily: "Satoshi, sans-serif",
                cursor: "pointer"
              }}
            >
              Login with Email →
            </motion.span>
          </Link>

          <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <motion.span
              whileHover={{ scale: 1.03, background: "rgba(0, 240, 255, 0.08)" }}
              whileTap={{ scale: 0.97 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                height: "54px",
                padding: "0 32px",
                background: "transparent",
                border: "1.5px solid rgba(0, 240, 255, 0.32)",
                color: "#00F0FF",
                borderRadius: "14px",
                fontSize: "15px",
                fontWeight: 600,
                fontFamily: "Satoshi, sans-serif",
                cursor: "pointer"
              }}
            >
              Get Test USDC
            </motion.span>
          </a>
        </div>

        {/* Stats Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "24px",
            borderTop: "1px solid rgba(255, 255, 255, 0.05)",
            paddingTop: "60px",
            marginBottom: "60px"
          }}
        >
          <div>
            <div style={{ fontSize: "28px", fontWeight: 700, color: "#00F0FF", fontFamily: "JetBrains Mono, monospace" }}>
              $0 - Infinity
            </div>
            <div style={{ fontSize: "12px", color: "#8B9CC8", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Permissionless Capital
            </div>
          </div>
          <div>
            <div style={{ fontSize: "28px", fontWeight: 700, color: "#7B2FFF", fontFamily: "JetBrains Mono, monospace" }}>
              100%
            </div>
            <div style={{ fontSize: "12px", color: "#8B9CC8", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              FHE-Encrypted
            </div>
          </div>
          <div>
            <div style={{ fontSize: "28px", fontWeight: 700, color: "#00FF88", fontFamily: "JetBrains Mono, monospace" }}>
              &lt; 15s
            </div>
            <div style={{ fontSize: "12px", color: "#8B9CC8", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Settlement Time
            </div>
          </div>
        </div>

        {/* Footer info */}
        <footer
          style={{
            fontSize: "12px",
            color: "#3D4E7A",
            fontFamily: "Satoshi, sans-serif",
            borderTop: "1px solid rgba(255, 255, 255, 0.03)",
            paddingTop: "32px"
          }}
        >
          &copy; 2026 Arbitra · Built with Zama FHEVM · Not financial advice · Sepolia Testnet
        </footer>
      </div>
    </motion.section>
  );
}
