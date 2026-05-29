"use client";

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

const COLORS = ["#00F0FF", "#7B2FFF", "#00FF88"];
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
        <div className="text-4xl mb-2" aria-hidden="true">📭</div>
        No invoices yet
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
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
            formatter={(value) => (
              <span style={{ color: "#94a3b8", fontSize: "11px" }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
