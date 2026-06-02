/**
 * @file Sidebar.tsx
 * @description Application sidebar containing logo, navigation links, FHE indicator, and wallet connector.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "@wagmi/core";
import { shortAddress } from "@/lib/contracts";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    href: "/marketplace",
    label: "Marketplace",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M3 4h14M3 10h14M3 16h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/upload",
    label: "Upload Invoice",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 3v10M6 7l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/portfolio",
    label: "Portfolio",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M3 15l4-5 4 3 3-5 3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <aside
      className="fixed left-0 top-0 h-full w-64 flex flex-col z-30"
      style={{ background: "rgba(10,15,28,0.95)", borderRight: "1px solid rgba(255,255,255,0.06)" }}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="p-6 border-b border-white/6">
        <Link href="/" className="flex items-center gap-3 group" aria-label="Arbitra Home">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #00F0FF, #7B2FFF)" }}
            aria-hidden="true"
          >
            <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 1L3 6v8l7 4 7-4V6L10 1zM10 15.4L4 12V8l6-3.4L16 8v4l-6 3.4z" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-white text-base group-hover:text-neon-cyan transition-colors">
              Arbitra
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Confidential Factoring
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1" aria-label="Site navigation">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item ${isActive ? "active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              {item.icon}
              {item.label}
              {isActive && (
                <div
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse"
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* FHE indicator */}
      <div
        className="mx-4 mb-4 p-3 rounded-xl"
        style={{ background: "rgba(0,240,255,0.05)", border: "1px solid rgba(0,240,255,0.1)" }}
      >
        <div className="flex items-center gap-2 text-xs text-neon-cyan mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" aria-hidden="true" />
          FHE Active
        </div>
        <div className="text-[10px] text-slate-500">
          Zama FHEVM v0.11 · Sepolia
        </div>
      </div>

      {/* Wallet */}
      <div className="p-4 border-t border-white/6">
        {isConnected && address ? (
          <div className="space-y-2">
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
              onClick={() => disconnect()}
              className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={() => connect({ connector: injected() })}
            className="neon-btn-secondary w-full text-xs py-2 rounded-lg"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </aside>
  );
}
