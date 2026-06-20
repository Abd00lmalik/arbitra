"use client";

import React from "react";
import { Lock, ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

export function LockedPage({
  message,
  title = "Access Locked",
}: {
  message: string;
  title?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-16 px-6 text-center">
      <GlassCard className="p-8 text-center max-w-md mx-auto space-y-6 relative overflow-hidden" glow="orange">
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "2px",
            background: "linear-gradient(90deg, #FFB000 0%, #FF7000 100%)",
          }}
        />
        <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-white font-bold text-lg font-heading" style={{ fontFamily: "Satoshi, sans-serif" }}>
            {title}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {message}
          </p>
        </div>
        <a
          href="/register"
          className="inline-flex items-center justify-center gap-2 w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold py-3 px-6 rounded-xl text-xs transition-colors hover:shadow-[0_0_20px_rgba(245,158,11,0.2)]"
        >
          Complete Verification <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </GlassCard>
    </div>
  );
}
