/**
 * @file PortfolioDonut.tsx
 * @description Customized Recharts Donut chart displaying invoice distributions with high contrast labels, matching legend colors, and dynamic category maps.
 */

"use client";

import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

interface PortfolioDonutProps {
  factored: number;
  available: number;
  repaid: number;
}

const COLOR_MAP: Record<string, string> = {
  Factored: "#00F0FF",   /* Neon Cyan */
  Available: "#7B2FFF",  /* Neon Purple */
  Repaid: "#00FF88",     /* Neon Green */
};

const RADIAN = Math.PI / 180;

function renderCustomLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
}) {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export function PortfolioDonut({ factored, available, repaid }: PortfolioDonutProps) {
  const total = factored + available + repaid;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-sm">
        {/* Replaced emoji 📭 with custom inline SVG */}
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-slate-600 mb-2"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
        <span>No invoices yet</span>
      </div>
    );
  }

  const data = [
    { name: "Factored", value: factored },
    { name: "Available", value: available },
    { name: "Repaid", value: repaid },
  ].filter((d) => d.value > 0);

  return (
    <div className="h-48" aria-label={`Portfolio distribution: ${factored} factored, ${available} available, ${repaid} repaid`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            innerRadius={50}
            outerRadius={75}
            dataKey="value"
            strokeWidth={2}
            stroke="rgba(0,0,0,0.5)"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLOR_MAP[entry.name] || "#ffffff"} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "rgba(13,21,38,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              color: "white",
              fontSize: "12px",
            }}
            formatter={(value: number) => [value, ""]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => {
              const color = COLOR_MAP[value] || "#94a3b8";
              return (
                <span style={{ color, fontSize: "11px", fontWeight: 600 }}>{value}</span>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
