"use client";

import React from "react";
import { useRole } from "@/providers/RoleProvider";

export function RoleToggle() {
  const { role, setRole } = useRole();

  const toggle = () => {
    const next = role === "supplier" ? "investor" : "supplier";
    setRole(next);
  };

  return (
    <div
      onClick={toggle}
      style={{
        display: "flex",
        borderRadius: "10px",
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        padding: "3px",
        cursor: "pointer",
        gap: "2px",
        userSelect: "none"
      }}
    >
      {(["supplier", "investor"] as const).map((r) => (
        <div
          key={r}
          style={{
            padding: "6px 14px",
            borderRadius: "8px",
            background: role === r ? (r === "supplier" ? "#00F0FF" : "#7B2FFF") : "transparent",
            color: role === r ? "#020714" : "#8B9CC8",
            fontSize: "12px",
            fontWeight: 700,
            fontFamily: "Satoshi, sans-serif",
            transition: "all 0.2s",
            textTransform: "capitalize",
          }}
        >
          {r}
        </div>
      ))}
    </div>
  );
}
