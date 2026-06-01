/*
 * @file page.tsx
 * @description Onboarding and registration page for suppliers joining Arbitra.
 *              Guides the user through email login, KYB verification, SBT minting, and FHE compliance.
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams }            from "next/navigation";
import { useAccount, useWriteContract,
         usePublicClient }                        from "wagmi";
import { motion, AnimatePresence }                from "framer-motion";
import { useWeb3Auth }                            from "@/providers/Web3AuthProvider";
import { useZama }                                from "@/providers/ZamaProvider";
import { GlassCard }                              from "@/components/ui/GlassCard";
import { Spinner }                                from "@/components/ui/Spinner";
import { FHEBadge }                               from "@/components/ui/FHEBadge";
import {
  SBT_ADDRESS,
  SBT_ABI,
  KYB_ORACLE_ADDRESS,
  KYB_ORACLE_ABI,
  IDENTITY_ADDRESS,
  IDENTITY_ABI,
  truncAddr,
} from "@/lib/contracts";
import { encryptUint32, encryptBool, encryptUint8 } from "@/lib/zama";

/* ─── Types ─── */
type Stage =
  | "LOGIN"
  | "WALLET_READY"
  | "KYB_PENDING"
  | "KYB_APPROVED"
  | "SBT_MINTED"
  | "FHE_SYNCED";

interface KYBResult {
  verification_id: string;
  company_status: string;
  sanctions_flag: boolean;
  pep_flag: boolean;
  risk_score: number;
  timestamp: number;
  signature: `0x${string}`;
  verificationIdBytes32: `0x${string}`;
  attestationHashBytes32: `0x${string}`;
}

/* ─── Shared Style Constants ─── */
const headingStyle: React.CSSProperties = {
  color: "#EEF2FF",
  fontSize: 22,
  fontWeight: 800,
  fontFamily: "Satoshi, sans-serif",
  letterSpacing: "-0.02em",
  marginBottom: 10,
};

const bodyStyle: React.CSSProperties = {
  color: "#8B9CC8",
  fontSize: 14,
  lineHeight: 1.7,
  fontFamily: "Satoshi, sans-serif",
};

const primaryBtnStyle: React.CSSProperties = {
  width: "100%",
  height: 52,
  background: "#00F0FF",
  color: "#020714",
  border: "none",
  borderRadius: 13,
  fontSize: 14,
  fontWeight: 700,
  fontFamily: "Satoshi, sans-serif",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  boxShadow: "0 0 20px rgba(0, 240, 255, 0.2)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: 11,
  padding: "11px 14px",
  color: "#EEF2FF",
  fontFamily: "Satoshi, sans-serif",
  fontSize: 14,
  outline: "none",
  transition: "border-color 0.2s",
};

const labelStyle: React.CSSProperties = {
  color: "#8B9CC8",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  marginBottom: 6,
  fontFamily: "Satoshi, sans-serif",
  display: "block",
};

