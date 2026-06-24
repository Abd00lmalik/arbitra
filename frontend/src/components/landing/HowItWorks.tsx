/**
 * @file HowItWorks.tsx
 * @description 4-step sequence showing invoice encryption, scoring, risk analysis, and settlement.
 */

"use client";

import React from "react";
import { motion } from "framer-motion";

interface StepItem {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export function HowItWorks() {
  const steps: StepItem[] = [
    {
      number: "01",
      title: "Encrypt & Upload",
      description: "Suppliers upload invoices with face value and due date encrypted client-side via Zama SDK. Zero plaintext leaves the browser.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <polyline points="9 15 12 12 15 15" />
        </svg>
      )
    },
    {
      number: "02",
      title: "Onchain Credit Scoring",
      description: "ArbitraInvoiceRegistry computes the discount rate using FHE math on the supplier's encrypted repayment history. P = V * (1 - d * t) - fully onchain.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7B2FFF" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="9" y1="9" x2="15" y2="9" />
          <line x1="9" y1="13" x2="15" y2="13" />
          <line x1="9" y1="17" x2="15" y2="17" />
          <line x1="12" y1="9" x2="12" y2="17" />
        </svg>
      )
    },
    {
      number: "03",
      title: "Deterministic Risk Assessment",
      description: "Investors sign an EIP-712 message to decrypt a privacy-safe summary. Arbitra returns a deterministic risk score and recommendation from structured invoice and protocol signals.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="1.5">
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
          <path d="M12 6v6l4 2" />
        </svg>
      )
    },
    {
      number: "04",
      title: "Factor & Settle",
      description: "Investor sends USDC to the supplier at the computed purchase price. Both parties keep their data private.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7B2FFF" strokeWidth="1.5">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    }
  ];

  return (
    <section
      style={{
        padding: "100px 24px",
        position: "relative",
        zIndex: 2,
        maxWidth: "1100px",
        margin: "0 auto"
      }}
    >
      {/* Headings */}
      <div style={{ textAlign: "center", marginBottom: "70px" }}>
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
          Workflow
        </span>
        <h2
          style={{
            fontFamily: "Satoshi, sans-serif",
            fontSize: "clamp(32px, 4vw, 48px)",
            fontWeight: 800,
            color: "#EEF2FF",
            letterSpacing: "-0.02em",
            marginBottom: "16px"
          }}
        >
          How Arbitra Works
        </h2>
        <p
          style={{
            fontFamily: "Satoshi, sans-serif",
            fontSize: "16px",
            color: "#8B9CC8"
          }}
        >
          Four steps from invoice to liquidity - entirely onchain.
        </p>
      </div>

      {/* Steps Flow Grid */}
      <div
        className="flow-container"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "stretch",
          gap: "24px",
          position: "relative"
        }}
      >
        {steps.map((step, idx) => (
          <React.Fragment key={idx}>
            {/* Step Card */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: idx * 0.12, ease: [0.16, 1, 0.3, 1] }}
              style={{
                flex: 1,
                background: "rgba(10, 16, 38, 0.5)",
                border: "1px solid rgba(255, 255, 255, 0.05)",
                borderRadius: "20px",
                padding: "32px 24px",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                position: "relative"
              }}
            >
              {/* Top Row: Icon and Step badge */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {step.icon}
                </div>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    border: "1.5px solid #00F0FF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#00F0FF",
                    fontFamily: "JetBrains Mono, monospace"
                  }}
                >
                  {step.number}
                </div>
              </div>

              {/* Title */}
              <h3 style={{ fontFamily: "Satoshi, sans-serif", fontSize: "18px", fontWeight: 700, color: "#EEF2FF", marginBottom: "12px" }}>
                {step.title}
              </h3>

              {/* Description */}
              <p style={{ fontFamily: "Satoshi, sans-serif", fontSize: "14px", color: "#8B9CC8", lineHeight: 1.6 }}>
                {step.description}
              </p>
            </motion.div>

            {/* Connecting lines between cards */}
            {idx < steps.length - 1 && (
              <div
                className="connector-line"
                style={{
                  alignSelf: "center",
                  width: "40px",
                  height: "2px",
                  borderTop: "1.5px dashed rgba(0, 240, 255, 0.2)",
                  position: "relative",
                  display: "var(--desktop-connector-display, block)"
                }}
              >
                {/* Arrow */}
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "-4px",
                    width: "6px",
                    height: "6px",
                    borderTop: "1.5px solid rgba(0, 240, 255, 0.3)",
                    borderRight: "1.5px solid rgba(0, 240, 255, 0.3)",
                    transform: "rotate(45deg)"
                  }}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      <style>{`
        @media (max-width: 991px) {
          .flow-container {
            flex-direction: column !important;
            gap: 40px !important;
          }
          .connector-line {
            display: none !important;
          }
        }
      `}</style>
    </section>
  );
}
