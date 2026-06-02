/*
 * @file page.tsx
 * @description Authentication and KYB onboarding entrypoint for Arbitra suppliers.
 */

"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount, useConnect, usePublicClient, useWriteContract } from "wagmi";
import { injected } from "@wagmi/core";
import { motion, AnimatePresence } from "framer-motion";
import { useWeb3Auth } from "@/providers/Web3AuthProvider";
import { GlassCard } from "@/components/ui/GlassCard";
import { Spinner } from "@/components/ui/Spinner";
import {
  IDENTITY_ABI,
  IDENTITY_ADDRESS,
  KYB_ORACLE_ABI,
  KYB_ORACLE_ADDRESS,
  SBT_ABI,
  SBT_ADDRESS,
  truncAddr,
} from "@/lib/contracts";
import { encryptBool, encryptUint32, encryptUint8 } from "@/lib/zama";

type Stage =
  | "AUTH_CHOICE"
  | "WALLET_READY"
  | "KYB_FORM"
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
  oracle_signature?: string;
  verificationIdBytes32: `0x${string}`;
  attestationHashBytes32: `0x${string}`;
}

const headingStyle: React.CSSProperties = {
  color: "#EEF2FF",
  fontSize: 24,
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
  minHeight: 54,
  background: "#00F0FF",
  color: "#020714",
  border: "none",
  borderRadius: 14,
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

const secondaryBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  background: "rgba(255,255,255,0.03)",
  color: "#EEF2FF",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "none",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 11,
  padding: "11px 14px",
  color: "#EEF2FF",
  fontFamily: "Satoshi, sans-serif",
  fontSize: 14,
  outline: "none",
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

function StatusBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 12,
        background: "rgba(255,186,0,0.06)",
        border: "1px solid rgba(255,186,0,0.2)",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFBA00" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <span style={{ color: "#FFCF6B", fontSize: 12, fontWeight: 700 }}>{children}</span>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/dashboard";

  const { wallet, isLoggedIn, isInitializing, login, authError } = useWeb3Auth();
  const { connectAsync } = useConnect();
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [stage, setStage] = useState<Stage>("AUTH_CHOICE");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [kybStep, setKybStep] = useState(0);
  const [isCheckingCredentials, setIsCheckingCredentials] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState("United States");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [taxID, setTaxID] = useState("");
  const [docUploaded, setDocUploaded] = useState(false);

  const [kybResult, setKybResult] = useState<KYBResult | null>(null);
  const [isMintingSBT, setIsMintingSBT] = useState(false);
  const [isEncryptingFHE, setIsEncryptingFHE] = useState(false);

  useEffect(() => {
    if (!isInitializing && authError) {
      setError(authError);
    }
  }, [authError, isInitializing]);

  useEffect(() => {
    if (!isInitializing && isLoggedIn && wallet && stage === "AUTH_CHOICE") {
      setStage("WALLET_READY");
    }
  }, [isInitializing, isLoggedIn, wallet, stage]);

  useEffect(() => {
    if (stage !== "WALLET_READY" || !wallet || !publicClient) return;

    const client = publicClient;

    let active = true;

    async function checkCredentials() {
      setIsCheckingCredentials(true);
      try {
        const connectedWallet = wallet;
        if (!connectedWallet) {
          setStage("AUTH_CHOICE");
          return;
        }

        const hasSBT = (await client.readContract({
          address: SBT_ADDRESS,
          abi: SBT_ABI,
          functionName: "hasValidSBT",
          args: [connectedWallet],
        })) as boolean;

        if (!active) return;

        if (!hasSBT) {
          setStage("KYB_FORM");
          return;
        }

        const hasFHE = (await client.readContract({
          address: IDENTITY_ADDRESS,
          abi: IDENTITY_ABI,
          functionName: "hasEncryptedCompliance",
          args: [connectedWallet],
        })) as boolean;

        if (!active) return;

        if (hasFHE) {
          router.push(nextPath);
          return;
        }

        setStage("SBT_MINTED");
      } catch (credentialError) {
        console.error("[Register] Credential check failed:", credentialError);
        if (active) {
          setError("Unable to verify current account status.");
          setStage("KYB_FORM");
        }
      } finally {
        if (active) {
          setIsCheckingCredentials(false);
        }
      }
    }

    checkCredentials();

    return () => {
      active = false;
    };
  }, [stage, wallet, publicClient, router, nextPath]);

  useEffect(() => {
    if (stage !== "KYB_PENDING") return;

    const delays = [900, 1800, 3000, 4200];
    const timers = delays.map((delay, index) =>
      setTimeout(() => setKybStep(index + 1), delay),
    );
    const finishTimer = setTimeout(() => setStage("KYB_APPROVED"), 5200);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finishTimer);
    };
  }, [stage]);

  async function handleEmailLogin() {
    setIsLoading(true);
    setError(null);

    try {
      await login("email");
    } catch (loginError) {
      console.error(loginError);
      setError(loginError instanceof Error ? loginError.message : "Email login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleWalletLogin() {
    setError(null);

    try {
      await connectAsync({ connector: injected() });
    } catch (walletError) {
      console.error(walletError);
      setError(walletError instanceof Error ? walletError.message : "Wallet connection failed.");
    }
  }

  async function handleKYBSubmit() {
    if (!companyName.trim()) return setError("Company Name is required.");
    if (!registrationNumber.trim()) return setError("Business Registration Number is required.");
    if (!taxID.trim()) return setError("Tax ID is required.");
    if (!docUploaded) return setError("Please upload the Certificate of Incorporation.");

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/kyb-verify", {
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

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "KYB validation failed.");
      }

      setKybResult(data);
      setKybStep(0);
      setStage("KYB_PENDING");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "KYB processing failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMintSBT() {
    if (!wallet || !kybResult || !publicClient) return;

    setIsMintingSBT(true);
    setError(null);

    try {
      const hash = await writeContractAsync({
        address: KYB_ORACLE_ADDRESS,
        abi: KYB_ORACLE_ABI,
        functionName: "submitKYBAttestation",
        args: [
          wallet,
          kybResult.verificationIdBytes32,
          kybResult.attestationHashBytes32,
          kybResult.risk_score,
          BigInt(kybResult.timestamp),
          kybResult.signature,
        ],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      setStage("SBT_MINTED");
    } catch (mintError) {
      console.error(mintError);
      setError(mintError instanceof Error ? mintError.message : "SBT minting failed.");
    } finally {
      setIsMintingSBT(false);
    }
  }

  async function handleFHESubmit() {
    if (!wallet || !kybResult || !publicClient) return;

    setIsEncryptingFHE(true);
    setError(null);

    try {
      const taxIDInt = parseInt(taxID.replace(/\D/g, "").slice(0, 9), 10);
      if (Number.isNaN(taxIDInt)) {
        throw new Error("Invalid Tax ID format.");
      }

      const encTax = await encryptUint32(BigInt(taxIDInt), wallet, IDENTITY_ADDRESS);
      const encKyb = await encryptBool(true, wallet, IDENTITY_ADDRESS);
      const encRisk = await encryptUint8(BigInt(kybResult.risk_score), wallet, IDENTITY_ADDRESS);

      const hash = await writeContractAsync({
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

      await publicClient.waitForTransactionReceipt({ hash });
      setStage("FHE_SYNCED");
    } catch (fheError) {
      console.error(fheError);
      setError(fheError instanceof Error ? fheError.message : "FHE compliance transaction failed.");
    } finally {
      setIsEncryptingFHE(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background:
          "radial-gradient(circle at top, rgba(0,240,255,0.12) 0%, transparent 30%), radial-gradient(circle at bottom right, rgba(255,186,0,0.12) 0%, transparent 22%), #030814",
      }}
    >
      <div style={{ width: "100%", maxWidth: 560 }}>
        <AnimatePresence mode="wait">
          {stage === "AUTH_CHOICE" && (
            <motion.div
              key="auth-choice"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.28 }}
            >
              <GlassCard className="p-8" glow="cyan">
                <div style={{ marginBottom: 26 }}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      borderRadius: 999,
                      border: "1px solid rgba(0,240,255,0.16)",
                      background: "rgba(0,240,255,0.06)",
                      color: "#00F0FF",
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "6px 12px",
                      marginBottom: 18,
                    }}
                  >
                    Dashboard Access
                  </div>
                  <h1 style={headingStyle}>Choose how you want to continue</h1>
                  <p style={bodyStyle}>
                    Sign in with an embedded email wallet or use a connected wallet for marketplace actions later.
                  </p>
                </div>

                {error && (
                  <div
                    style={{
                      background: "rgba(255,45,107,0.1)",
                      border: "1px solid rgba(255,45,107,0.2)",
                      borderRadius: 12,
                      padding: 12,
                      color: "#FF5E8C",
                      fontSize: 13,
                      marginBottom: 20,
                    }}
                  >
                    {error}
                  </div>
                )}

                <div style={{ display: "grid", gap: 14 }}>
                  <button onClick={handleEmailLogin} disabled={isLoading || isInitializing} style={primaryBtnStyle}>
                    {isLoading || isInitializing ? <Spinner /> : "Continue with Email"}
                  </button>
                  <button onClick={handleWalletLogin} style={secondaryBtnStyle}>
                    Connect Wallet
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {stage === "WALLET_READY" && (
            <motion.div
              key="wallet-ready"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.28 }}
            >
              <GlassCard className="p-8" glow="cyan">
                <h2 style={headingStyle}>Checking business access</h2>
                <p style={{ ...bodyStyle, marginBottom: 22 }}>
                  Wallet Connected: {truncAddr(wallet ?? "")}
                </p>
                {isCheckingCredentials ? <Spinner /> : <p style={bodyStyle}>Preparing your account status...</p>}
              </GlassCard>
            </motion.div>
          )}

          {stage === "KYB_FORM" && (
            <motion.div
              key="kyb-form"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.28 }}
            >
              <GlassCard className="p-8" glow="cyan">
                <div style={{ display: "grid", gap: 18 }}>
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        marginBottom: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <h2 style={{ ...headingStyle, marginBottom: 0 }}>Account onboarding</h2>
                      <span style={{ color: "#00F0FF", fontSize: 12, fontFamily: "JetBrains Mono, monospace" }}>
                        Wallet Connected: {truncAddr(wallet ?? "")}
                      </span>
                    </div>
                    <div style={{ color: "#FFBA00", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                      Account Status: Unverified Business
                    </div>
                    <StatusBanner>Invoice Marketplace Locked - Business Verification Required to Continue</StatusBanner>
                  </div>

                  {error && (
                    <div
                      style={{
                        background: "rgba(255,45,107,0.1)",
                        border: "1px solid rgba(255,45,107,0.2)",
                        borderRadius: 12,
                        padding: 12,
                        color: "#FF5E8C",
                        fontSize: 13,
                      }}
                    >
                      {error}
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <p style={{ ...bodyStyle, margin: 0 }}>
                      Start Verification to unlock invoice marketplace access and submit KYB details.
                    </p>
                    <button
                      onClick={() => setStage("KYB_FORM")}
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(0,240,255,0.18)",
                        borderRadius: 999,
                        color: "#00F0FF",
                        padding: "8px 12px",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Start Verification
                    </button>
                  </div>

                  <div style={{ display: "grid", gap: 16 }}>
                    <div>
                      <label style={labelStyle}>Company Name</label>
                      <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Country</label>
                      <input value={country} onChange={(event) => setCountry(event.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Business Registration Number</label>
                      <input value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Tax ID</label>
                      <input value={taxID} onChange={(event) => setTaxID(event.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Upload Certificate of Incorporation</label>
                      <button
                        onClick={() => setDocUploaded(true)}
                        style={{
                          ...secondaryBtnStyle,
                          justifyContent: "flex-start",
                          padding: "14px 16px",
                          minHeight: 58,
                          color: docUploaded ? "#00FF88" : "#EEF2FF",
                        }}
                      >
                        {docUploaded ? "Certificate attached" : "Attach incorporation certificate"}
                      </button>
                    </div>
                  </div>

                  <button onClick={handleKYBSubmit} disabled={isLoading} style={primaryBtnStyle}>
                    {isLoading ? <Spinner /> : "Submit for Verification"}
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {stage === "KYB_PENDING" && (
            <motion.div
              key="kyb-pending"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.28 }}
            >
              <GlassCard className="p-8" glow="cyan">
                <h2 style={headingStyle}>Verifying business identity...</h2>
                <div style={{ display: "grid", gap: 14 }}>
                  {[
                    "Validating company presence",
                    "Running sanctions screening",
                    "Running AML screening",
                    "Generating oracle attestation",
                  ].map((label, index) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {kybStep > index ? (
                        <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#00FF88" }} />
                      ) : kybStep === index ? (
                        <Spinner size={16} />
                      ) : (
                        <div style={{ width: 18, height: 18, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)" }} />
                      )}
                      <span style={{ color: kybStep >= index ? "#EEF2FF" : "#4F6495", fontSize: 13 }}>{label}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          )}

          {stage === "KYB_APPROVED" && (
            <motion.div
              key="kyb-approved"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.28 }}
            >
              <GlassCard className="p-8" glow="cyan">
                <h2 style={headingStyle}>Business verified</h2>
                <p style={{ ...bodyStyle, marginBottom: 22 }}>
                  MockKYBOracleService approved this business and prepared a signed compliance attestation.
                </p>

                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: 14,
                    padding: 16,
                    marginBottom: 22,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ color: "#8B9CC8", fontSize: 12 }}>Verification ID</span>
                    <span style={{ color: "#00F0FF", fontSize: 12, fontFamily: "JetBrains Mono, monospace" }}>
                      {kybResult?.verification_id}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ color: "#8B9CC8", fontSize: 12 }}>Risk Score</span>
                    <span style={{ color: "#00FF88", fontSize: 12, fontWeight: 700 }}>
                      {kybResult?.risk_score}
                    </span>
                  </div>
                </div>

                <button onClick={handleMintSBT} disabled={isMintingSBT} style={primaryBtnStyle}>
                  {isMintingSBT ? <Spinner /> : "Mint Soulbound Token"}
                </button>
              </GlassCard>
            </motion.div>
          )}

          {stage === "SBT_MINTED" && (
            <motion.div
              key="sbt-minted"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.28 }}
            >
              <GlassCard className="p-8" glow="cyan">
                <h2 style={headingStyle}>Finalize encrypted compliance</h2>
                <p style={{ ...bodyStyle, marginBottom: 20 }}>
                  KYB is approved and the SBT is minted. FHE encryption is now enabled for Tax ID, KYB status, and risk score.
                </p>
                <button onClick={handleFHESubmit} disabled={isEncryptingFHE} style={primaryBtnStyle}>
                  {isEncryptingFHE ? <Spinner /> : "Encrypt and store compliance"}
                </button>
              </GlassCard>
            </motion.div>
          )}

          {stage === "FHE_SYNCED" && (
            <motion.div
              key="fhe-synced"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.28 }}
            >
              <GlassCard className="p-8" glow="cyan">
                <h2 style={headingStyle}>Access unlocked</h2>
                <p style={{ ...bodyStyle, marginBottom: 20 }}>
                  Marketplace access is now available. Your compliance profile is encrypted and your SBT is active.
                </p>
                <button onClick={() => router.push(nextPath)} style={primaryBtnStyle}>
                  Enter Dashboard
                </button>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
