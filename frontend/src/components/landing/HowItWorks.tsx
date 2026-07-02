/**
 * @file HowItWorks.tsx
 * @description Interactive lifecycle showing Arbitra's confidential protocol and integration boundary.
 */

"use client";

import React from "react";
import { motion } from "framer-motion";

interface StageItem {
  title: string;
  data: string;
  primitive: string;
  reason: string;
}

interface PrimitiveItem {
  data: string;
  primitive: string;
  reason: string;
}

const lifecycleStages: StageItem[] = [
  {
    title: "Supplier Upload",
    data: "Invoice PDF and supplier-entered business context.",
    primitive: "AES plus client controls",
    reason: "Documents need private storage, not homomorphic computation."
  },
  {
    title: "Parser",
    data: "Invoice number, debtor email, amount, due date, and fingerprint inputs.",
    primitive: "Deterministic parser",
    reason: "Parsing must be reproducible before confidential state is created."
  },
  {
    title: "Encrypted Invoice",
    data: "Face value, due date, fingerprint, and pricing inputs.",
    primitive: "Zama FHEVM",
    reason: "The protocol needs to compute on values without revealing them."
  },
  {
    title: "FHE Pricing",
    data: "Encrypted invoice value, encrypted discount, and encrypted purchase price.",
    primitive: "Zama FHEVM",
    reason: "Purchase economics are commercially sensitive but still need on-chain math."
  },
  {
    title: "FHE Underwriting",
    data: "Encrypted repayment ratio, defaults, tenor, value, and reputation.",
    primitive: "Zama FHEVM",
    reason: "Investors should receive only the final result, not raw supplier history."
  },
  {
    title: "ACL Approval",
    data: "Investor SBT status and encrypted handle permissions.",
    primitive: "FHEVM ACL",
    reason: "Selective disclosure is granted to a verified wallet, not to the public."
  },
  {
    title: "Authorized Decryption",
    data: "Final terms and final underwriting score.",
    primitive: "User decrypt",
    reason: "Only the approved investor decrypts the decision output."
  },
  {
    title: "Settlement Adapter",
    data: "Payment reference commitments and bank rail proof material.",
    primitive: "Hashes and signatures",
    reason: "External rails need auditability and authorization, not FHE arithmetic."
  },
  {
    title: "USDC Transfer",
    data: "Execution amount needed by standard ERC-20 settlement.",
    primitive: "Plaintext boundary",
    reason: "ERC-20 transfer execution requires a clear amount in this version."
  }
];

const primitiveRows: PrimitiveItem[] = [
  {
    data: "Invoice value",
    primitive: "FHE",
    reason: "Used for confidential pricing and underwriting math."
  },
  {
    data: "Risk score",
    primitive: "FHE",
    reason: "Computed from private inputs and revealed only after ACL approval."
  },
  {
    data: "Invoice PDF",
    primitive: "AES storage encryption",
    reason: "The file needs private storage, not on-chain computation."
  },
  {
    data: "Payment reference",
    primitive: "Hash commitment",
    reason: "Auditors need integrity without leaking banking metadata."
  },
  {
    data: "KYB approval",
    primitive: "Signature",
    reason: "The platform attests authorization; no hidden arithmetic is needed."
  },
  {
    data: "Invoice status",
    primitive: "Plaintext",
    reason: "Public coordination state helps suppliers and investors track workflow."
  }
];

