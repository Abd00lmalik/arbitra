/**
 * @file ArbitraLogo.tsx
 * @description Highly aesthetic and professional SVG logo component for Arbitra.
 *              Combines a secure hexagonal shield, the letter 'A', and scales of justice/balance.
 *              Styled with neon cyan to deep purple gradient.
 */

"use client";

import React from "react";

interface ArbitraLogoProps {
  size?: number;
  showText?: boolean;
  textClassName?: string;
  subtextClassName?: string;
  className?: string;
  glow?: boolean;
}

export function ArbitraLogo({
  size = 36,
  showText = false,
  textClassName = "text-white font-bold",
  subtextClassName = "text-slate-500 font-mono",
  className = "",
  glow = true,
}: ArbitraLogoProps) {
  const glowStyles = glow
    ? { filter: "drop-shadow(0px 0px 8px rgba(0, 240, 255, 0.25))" }
    : {};

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* SVG Icon */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={glowStyles}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="arbitraBrandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00F0FF" />
            <stop offset="100%" stopColor="#7B2FFF" />
          </linearGradient>
          <linearGradient id="arbitraGlowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#7B2FFF" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Outer Hexagonal Shield Outline */}
        <path
          d="M60 8 L106 34v52L60 112L14 86V34L60 8z"
          stroke="url(#arbitraBrandGradient)"
          strokeWidth="3"
          strokeLinejoin="round"
          opacity="0.85"
        />

        {/* Outer Hexagon Glow Pulse Border */}
        <path
          d="M60 4 L110 32v56L60 116L10 88V32L60 4z"
          stroke="url(#arbitraGlowGradient)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          opacity="0.3"
          className="animate-pulse"
        />

        {/* Inner Tech Hexagon Skeleton */}
        <path
          d="M60 18 L94 38v44L60 102L26 82V38L60 18z"
          stroke="url(#arbitraBrandGradient)"
          strokeWidth="1.5"
          strokeDasharray="3 4"
          opacity="0.35"
        />

        {/* Stylized A / Balance Beam column */}
        {/* Left leg of A */}
        <path
          d="M60 26 L36 84"
          stroke="url(#arbitraBrandGradient)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        
        {/* Right leg of A */}
        <path
          d="M60 26 L84 84"
          stroke="url(#arbitraBrandGradient)"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* The Balance Beam (Crossbar of A) */}
        <path
          d="M27 61h66"
          stroke="url(#arbitraBrandGradient)"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Left scale pan details */}
        <path
          d="M27 61v9M21 70h12"
          stroke="url(#arbitraBrandGradient)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Right scale pan details */}
        <path
          d="M93 61v9M87 70h12"
          stroke="url(#arbitraBrandGradient)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Fulcrum pillar */}
        <path
          d="M60 26v35"
          stroke="url(#arbitraBrandGradient)"
          strokeWidth="1.5"
          strokeDasharray="2 2"
          opacity="0.6"
        />

        {/* Balance central node */}
        <circle cx="60" cy="61" r="4.5" fill="url(#arbitraBrandGradient)" />

        {/* Summit apex node */}
        <circle cx="60" cy="26" r="5" fill="url(#arbitraBrandGradient)" />
      </svg>

      {/* Brand Text */}
      {showText && (
        <div className="flex flex-col">
          <span className={`text-base tracking-tight leading-none ${textClassName}`}>
            Arbitra
          </span>
          <span className={`text-[10px] tracking-wider leading-none mt-1 ${subtextClassName}`}>
            CONFIDENTIAL FACTORING
          </span>
        </div>
      )}
    </div>
  );
}
