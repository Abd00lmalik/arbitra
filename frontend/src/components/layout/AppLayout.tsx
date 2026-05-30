/**
 * @file AppLayout.tsx
 * @description Layout component containing sidebar structure, content viewport, and background grid overlays.
 */

"use client";

import React, { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function AppLayout({ children, title, description }: AppLayoutProps) {
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

        {/* Page header */}
        {(title || description) && (
          <header className="relative z-10 mb-8">
            {title && (
              <h1 className="text-2xl font-bold text-white mb-1">
                {title}
              </h1>
            )}
            {description && (
              <p className="text-sm text-slate-400">{description}</p>
            )}
          </header>
        )}

        {/* Page content */}
        <div className="relative z-10">{children}</div>
      </main>
    </div>
  );
}
