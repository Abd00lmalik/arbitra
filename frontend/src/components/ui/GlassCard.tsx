import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: "cyan" | "purple" | "none";
  onClick?: () => void;
}

export function GlassCard({
  children,
  className = "",
  hover = false,
  glow = "none",
  onClick,
}: GlassCardProps) {
  const hoverClass = hover
    ? "cursor-pointer transition-all duration-300 hover:border-white/15 hover:-translate-y-0.5"
    : "";

  const glowClass =
    glow === "cyan"
      ? "hover:shadow-[0_0_30px_rgba(0,240,255,0.2)]"
      : glow === "purple"
      ? "hover:shadow-[0_0_30px_rgba(123,47,255,0.2)]"
      : "";

  return (
    <div
      className={`glass-card ${hoverClass} ${glowClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
