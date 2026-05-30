"use client";

import React from "react";

export function FaucetLinks() {
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      <a
        href="https://faucet.circle.com/"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "7px",
          background: "rgba(0, 240, 255, 0.08)",
          border: "1px solid rgba(0, 240, 255, 0.25)",
          borderRadius: "10px",
          padding: "9px 16px",
          color: "#00F0FF",
          fontSize: "12px",
          fontWeight: 600,
          fontFamily: "Satoshi, sans-serif",
          textDecoration: "none",
          whiteSpace: "nowrap",
          transition: "background 0.2s"
        }}
      >
        <DropletIcon size={13} />
        Get Test USDC (Circle Faucet) ↗
      </a>
      <a
        href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "7px",
          background: "rgba(255, 255, 255, 0.04)",
          border: "1px solid rgba(255, 255, 255, 0.10)",
          borderRadius: "10px",
          padding: "9px 16px",
          color: "#8B9CC8",
          fontSize: "12px",
          fontWeight: 600,
          fontFamily: "Satoshi, sans-serif",
          textDecoration: "none",
          whiteSpace: "nowrap",
          transition: "background 0.2s"
        }}
      >
        <GasIcon size={13} />
        Get Sepolia ETH (Gas) ↗
      </a>
    </div>
  );
}

function DropletIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
  );
}

function GasIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 22V9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v13" />
      <path d="M3 22h12M13 9l5 5-5 5" />
      <path d="M18 14h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1" />
    </svg>
  );
}
