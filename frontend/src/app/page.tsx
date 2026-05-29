"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { NeonButton } from "@/components/ui/NeonButton";
import { FHEBadge } from "@/components/ui/FHEBadge";

export default function HomePage() {
  const { isConnected } = useAccount();
  const { connect } = useConnect();
  const router = useRouter();

  useEffect(() => {
    if (isConnected) {
      router.push("/dashboard");
    }
  }, [isConnected, router]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(123,47,255,0.25) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 50%, rgba(0,240,255,0.15) 0%, transparent 60%), #020714",
      }}
    >
      {/* Grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,240,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.04) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
        aria-hidden="true"
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between p-6">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #00F0FF, #7B2FFF)" }}
            aria-hidden="true"
          >
            <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10 1L3 6v8l7 4 7-4V6L10 1zM10 15.4L4 12V8l6-3.4L16 8v4l-6 3.4z" />
            </svg>
          </div>
          <span className="text-lg font-bold text-white">Arbitra</span>
        </div>

        <div className="flex items-center gap-3">
          <FHEBadge />
          <NeonButton
            variant="secondary"
            size="sm"
            onClick={() => connect({ connector: injected() })}
          >
            Connect Wallet
          </NeonButton>
        </div>
      </header>

      {/* Hero */}
      <main
        className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-20"
        aria-labelledby="hero-title"
      >
        {/* Pill badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-xs font-medium"
          style={{
            background: "rgba(123,47,255,0.15)",
            border: "1px solid rgba(123,47,255,0.3)",
            color: "#7B2FFF",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-neon-purple animate-pulse" aria-hidden="true" />
          Powered by Zama FHEVM v0.11 · Sepolia Testnet
        </div>

        {/* Main heading */}
        <h1 id="hero-title" className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight max-w-4xl">
          <span className="text-white">Invoice Factoring,</span>
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #00F0FF 0%, #7B2FFF 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Fully Confidential
          </span>
        </h1>

        <p className="text-lg text-slate-400 max-w-2xl mb-12 leading-relaxed">
          The first on-chain invoice factoring registry where face values, due dates,
          and purchase prices are encrypted with{" "}
          <strong className="text-white">Fully Homomorphic Encryption</strong>.
          Only authorized parties can decrypt their own data.
        </p>

        {/* CTA */}
        <div className="flex flex-wrap gap-4 justify-center">
          <NeonButton
            variant="primary"
            size="lg"
            onClick={() => connect({ connector: injected() })}
            id="hero-connect-btn"
          >
            Launch App
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </NeonButton>
          <Link href="/marketplace">
            <NeonButton variant="ghost" size="lg">
              Browse Marketplace
            </NeonButton>
          </Link>
        </div>

        {/* Feature cards */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full text-left">
          {[
            {
              icon: "🔒",
              title: "FHE-Encrypted Invoices",
              description:
                "Face values and due dates are encrypted with Zama FHEVM. The blockchain sees only ciphertexts.",
            },
            {
              icon: "🤖",
              title: "AI Risk Assessment",
              description:
                "Gemini Flash analyzes supplier repayment history and maturity to score invoice risk in real time.",
            },
            {
              icon: "⚡",
              title: "On-Chain Credit Scoring",
              description:
                "Supplier discount rates are computed homomorphically from encrypted repayment history — no oracle needed.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="glass-card p-5"
            >
              <div className="text-2xl mb-3" aria-hidden="true">{card.icon}</div>
              <h2 className="text-base font-semibold text-white mb-2">{card.title}</h2>
              <p className="text-sm text-slate-500 leading-relaxed">{card.description}</p>
            </div>
          ))}
        </div>

        {/* Tech stack badges */}
        <div className="mt-16 flex flex-wrap gap-3 justify-center">
          {[
            "Zama FHEVM v0.11",
            "Sepolia Testnet",
            "euint64 Encryption",
            "EIP-712 UserDecrypt",
            "Gemini Flash AI",
            "Next.js 14",
          ].map((badge) => (
            <span
              key={badge}
              className="px-3 py-1 rounded-full text-xs text-slate-500"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {badge}
            </span>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-8 text-xs text-slate-600">
        <p>Arbitra · Confidential Invoice Factoring on FHEVM · Demo on Sepolia</p>
      </footer>
    </div>
  );
}
