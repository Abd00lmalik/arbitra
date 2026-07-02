/**
 * @file PhoneMockup.tsx
 * @description App-faithful mobile preview showing selective disclosure across supplier and investor flows.
 */

"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Store, ShieldCheck, WalletCards, CheckCircle2 } from "lucide-react";

interface ScreenState {
  key: string;
  label: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  rows: Array<{ label: string; value: string; tone?: string }>;
  cta: string;
}

const screens: ScreenState[] = [
  {
    key: "upload",
    label: "Upload",
    title: "Upload Invoice",
    subtitle: "Parser creates encrypted protocol inputs.",
    icon: <Upload size={14} />,
    rows: [
      { label: "PDF", value: "INV-2025-0301.pdf" },
      { label: "Face value", value: "Encrypted handle", tone: "#00F0FF" },
      { label: "Due date", value: "Encrypted handle", tone: "#00F0FF" },
      { label: "Collateral", value: "Staked", tone: "#00FF88" }
    ],
    cta: "Submit encrypted invoice"
  },
  {
    key: "market",
    label: "Marketplace",
    title: "Marketplace",
    subtitle: "Pre-ACL cards show coordination data only.",
    icon: <Store size={14} />,
    rows: [
      { label: "Supplier", value: "Verified", tone: "#00FF88" },
      { label: "Industry", value: "Services" },
      { label: "Maturity", value: "30 day bucket" },
      { label: "Economics", value: "Request access", tone: "#00F0FF" }
    ],
    cta: "Request FHE access"
  },
  {
    key: "review",
    label: "Review",
    title: "Investor Review",
    subtitle: "Authorized wallet decrypts final outputs.",
    icon: <ShieldCheck size={14} />,
    rows: [
      { label: "Face value", value: "Decrypted by ACL", tone: "#EEF2FF" },
      { label: "Purchase price", value: "Decrypted by ACL", tone: "#EEF2FF" },
      { label: "FHE risk score", value: "53 / 100", tone: "#FFBA00" },
      { label: "Raw history", value: "Not disclosed", tone: "#00F0FF" }
    ],
    cta: "Deploy capital"
  },
  {
    key: "settlement",
    label: "Settlement",
    title: "Settlement Adapter",
    subtitle: "Clear amount exists only at the rail boundary.",
    icon: <WalletCards size={14} />,
    rows: [
      { label: "Reference", value: "hash commitment" },
      { label: "Bank trace", value: "hash commitment" },
      { label: "Ledger", value: "Encrypted balance", tone: "#00F0FF" },
      { label: "USDC", value: "Transfer executed", tone: "#00FF88" }
    ],
    cta: "Settlement recorded"
  }
];

