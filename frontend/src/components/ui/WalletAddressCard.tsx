"use client";

/**
 * @file WalletAddressCard.tsx
 * @description Displays the active Sepolia wallet, gas balance, copy action, and faucet links.
 */

import React, { useMemo, useState } from "react";
import { useAccount, useBalance } from "wagmi";
import { formatEther } from "viem";
import { GlassCard } from "@/components/ui/GlassCard";

interface WalletAddressCardProps {
  walletAddress?: `0x${string}` | null;
}

const FAUCETS = [
  {
    label: "Google Sepolia ETH",
    href: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia",
  },
  {
    label: "Alchemy Sepolia ETH",
    href: "https://www.alchemy.com/faucets/ethereum-sepolia",
  },
  {
    label: "Circle USDC Faucet",
    href: "https://faucet.circle.com/",
  },
] as const;

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletAddressCard({ walletAddress }: WalletAddressCardProps) {
  const { address, isConnected } = useAccount();
  const [copied, setCopied] = useState(false);
  const resolvedAddress = walletAddress ?? (isConnected ? address : undefined);
  const { data: balance } = useBalance({
    address: resolvedAddress,
    chainId: 11155111,
    query: { enabled: !!resolvedAddress },
  });

  const ethBalance = useMemo(() => {
    if (!balance?.value) return "0.0000";
    return Number(formatEther(balance.value)).toFixed(4);
  }, [balance?.value]);

  if (!resolvedAddress) return null;

  const copyAddress = async () => {
    await navigator.clipboard.writeText(resolvedAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <GlassCard className="p-5" glow="cyan">
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#00F0FF", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Sepolia embedded wallet
            </div>
            <div style={{ color: "#EEF2FF", fontSize: 18, fontWeight: 800, marginTop: 7, fontFamily: "JetBrains Mono, monospace" }}>
              {shortAddress(resolvedAddress)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#8B9CC8", fontSize: 11, fontWeight: 700 }}>Gas balance</div>
            <div style={{ color: "#00FF88", fontSize: 18, fontWeight: 800, marginTop: 5 }}>
              {ethBalance} ETH
            </div>
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.035)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            padding: "12px 14px",
            color: "#8B9CC8",
            fontSize: 12,
            fontFamily: "JetBrains Mono, monospace",
            wordBreak: "break-all",
          }}
        >
          {resolvedAddress}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={copyAddress}
            style={{
              border: "1px solid rgba(0,240,255,0.25)",
              background: "rgba(0,240,255,0.08)",
              color: "#00F0FF",
              borderRadius: 11,
              padding: "9px 13px",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {copied ? "Copied" : "Copy address"}
          </button>
          <a
            href={`https://sepolia.etherscan.io/address/${resolvedAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.04)",
              color: "#8B9CC8",
              borderRadius: 11,
              padding: "9px 13px",
              fontSize: 12,
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            View on Etherscan
          </a>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ color: "#8B9CC8", fontSize: 12, lineHeight: 1.6 }}>
            Fund this wallet with Sepolia ETH for gas and Sepolia USDC for collateral/factoring tests.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {FAUCETS.map((faucet) => (
              <a
                key={faucet.href}
                href={faucet.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#EEF2FF",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 10,
                  padding: "8px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                {faucet.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
