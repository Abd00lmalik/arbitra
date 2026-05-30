/**
 * @file AppLayout.tsx
 * @description Layout component containing sidebar structure, content viewport, and background grid overlays.
 */

"use client";

import React, { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useRole } from "@/providers/RoleProvider";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function AppLayout({ children, title, description }: AppLayoutProps) {
  const { role, setRole } = useRole();

  return (
    <div className="flex min-h-screen bg-navy-900">
      <Sidebar />
      <main
        className="flex-1 ml-64 p-8 min-h-screen"
        style={{ background: "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(123,47,255,0.08) 0%, transparent 60%), #0a0f1c" }}
      >
        {/* Subtle grid overlay */}
        <div
          className="fixed inset-0 pointer-events-none z-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,240,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.04) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
          aria-hidden="true"
        />

        {/* Page header with role switch toggle */}
        {(title || description) && (
          <header className="relative z-10 mb-8 flex justify-between items-start flex-wrap gap-4">
            <div>
              {title && (
                <h1 className="text-2xl font-bold text-white mb-1">
                  {title}
                </h1>
              )}
              {description && (
                <p className="text-sm text-slate-400">{description}</p>
              )}
            </div>

            {/* Switch Role Toggle */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/2 border border-white/5 text-xs">
              <button
                onClick={() => setRole("supplier")}
                className={`px-3 py-1.5 rounded-lg transition-all duration-200 ${
                  role === "supplier"
                    ? "bg-neon-cyan/10 border border-neon-cyan/35 text-neon-cyan font-bold"
                    : "text-slate-400 border border-transparent hover:text-white"
                }`}
              >
                Supplier Mode
              </button>
              <button
                onClick={() => setRole("investor")}
                className={`px-3 py-1.5 rounded-lg transition-all duration-200 ${
                  role === "investor"
                    ? "bg-neon-purple/10 border border-neon-purple/35 text-neon-purple font-bold"
                    : "text-slate-400 border border-transparent hover:text-white"
                }`}
              >
                Investor Mode
              </button>
            </div>
          </header>
        )}

        {/* Page content */}
        <div className="relative z-10">{children}</div>
      </main>
    </div>
  );
}
