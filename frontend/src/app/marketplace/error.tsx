"use client";

import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/GlassCard";

function clearMarketplaceSessionState() {
  if (typeof window === "undefined") return;

  document.cookie = "arbitra_session=; path=/; max-age=0";

  try {
    window.localStorage.removeItem("arbitra_embedded_wallet");
    window.localStorage.removeItem("arbitra_role");

    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("wagmi.") || key.startsWith("wc@2:")) {
        window.localStorage.removeItem(key);
      }
    }

    for (const key of Object.keys(window.sessionStorage)) {
      if (key.startsWith("wagmi.") || key.startsWith("wc@2:")) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.error("[MarketplaceErrorBoundary] Failed to clear session state:", error);
  }
}

export default function MarketplaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[MarketplaceErrorBoundary]", error);
  }, [error]);

  return (
    <AppLayout title="Marketplace Recovery" description="Refreshing the investor workspace.">
      <div className="flex items-center justify-center min-h-[60vh] px-6 py-16">
        <GlassCard className="max-w-lg w-full p-8 space-y-5 text-center" glow="purple">
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Marketplace hit a client-side error</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              We caught the crash and stopped it from blanking the rest of the app. You can retry the page, or clear the local marketplace session and reload cleanly.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-left">
            <p className="text-xs text-slate-300 break-words">
              {error.message || "Unknown marketplace error"}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => reset()}
              className="flex-1 rounded-xl border border-neon-cyan/30 bg-neon-cyan/10 px-4 py-3 text-sm font-semibold text-neon-cyan transition hover:bg-neon-cyan/15"
            >
              Retry Marketplace
            </button>
            <button
              type="button"
              onClick={() => {
                clearMarketplaceSessionState();
                window.location.href = "/marketplace";
              }}
              className="flex-1 rounded-xl border border-neon-purple/30 bg-neon-purple/10 px-4 py-3 text-sm font-semibold text-neon-purple transition hover:bg-neon-purple/15"
            >
              Reset Session & Reload
            </button>
          </div>
        </GlassCard>
      </div>
    </AppLayout>
  );
}
