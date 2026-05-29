/**
 * @file DataFlowIllustration.tsx
 * @description SVG illustration representing credit score trends and historical verification.
 */

import React from "react";

export function DataFlowIllustration() {
  const bars = [
    { x: 30, h: 30 },
    { x: 50, h: 45 },
    { x: 70, h: 60 },
    { x: 90, h: 75 },
    { x: 110, h: 95 }
  ];

  return (
    <svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background grid lines */}
      <line x1="20" y1="130" x2="180" y2="130" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      <line x1="20" y1="100" x2="180" y2="100" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
      <line x1="20" y1="70" x2="180" y2="70" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
      <line x1="20" y1="40" x2="180" y2="40" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

      {/* Credit scoring bars */}
      {bars.map((bar, i) => (
        <rect
          key={`bar-${i}`}
          x={bar.x}
          y={130 - bar.h}
          width="12"
          height={bar.h}
          rx="3"
          fill={`rgba(0, 255, 136, ${0.05 + (i * 0.05)})`}
          stroke={`rgba(0, 255, 136, ${0.2 + (i * 0.15)})`}
          strokeWidth="1.2"
        />
      ))}

      {/* Ascending Trend Line */}
      <polyline
        points="36,95 56,80 76,65 96,50 116,30 145,26"
        fill="none"
        stroke="#00FF88"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#glow-green)"
      />

      {/* Verification Shield Badge on the right */}
      <g transform="translate(136, 36)">
        {/* Glow behind shield */}
        <circle cx="20" cy="20" r="18" fill="rgba(0,255,136,0.08)" />
        {/* Shield outline */}
        <path
          d="M20 7 C28 10 32 12 32 18 C32 26 20 32 20 32 C20 32 8 26 8 18 C8 12 12 10 20 7 Z"
          fill="rgba(2,7,20,0.9)"
          stroke="#00FF88"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Checkmark inside shield */}
        <path
          d="M15 19 L18 22 L25 15"
          fill="none"
          stroke="#00FF88"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* SVG filter definition for neon glow */}
      <defs>
        <filter id="glow-green" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}
