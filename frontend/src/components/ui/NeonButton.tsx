"use client";

import { ReactNode, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export function NeonButton({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  children,
  disabled,
  className = "",
  ...props
}: NeonButtonProps) {
  const variantClass = {
    primary: "neon-btn-primary",
    secondary: "neon-btn-secondary",
    ghost: "neon-btn-ghost",
    danger:
      "neon-btn inline-flex items-center justify-center gap-2 bg-neon-pink/10 text-neon-pink border border-neon-pink/30 hover:bg-neon-pink/20",
  }[variant];

  const sizeClass = {
    sm: "px-4 py-1.5 text-xs rounded-lg",
    md: "px-6 py-2.5 text-sm rounded-xl",
    lg: "px-8 py-3.5 text-base rounded-xl",
  }[size];

  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`
        ${variantClass} ${sizeClass}
        font-semibold transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
        focus:outline-none focus:ring-2 focus:ring-neon-cyan/30 focus:ring-offset-0
        ${className}
      `}
    >
      {loading ? (
        <>
          <svg
            className="w-4 h-4 animate-spin flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Processing...</span>
        </>
      ) : (
        <>
          {icon && <span className="flex-shrink-0" aria-hidden="true">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
}