export function HowItWorks() {
  return (
    <section
      style={{
        padding: "100px 24px",
        position: "relative",
        zIndex: 2,
        maxWidth: "1180px",
        margin: "0 auto"
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "58px" }}>
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
          Confidential Architecture
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
          Two Domains, One Confidential Source Of Truth.
        </h2>
        <p
          style={{
            fontFamily: "Satoshi, sans-serif",
            fontSize: "16px",
            color: "#8B9CC8",
            maxWidth: "760px",
            margin: "0 auto",
            lineHeight: 1.7
          }}
        >
          Arbitra keeps protocol economics encrypted through pricing and underwriting, then decrypts only at explicit authorization or integration boundaries.
        </p>
      </div>

      <div className="lifecycle-grid">
        {lifecycleStages.map((stage, idx) => (
          <motion.div
            key={stage.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -5, borderColor: "rgba(0, 240, 255, 0.35)" }}
            className="lifecycle-card"
          >
            <div className="lifecycle-index">{String(idx + 1).padStart(2, "0")}</div>
            <h3>{stage.title}</h3>
            <p>{stage.data}</p>
            <div className="lifecycle-hover">
              <span>{stage.primitive}</span>
              <p>{stage.reason}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="primitive-panel">
        <div>
          <span className="primitive-kicker">Why this primitive?</span>
          <h3>FHE where computation matters. Simpler cryptography everywhere else.</h3>
        </div>
        <div className="primitive-table">
          {primitiveRows.map((row) => (
            <div className="primitive-row" key={row.data}>
              <span>{row.data}</span>
              <strong>{row.primitive}</strong>
              <p>{row.reason}</p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .lifecycle-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }
        .lifecycle-card {
          min-height: 196px;
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 16px;
          padding: 22px;
          background:
            linear-gradient(135deg, rgba(10, 16, 38, 0.84), rgba(3, 8, 22, 0.72)),
            radial-gradient(circle at 20% 0%, rgba(0, 240, 255, 0.08), transparent 35%);
          transition: border-color 0.25s ease, transform 0.25s ease;
        }
        .lifecycle-card h3 {
          margin: 18px 0 10px;
          color: #EEF2FF;
          font-family: Satoshi, sans-serif;
          font-size: 17px;
          font-weight: 800;
        }
        .lifecycle-card p {
          margin: 0;
          color: #8B9CC8;
          font-family: Satoshi, sans-serif;
          font-size: 13px;
          line-height: 1.55;
        }
        .lifecycle-index {
          width: 38px;
          height: 38px;
          border-radius: 999px;
          border: 1px solid rgba(0, 240, 255, 0.28);
          color: #00F0FF;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: JetBrains Mono, monospace;
          font-size: 12px;
          font-weight: 800;
          background: rgba(0, 240, 255, 0.06);
        }
        .lifecycle-hover {
          position: absolute;
          inset: auto 14px 14px;
          border-radius: 12px;
          border: 1px solid rgba(0, 240, 255, 0.16);
          background: rgba(2, 7, 20, 0.9);
          padding: 12px;
          opacity: 0;
          transform: translateY(10px);
          transition: opacity 0.2s ease, transform 0.2s ease;
        }
        .lifecycle-card:hover .lifecycle-hover {
          opacity: 1;
          transform: translateY(0);
        }
        .lifecycle-hover span {
          display: block;
          color: #00F0FF;
          font-family: JetBrains Mono, monospace;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          margin-bottom: 5px;
        }
        .primitive-panel {
          margin-top: 26px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          padding: 26px;
          background: rgba(10, 16, 38, 0.62);
        }
        .primitive-kicker {
          color: #00F0FF;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-family: Satoshi, sans-serif;
          font-size: 11px;
          font-weight: 800;
        }
        .primitive-panel h3 {
          color: #EEF2FF;
          margin: 8px 0 22px;
          font-family: Satoshi, sans-serif;
          font-size: clamp(22px, 3vw, 30px);
          font-weight: 800;
        }
        .primitive-table {
          display: grid;
          gap: 10px;
        }
        .primitive-row {
          display: grid;
          grid-template-columns: 1fr 0.9fr 2fr;
          gap: 14px;
          align-items: center;
          padding: 13px 14px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid rgba(255, 255, 255, 0.05);
          font-family: Satoshi, sans-serif;
        }
        .primitive-row span {
          color: #EEF2FF;
          font-size: 13px;
          font-weight: 700;
        }
        .primitive-row strong {
          color: #00F0FF;
          font-size: 12px;
          font-family: JetBrains Mono, monospace;
        }
        .primitive-row p {
          margin: 0;
          color: #8B9CC8;
          font-size: 13px;
          line-height: 1.45;
        }
        @media (max-width: 991px) {
          .lifecycle-grid {
            grid-template-columns: 1fr;
          }
          .lifecycle-card {
            min-height: 174px;
          }
          .lifecycle-hover {
            position: static;
            opacity: 1;
            transform: none;
            margin-top: 14px;
          }
          .primitive-row {
            grid-template-columns: 1fr;
            gap: 6px;
          }
        }
      `}</style>
    </section>
  );
}
