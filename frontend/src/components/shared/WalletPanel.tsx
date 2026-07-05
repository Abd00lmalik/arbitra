/*
 * @file WalletPanel.tsx
 * @description Expanded wallet panel shown in the Sidebar when connected.
 *              Displays ETH, USDC, and cUSDC balances. Provides Shield (USDC->cUSDC),
 *              Unshield (cUSDC->USDC, two-phase), and Set Registry as Operator actions.
 *
 *              SDK constraint: uses legacy @zama-fhe/relayer-sdk@0.4.1 primitives via
 *              the existing zama.ts helpers. Does NOT import @zama-fhe/sdk or
 *              @zama-fhe/react-sdk.
 */

"use client";

import React, { useCallback, useEffect, useState } from "react";
import { usePublicClient, useReadContract, useWatchContractEvent } from "wagmi";
import { useActiveWalletClient } from "@/hooks/useActiveWalletClient";
import { useZama } from "@/providers/ZamaProvider";
import {
  CUSDC_ADDRESS,
  CUSDC_ABI,
  USDC_ADDRESS,
  USDC_ABI,
  ARBITRA_REGISTRY_ADDRESS,
  shortAddress,
  fromMicro,
} from "@/lib/contracts";
import { encryptUint64, userDecryptHandles } from "@/lib/zama";

interface WalletPanelProps {
  address: string;
  onDisconnect: () => void;
}

type ShieldStatus = "idle" | "approving" | "shielding" | "done" | "error";
type UnshieldStatus = "idle" | "encrypting" | "unwrapping" | "waiting-kms" | "finalizing" | "done" | "error";
type OperatorStatus = "idle" | "pending" | "done" | "error";

