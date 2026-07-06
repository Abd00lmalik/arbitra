/*
 * @file WalletPanel.tsx
 * @description Expanded wallet panel shown in the Sidebar when connected.
 *              Displays ETH, USDC, and cUSDC balances with shared confidential
 *              token actions powered by the new Zama Token SDK.
 */

"use client";

import React, { useMemo, useState } from "react";
import { formatEther } from "viem";
import { fromMicro, shortAddress } from "@/lib/contracts";
import { useConfidentialWallet } from "@/hooks/useConfidentialWallet";

interface WalletPanelProps {
  address: string;
  onDisconnect: () => void;
}

function parseAmount(value: string): bigint | null {
  const normalized = Number.parseFloat(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }

  return BigInt(Math.round(normalized * 1_000_000));
}

function balanceText(kind: ReturnType<typeof useConfidentialWallet>["balanceState"]) {
  if (kind.kind === "ready" || kind.kind === "zero_balance") {
    return `${fromMicro(kind.balance)} cUSDC`;
  }

  if (kind.kind === "loading") {
    return "Decrypting...";
  }

  if (kind.kind === "needs_permit") {
    return "Unlock to decrypt";
  }

  if (kind.kind === "never_shielded") {
    return "Not yet shielded";
  }

  return "Unavailable";
}

