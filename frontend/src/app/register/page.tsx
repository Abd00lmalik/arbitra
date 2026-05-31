/**
 * @file page.tsx
 * @description Onboarding and registration page for suppliers joining Arbitra.
 *              Guides the user through email login, KYB verification, SBT minting, and FHE compliance.
 */

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { useWeb3Auth } from "@/providers/Web3AuthProvider";
import { useZama } from "@/providers/ZamaProvider";
import { GlassCard } from "@/components/ui/GlassCard";
import { Spinner } from "@/components/ui/Spinner";
import { FHEBadge } from "@/components/ui/FHEBadge";
import {
  SBT_ADDRESS,
  SBT_ABI,
  KYB_ORACLE_ADDRESS,
  KYB_ORACLE_ABI,
  IDENTITY_ADDRESS,
  IDENTITY_ABI,
  truncAddr
} from "@/lib/contracts";
import { encryptUint32, encryptBool, encryptUint8 } from "@/lib/zama";

type OnboardingState =
  | "LOGIN"
  | "WALLET_READY"
  | "KYB_FORM"
  | "KYB_PENDING"
  | "KYB_APPROVED"
  | "SBT_MINTED"
  | "FHE_SYNCED";

export default function RegisterPage() {
  const router = useRouter();
  const { wallet: web3authWallet, isLoggedIn, login, getUserInfo } = useWeb3Auth();
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { isReady: zamaReady } = useZama();

  const [state, setState] = useState<OnboardingState>("LOGIN");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [kybStep, setKybStep] = useState(0);

  /* KYB form inputs */
  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState("US");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [taxID, setTaxID] = useState("");
  const [docUploaded, setDocUploaded] = useState(false);

  /* Oracle response payload */
  const [kybResult, setKybResult] = useState<{
    verification_id: string;
    company_status: string;
    sanctions_flag: boolean;
    pep_flag: boolean;
    risk_score: number;
    timestamp: number;
    signature: `0x${string}`;
    verificationIdBytes32: `0x${string}`;
    attestationHashBytes32: `0x${string}`;
  } | null>(null);

  /* FHE verification states */
  const [isMintingSBT, setIsMintingSBT] = useState(false);
  const [isEncryptingFHE, setIsEncryptingFHE] = useState(false);

  /* Transition if logged in */
  useEffect(() => {
    if (isLoggedIn && web3authWallet && state === "LOGIN") {
      setState("WALLET_READY");
    }
  }, [isLoggedIn, web3authWallet, state]);

  /* Handle SBT / FHE check when in WALLET_READY */
  useEffect(() => {
    if (state !== "WALLET_READY" || !web3authWallet || !publicClient) return;

    let active = true;
    const runChecks = async () => {
      try {
        /* Check SBT */
        const hasSBT = await publicClient.readContract({
          address: SBT_ADDRESS,
          abi: SBT_ABI,
          functionName: "hasValidSBT",
          args: [web3authWallet],
        }) as boolean;

        if (!active) return;

        if (hasSBT) {
          /* Check FHE identity */
          const hasFHE = await publicClient.readContract({
            address: IDENTITY_ADDRESS,
            abi: IDENTITY_ABI,
            functionName: "hasEncryptedCompliance",
            args: [web3authWallet],
          }) as boolean;

          if (!active) return;

          if (hasFHE) {
            router.push("/dashboard");
          } else {
            setState("SBT_MINTED");
          }
        } else {
          setState("KYB_FORM");
        }
      } catch (e) {
        console.error("Onboarding checks failed:", e);
        if (active) setState("KYB_FORM");
      }
    };

    runChecks();
    return () => { active = false; };
  }, [state, web3authWallet, publicClient, router]);

  /* Animate mock oracle verification steps */
  useEffect(() => {
    if (state !== "KYB_PENDING") return;
    const delays = [800, 1800, 2800, 3800];
    const timers = delays.map((d, idx) =>
      setTimeout(() => setKybStep(idx + 1), d)
    );
    const finalTimer = setTimeout(() => setState("KYB_APPROVED"), 4500);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finalTimer);
    };
  }, [state]);

  const handleWeb3AuthLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await login();
    } catch (e) {
      console.error(e);
      setError("Login failed. Check your network or connection.");
    } finally {
      setIsLoading(false);
    }
  };

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
          wallet: web3authWallet,
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
      setState("KYB_PENDING");
    } catch (e: any) {
      setError(e.message || "KYB processing failed.");
    } finally {
      setIsLoading(false);
    }
  };

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
          web3authWallet as `0x${string}`,
          kybResult.verificationIdBytes32,
          kybResult.attestationHashBytes32,
          kybResult.risk_score,
          BigInt(kybResult.timestamp),
          kybResult.signature,
        ],
      });

      await publicClient.waitForTransactionReceipt({ hash: tx });
      setState("SBT_MINTED");
    } catch (e: any) {
      console.error(e);
      setError(e.message || "On-chain SBT minting transaction failed.");
    } finally {
      setIsMintingSBT(false);
    }
  };

  const handleFHESubmit = async () => {
    if (!web3authWallet || !kybResult || !publicClient) return;
    setIsEncryptingFHE(true);
    setError(null);

    try {
      /* Extract numeric components of Tax ID */
      const taxIDInt = parseInt(taxID.replace(/\D/g, "").slice(0, 9));
      if (isNaN(taxIDInt)) throw new Error("Invalid Tax ID format.");

      /* Encrypt compliance parameters using FHE VM client SDK */
      const encTax = await encryptUint32(BigInt(taxIDInt), web3authWallet, IDENTITY_ADDRESS);
      const encKyb = await encryptBool(true, web3authWallet, IDENTITY_ADDRESS);
      const encRisk = await encryptUint8(BigInt(kybResult.risk_score), web3authWallet, IDENTITY_ADDRESS);

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
      setState("FHE_SYNCED");
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
          {/* STATE 1: LOGIN */}
          {state === "LOGIN" && (
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
                <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#EEF2FF", marginBottom: "12px", fontFamily: "Satoshi, sans-serif" }}>
                  Join Arbitra
                </h1>
                <p style={{ color: "#8B9CC8", fontSize: "14px", lineHeight: 1.6, marginBottom: "32px" }}>
                  Tokenize invoices as private RWAs. Complete compliance verification to unlock secure invoice factoring.
                </p>

                {error && (
                  <div style={{ background: "rgba(255,45,107,0.1)", border: "1px solid rgba(255,45,107,0.2)", borderRadius: "12px", padding: "12px", color: "#FF5E8C", fontSize: "13px", marginBottom: "20px", textAlign: "left" }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={handleWeb3AuthLogin}
                  disabled={isLoading}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "12px",
                    background: "linear-gradient(90deg, #00C4FF 0%, #00F0FF 100%)",
                    color: "#030814",
                    fontWeight: 700,
                    fontSize: "15px",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 4px 20px rgba(0, 240, 255, 0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  {isLoading ? (
                    <>
                      <Spinner /> Initializing Secure Session...
                    </>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      Login with Email
                    </>
                  )}
                </button>

                <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "24px" }}>
                  {["🔒 Soulbound Gate", "🛡 FHE Identity", "⚡ Instant OTP"].map((tag) => (
                    <span key={tag} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "100px", padding: "4px 10px", fontSize: "11px", color: "#8B9CC8", fontWeight: 600 }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* STATE 2: WALLET_READY */}
          {state === "WALLET_READY" && (
            <motion.div
              key="wallet-ready"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <GlassCard className="p-8 text-center" glow="cyan">
                <Spinner />
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#EEF2FF", marginTop: "20px", marginBottom: "8px" }}>
                  Verifying Soulbound credentials...
                </h2>
                <p style={{ color: "#8B9CC8", fontSize: "13px", fontFamily: "JetBrains Mono, monospace" }}>
                  Wallet: {truncAddr(web3authWallet)}
                </p>
              </GlassCard>
            </motion.div>
          )}

          {/* STATE 3: KYB_FORM */}
          {state === "KYB_FORM" && (
            <motion.div
              key="kyb-form"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <GlassCard className="p-8" glow="cyan">
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "10px", background: "rgba(255,186,0,0.06)", border: "1px solid rgba(255,186,0,0.2)", marginBottom: "24px" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFBA00" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span style={{ fontSize: "12px", color: "#FFBA00", fontWeight: 700 }}>
                    KYB Verification Required for Marketplace
                  </span>
                </div>

                <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#EEF2FF", marginBottom: "8px" }}>
                  Business Verification
                </h2>
                <p style={{ color: "#8B9CC8", fontSize: "13px", lineHeight: 1.5, marginBottom: "24px" }}>
                  Submit business registry coordinates to issue your Soulbound Token verification credential.
                </p>

                {error && (
                  <div style={{ background: "rgba(255,45,107,0.1)", border: "1px solid rgba(255,45,107,0.2)", borderRadius: "12px", padding: "12px", color: "#FF5E8C", fontSize: "13px", marginBottom: "20px" }}>
                    {error}
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", color: "#8B9CC8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px", fontWeight: 700 }}>
                      Company Name
                    </label>
                    <input
                      type="text"
                      placeholder="Acme Trading Ltd"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      style={{ width: "100%", padding: "12px", borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", color: "#EEF2FF", outline: "none", fontSize: "14px" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", color: "#8B9CC8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px", fontWeight: 700 }}>
                      Jurisdiction Country
                    </label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      style={{ width: "100%", padding: "12px", borderRadius: "10px", background: "#0b152d", border: "1px solid rgba(255,255,255,0.08)", color: "#EEF2FF", outline: "none", fontSize: "14px" }}
                    >
                      <option value="US">United States (US)</option>
                      <option value="GB">United Kingdom (GB)</option>
                      <option value="DE">Germany (DE)</option>
                      <option value="SG">Singapore (SG)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", color: "#8B9CC8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px", fontWeight: 700 }}>
                      Business Registration Number
                    </label>
                    <input
                      type="text"
                      placeholder="RC-99887766"
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      style={{ width: "100%", padding: "12px", borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", color: "#EEF2FF", outline: "none", fontSize: "14px" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", color: "#8B9CC8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px", fontWeight: 700 }}>
                      Tax ID / VAT
                    </label>
                    <input
                      type="text"
                      placeholder="VAT-123456"
                      value={taxID}
                      onChange={(e) => setTaxID(e.target.value)}
                      style={{ width: "100%", padding: "12px", borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", color: "#EEF2FF", outline: "none", fontSize: "14px" }}
                    />
                    <span style={{ fontSize: "10px", color: "#4F6495", marginTop: "4px", display: "block" }}>
                      This value will be FHE-encrypted and is never stored in plaintext.
                    </span>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", color: "#8B9CC8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px", fontWeight: 700 }}>
                      Certificate of Incorporation (In-Browser Upload)
                    </label>
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
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "12px",
                    background: "linear-gradient(90deg, #00C4FF 0%, #00F0FF 100%)",
                    color: "#030814",
                    fontWeight: 700,
                    fontSize: "15px",
                    border: "none",
                    cursor: "pointer",
                    marginTop: "24px",
                    boxShadow: "0 4px 20px rgba(0, 240, 255, 0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  {isLoading ? <Spinner /> : "Verify Identity"}
                </button>
              </GlassCard>
            </motion.div>
          )}

          {/* STATE 4: KYB_PENDING */}
          {state === "KYB_PENDING" && (
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
                        <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "#00FF88", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#030814", fontWeight: 700 }}>
                          ✓
                        </div>
                      ) : kybStep === idx ? (
                        <Spinner size={16} />
                      ) : (
                        <div style={{ width: "18px", height: "18px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)" }} />
                      )}
                      <span style={{ fontSize: "13px", color: kybStep > idx ? "#00FF88" : kybStep === idx ? "#EEF2FF" : "#4F6495" }}>
                        {stepDesc}
                      </span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* STATE 5: KYB_APPROVED */}
          {state === "KYB_APPROVED" && (
            <motion.div
              key="kyb-approved"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <GlassCard className="p-8 text-center" glow="cyan">
                <div style={{ width: "50px", height: "50px", borderRadius: "50%", background: "rgba(0, 255, 136, 0.1)", border: "1px solid rgba(0, 255, 136, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: "#00FF88", margin: "0 auto 20px" }}>
                  ✓
                </div>
                <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#EEF2FF", marginBottom: "8px" }}>
                  KYB Verification Approved!
                </h2>
                <p style={{ color: "#8B9CC8", fontSize: "13px", lineHeight: 1.5, marginBottom: "24px" }}>
                  The Arbitra Compliance Oracle has verified your credentials and signed the attestation. Mint your Soulbound Token on-chain.
                </p>

                {error && (
                  <div style={{ background: "rgba(255,45,107,0.1)", border: "1px solid rgba(255,45,107,0.2)", borderRadius: "12px", padding: "12px", color: "#FF5E8C", fontSize: "13px", marginBottom: "20px", textAlign: "left" }}>
                    {error}
                  </div>
                )}

                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "12px", padding: "14px", marginBottom: "24px", textAlign: "left" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "12px" }}>
                    <span style={{ color: "#8B9CC8" }}>Verification ID:</span>
                    <span style={{ color: "#00F0FF", fontFamily: "JetBrains Mono, monospace" }}>{kybResult?.verification_id}</span>
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
                    width: "100%",
                    padding: "14px",
                    borderRadius: "12px",
                    background: "linear-gradient(90deg, #00FF88 0%, #00FFC4 100%)",
                    color: "#030814",
                    fontWeight: 700,
                    fontSize: "15px",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 4px 20px rgba(0, 255, 136, 0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  {isMintingSBT ? <Spinner /> : "Mint soulbound verification token"}
                </button>
              </GlassCard>
            </motion.div>
          )}

          {/* STATE 6: SBT_MINTED */}
          {state === "SBT_MINTED" && (
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

                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "14px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                  {[
                    { label: "Tax ID / VAT", type: "euint32" },
                    { label: "KYB Status", type: "ebool" },
                    { label: "Risk Score", type: "euint8" },
                  ].map((field) => (
                    <div key={field.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "13px", color: "#EEF2FF", fontWeight: 600 }}>{field.label}</span>
                      <span style={{ background: "rgba(0, 240, 255, 0.1)", border: "1px solid rgba(0, 240, 255, 0.2)", borderRadius: "100px", padding: "2px 8px", fontSize: "11px", color: "#00F0FF", fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
                        {field.type}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: "10px", padding: "12px", borderRadius: "10px", background: "rgba(0,240,255,0.03)", border: "1px solid rgba(0,240,255,0.1)", marginBottom: "24px" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="2" style={{ flexShrink: 0, marginTop: "2px" }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <p style={{ color: "#8B9CC8", fontSize: "11px", lineHeight: 1.5 }}>
                    Your fields will be encrypted client-side in your browser before submission. Plaint-text data never hits the blockchain. Only your wallet key can authorize decryption requests.
                  </p>
                </div>

                {error && (
                  <div style={{ background: "rgba(255,45,107,0.1)", border: "1px solid rgba(255,45,107,0.2)", borderRadius: "12px", padding: "12px", color: "#FF5E8C", fontSize: "13px", marginBottom: "20px" }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={handleFHESubmit}
                  disabled={isEncryptingFHE}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "12px",
                    background: "linear-gradient(90deg, #00C4FF 0%, #00F0FF 100%)",
                    color: "#030814",
                    fontWeight: 700,
                    fontSize: "15px",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 4px 20px rgba(0, 240, 255, 0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  {isEncryptingFHE ? <Spinner /> : "Encrypt and submit compliance"}
                </button>
              </GlassCard>
            </motion.div>
          )}

          {/* STATE 7: FHE_SYNCED */}
          {state === "FHE_SYNCED" && (
            <motion.div
              key="fhe-synced"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <GlassCard className="p-8 text-center" glow="cyan">
                <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: "rgba(0, 255, 136, 0.1)", border: "1px solid rgba(0, 255, 136, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", color: "#00FF88", margin: "0 auto 24px" }}>
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
                    <div key={stat.label} style={{ padding: "14px", borderRadius: "12px", background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.03)", textAlign: "left" }}>
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
                  onClick={() => router.push("/dashboard")}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "12px",
                    background: "linear-gradient(90deg, #00C4FF 0%, #00F0FF 100%)",
                    color: "#030814",
                    fontWeight: 700,
                    fontSize: "15px",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 4px 20px rgba(0, 240, 255, 0.35)",
                  }}
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
