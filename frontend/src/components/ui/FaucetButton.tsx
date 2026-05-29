"use client";

import { useState } from "react";
import { NeonButton } from "./NeonButton";

/**
 * FaucetButton Component
 *
 * Provides a sleek, cyber-themed button to guide users to wrap Sepolia USDT
 * into confidential cUSDT via Zama's official faucet/portfolio application.
 */
export function FaucetButton() {
  const [showTooltip, setShowTooltip] = useState(false);

  const faucetUrl = "https://app.zama.ai";

  return (
    <div className="relative inline-block">
      <NeonButton
        variant="secondary"
        size="xs"
        onClick={() => window.open(faucetUrl, "_blank")}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="flex items-center gap-1.5"
        id="faucet-button"
      >
        <span className="text-[10px] sm:text-xs">💧</span>
        <span className="text-[10px] sm:text-xs tracking-wide">Get Test cUSDT</span>
      </NeonButton>

      {showTooltip && (
        <div
          className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 rounded-lg text-xs leading-relaxed text-slate-300 shadow-2xl transition-all duration-200"
          style={{
            background: "rgba(10, 15, 30, 0.95)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(0, 240, 255, 0.2)",
            boxShadow: "0 0 15px rgba(0, 240, 255, 0.1)",
          }}
          role="tooltip"
        >
          <div className="font-semibold text-white mb-1 flex items-center gap-1">
            <span>Confidential USDT (cUSDT)</span>
          </div>
          <p className="mb-2">
            Arbitra uses Zama&apos;s official cUSDT wrapper on Sepolia.
          </p>
          <ol className="list-decimal pl-4 space-y-1 text-slate-400">
            <li>Open Zama Portfolio.</li>
            <li>Request Sepolia test USDT from faucet.</li>
            <li>Wrap USDT to cUSDT to use on Arbitra.</li>
          </ol>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[rgba(10,15,30,0.95)]" />
        </div>
      )}
    </div>
  );
}