export function WalletPanel({ address, onDisconnect }: WalletPanelProps) {
  const wallet = useConfidentialWallet(address as `0x${string}`);
  const [shieldAmount, setShieldAmount] = useState("");
  const [unshieldAmount, setUnshieldAmount] = useState("");

  const ethFormatted = useMemo(() => {
    if (wallet.ethBalance === undefined) {
      return "-";
    }

    return Number.parseFloat(formatEther(wallet.ethBalance)).toFixed(4);
  }, [wallet.ethBalance]);

  const usdcFormatted = useMemo(() => {
    if (wallet.usdcBalance === undefined) {
      return "-";
    }

    return fromMicro(wallet.usdcBalance);
  }, [wallet.usdcBalance]);

  const canTransactConfidentially =
    wallet.balanceState.kind === "ready" ||
    wallet.balanceState.kind === "zero_balance" ||
    wallet.balanceState.kind === "never_shielded" ||
    wallet.balanceState.kind === "needs_permit";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #00F0FF30, #7B2FFF30)" }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="text-xs font-mono text-slate-300 truncate">{shortAddress(address)}</div>
            <div className="text-[10px] text-slate-600">Connected | Sepolia</div>
          </div>
        </div>
        <button
          onClick={onDisconnect}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Disconnect
        </button>
      </div>

      <div
        className="rounded-xl p-3 space-y-1.5"
        style={{ background: "rgba(0,240,255,0.04)", border: "1px solid rgba(0,240,255,0.08)" }}
      >
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500">ETH</span>
          <span className="font-mono text-slate-300">{ethFormatted} ETH</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500">USDC</span>
          <span className="font-mono text-slate-300">${usdcFormatted}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500">cUSDC</span>
          <span className="font-mono" style={{ color: "#00F0FF" }}>
            {balanceText(wallet.balanceState)}
          </span>
        </div>
      </div>

      {wallet.balanceState.kind === "needs_permit" && (
        <button
          onClick={() => {
            void wallet.grantPermit();
          }}
          className="neon-btn-secondary w-full text-xs py-1.5 rounded-lg"
        >
          Unlock cUSDC balance
        </button>
      )}

      {(wallet.balanceState.kind === "never_shielded" ||
        wallet.balanceState.kind === "error" ||
        wallet.balanceState.kind === "wrapper_invalid" ||
        wallet.balanceState.kind === "not_configured") && (
        <p className="text-[10px] text-slate-500 leading-tight">
          {wallet.balanceState.message}
        </p>
      )}

      {canTransactConfidentially && wallet.isConfigured && (
        <>
          <div className="space-y-1.5">
            <input
              id="shield-amount-input"
              type="number"
              min="0"
              step="0.01"
              placeholder="USDC amount"
              value={shieldAmount}
              onChange={(event) => {
                setShieldAmount(event.target.value);
              }}
              className="w-full text-xs bg-transparent border border-white/10 rounded-lg px-3 py-1.5 text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-neon-cyan/40"
              aria-label="USDC amount to shield"
            />
            <button
              id="shield-usdc-btn"
              onClick={() => {
                const amount = parseAmount(shieldAmount);
                if (!amount) {
                  return;
                }

                void wallet.shield(amount);
              }}
              disabled={wallet.shieldPhase === "pending" || !parseAmount(shieldAmount)}
              className="neon-btn-secondary w-full text-xs py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {wallet.shieldPhase === "pending"
                ? "Shielding..."
                : wallet.shieldPhase === "success"
                ? "Shield complete"
                : wallet.shieldPhase === "error"
                ? "Retry shield"
                : "Shield USDC -> cUSDC"}
            </button>
            {wallet.shieldError && (
              <p className="text-[10px] text-red-400 leading-tight">{wallet.shieldError}</p>
            )}
          </div>

          {(wallet.balanceState.kind === "ready" ||
            wallet.balanceState.kind === "zero_balance" ||
            wallet.pendingUnshieldTxHash) && (
            <div className="space-y-1.5">
              <input
                id="unshield-amount-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="cUSDC amount to unshield"
                value={unshieldAmount}
                onChange={(event) => {
                  setUnshieldAmount(event.target.value);
                }}
                className="w-full text-xs bg-transparent border border-white/10 rounded-lg px-3 py-1.5 text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-neon-cyan/40"
                aria-label="cUSDC amount to unshield"
              />
              <button
                id="unshield-cusdc-btn"
                onClick={() => {
                  const amount = parseAmount(unshieldAmount);
                  if (!amount) {
                    return;
                  }

                  void wallet.unshield(amount);
                }}
                disabled={wallet.unshieldPhase === "submitting" || wallet.unshieldPhase === "waiting" || wallet.unshieldPhase === "finalizing" || !parseAmount(unshieldAmount)}
                className="neon-btn-secondary w-full text-xs py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ borderColor: "rgba(123,47,255,0.3)", color: "#A87FFF" }}
              >
                {wallet.unshieldPhase === "submitting"
                  ? "Submitting unwrap..."
                  : wallet.unshieldPhase === "waiting"
                  ? "Waiting for decryption..."
                  : wallet.unshieldPhase === "finalizing"
                  ? "Finalizing..."
                  : wallet.unshieldPhase === "success"
                  ? "Unshield complete"
                  : wallet.unshieldPhase === "error"
                  ? "Retry unshield"
                  : "Unshield cUSDC -> USDC"}
              </button>
              {wallet.pendingUnshieldTxHash && (
                <button
                  type="button"
                  onClick={() => {
                    void wallet.resumePendingUnshield();
                  }}
                  className="neon-btn-secondary w-full text-xs py-1.5 rounded-lg"
                  style={{ borderColor: "rgba(255,255,255,0.18)", color: "#EEF2FF" }}
                >
                  Resume pending unshield
                </button>
              )}
              {wallet.unshieldError && (
                <p className="text-[10px] text-red-400 leading-tight">{wallet.unshieldError}</p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <button
              id="set-operator-btn"
              onClick={() => {
                void wallet.setRegistryOperator();
              }}
              disabled={wallet.operatorPhase === "pending" || wallet.isOperatorApproved}
              title="Lets Arbitra use your cUSDC to fund invoices."
              className="neon-btn-secondary w-full text-xs py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: "rgba(0,255,136,0.2)", color: "#00FF88" }}
            >
              {wallet.isOperatorApproved
                ? "Registry authorized"
                : wallet.operatorPhase === "pending"
                ? "Authorizing registry..."
                : wallet.operatorPhase === "success"
                ? "Registry authorized"
                : "Authorize registry operator"}
            </button>
            {wallet.operatorError && (
              <p className="text-[10px] text-red-400 leading-tight">{wallet.operatorError}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
