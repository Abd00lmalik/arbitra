/*
 * @file InvoiceMiniCard.tsx
 * @description Compact preview card for blockchain invoices,
 *              redesigned for premium RWA aesthetics and info hierarchy.
 */

"use client";

import React, { useState } from "react";
import { FHEBadge } from "../ui/FHEBadge";
import { shortAddress, InvoiceStatus, daysUntilDue, type InvoiceOnChain } from "@/lib/contracts";

interface InvoiceMiniCardProps {
  invoice: InvoiceOnChain;
  onClick: () => void;
  isNew?: boolean;
  isSupplierView?: boolean;
}

export function InvoiceMiniCard({ invoice, onClick, isNew = false, isSupplierView = false }: InvoiceMiniCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const isFactored = invoice.status >= InvoiceStatus.Factored;
  const isRepaid = invoice.status === InvoiceStatus.Settled;
  const isDisputed = invoice.status === InvoiceStatus.Disputed;
  const isSlashed = invoice.status === InvoiceStatus.Slashed;

  /*
   * Helper: Derive an honest size tier from plaintext face value.
   * S = under $10k | M = $10k–$50k | L = $50k–$200k | XL = over $200k
   * Colour is based on tier, not a fake risk score.
   */
  const getSizeTier = (faceValuePlaintext: bigint) => {
    const usd = Number(faceValuePlaintext) / 1_000_000;
    if (usd < 10_000) {
      return { tier: "S", label: "Small Cap", color: "#00F0FF", shadow: "rgba(0, 240, 255, 0.15)" };
    }
    if (usd < 50_000) {
      return { tier: "M", label: "Mid Cap", color: "#A87FFF", shadow: "rgba(168, 127, 255, 0.15)" };
    }
    if (usd < 200_000) {
      return { tier: "L", label: "Large Cap", color: "#00FF88", shadow: "rgba(0, 255, 136, 0.15)" };
    }
    return { tier: "XL", label: "Inst. Cap", color: "#FFBA00", shadow: "rgba(255, 186, 0, 0.15)" };
  };

  const risk = getSizeTier(invoice.faceValuePlaintext);

  const getStatusBadge = () => {
    if (isRepaid) {
      return (
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: "6px",
            background: "rgba(0, 255, 136, 0.06)",
            color: "#00FF88",
            border: "1px solid rgba(0, 255, 136, 0.15)",
            fontFamily: "Satoshi, sans-serif"
          }}
        >
          ● Settled
        </span>
      );
    }
    if (isDisputed) {
      return (
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: "6px",
            background: "rgba(255, 45, 155, 0.06)",
            color: "#FF2D9B",
            border: "1px solid rgba(255, 45, 155, 0.15)",
            fontFamily: "Satoshi, sans-serif"
          }}
        >
          ● Disputed
        </span>
      );
    }
    if (isSlashed) {
      return (
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: "6px",
            background: "rgba(239, 68, 68, 0.06)",
            color: "#EF4444",
            border: "1px solid rgba(239, 68, 68, 0.15)",
            fontFamily: "Satoshi, sans-serif"
          }}
        >
          ● Slashed
        </span>
      );
    }
    if (isFactored) {
      if (isSupplierView) {
        return (
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: "6px",
              background: "rgba(0, 255, 136, 0.06)",
              color: "#00FF88",
              border: "1px solid rgba(0, 255, 136, 0.15)",
              fontFamily: "Satoshi, sans-serif",
              display: "inline-flex",
              alignItems: "center",
              gap: "3px"
            }}
          >
            💰 Advance Disbursed
          </span>
        );
      }
      return (
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: "6px",
            background: "rgba(168, 127, 255, 0.06)",
            color: "#A87FFF",
            border: "1px solid rgba(168, 127, 255, 0.15)",
            fontFamily: "Satoshi, sans-serif"
          }}
        >
          ● Factored
        </span>
      );
    }
    if (invoice.status === InvoiceStatus.Attested) {
      return (
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: "6px",
            background: "rgba(0, 240, 255, 0.06)",
            color: "#00F0FF",
            border: "1px solid rgba(0, 240, 255, 0.15)",
            fontFamily: "Satoshi, sans-serif"
          }}
        >
          ● Attested
        </span>
      );
    }
    return (
      <span
        style={{
          fontSize: "10px",
          fontWeight: 700,
          padding: "3px 8px",
          borderRadius: "6px",
          background: "rgba(255, 186, 0, 0.06)",
          color: "#FFBA00",
          border: "1px solid rgba(255, 186, 0, 0.15)",
          fontFamily: "Satoshi, sans-serif"
        }}
      >
        ● Pending
      </span>
    );
  };

  const daysLeft = daysUntilDue(invoice.maturityTimestamp);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        cursor: "pointer",
        borderRadius: "16px",
        background: "linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.01) 100%)",
        backdropFilter: "blur(20px)",
        border: isNew
          ? "1px solid rgba(0, 240, 255, 0.45)"
          : isHovered
          ? `1px solid ${risk.color}66`
          : "1px solid rgba(255, 255, 255, 0.06)",
        boxShadow: isNew
          ? "0 0 25px rgba(0, 240, 255, 0.2)"
          : isHovered
          ? `0 10px 30px ${risk.shadow}`
          : "0 4px 20px rgba(0, 0, 0, 0.25)",
        transform: isHovered ? "translateY(-5px)" : "translateY(0)",
        transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        position: "relative",
        overflow: "hidden",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      {/* Top Accent Gradient Line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "3px",
          background: isHovered
            ? `linear-gradient(90deg, ${risk.color}, #7B2FFF)`
            : "linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
          transition: "all 0.3s ease",
        }}
      />

      {/* Header Section: ID + Title + Status badges */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              padding: "2px 6px",
              borderRadius: "4px",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              color: "#EEF2FF",
              fontFamily: "JetBrains Mono, monospace"
            }}
          >
            #{invoice.invoiceId.toString()}
          </span>
          <span
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "#EEF2FF",
              fontFamily: "Satoshi, sans-serif"
            }}
          >
            Stable Invoice
          </span>
          {isNew && (
            <span
              style={{
                fontSize: "9px",
                fontWeight: 800,
                padding: "2px 6px",
                borderRadius: "4px",
                background: "rgba(0, 240, 255, 0.1)",
                color: "#00F0FF",
                border: "1px solid rgba(0, 240, 255, 0.2)",
                fontFamily: "Satoshi, sans-serif"
              }}
            >
              NEW
            </span>
          )}
        </div>
        {getStatusBadge()}
      </div>

      {/* Main Metrics Area: Risk, Yield, Maturity */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid rgba(255, 255, 255, 0.04)",
          borderRadius: "10px",
          padding: "10px 8px",
          gap: "4px",
          textAlign: "center"
        }}
      >
        {/* Size Tier */}
        <div style={{ display: "flex", flexDirection: "column", gap: "3px", borderRight: "1px solid rgba(255, 255, 255, 0.04)" }}>
          <span style={{ fontSize: "9px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Size Tier
          </span>
          <span style={{ fontSize: "14px", fontWeight: 800, color: risk.color }}>
            {risk.tier}
          </span>
        </div>

        {/* Yield — encrypted until investor decrypts */}
        <div style={{ display: "flex", flexDirection: "column", gap: "3px", borderRight: "1px solid rgba(255, 255, 255, 0.04)" }}>
          <span style={{ fontSize: "9px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Yield
          </span>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#00F0FF", fontFamily: "JetBrains Mono, monospace", display: "flex", alignItems: "center", gap: "3px" }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Decrypt
          </span>
        </div>

        {/* Maturity */}
        <div style={{ display: "flex", flexDirection: "column", gap: "3px", justifySelf: "center", alignItems: "center" }}>
          <span style={{ fontSize: "9px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Maturity
          </span>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "2px" }}>
            {/* Calendar SVG */}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span style={{ fontSize: "12px", fontWeight: 700, color: isRepaid ? "#00FF88" : "#EEF2FF" }}>
              {isRepaid ? "Paid" : `${daysLeft}d`}
            </span>
          </div>
        </div>
      </div>

      {/* Parties Section: Supplier & Buyer (Short Addresses) */}
      <div
        style={{
          fontSize: "11px",
          display: "flex",
          flexDirection: "column",
          gap: "5px",
          color: "#8B9CC8",
          textAlign: "left",
          borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
          paddingBottom: "10px"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {/* Supplier Wallet Icon */}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5">
              <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            Supplier:
          </span>
          <span style={{ fontFamily: "JetBrains Mono, monospace", color: "#EEF2FF" }}>
            {shortAddress(invoice.supplier)}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {/* Buyer Building Icon */}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5">
              <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
              <line x1="9" y1="22" x2="9" y2="16" />
              <line x1="15" y1="22" x2="15" y2="16" />
              <line x1="9" y1="16" x2="15" y2="16" />
            </svg>
            Buyer (Debtor):
          </span>
          <span style={{ fontFamily: "JetBrains Mono, monospace", color: "#EEF2FF" }}>
            {shortAddress(invoice.debtor)}
          </span>
        </div>
      </div>

      {/* Trust Indicators: SHIELDED + FHE Protected Badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "#00F0FF",
              fontFamily: "JetBrains Mono, monospace",
              background: "rgba(0, 240, 255, 0.05)",
              border: "1px solid rgba(0, 240, 255, 0.15)",
              padding: "2px 6px",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              gap: "3px"
            }}
          >
            {/* Lock Icon */}
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            SHIELDED
          </span>
          <span
            style={{
              fontSize: "9px",
              fontWeight: 600,
              color: "#8B9CC8",
              fontFamily: "Satoshi, sans-serif"
            }}
          >
            FHE Protected
          </span>
        </div>
        <FHEBadge size="sm" animated={isHovered} label="" />
      </div>

      {/* Action Button: View Details & Risk */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "11px",
          color: isHovered ? "#FFFFFF" : "#00F0FF",
          background: isHovered ? "rgba(0, 240, 255, 0.15)" : "rgba(255, 255, 255, 0.02)",
          border: isHovered ? "1px solid rgba(0, 240, 255, 0.45)" : "1px solid rgba(255, 255, 255, 0.05)",
          borderRadius: "8px",
          padding: "8px",
          fontWeight: 700,
          fontFamily: "Satoshi, sans-serif",
          gap: "4px",
          transition: "all 0.2s ease",
          marginTop: "2px"
        }}
      >
        <span>View Details & Risk</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          style={{
            transform: isHovered ? "translateX(2px)" : "translateX(0)",
            transition: "transform 0.2s ease"
          }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </div>
  );
}
