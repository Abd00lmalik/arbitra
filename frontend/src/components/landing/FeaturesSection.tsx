/**
 * @file FeaturesSection.tsx
 * @description Renders the core feature cards displaying key confidential factoring benefits.
 */

"use client";

import React from "react";
import { motion } from "framer-motion";
import { InvoiceIllustration } from "./InvoiceIllustration";
import { LockVaultIllustration } from "./LockVaultIllustration";
import { DataFlowIllustration } from "./DataFlowIllustration";

interface FeatureCardProps {
  illustration: React.ReactNode;
  title: string;
  description: string;
  accentColor: string;
  shadowColor: string;
}

function FeatureCard({ illustration, title, description, accentColor, shadowColor }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{
        y: -4,
        borderColor: accentColor,
        boxShadow: `0 0 40px ${shadowColor}`
      }}
      style={{
        background: "rgba(10, 16, 38, 0.85)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255, 255, 255, 0.07)",
        borderRadius: "24px",
        padding: "32px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        cursor: "pointer",
        transition: "border-color 0.3s, box-shadow 0.3s"
      }}
    >
      <div style={{ alignSelf: "center", marginBottom: "24px", transition: "transform 0.3s" }}>
        {illustration}
      </div>
      <h3
        style={{
          fontFamily: "Satoshi, sans-serif",
          fontSize: "22px",
          fontWeight: 700,
          color: "#EEF2FF",
          marginBottom: "12px"
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontFamily: "Satoshi, sans-serif",
          fontSize: "15px",
          fontWeight: 400,
          color: "#8B9CC8",
          lineHeight: 1.7,
          marginBottom: "24px"
        }}
      >
        {description}
      </p>
      <span
        style={{
          fontFamily: "Satoshi, sans-serif",
          fontSize: "14px",
          fontWeight: 500,
          color: "#00F0FF",
          marginTop: "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: "4px"
        }}
      >
        Learn more
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M3 8h10M8 3l5 5-5 5" stroke="#00F0FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    </motion.div>
  );
}

export function FeaturesSection() {
  const cards = [
    {
      illustration: <InvoiceIllustration />,
      title: "FHE-Encrypted Invoices",
      description: "Supplier face values, payment dates, and metadata are client-side encrypted via Zama SDK before storage. All onchain details are strictly kept private as ciphertexts.",
      accentColor: "rgba(0, 240, 255, 0.25)",
      shadowColor: "rgba(0, 240, 255, 0.12)"
    },
    {
      illustration: <LockVaultIllustration />,
      title: "Deterministic Risk Review",
      description: "Structured invoice fields and privacy-preserving contract data feed a deterministic underwriting model. Investors get a stable recommendation without external inference APIs in the financial core.",
      accentColor: "rgba(123, 47, 255, 0.25)",
      shadowColor: "rgba(123, 47, 255, 0.12)"
    },
    {
      illustration: <DataFlowIllustration />,
      title: "On-Chain Credit Scoring",
      description: "The registry computes interest discounts using homomorphic arithmetic on the supplier's private repayment history. No oracles are required, preserving mathematical integrity.",
      accentColor: "rgba(0, 255, 136, 0.25)",
      shadowColor: "rgba(0, 255, 136, 0.12)"
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
      <div style={{ textAlign: "center", marginBottom: "60px" }}>
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
          Key Capabilities
        </span>
        <h2
          style={{
            fontFamily: "Satoshi, sans-serif",
            fontSize: "clamp(32px, 4vw, 48px)",
            fontWeight: 800,
            color: "#EEF2FF",
            letterSpacing: "-0.02em"
          }}
        >
          Confidentiality Meets Capital.
        </h2>
      </div>

      <div
        className="features-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "32px"
        }}
      >
        {cards.map((card, idx) => (
          <FeatureCard
            key={idx}
            illustration={card.illustration}
            title={card.title}
            description={card.description}
            accentColor={card.accentColor}
            shadowColor={card.shadowColor}
          />
        ))}
      </div>
    </section>
  );
}
