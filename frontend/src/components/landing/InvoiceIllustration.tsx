/**
 * @file InvoiceIllustration.tsx
 * @description SVG illustration representing FHE-encrypted invoice documents.
 */

import React from "react";

export function InvoiceIllustration() {
  return (
    <svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Document body */}
      <rect x="40" y="10" width="120" height="140" rx="8" fill="rgba(0,240,255,0.06)" stroke="rgba(0,240,255,0.25)" strokeWidth="1.5"/>
      {/* Document lines representing text */}
      <rect x="56" y="28" width="88" height="5" rx="2.5" fill="rgba(0,240,255,0.15)"/>
      <rect x="56" y="40" width="64" height="4" rx="2" fill="rgba(255,255,255,0.07)"/>
      <rect x="56" y="52" width="80" height="4" rx="2" fill="rgba(255,255,255,0.07)"/>
      <rect x="56" y="64" width="72" height="4" rx="2" fill="rgba(255,255,255,0.07)"/>
      {/* Encrypted value blocks (cipher bars) */}
      <rect x="56" y="80" width="88" height="8" rx="4" fill="rgba(0,240,255,0.08)" stroke="rgba(0,240,255,0.2)" strokeWidth="1"/>
      <rect x="56" y="96" width="60" height="8" rx="4" fill="rgba(0,240,255,0.08)" stroke="rgba(0,240,255,0.2)" strokeWidth="1"/>
      {/* FHE glow ring */}
      <circle cx="100" cy="115" r="22" fill="rgba(0,240,255,0.06)" stroke="rgba(0,240,255,0.3)" strokeWidth="1.5"/>
      <circle cx="100" cy="115" r="30" fill="none" stroke="rgba(0,240,255,0.1)" strokeWidth="1" strokeDasharray="4 4"/>
      {/* Lock icon */}
      <rect x="92" y="118" width="16" height="12" rx="2" fill="none" stroke="#00F0FF" strokeWidth="1.8"/>
      <path d="M95 118v-3a5 5 0 0 1 10 0v3" stroke="#00F0FF" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="100" cy="124" r="1.5" fill="#00F0FF"/>
      {/* Corner accent */}
      <path d="M140 10 L160 10 L160 30" stroke="rgba(0,240,255,0.4)" strokeWidth="1.5" fill="none"/>
    </svg>
  );
}
