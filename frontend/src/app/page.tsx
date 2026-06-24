/**
 * @file page.tsx
 * @description Main entrypoint page for the Arbitra landing experience.
 */

import React from "react";
import type { Metadata } from "next";
import { HeroSection } from "@/components/landing/HeroSection";
import { TrustBar } from "@/components/landing/TrustBar";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { PhoneMockup } from "@/components/landing/PhoneMockup";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { CTASection } from "@/components/landing/CTASection";
import { BackgroundGrid } from "@/components/landing/BackgroundGrid";

export const metadata: Metadata = {
  title: "Arbitra - Confidential Invoice Factoring",
  description:
    "Tokenize invoices as private RWAs. FHE-encrypted face values, deterministic ingestion, and on-chain credit scoring - all on Sepolia testnet using Zama FHEVM.",
  openGraph: {
    title: "Arbitra - Confidential Invoice Factoring",
    description:
      "FHE-powered decentralized invoice factoring. Zero plaintext on-chain.",
    type: "website",
    url: "https://arbitra-dapp.vercel.app"
  },
  twitter: {
    card: "summary_large_image",
    title: "Arbitra - Confidential Invoice Factoring",
    description: "FHE-powered decentralized invoice factoring."
  },
  keywords: [
    "invoice factoring", "FHE", "FHEVM", "Zama", "DeFi", "confidential",
    "blockchain", "Sepolia", "RWA", "real world assets", "privacy"
  ]
};

export default function LandingPage() {
  return (
    <main
      style={{
        background: "linear-gradient(180deg, #020714 0%, #060B18 30%, #060B18 70%, #020714 100%)",
        minHeight: "100vh",
        overflowX: "hidden",
        position: "relative"
      }}
    >
      <BackgroundGrid />
      <HeroSection />
      <TrustBar />
      <FeaturesSection />
      <PhoneMockup />
      <HowItWorks />
      <CTASection />
    </main>
  );
}
