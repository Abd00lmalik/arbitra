"use client";

import { useState } from "react";
import { FHEBadge } from "./FHEBadge";

interface EncryptedValueProps {
  /** Clear-text value to display once decrypted */
  clearValue?: string;
  /** Whether the decrypted value is available */
  isDecrypted?: boolean;
  /** Whether decryption is in progress */
  isDecrypting?: boolean;
  /** Class for the encrypted placeholder */
  className?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

/**
 * Displays either a scrambled FHE-encrypted placeholder or the decrypted value.
 * The scramble effect communicates that real data is hidden behind FHE.
 */
export function EncryptedValue({
  clearValue,
  isDecrypted = false,
  isDecrypting = false,
  className = "",
  size = "md",
}: EncryptedValueProps) {
  const [hovered, setHovered] = useState(false);

  const sizeClass = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }[size];

  if (isDecrypting) {
    return (
      <span className={`inline-flex items-center gap-2 ${sizeClass} ${className}`}>
        <span className="animate-pulse text-neon-cyan font-mono opacity-70">
          Decrypting...
        </span>
      </span>
    );
  }

  if (isDecrypted && clearValue) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-mono text-neon-green font-medium ${sizeClass} ${className}`}
      >
        <svg
          className="w-3 h-3 flex-shrink-0"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M2 6.5L4.5 9L10 3"
            stroke="#00FF88"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {clearValue}
      </span>
    );
  }

  /* Encrypted placeholder — scrambled characters with neon styling */
  const scrambled = "••••••••";

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${sizeClass} ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        className="font-mono text-neon-cyan/60 tracking-widest select-none"
        title="Encrypted with FHE — requires permission to decrypt"
        aria-label="Encrypted value"
      >
        {hovered ? (
          <span className="inline-flex gap-0.5">
            {[..."0xAF3B"].map((char, i) => (
              <span
                key={i}
                className="animate-pulse"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                {char}
              </span>
            ))}
            <span className="opacity-40">...••••</span>
          </span>
        ) : (
          scrambled
        )}
      </span>
      <FHEBadge size="sm" animated={false} label="" />
    </span>
  );
}