/* ─── LockIcon ─── */
function LockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/* ─── Main Onboarding Form ─── */
export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/dashboard";

  const { wallet, isLoggedIn, login, isInitializing } = useWeb3Auth();
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { isReady: zamaReady } = useZama();

  const [stage, setStage] = useState<Stage>("LOGIN");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [kybStep, setKybStep] = useState(0);

  /* Credential checking states */
  const [isCheckingCredentials, setIsCheckingCredentials] = useState(true);

  /* KYB form inputs */
  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState("US");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [taxID, setTaxID] = useState("");
  const [docUploaded, setDocUploaded] = useState(false);

  /* Oracle response payload */
  const [kybResult, setKybResult] = useState<KYBResult | null>(null);

  /* Minting & Encryption Loader flags */
  const [isMintingSBT, setIsMintingSBT] = useState(false);
  const [isEncryptingFHE, setIsEncryptingFHE] = useState(false);

  /* Advance to WALLET_READY if logged in */
  useEffect(() => {
    if (!isInitializing && isLoggedIn && wallet && stage === "LOGIN") {
      setStage("WALLET_READY");
    }
  }, [isLoggedIn, isInitializing, wallet, stage]);

  /* Run credential verification check inside WALLET_READY */
  useEffect(() => {
    if (stage !== "WALLET_READY" || !wallet || !publicClient) return;

    let active = true;

    const checkCredentials = async () => {
      try {
        setIsCheckingCredentials(true);

        /* Query Soulbound Token contract for valid credential */
        const hasSBT = (await publicClient.readContract({
          address: SBT_ADDRESS,
          abi: SBT_ABI,
          functionName: "hasValidSBT",
          args: [wallet],
        })) as boolean;

        if (!active) return;

        if (hasSBT) {
          /* Check if FHE identity data was submitted */
          const hasFHE = (await publicClient.readContract({
            address: IDENTITY_ADDRESS,
            abi: IDENTITY_ABI,
            functionName: "hasEncryptedCompliance",
            args: [wallet],
          })) as boolean;

          if (!active) return;

          if (hasFHE) {
            router.push(nextPath);
          } else {
            setStage("SBT_MINTED");
          }
        }
      } catch (e) {
        console.error("[Register] Credential check failed:", e);
      } finally {
        if (active) {
          setIsCheckingCredentials(false);
        }
      }
    };

    checkCredentials();

    return () => {
      active = false;
    };
  }, [stage, wallet, publicClient, router, nextPath]);

  /* Mock oracle steps sequence simulator */
  useEffect(() => {
    if (stage !== "KYB_PENDING") return;
    const delays = [800, 1800, 2800, 3800];
    const timers = delays.map((d, idx) =>
      setTimeout(() => setKybStep(idx + 1), d)
    );
    const finalTimer = setTimeout(() => setStage("KYB_APPROVED"), 4500);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finalTimer);
    };
  }, [stage]);

  /* Web3Auth login handler */
  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await login();
    } catch (e) {
      console.error(e);
      setError("Email login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  /* Form submission triggering mock KYB verification backend */
  const handleKYBSubmit = async () => {
    if (!companyName.trim()) return setError("Company Name is required.");
    if (!registrationNumber.trim()) return setError("Registration Number is required.");
    if (!taxID.trim()) return setError("Tax ID / VAT is required.");
    if (!docUploaded) return setError("Please upload the Certificate of Incorporation.");

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/kyb-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          companyName,
          country,
          registrationNumber,
          taxID,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "KYB validation failed.");
      }

      setKybResult(data);
      setKybStep(0);
      setStage("KYB_PENDING");
    } catch (e: any) {
      setError(e.message || "KYB processing failed.");
    } finally {
      setIsLoading(false);
    }
  };

  /* Mint SBT using oracle signature payload */
  const handleMintSBT = async () => {
    if (!kybResult || !publicClient) return;
    setIsMintingSBT(true);
    setError(null);

    try {
      const tx = await writeContractAsync({
        address: KYB_ORACLE_ADDRESS,
        abi: KYB_ORACLE_ABI,
        functionName: "submitKYBAttestation",
        args: [
          wallet as `0x${string}`,
          kybResult.verificationIdBytes32,
          kybResult.attestationHashBytes32,
          kybResult.risk_score,
          BigInt(kybResult.timestamp),
          kybResult.signature,
        ],
      });

      await publicClient.waitForTransactionReceipt({ hash: tx });
      setStage("SBT_MINTED");
    } catch (e: any) {
      console.error(e);
      setError(e.message || "On-chain SBT minting transaction failed.");
    } finally {
      setIsMintingSBT(false);
    }
  };

  /* Client-side FHE encryption and submission to ArbitraIdentity */
  const handleFHESubmit = async () => {
    if (!wallet || !kybResult || !publicClient) return;
    setIsEncryptingFHE(true);
    setError(null);

    try {
      /* Extract numeric values of Tax ID */
      const taxIDInt = parseInt(taxID.replace(/\D/g, "").slice(0, 9), 10);
      if (isNaN(taxIDInt)) throw new Error("Invalid Tax ID format.");

      /* Encrypt compliance data in-browser */
      const encTax = await encryptUint32(BigInt(taxIDInt), wallet, IDENTITY_ADDRESS);
      const encKyb = await encryptBool(true, wallet, IDENTITY_ADDRESS);
      const encRisk = await encryptUint8(BigInt(kybResult.risk_score), wallet, IDENTITY_ADDRESS);

      const tx = await writeContractAsync({
        address: IDENTITY_ADDRESS,
        abi: IDENTITY_ABI,
        functionName: "submitEncryptedCompliance",
        args: [
          encTax.handle,
          encTax.proof,
          encKyb.handle,
          encKyb.proof,
          encRisk.handle,
          encRisk.proof,
        ],
      });

      await publicClient.waitForTransactionReceipt({ hash: tx });
      setStage("FHE_SYNCED");
    } catch (e: any) {
      console.error(e);
      setError(e.message || "FHE compliance transaction failed.");
    } finally {
      setIsEncryptingFHE(false);
    }
  };

  return (
    <main
      style={{
        background: "radial-gradient(circle at center, #0b152d 0%, #030814 100%)",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "520px" }}>
        <AnimatePresence mode="wait">
          {/* ════ Stage 1: LOGIN ════ */}
          {stage === "LOGIN" && (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <GlassCard className="p-8 text-center" glow="cyan">
                <div
                  style={{
                    width: "60px",
                    height: "60px",
                    borderRadius: "18px",
                    background: "rgba(0, 240, 255, 0.1)",
                    border: "1px solid rgba(0, 240, 255, 0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "28px",
                    fontWeight: 800,
                    color: "#00F0FF",
                    margin: "0 auto 24px",
                  }}
                >
                  A
                </div>
                <h1 style={{ ...headingStyle, fontSize: "24px" }}>
                  Join Arbitra
                </h1>
                <p style={{ ...bodyStyle, marginBottom: "32px" }}>
                  Confidential invoice factoring for verified businesses.
                  No MetaMask required.
                </p>

                {error && (
                  <div
                    style={{
                      background: "rgba(255,45,107,0.1)",
                      border: "1px solid rgba(255,45,107,0.2)",
                      borderRadius: "12px",
                      padding: "12px",
                      color: "#FF5E8C",
                      fontSize: "13px",
                      marginBottom: "20px",
                      textAlign: "left",
                    }}
                  >
                    {error}
                  </div>
                )}

                <button
                  onClick={handleLogin}
                  disabled={isLoading}
                  style={primaryBtnStyle}
                >
                  {isLoading ? (
                    <>
                      <Spinner /> Creating secure session...
                    </>
                  ) : (
                    <>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      Login with Email
                    </>
                  )}
                </button>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "10px",
                    marginTop: "24px",
                  }}
                >
                  {["🔒 Soulbound Gate", "🛡 FHE Identity", "⚡ Instant OTP"].map((tag) => (
                    <span
                      key={tag}
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.05)",
                        borderRadius: "100px",
                        padding: "4px 10px",
                        fontSize: "11px",
                        color: "#8B9CC8",
                        fontWeight: 600,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* ════ Stage 2: WALLET_READY (Loading Check OR KYB Form) ════ */}
          {stage === "WALLET_READY" && (
            <motion.div
              key="wallet-ready"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              {isCheckingCredentials ? (
                <GlassCard className="p-8 text-center" glow="cyan">
                  <Spinner />
                  <h2
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      color: "#EEF2FF",
                      marginTop: "20px",
                      marginBottom: "8px",
                    }}
                  >
                    Verifying Soulbound credentials...
                  </h2>
                  <p
                    style={{
                      color: "#8B9CC8",
                      fontSize: "13px",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    Wallet: {truncAddr(wallet)}
                  </p>
                </GlassCard>
              ) : (
                <GlassCard className="p-8" glow="cyan">
                  {/* Warning banner */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: "rgba(255,186,0,0.06)",
                      border: "1px solid rgba(255,186,0,0.2)",
                      marginBottom: "24px",
                    }}
                  >
                    <LockIcon size={18} />
                    <span style={{ fontSize: "12px", color: "#FFBA00", fontWeight: 700 }}>
                      KYB Verification Required for Marketplace
                    </span>
                  </div>

                  {/* Wallet Connection Card */}
                  <div
                    style={{
                      background: "rgba(0,240,255,0.04)",
                      border: "1px solid rgba(0,240,255,0.15)",
                      borderRadius: 11,
                      padding: "10px 14px",
                      marginBottom: 22,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ color: "#4F6495", fontSize: 11 }}>Wallet Connected</span>
                    <span style={{ color: "#00F0FF", fontFamily: "JetBrains Mono,monospace", fontSize: 12 }}>
                      {truncAddr(wallet ?? "")}
                    </span>
                    <span
                      style={{
                        background: "rgba(255,186,0,0.1)",
                        border: "1px solid rgba(255,186,0,0.25)",
                        borderRadius: 100,
                        padding: "2px 9px",
                        color: "#FFBA00",
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      Unverified
                    </span>
                  </div>

                  <h2 style={headingStyle}>Verify Your Business</h2>
                  <p style={{ ...bodyStyle, marginBottom: 22 }}>
                    Complete the KYB form below. Your Tax ID will be encrypted using Zama FHEVM
                    after verification - never stored in plaintext.
                  </p>

                  {error && (
                    <div
                      style={{
                        background: "rgba(255,45,107,0.1)",
                        border: "1px solid rgba(255,45,107,0.2)",
                        borderRadius: "12px",
                        padding: "12px",
                        color: "#FF5E8C",
                        fontSize: "13px",
                        marginBottom: "20px",
                      }}
                    >
                      {error}
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div>
                      <label style={labelStyle}>Company Name</label>
                      <input
                        type="text"
                        placeholder="Acme Supplies Ltd"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>Country</label>
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        style={{ ...inputStyle, background: "#0b152d" }}
                      >
                        <option value="">Select country...</option>
                        {["United States", "United Kingdom", "Nigeria", "Canada", "Germany", "Singapore",
                          "United Arab Emirates", "Australia", "India", "Brazil", "Other"].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>Business Registration Number</label>
                      <input
                        type="text"
                        placeholder="RC-12345678"
                        value={registrationNumber}
                        onChange={(e) => setRegistrationNumber(e.target.value)}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>Tax ID / VAT Number</label>
                      <input
                        type="text"
                        placeholder="991-20-4855"
                        value={taxID}
                        onChange={(e) => setTaxID(e.target.value)}
                        style={inputStyle}
                      />
                      <span style={{ fontSize: "10px", color: "#4F6495", marginTop: "4px", display: "block" }}>
                        🔒 Will be encrypted using Zama FHEVM after verification. Never stored in plaintext.
                      </span>
                    </div>

                    <div>
                      <label style={labelStyle}>Certificate of Incorporation</label>
                      <div
                        onClick={() => setDocUploaded(true)}
                        style={{
                          padding: "24px",
                          border: "2px dashed rgba(255,255,255,0.1)",
                          borderRadius: "12px",
                          textAlign: "center",
                          cursor: "pointer",
                          background: docUploaded ? "rgba(0,255,136,0.02)" : "rgba(255,255,255,0.01)",
                          borderColor: docUploaded ? "rgba(0,255,136,0.25)" : "rgba(255,255,255,0.1)",
                        }}
                      >
                        {docUploaded ? (
                          <p style={{ color: "#00FF88", fontSize: "13px", fontWeight: 600 }}>
                            ✓ certificate_of_incorporation.pdf (Attached)
                          </p>
                        ) : (
                          <p style={{ color: "#8B9CC8", fontSize: "13px" }}>
                            Click to upload PDF or image document
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleKYBSubmit}
                    disabled={isLoading}
                    style={{ ...primaryBtnStyle, marginTop: "24px" }}
                  >
                    {isLoading ? <Spinner /> : "Submit for Verification →"}
                  </button>
                </GlassCard>
              )}
            </motion.div>
          )}

          {/* ════ Stage 3: KYB_PENDING ════ */}
          {stage === "KYB_PENDING" && (
            <motion.div
              key="kyb-pending"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <GlassCard className="p-8" glow="cyan">
                <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#EEF2FF", marginBottom: "20px" }}>
                  Verification Processing...
                </h2>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {[
                    "Validating company registration metadata",
                    "Sanction list and AML compliance check",
                    "Generating company risk assessment parameters",
                    "Signing EIP-712 compliance attestation",
                  ].map((stepDesc, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      {kybStep > idx ? (
                        <div
                          style={{
                            width: "18px",
                            height: "18px",
                            borderRadius: "50%",
                            background: "#00FF88",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "10px",
                            color: "#030814",
                            fontWeight: 700,
                          }}
                        >
                          ✓
                        </div>
                      ) : kybStep === idx ? (
                        <Spinner size={16} />
                      ) : (
                        <div style={{ width: "18px", height: "18px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)" }} />
                      )}
                      <span
                        style={{
                          fontSize: "13px",
                          color: kybStep > idx ? "#00FF88" : kybStep === idx ? "#EEF2FF" : "#4F6495",
                        }}
                      >
                        {stepDesc}
                      </span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* ════ Stage 4: KYB_APPROVED ════ */}
          {stage === "KYB_APPROVED" && (
            <motion.div
              key="kyb-approved"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <GlassCard className="p-8 text-center" glow="cyan">
                <div
                  style={{
                    width: "50px",
                    height: "50px",
                    borderRadius: "50%",
                    background: "rgba(0, 255, 136, 0.1)",
                    border: "1px solid rgba(0, 255, 136, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    color: "#00FF88",
                    margin: "0 auto 20px",
                  }}
                >
                  ✓
                </div>
                <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#EEF2FF", marginBottom: "8px" }}>
                  KYB Verification Approved!
                </h2>
                <p style={{ ...bodyStyle, marginBottom: "24px" }}>
                  The Arbitra Compliance Oracle has verified your credentials and signed the attestation. Mint your Soulbound Token on-chain.
                </p>

                {error && (
                  <div
                    style={{
                      background: "rgba(255,45,107,0.1)",
                      border: "1px solid rgba(255,45,107,0.2)",
                      borderRadius: "12px",
                      padding: "12px",
                      color: "#FF5E8C",
                      fontSize: "13px",
                      marginBottom: "20px",
                      textAlign: "left",
                    }}
                  >
                    {error}
                  </div>
                )}

                <div
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.04)",
                    borderRadius: "12px",
                    padding: "14px",
                    marginBottom: "24px",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "12px" }}>
                    <span style={{ color: "#8B9CC8" }}>Verification ID:</span>
                    <span style={{ color: "#00F0FF", fontFamily: "JetBrains Mono, monospace" }}>
                      {kybResult?.verification_id}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                    <span style={{ color: "#8B9CC8" }}>Compliance Risk Score:</span>
                    <span style={{ color: "#00FF88", fontWeight: 700 }}>{kybResult?.risk_score}/100</span>
                  </div>
                </div>

                <button
                  onClick={handleMintSBT}
                  disabled={isMintingSBT}
                  style={{
                    ...primaryBtnStyle,
                    background: "linear-gradient(90deg, #00FF88 0%, #00FFC4 100%)",
                    boxShadow: "0 4px 20px rgba(0, 255, 136, 0.25)",
                  }}
                >
                  {isMintingSBT ? <Spinner /> : "Mint soulbound verification token"}
                </button>
              </GlassCard>
            </motion.div>
          )}

          {/* ════ Stage 5: SBT_MINTED ════ */}
          {stage === "SBT_MINTED" && (
            <motion.div
              key="sbt-minted"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <GlassCard className="p-8" glow="cyan">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#EEF2FF" }}>
                    Encrypt Compliance Profile
                  </h2>
                  <FHEBadge />
                </div>
                <p style={{ color: "#8B9CC8", fontSize: "13px", lineHeight: 1.5, marginBottom: "20px" }}>
                  Encrypt your private compliance attributes using Zama Fully Homomorphic Encryption (FHEVM) and commit them to the blockchain.
                </p>

                <div
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.04)",
                    borderRadius: "14px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    marginBottom: "20px",
                  }}
                >
                  {[
                    { label: "Tax ID / VAT", type: "euint32" },
                    { label: "KYB Status", type: "ebool" },
                    { label: "Risk Score", type: "euint8" },
                  ].map((field) => (
                    <div key={field.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "13px", color: "#EEF2FF", fontWeight: 600 }}>{field.label}</span>
                      <span
                        style={{
                          background: "rgba(0, 240, 255, 0.1)",
                          border: "1px solid rgba(0, 240, 255, 0.2)",
                          borderRadius: "100px",
                          padding: "2px 8px",
                          fontSize: "11px",
                          color: "#00F0FF",
                          fontWeight: 700,
                          fontFamily: "JetBrains Mono, monospace",
                        }}
                      >
                        {field.type}
                      </span>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    padding: "12px",
                    borderRadius: "10px",
                    background: "rgba(0,240,255,0.03)",
                    border: "1px solid rgba(0,240,255,0.1)",
                    marginBottom: "24px",
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#00F0FF"
                    strokeWidth="2"
                    style={{ flexShrink: 0, marginTop: "2px" }}
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <p style={{ color: "#8B9CC8", fontSize: "11px", lineHeight: 1.5 }}>
                    Your fields will be encrypted client-side in your browser before submission. Plain-text data never hits the blockchain.
                  </p>
                </div>

                {error && (
                  <div
                    style={{
                      background: "rgba(255,45,107,0.1)",
                      border: "1px solid rgba(255,45,107,0.2)",
                      borderRadius: "12px",
                      padding: "12px",
                      color: "#FF5E8C",
                      fontSize: "13px",
                      marginBottom: "20px",
                    }}
                  >
                    {error}
                  </div>
                )}

                <button
                  onClick={handleFHESubmit}
                  disabled={isEncryptingFHE}
                  style={primaryBtnStyle}
                >
                  {isEncryptingFHE ? <Spinner /> : "Encrypt and submit compliance"}
                </button>
              </GlassCard>
            </motion.div>
          )}

          {/* ════ Stage 6: FHE_SYNCED ════ */}
          {stage === "FHE_SYNCED" && (
            <motion.div
              key="fhe-synced"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <GlassCard className="p-8 text-center" glow="cyan">
                <div
                  style={{
                    width: "60px",
                    height: "60px",
                    borderRadius: "50%",
                    background: "rgba(0, 255, 136, 0.1)",
                    border: "1px solid rgba(0, 255, 136, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "28px",
                    color: "#00FF88",
                    margin: "0 auto 24px",
                  }}
                >
                  ✓
                </div>
                <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#EEF2FF", marginBottom: "10px", fontFamily: "Satoshi, sans-serif" }}>
                  Verification Complete!
                </h2>
                <p style={{ color: "#8B9CC8", fontSize: "14px", lineHeight: 1.5, marginBottom: "32px" }}>
                  Your business has been successfully verified. Soulbound Token is minted on-chain and compliance parameters are FHE-encrypted.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "32px" }}>
                  {[
                    { label: "SBT status", value: "Valid", color: "#00FF88" },
                    { label: "Risk classification", value: "Verified Low", color: "#00FF88" },
                    { label: "Privacy protocol", value: "FHE Locked", color: "#00F0FF" },
                    { label: "Marketplace gate", value: "Unlocked", color: "#00F0FF" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      style={{
                        padding: "14px",
                        borderRadius: "12px",
                        background: "rgba(255,255,255,0.01)",
                        border: "1px solid rgba(255,255,255,0.03)",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ fontSize: "10px", color: "#8B9CC8", textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>
                        {stat.label}
                      </span>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: stat.color, marginTop: "4px", display: "block" }}>
                        {stat.value}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => router.push(nextPath)}
                  style={primaryBtnStyle}
                >
                  Enter Factoring Marketplace →
                </button>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
