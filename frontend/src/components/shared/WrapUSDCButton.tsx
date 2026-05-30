"use client";

import React, { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useReadContract } from "wagmi";
import {
  USDC_ADDRESS,
  WRAPPERS_REGISTRY,
  WRAPPERS_REGISTRY_ABI,
  USDC_ABI,
  toMicroUnits
} from "@/lib/contracts";

export function WrapUSDCButton({ amountUSDC }: { amountUSDC: number }) {
  const { address } = useAccount();
  const [step, setStep] = useState<"idle" | "approving" | "wrapping" | "done">("idle");

  const { writeContract: approve, data: approveTx } = useWriteContract();
  const { writeContract: wrap, data: wrapTx } = useWriteContract();
  
  const { isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTx });
  const { isSuccess: wrapSuccess } = useWaitForTransactionReceipt({ hash: wrapTx });

  /* Resolve cUSDC address dynamically at runtime from Zama registry */
  const { data: registryResult } = useReadContract({
    address: WRAPPERS_REGISTRY,
    abi: WRAPPERS_REGISTRY_ABI,
    functionName: "getConfidentialTokenAddress",
    args: [USDC_ADDRESS]
  });

  const getCUSDCAddress = (): `0x${string}` => {
    if (registryResult) {
      const [found, confidentialToken] = registryResult as [boolean, `0x${string}`];
      if (found && confidentialToken !== "0x0000000000000000000000000000000000000000") {
        return confidentialToken;
      }
    }
    /* Fallback to live cUSDT wrapper which is registered on Sepolia */
    return "0x4E7B06D78965594eB5EF5414c357ca21E1554491";
  };

  const handleWrap = async () => {
    if (!address) return;
    const amount = toMicroUnits(amountUSDC);

    /* Step 1: approve Wrappers Registry to spend USDC */
    setStep("approving");
    approve({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: "approve",
      args: [WRAPPERS_REGISTRY, amount]
    });
  };

  /* Step 2: once approval confirmed, call wrap() */
  useEffect(() => {
    if (!approveSuccess) return;
    setStep("wrapping");
    wrap({
      address: WRAPPERS_REGISTRY,
      abi: WRAPPERS_REGISTRY_ABI,
      functionName: "wrap",
      args: [USDC_ADDRESS, toMicroUnits(amountUSDC)]
    });
  }, [approveSuccess]);

  /* Step 3: once wrap transaction lands, set step -> done */
  useEffect(() => {
    if (wrapSuccess) {
      setStep("done");
    }
  }, [wrapSuccess]);

  const labels = {
    idle: "Wrap USDC → cUSDC",
    approving: "Approving USDC…",
    wrapping: "Wrapping to cUSDC…",
    done: "✓ cUSDC Received"
  };

  return (
    <button
      onClick={handleWrap}
      disabled={step !== "idle" || !address}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        background: step === "done" ? "rgba(0, 255, 136, 0.1)" : "rgba(123, 47, 255, 0.1)",
        border: `1px solid ${step === "done" ? "rgba(0, 255, 136, 0.3)" : "rgba(123, 47, 255, 0.3)"}`,
        borderRadius: "11px",
        padding: "9px 18px",
        color: step === "done" ? "#00FF88" : "#A87FFF",
        fontSize: "13px",
        fontWeight: 600,
        fontFamily: "Satoshi, sans-serif",
        cursor: step === "idle" ? "pointer" : "not-allowed",
        opacity: !address ? 0.5 : 1,
        transition: "all 0.2s"
      }}
    >
      {step !== "idle" && step !== "done" && (
        <span
          style={{
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            border: "2px solid currentColor",
            borderTopColor: "transparent",
            animation: "spin 0.8s linear infinite",
            display: "inline-block"
          }}
        />
      )}
      {labels[step]}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  );
}
