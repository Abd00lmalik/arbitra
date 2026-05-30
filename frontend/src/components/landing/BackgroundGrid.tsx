/**
 * @file BackgroundGrid.tsx
 * @description Renders the animated background grid, scanlines, scroll progress bar, floating security orb, and floating cUSDT faucet pill.
 */

"use client";

import React from "react";
import { motion, useScroll } from "framer-motion";

export function BackgroundGrid() {
  const { scrollYProgress } = useScroll();

  return (
    <>
      {/* Scroll Progress Indicator at top of screen */}
      <motion.div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: "linear-gradient(90deg, #00F0FF 0%, #7B2FFF 100%)",
          scaleX: scrollYProgress,
          transformOrigin: "0%",
          zIndex: 100
        }}
      />

      {/* Floating Security Orb Background Element */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          right: "8%",
          top: "45%",
          width: "280px",
          height: "280px",
          borderRadius: "50%",
          zIndex: 1,
          pointerEvents: "none",
          background: "radial-gradient(circle at 30% 30%, rgba(0, 240, 255, 0.12) 0%, rgba(123, 47, 255, 0.08) 50%, rgba(2, 7, 20, 0) 100%)",
          border: "1px solid rgba(0, 240, 255, 0.12)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow: "0 0 50px rgba(0, 240, 255, 0.1), inset 0 0 30px rgba(123, 47, 255, 0.15)",
          animation: "floatOrb 15s ease-in-out infinite alternate"
        }}
      >
        {/* Inner locked state details */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.25,
            animation: "rotateOrb 25s linear infinite"
          }}
        >
          {/* Circular grid scanner */}
          <svg width="180" height="180" viewBox="0 0 200 200" fill="none">
            <circle cx="100" cy="100" r="80" stroke="#00F0FF" strokeWidth="1" strokeDasharray="5 5" />
            <circle cx="100" cy="100" r="50" stroke="#7B2FFF" strokeWidth="1" strokeDasharray="3 8" />
            <line x1="20" y1="100" x2="180" y2="100" stroke="#00F0FF" strokeWidth="0.8" opacity="0.5" />
            <line x1="100" y1="20" x2="100" y2="180" stroke="#00F0FF" strokeWidth="0.8" opacity="0.5" />
          </svg>
        </div>

        {/* Locked padlock indicator in center */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.4
          }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
      </div>

      {/* Floating Faucet Pill (Bottom-Right) */}
      <motion.a
        href="https://faucet.zama.ai"
        target="_blank"
        rel="noopener noreferrer"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.5 }}
        whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(0, 240, 255, 0.4)" }}
        whileTap={{ scale: 0.95 }}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 18px",
          background: "rgba(10, 16, 38, 0.85)",
          border: "1.5px solid rgba(0, 240, 255, 0.3)",
          borderRadius: "100px",
          color: "#00F0FF",
          fontSize: "12px",
          fontWeight: 700,
          fontFamily: "Satoshi, sans-serif",
          textDecoration: "none",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
          cursor: "pointer"
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-11-7-11S5 10.7 5 15a7 7 0 0 0 7 7z" />
        </svg>
        Get Test cUSDT
      </motion.a>

      {/* Main scanning grid background */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          backgroundImage: `
            linear-gradient(rgba(0, 240, 255, 0.012) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 240, 255, 0.012) 1px, transparent 1px)
          `,
          backgroundSize: "44px 44px"
        }}
      >
        {/* Animated vertical scan lines */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "25%",
            width: "1px",
            height: "40%",
            background: "linear-gradient(180deg, transparent, rgba(0, 240, 255, 0.35), transparent)",
            animation: "scanV 8s ease-in-out infinite"
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "70%",
            width: "1px",
            height: "30%",
            background: "linear-gradient(180deg, transparent, rgba(123, 47, 255, 0.35), transparent)",
            animation: "scanV 11s ease-in-out infinite 3s"
          }}
        />
        <style>{`
          @keyframes scanV {
            0%   { transform: translateY(-100%); opacity: 0; }
            10%  { opacity: 1; }
            90%  { opacity: 1; }
            100% { transform: translateY(280vh); opacity: 0; }
          }
          @keyframes floatOrb {
            0% { transform: translateY(0) scale(1); }
            100% { transform: translateY(-20px) scale(1.05); }
          }
          @keyframes rotateOrb {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </>
  );
}
