"use client";

/**
 * @file WalletAddressCard.tsx
 * @description Displays the active Sepolia wallet, balances, copy action, faucet links, and withdraw panel.
 */

import React, { useMemo, useState } from "react";
import {
  useAccount,
  useBalance,
  useSendTransaction,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { erc20Abi, formatEther, formatUnits, isAddress, parseEther, parseUnits } from "viem";
import { GlassCard } from "@/components/ui/GlassCard";
import { USDC_ADDRESS } from "@/lib/contracts";

interface WalletAddressCardProps {
  walletAddress?: `0x${string}` | null;
}

type WalletView = "main" | "withdraw";
type SendAsset = "ETH" | "USDC";

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

function formatAmount(value: bigint | undefined, decimals: number, digits: number) {
  if (value === undefined) return "-";
  return Number.parseFloat(formatUnits(value, decimals)).toFixed(digits);
}

function getErrorMessage(error: unknown) {
  if (!error) return null;
  if (typeof error === "object" && error !== null) {
    if ("shortMessage" in error && typeof (error as { shortMessage?: unknown }).shortMessage === "string") {
      return (error as { shortMessage: string }).shortMessage;
    }
    if ("message" in error && typeof (error as { message?: unknown }).message === "string") {
      return (error as { message: string }).message;
    }
  }
  return String(error);
}

export function WalletAddressCard({ walletAddress }: WalletAddressCardProps) {
  const { address, isConnected } = useAccount();
  const resolvedAddress = walletAddress ?? (isConnected ? address : undefined);

  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<WalletView>("main");
  const [recipient, setRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendAsset, setSendAsset] = useState<SendAsset>("ETH");
  const [sendError, setSendError] = useState<string | null>(null);

  const { data: ethBalance } = useBalance({
    address: resolvedAddress,
    chainId: 11155111,
    query: { enabled: !!resolvedAddress },
  });

  const { data: usdcBalance } = useBalance({
    address: resolvedAddress,
    token: USDC_ADDRESS,
    chainId: 11155111,
    query: { enabled: !!resolvedAddress },
  });

  const {
    sendTransactionAsync,
    data: ethSendTxHash,
    isPending: isSendingEth,
    error: sendEthError,
  } = useSendTransaction();

  const {
    writeContractAsync,
    data: usdcSendTxHash,
    isPending: isSendingUsdc,
    error: sendUsdcError,
  } = useWriteContract();

  const activeSendTxHash = (usdcSendTxHash ?? ethSendTxHash) || undefined;
  const {
    isLoading: isConfirmingSend,
    isSuccess: sendSuccess,
  } = useWaitForTransactionReceipt({ hash: activeSendTxHash });

  const isSending = isSendingEth || isSendingUsdc;
  const sendWriteError = sendAsset === "USDC" ? sendUsdcError : sendEthError;

  const ethFormatted = useMemo(() => formatAmount(ethBalance?.value, 18, 4), [ethBalance?.value]);
  const usdcFormatted = useMemo(() => formatAmount(usdcBalance?.value, 6, 2), [usdcBalance?.value]);

  if (!resolvedAddress) return null;

  const resetWithdrawState = () => {
    setRecipient("");
    setSendAmount("");
    setSendAsset("ETH");
    setSendError(null);
  };

  const copyAddress = async () => {
    await navigator.clipboard.writeText(resolvedAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const handleSend = async () => {
    setSendError(null);

    if (!isAddress(recipient)) {
      setSendError("Invalid wallet address");
      return;
    }

    const normalizedAmount = Number.parseFloat(sendAmount);
    if (!sendAmount || Number.isNaN(normalizedAmount) || normalizedAmount <= 0) {
      setSendError("Enter a valid amount");
      return;
    }

    try {
      if (sendAsset === "ETH") {
        const weiAmount = parseEther(sendAmount);
        if (ethBalance?.value !== undefined && weiAmount > ethBalance.value) {
          setSendError("Insufficient ETH balance");
          return;
        }

        await sendTransactionAsync({
          to: recipient as `0x${string}`,
          value: weiAmount,
          chainId: 11155111,
        });
        return;
      }

      const tokenAmount = parseUnits(sendAmount, 6);
      if (usdcBalance?.value !== undefined && tokenAmount > usdcBalance.value) {
        setSendError("Insufficient USDC balance");
        return;
      }

      await writeContractAsync({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "transfer",
        args: [recipient as `0x${string}`, tokenAmount],
        chainId: 11155111,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Send failed";
      setSendError(message);
    }
  };

  if (view === "main") {
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
                {ethFormatted} ETH
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

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
              <span style={{ color: "#8B9CC8", fontWeight: 600 }}>ETH Balance</span>
              <span style={{ color: "#EEF2FF", fontWeight: 800 }}>{ethFormatted} ETH</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
              <span style={{ color: "#8B9CC8", fontWeight: 600 }}>USDC Balance</span>
              <span style={{ color: "#EEF2FF", fontWeight: 800 }}>{usdcFormatted} USDC</span>
            </div>
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
                flex: 1,
              }}
            >
              {copied ? "Copied" : "Copy address"}
            </button>

            <button
              type="button"
              onClick={() => {
                resetWithdrawState();
                setView("withdraw");
              }}
              style={{
                border: "1px solid rgba(0,240,255,0.3)",
                background: "rgba(0,240,255,0.12)",
                color: "#00F0FF",
                borderRadius: 11,
                padding: "9px 13px",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                flex: 1,
              }}
            >
              Withdraw
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

  return (
    <GlassCard className="p-5" glow="cyan">
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={() => {
              setView("main");
              setSendError(null);
            }}
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: "#8B9CC8",
              borderRadius: 10,
              padding: "7px 10px",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Back
          </button>
          <div style={{ color: "#EEF2FF", fontSize: 16, fontWeight: 800 }}>Withdraw</div>
        </div>

        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.04)",
            padding: 16,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 10,
                background: "rgba(0,240,255,0.12)",
                color: "#00F0FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              W
            </div>
            <div>
              <div style={{ color: "#EEF2FF", fontSize: 14, fontWeight: 800 }}>Send to Wallet</div>
              <div style={{ color: "#8B9CC8", fontSize: 11 }}>Transfer ETH or USDC from your embedded wallet.</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {(["ETH", "USDC"] as const).map((asset) => (
              <button
                key={asset}
                type="button"
                onClick={() => setSendAsset(asset)}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  border: sendAsset === asset ? "1px solid rgba(0,240,255,0.35)" : "1px solid rgba(255,255,255,0.10)",
                  background: sendAsset === asset ? "rgba(0,240,255,0.12)" : "rgba(255,255,255,0.04)",
                  color: sendAsset === asset ? "#00F0FF" : "#8B9CC8",
                  padding: "9px 10px",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {asset}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ color: "#8B9CC8", fontSize: 11, fontWeight: 700 }}>Recipient address</label>
            <input
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder="0x..."
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: "12px 14px",
                color: "#EEF2FF",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 12,
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ color: "#8B9CC8", fontSize: 11, fontWeight: 700 }}>
              Amount ({sendAsset}) - Available: {sendAsset === "ETH" ? `${ethFormatted} ETH` : `${usdcFormatted} USDC`}
            </label>
            <input
              value={sendAmount}
              onChange={(event) => setSendAmount(event.target.value)}
              placeholder={sendAsset === "ETH" ? "0.001" : "25"}
              type="number"
              min="0"
              step={sendAsset === "ETH" ? "0.001" : "0.01"}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: "12px 14px",
                color: "#EEF2FF",
                fontSize: 12,
                outline: "none",
              }}
            />
          </div>

          {(sendError || sendWriteError) ? (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                background: "rgba(255,45,107,0.10)",
                border: "1px solid rgba(255,45,107,0.22)",
                color: "#FF5E8E",
                fontSize: 12,
              }}
            >
              {sendError || getErrorMessage(sendWriteError)}
            </div>
          ) : null}

          {sendSuccess ? (
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ color: "#00FF88", fontSize: 12, fontWeight: 800, textAlign: "center" }}>
                Transaction sent successfully.
              </div>
              {activeSendTxHash ? (
                <a
                  href={`https://sepolia.etherscan.io/tx/${activeSendTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#00F0FF",
                    fontSize: 12,
                    fontWeight: 700,
                    textAlign: "center",
                    textDecoration: "underline",
                  }}
                >
                  View on Etherscan
                </a>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || isConfirmingSend}
              style={{
                border: "none",
                borderRadius: 12,
                background: isSending || isConfirmingSend ? "rgba(0,240,255,0.35)" : "#00F0FF",
                color: "#020714",
                padding: "12px 16px",
                fontSize: 13,
                fontWeight: 900,
                cursor: isSending || isConfirmingSend ? "not-allowed" : "pointer",
                opacity: isSending || isConfirmingSend ? 0.75 : 1,
              }}
            >
              {isSending ? "Confirm in wallet..." : isConfirmingSend ? "Confirming on Sepolia..." : `Send ${sendAmount || "0"} ${sendAsset}`}
            </button>
          )}
        </div>

        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.02)",
            padding: 16,
            display: "grid",
            gap: 8,
            opacity: 0.6,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div>
              <div style={{ color: "#C9D4F0", fontSize: 14, fontWeight: 800 }}>To Local Bank</div>
              <div style={{ color: "#8B9CC8", fontSize: 11 }}>Off-ramp directly to a local bank account.</div>
            </div>
            <div
              style={{
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
                color: "#8B9CC8",
                padding: "5px 10px",
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              Locked - Coming Soon
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
