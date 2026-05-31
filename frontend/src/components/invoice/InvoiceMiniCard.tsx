/*
 * @file InvoiceMiniCard.tsx
 * @description Compact preview card for blockchain invoices,
 *              providing status badges, shortened addresses, and click triggers.
 */

"use client";

import React from "react";
import { GlassCard } from "../ui/GlassCard";
import { FHEBadge } from "../ui/FHEBadge";
import { shortAddress, InvoiceStatus, type InvoiceOnChain } from "@/lib/contracts";

interface InvoiceMiniCardProps {
  invoice: InvoiceOnChain;
  onClick: () => void;
}

export function InvoiceMiniCard({ invoice, onClick }: InvoiceMiniCardProps) {
  const isFactored = invoice.status >= InvoiceStatus.Factored;
  const isRepaid = invoice.status === InvoiceStatus.Settled;
  const isDisputed = invoice.status === InvoiceStatus.Disputed;

  const getStatusBadge = () => {
    if (isRepaid) {
      return (
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: "8px",
            background: "rgba(0, 255, 136, 0.08)",
            color: "#00FF88",
            border: "1px solid rgba(0, 255, 136, 0.15)"
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
            borderRadius: "8px",
            background: "rgba(255, 0, 120, 0.08)",
            color: "#FF0078",
            border: "1px solid rgba(255, 0, 120, 0.15)"
          }}
        >
          ● Disputed
        </span>
      );
    }
    if (isFactored) {
      return (
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: "8px",
            background: "rgba(123, 47, 255, 0.08)",
            color: "#A87FFF",
            border: "1px solid rgba(123, 47, 255, 0.15)"
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
            borderRadius: "8px",
            background: "rgba(0, 240, 255, 0.08)",
            color: "#00F0FF",
            border: "1px solid rgba(0, 240, 255, 0.15)"
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
          borderRadius: "8px",
          background: "rgba(254, 240, 138, 0.08)",
          color: "#EAB308",
          border: "1px solid rgba(254, 240, 138, 0.15)"
        }}
      >
        ● Pending
      </span>
    );
  };

  return (
    <div onClick={onClick} style={{ cursor: "pointer" }}>
      <GlassCard className="p-4 flex flex-col gap-3.5 transition-all duration-200" hover glow="cyan">
        /* Header row */
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "6px",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "11px",
                fontWeight: 700,
                color: "#EEF2FF",
                fontFamily: "JetBrains Mono, monospace"
              }}
            >
              #{invoice.invoiceId.toString()}
            </span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#EEF2FF", fontFamily: "Satoshi, sans-serif" }}>
              Stable Invoice
            </span>
          </div>
          {getStatusBadge()}
        </div>

        /* Short address stats */
        <div style={{ fontSize: "11px", display: "flex", flexDirection: "column", gap: "6px", color: "#8B9CC8", textAlign: "left" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Supplier:</span>
            <span style={{ fontFamily: "JetBrains Mono, monospace", color: "#EEF2FF" }}>
              {shortAddress(invoice.supplier)}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Buyer (Debtor):</span>
            <span style={{ fontFamily: "JetBrains Mono, monospace", color: "#EEF2FF" }}>
              {shortAddress(invoice.debtor)}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Parameters:</span>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ fontFamily: "JetBrains Mono, monospace", color: "#00F0FF", letterSpacing: "1px" }}>🔒 SHIELDED</span>
              <FHEBadge size="sm" animated={false} label="" />
            </div>
          </div>
        </div>

        /* Action link */
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            fontSize: "10px",
            color: "#00F0FF",
            fontWeight: 700,
            fontFamily: "Satoshi, sans-serif",
            marginTop: "2px",
            gap: "2px"
          }}
        >
          <span>View Details & Risk</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </GlassCard>
    </div>
  );
}