export function PhoneMockup() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = screens[activeIndex];

  return (
    <section
      style={{
        padding: "100px 24px",
        position: "relative",
        zIndex: 2,
        overflow: "hidden"
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto", textAlign: "center" }}>
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
          Real Product Flow
        </span>
        <h2
          style={{
            fontFamily: "Satoshi, sans-serif",
            fontSize: "clamp(32px, 4vw, 48px)",
            fontWeight: 800,
            marginBottom: "16px",
            color: "#EEF2FF"
          }}
        >
          Mobile screens that mirror the app.
        </h2>
        <p
          style={{
            fontFamily: "Satoshi, sans-serif",
            fontSize: "17px",
            color: "#8B9CC8",
            maxWidth: "650px",
            margin: "0 auto 44px",
            lineHeight: 1.75
          }}
        >
          The preview follows the same supplier upload, marketplace, investor review, and settlement states used in the live interface.
        </p>

        <div className="mobile-demo-wrap">
          <div className="screen-tabs">
            {screens.map((screen, idx) => (
              <button
                key={screen.key}
                onClick={() => setActiveIndex(idx)}
                className={idx === activeIndex ? "active" : ""}
              >
                {screen.label}
              </button>
            ))}
          </div>

          <div className="phone-shell">
            <div className="phone-island" />
            <AnimatePresence mode="wait">
              <motion.div
                key={active.key}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.24 }}
                className="phone-screen"
              >
                <div className="phone-top">
                  <div className="phone-logo">
                    {active.icon}
                  </div>
                  <div>
                    <h3>{active.title}</h3>
                    <p>{active.subtitle}</p>
                  </div>
                </div>

                <div className="fhe-chip">
                  <span />
                  Zama FHEVM active
                </div>

                <div className="invoice-panel">
                  <div className="invoice-head">
                    <span>Invoice #5</span>
                    <strong>{active.key === "market" ? "Public Preview" : "Authorized Flow"}</strong>
                  </div>
                  {active.rows.map((row) => (
                    <div className="invoice-row" key={row.label}>
                      <span>{row.label}</span>
                      <strong style={{ color: row.tone || "#EEF2FF" }}>{row.value}</strong>
                    </div>
                  ))}
                </div>

                <div className="underwriting-card">
                  <div>
                    <span>Confidential underwriting</span>
                    <strong>{active.key === "review" ? "Final result decrypted" : "Raw inputs hidden"}</strong>
                  </div>
                  {active.key === "review" ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}
                </div>

                <button className="phone-cta">{active.cta}</button>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <style>{`
        .mobile-demo-wrap {
          display: grid;
          grid-template-columns: 220px 340px;
          justify-content: center;
          align-items: center;
          gap: 34px;
        }
        .screen-tabs {
          display: grid;
          gap: 10px;
        }
        .screen-tabs button {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(10, 16, 38, 0.62);
          color: #8B9CC8;
          border-radius: 12px;
          padding: 12px 14px;
          text-align: left;
          font-family: Satoshi, sans-serif;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
        }
        .screen-tabs button.active {
          color: #00F0FF;
          border-color: rgba(0, 240, 255, 0.38);
          background: rgba(0, 240, 255, 0.08);
        }
        .phone-shell {
          width: 320px;
          height: 640px;
          border-radius: 42px;
          background: #020714;
          border: 10px solid #1E2330;
          box-shadow: 0 25px 55px rgba(0, 0, 0, 0.5), 0 0 42px rgba(0, 240, 255, 0.14);
          position: relative;
          overflow: hidden;
        }
        .phone-island {
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          width: 88px;
          height: 22px;
          border-radius: 999px;
          background: #000;
          z-index: 5;
        }
        .phone-screen {
          height: 100%;
          padding: 44px 16px 16px;
          background: linear-gradient(180deg, #060B18, #020714);
          display: flex;
          flex-direction: column;
          gap: 14px;
          text-align: left;
        }
        .phone-top {
          display: flex;
          gap: 10px;
          align-items: center;
          padding-top: 8px;
        }
        .phone-logo {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 240, 255, 0.1);
          color: #00F0FF;
          border: 1px solid rgba(0, 240, 255, 0.22);
        }
        .phone-top h3 {
          color: #EEF2FF;
          font-family: Satoshi, sans-serif;
          font-size: 16px;
          font-weight: 900;
          margin: 0 0 2px;
        }
        .phone-top p {
          color: #8B9CC8;
          font-family: Satoshi, sans-serif;
          font-size: 10px;
          margin: 0;
        }
        .fhe-chip {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border-radius: 10px;
          border: 1px solid rgba(0, 240, 255, 0.16);
          background: rgba(0, 240, 255, 0.06);
          color: #00F0FF;
          font-family: JetBrains Mono, monospace;
          font-size: 9px;
          font-weight: 800;
          padding: 8px;
        }
        .fhe-chip span {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #00FF88;
        }
        .invoice-panel {
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.025);
          padding: 12px;
          display: grid;
          gap: 10px;
        }
        .invoice-head,
        .invoice-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .invoice-head span {
          color: #EEF2FF;
          font-family: Satoshi, sans-serif;
          font-size: 12px;
          font-weight: 900;
        }
        .invoice-head strong {
          color: #00F0FF;
          font-family: JetBrains Mono, monospace;
          font-size: 8px;
          text-transform: uppercase;
        }
        .invoice-row {
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 9px;
        }
        .invoice-row span {
          color: #8B9CC8;
          font-family: Satoshi, sans-serif;
          font-size: 10px;
        }
        .invoice-row strong {
          font-family: JetBrains Mono, monospace;
          font-size: 10px;
          text-align: right;
        }
        .underwriting-card {
          margin-top: auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-radius: 14px;
          border: 1px solid rgba(123, 47, 255, 0.22);
          background: rgba(123, 47, 255, 0.08);
          padding: 12px;
          color: #A87FFF;
        }
        .underwriting-card span {
          display: block;
          color: #8B9CC8;
          font-size: 9px;
          font-family: Satoshi, sans-serif;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .underwriting-card strong {
          display: block;
          color: #EEF2FF;
          font-size: 12px;
          margin-top: 3px;
          font-family: Satoshi, sans-serif;
        }
        .phone-cta {
          border: 1px solid rgba(0, 240, 255, 0.28);
          border-radius: 12px;
          color: #020714;
          background: linear-gradient(135deg, #00F0FF, #00FF88);
          font-family: Satoshi, sans-serif;
          font-size: 12px;
          font-weight: 900;
          padding: 11px;
        }
        @media (max-width: 760px) {
          .mobile-demo-wrap {
            grid-template-columns: 1fr;
            gap: 22px;
          }
          .screen-tabs {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            max-width: 340px;
            margin: 0 auto;
          }
          .phone-shell {
            margin: 0 auto;
            width: min(320px, calc(100vw - 48px));
          }
        }
      `}</style>
    </section>
  );
}