function toHex(b: Uint8Array | string): `0x${string}` {
  if (typeof b === "string") return b as `0x${string}`;
  return ("0x" + Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
}

export function WalletPanel({ address, onDisconnect }: WalletPanelProps) {
  const publicClient = usePublicClient();
  const { walletClient, isEmbedded, getEmbeddedSigner } = useActiveWalletClient();
  const { instance } = useZama();

  /* ---------- Balance state ---------- */
  const [ethBalance, setEthBalance]     = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance]   = useState<bigint | null>(null);
  const [cUsdcBalance, setCusdcBalance] = useState<bigint | null>(null);
  const [cUsdcHandle, setCusdcHandle]   = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  /* ---------- Shield state ---------- */
  const [shieldAmount, setShieldAmount] = useState("");
  const [shieldStatus, setShieldStatus] = useState<ShieldStatus>("idle");
  const [shieldError, setShieldError]   = useState<string | null>(null);

  /* ---------- Unshield state ---------- */
  const [unshieldAmount, setUnshieldAmount] = useState("");
  const [unshieldStatus, setUnshieldStatus] = useState<UnshieldStatus>("idle");
  const [unshieldError, setUnshieldError]   = useState<string | null>(null);

  /* ---------- Operator state ---------- */
  const [operatorStatus, setOperatorStatus] = useState<OperatorStatus>("idle");
  const [operatorError, setOperatorError]   = useState<string | null>(null);

  /* ---------- USDC balance (wagmi read) ---------- */
  const { data: usdcRaw, refetch: refetchUsdc } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
    query: { enabled: Boolean(address) },
  });

  /* ---------- cUSDC handle (wagmi read) ---------- */
  const { data: cUsdcHandleRaw, refetch: refetchCUsdc } = useReadContract({
    address: CUSDC_ADDRESS as `0x${string}`,
    abi: CUSDC_ABI,
    functionName: "confidentialBalanceOf",
    args: [address as `0x${string}`],
    query: { enabled: Boolean(address) && Boolean(CUSDC_ADDRESS) },
  });

  /* ---------- Operator check ---------- */
  const { data: isOperator } = useReadContract({
    address: CUSDC_ADDRESS as `0x${string}`,
    abi: CUSDC_ABI,
    functionName: "isOperator",
    args: [address as `0x${string}`, ARBITRA_REGISTRY_ADDRESS],
    query: { enabled: Boolean(address) && Boolean(CUSDC_ADDRESS) },
  });

  /* ---------- ETH balance fetch ---------- */
  const fetchEthBalance = useCallback(async () => {
    if (!publicClient || !address) return;
    try {
      const wei = await publicClient.getBalance({ address: address as `0x${string}` });
      const eth = Number(wei) / 1e18;
      setEthBalance(eth.toFixed(4));
    } catch {
      setEthBalance(null);
    }
  }, [publicClient, address]);

  useEffect(() => {
    void fetchEthBalance();
  }, [fetchEthBalance]);

  /* ---------- Sync readable balances ---------- */
  useEffect(() => {
    if (usdcRaw !== undefined) {
      setUsdcBalance(usdcRaw as bigint);
    }
  }, [usdcRaw]);

  useEffect(() => {
    const handle = cUsdcHandleRaw as `0x${string}` | undefined;
    if (handle && handle !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      setCusdcHandle(handle);
    } else {
      setCusdcHandle(null);
      setCusdcBalance(null);
    }
  }, [cUsdcHandleRaw]);

  /* ---------- Decrypt cUSDC balance ---------- */
  const decryptCusdcBalance = useCallback(async () => {
    if (!instance || !cUsdcHandle || !CUSDC_ADDRESS) return;
    setBalanceLoading(true);
    try {
      const signer = {
        getAddress: async () => address,
        signTypedData: async (domain: object, types: object, value: object) => {
          if (isEmbedded) {
            const s = await getEmbeddedSigner();
            const cleanTypes = { ...types } as Record<string, unknown>;
            delete cleanTypes.EIP712Domain;
            return s.signTypedData(domain, cleanTypes, value);
          }
          if (!walletClient) throw new Error("Wallet not connected");
          return walletClient.signTypedData({
            domain: domain as Parameters<typeof walletClient.signTypedData>[0]["domain"],
            types: types as Parameters<typeof walletClient.signTypedData>[0]["types"],
            primaryType: Object.keys(types as Record<string, unknown>)[0],
            message: value as Parameters<typeof walletClient.signTypedData>[0]["message"],
            account: address as `0x${string}`,
          });
        },
      };
      const clearValues = await userDecryptHandles(
        instance,
        [{ handle: cUsdcHandle, contractAddress: CUSDC_ADDRESS }],
        signer,
      );
      const decrypted = clearValues[cUsdcHandle];
      if (typeof decrypted === "bigint") {
        setCusdcBalance(decrypted);
      }
    } catch {
      setCusdcBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }, [instance, cUsdcHandle, address, isEmbedded, getEmbeddedSigner, walletClient]);

  useEffect(() => {
    if (cUsdcHandle && instance) {
      void decryptCusdcBalance();
    }
  }, [cUsdcHandle, instance, decryptCusdcBalance]);

  /* ================================================================
   * SHIELD: approve USDC -> cUsdc.wrap(user, amount)
   * ================================================================ */
  const handleShield = async () => {
    const amt = BigInt(Math.round(Number(shieldAmount) * 1_000_000));
    if (amt <= 0n) return;

    setShieldStatus("approving");
    setShieldError(null);

    try {
      const { ethers } = await import("ethers");
      const signer = isEmbedded
        ? await getEmbeddedSigner()
        : new ethers.BrowserProvider((window as any).ethereum).getSigner();

      /* Step 1: approve USDC to cUSDC contract */
      const usdcContract = new ethers.Contract(USDC_ADDRESS, [
        "function approve(address spender, uint256 amount) returns (bool)",
      ], await signer);
      const approveTx = await usdcContract["approve"](CUSDC_ADDRESS, amt, { gasLimit: 150000n });
      await approveTx.wait();

      /* Step 2: wrap */
      setShieldStatus("shielding");
      const cUsdcContract = new ethers.Contract(CUSDC_ADDRESS, [
        "function wrap(address to, uint256 amount) returns (bytes32)",
      ], await signer);
      const wrapTx = await cUsdcContract["wrap"](address, amt, { gasLimit: 350000n });
      await wrapTx.wait();

      setShieldStatus("done");
      setShieldAmount("");
      await refetchUsdc();
      await refetchCUsdc();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setShieldError(msg.includes("rejected") ? "Transaction cancelled." : msg.slice(0, 200));
      setShieldStatus("error");
    }
  };

  /* ================================================================
   * UNSHIELD (2-phase): encrypt -> unwrap -> publicDecrypt -> finalizeUnwrap
   * ================================================================ */
  const handleUnshield = async () => {
    const amt = BigInt(Math.round(Number(unshieldAmount) * 1_000_000));
    if (amt <= 0n || !instance || !CUSDC_ADDRESS) return;

    setUnshieldStatus("encrypting");
    setUnshieldError(null);

    try {
      const { ethers } = await import("ethers");
      const signer = isEmbedded
        ? await getEmbeddedSigner()
        : new ethers.BrowserProvider((window as any).ethereum).getSigner();

      /* Step 1: encrypt the amount */
      const { handle, inputProof } = await encryptUint64(instance, amt, CUSDC_ADDRESS, address);

      /* Step 2: unwrap -> returns unwrapRequestId (bytes32 handle) */
      setUnshieldStatus("unwrapping");
      const cUsdcContract = new ethers.Contract(CUSDC_ADDRESS, [
        "function unwrap(address from, address to, bytes32 encryptedAmount, bytes calldata inputProof) returns (bytes32 unwrapRequestId)",
      ], await signer);
      const unwrapTx = await cUsdcContract["unwrap"](address, address, handle, inputProof, { gasLimit: 350000n });
      const receipt  = await unwrapTx.wait();

      /* Extract unwrapRequestId from receipt logs or return value */
      const unwrapRequestId: `0x${string}` = receipt?.logs?.[0]?.topics?.[1] ?? handle;

      /* Step 3: off-chain public decrypt via relayer */
      setUnshieldStatus("waiting-kms");
      const publicDecryptResult = await instance.publicDecrypt([unwrapRequestId]);
      const clearValue = (publicDecryptResult?.clearValues ?? {})[unwrapRequestId] as bigint;
      if (clearValue === undefined) throw new Error("Public decrypt did not return a clear value.");

      /* Step 4: finalizeUnwrap on-chain */
      setUnshieldStatus("finalizing");
      const finalizeTx = await cUsdcContract["finalizeUnwrap"](
        unwrapRequestId,
        clearValue,
        toHex(publicDecryptResult.proof ?? new Uint8Array()),
        { gasLimit: 350000n }
      );
      await finalizeTx.wait();

      setUnshieldStatus("done");
      setUnshieldAmount("");
      await refetchUsdc();
      await refetchCUsdc();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setUnshieldError(msg.includes("rejected") ? "Transaction cancelled." : msg.slice(0, 200));
      setUnshieldStatus("error");
    }
  };

  /* ================================================================
   * SET OPERATOR: cUsdc.setOperator(registry, until) — uint48 timestamp
   * ================================================================ */
  const handleSetOperator = async () => {
    if (!CUSDC_ADDRESS) return;
    setOperatorStatus("pending");
    setOperatorError(null);
    try {
      const { ethers } = await import("ethers");
      const signer = isEmbedded
        ? await getEmbeddedSigner()
        : new ethers.BrowserProvider((window as any).ethereum).getSigner();

      const until = Math.floor(Date.now() / 1000) + 7200; /* 2 hours */
      const cUsdcContract = new ethers.Contract(CUSDC_ADDRESS, [
        "function setOperator(address operator, uint48 until)",
      ], await signer);
      const tx = await cUsdcContract["setOperator"](ARBITRA_REGISTRY_ADDRESS, until, { gasLimit: 150000n });
      await tx.wait();
      setOperatorStatus("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setOperatorError(msg.includes("rejected") ? "Transaction cancelled." : msg.slice(0, 200));
      setOperatorStatus("error");
    }
  };

  const shieldStatusLabel: Record<ShieldStatus, string> = {
    idle: "Shield USDC → cUSDC",
    approving: "Approving USDC…",
    shielding: "Shielding…",
    done: "Done ✓",
    error: "Try again",
  };

  const unshieldStatusLabel: Record<UnshieldStatus, string> = {
    idle: "Unshield cUSDC → USDC",
    encrypting: "Encrypting amount…",
    unwrapping: "Submitting unwrap…",
    "waiting-kms": "Waiting for KMS (~30s)…",
    finalizing: "Finalizing…",
    done: "Done ✓",
    error: "Try again",
  };

  const isCusdcConfigured = Boolean(CUSDC_ADDRESS);

  return (
    <div className="space-y-3">
      {/* Address row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #00F0FF30, #7B2FFF30)" }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="text-xs font-mono text-slate-300 truncate">{shortAddress(address)}</div>
            <div className="text-[10px] text-slate-600">Connected · Sepolia</div>
          </div>
        </div>
        <button
          onClick={onDisconnect}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Disconnect
        </button>
      </div>

      {/* Balance rows */}
      <div
        className="rounded-xl p-3 space-y-1.5"
        style={{ background: "rgba(0,240,255,0.04)", border: "1px solid rgba(0,240,255,0.08)" }}
      >
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500">ETH</span>
          <span className="font-mono text-slate-300">{ethBalance ?? "…"} ETH</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500">USDC</span>
          <span className="font-mono text-slate-300">
            {usdcBalance !== null ? `$${fromMicro(usdcBalance)}` : "…"}
          </span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500 flex items-center gap-1">
            <span
              style={{ color: "#00F0FF" }}
              role="img"
              aria-label="locked"
            >
              🔒
            </span>
            cUSDC
          </span>
          <span className="font-mono" style={{ color: "#00F0FF" }}>
            {!isCusdcConfigured
              ? "not deployed"
              : cUsdcHandle === null
              ? "0.00"
              : balanceLoading
              ? "decrypting…"
              : cUsdcBalance !== null
              ? `$${fromMicro(cUsdcBalance)}`
              : "🔒 encrypted"}
          </span>
        </div>
      </div>

      {isCusdcConfigured && (
        <>
          {/* Shield USDC → cUSDC */}
          <div className="space-y-1.5">
            <input
              id="shield-amount-input"
              type="number"
              min="0"
              step="0.01"
              placeholder="USDC amount"
              value={shieldAmount}
              onChange={(e) => {
                setShieldAmount(e.target.value);
                setShieldStatus("idle");
                setShieldError(null);
              }}
              className="w-full text-xs bg-transparent border border-white/10 rounded-lg px-3 py-1.5 text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-neon-cyan/40"
              aria-label="USDC amount to shield"
            />
            <button
              id="shield-usdc-btn"
              onClick={() => { void handleShield(); }}
              disabled={shieldStatus === "approving" || shieldStatus === "shielding" || !shieldAmount}
              className="neon-btn-secondary w-full text-xs py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {shieldStatusLabel[shieldStatus]}
            </button>
            {shieldError && (
              <p className="text-[10px] text-red-400 leading-tight">{shieldError}</p>
            )}
          </div>

          {/* Unshield cUSDC → USDC */}
          {cUsdcHandle && (
            <div className="space-y-1.5">
              <input
                id="unshield-amount-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="cUSDC amount to unshield"
                value={unshieldAmount}
                onChange={(e) => {
                  setUnshieldAmount(e.target.value);
                  setUnshieldStatus("idle");
                  setUnshieldError(null);
                }}
                className="w-full text-xs bg-transparent border border-white/10 rounded-lg px-3 py-1.5 text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-neon-cyan/40"
                aria-label="cUSDC amount to unshield"
              />
              <button
                id="unshield-cusdc-btn"
                onClick={() => { void handleUnshield(); }}
                disabled={
                  unshieldStatus !== "idle" && unshieldStatus !== "done" && unshieldStatus !== "error"
                  || !unshieldAmount || !instance
                }
                className="neon-btn-secondary w-full text-xs py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ borderColor: "rgba(123,47,255,0.3)", color: "#A87FFF" }}
              >
                {unshieldStatusLabel[unshieldStatus]}
              </button>
              {unshieldStatus === "waiting-kms" && (
                <p className="text-[10px] text-slate-500 leading-tight">
                  Unshield takes 30–60 seconds for KMS decryption.
                </p>
              )}
              {unshieldError && (
                <p className="text-[10px] text-red-400 leading-tight">{unshieldError}</p>
              )}
            </div>
          )}

          {/* Set Registry as Operator */}
          {cUsdcHandle && (
            <div className="space-y-1">
              <button
                id="set-operator-btn"
                onClick={() => { void handleSetOperator(); }}
                disabled={operatorStatus === "pending" || operatorStatus === "done" || isOperator === true}
                title="Lets Arbitra use your cUSDC to fund invoices. Expires in 2 hours."
                className="neon-btn-secondary w-full text-xs py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ borderColor: "rgba(0,255,136,0.2)", color: "#00FF88" }}
              >
                {isOperator === true || operatorStatus === "done"
                  ? "Registry authorized ✓"
                  : operatorStatus === "pending"
                  ? "Authorizing…"
                  : "Set Registry as Operator"}
              </button>
              {isOperator !== true && operatorStatus === "idle" && (
                <p className="text-[10px] text-slate-600 leading-tight">
                  Required before funding invoices. Expires in 2 hours.
                </p>
              )}
              {operatorError && (
                <p className="text-[10px] text-red-400 leading-tight">{operatorError}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
