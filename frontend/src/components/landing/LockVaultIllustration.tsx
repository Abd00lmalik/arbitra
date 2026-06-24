/**
 * @file LockVaultIllustration.tsx
 * @description SVG illustration representing the deterministic risk assessment engine.
 */

import React from "react";

export function LockVaultIllustration() {
  const nodes = [
    [30, 40],
    [30, 80],
    [30, 120],
    [80, 30],
    [80, 70],
    [80, 110],
    [80, 140]
  ];

  const lines = [
    [30, 40, 80, 30],
    [30, 40, 80, 70],
    [30, 80, 80, 70],
    [30, 80, 80, 110],
    [30, 120, 80, 110],
    [30, 120, 80, 140]
  ];

  const connections = [30, 70, 110, 140];

  return (
    <svg width="200" height="160" viewBox="0 0 200 160" fill="none">
      {/* Neural network connections */}
      {lines.map(([x1, y1, x2, y2], i) => (
        <line
          key={`line-${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="rgba(123,47,255,0.2)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      ))}

      {/* Neural network nodes */}
      {nodes.map(([x, y], i) => (
        <circle
          key={`node-${i}`}
          cx={x}
          cy={y}
          r="7"
          fill="rgba(123,47,255,0.15)"
          stroke="rgba(123,47,255,0.4)"
          strokeWidth="1.2"
        />
      ))}

      {/* Output risk gauge node */}
      <circle
        cx="130"
        cy="80"
        r="28"
        fill="rgba(123,47,255,0.08)"
        stroke="rgba(123,47,255,0.35)"
        strokeWidth="1.5"
      />
      <text
        x="130"
        y="76"
        textAnchor="middle"
        fill="#A87FFF"
        fontSize="14"
        fontWeight="700"
        fontFamily="Satoshi, sans-serif"
      >
        4.2
      </text>
      <text
        x="130"
        y="90"
        textAnchor="middle"
        fill="rgba(123,47,255,0.6)"
        fontSize="9"
        fontFamily="Satoshi, sans-serif"
      >
        RISK
      </text>

      {/* Deterministic review badge */}
      <rect
        x="110"
        y="115"
        width="40"
        height="14"
        rx="7"
        fill="rgba(123,47,255,0.12)"
        stroke="rgba(123,47,255,0.3)"
        strokeWidth="1"
      />
      <text
        x="130"
        y="125"
        textAnchor="middle"
        fill="#A87FFF"
        fontSize="8"
        fontFamily="Satoshi, sans-serif"
      >
        MODEL
      </text>

      {/* Connections from neural net to output */}
      {connections.map((y, i) => (
        <line
          key={`conn-${i}`}
          x1="86"
          y1={y}
          x2="102"
          y2="80"
          stroke="rgba(123,47,255,0.25)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      ))}
    </svg>
  );
}
