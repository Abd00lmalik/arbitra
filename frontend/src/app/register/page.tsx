/*
 * @file page.tsx
 * @description Authentication and KYB onboarding entrypoint for Arbitra suppliers.
 */

"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useAccount,
  useConnect,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
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
import { encryptBool, encryptUint32, encryptUint8, getZamaSDK } from "@/lib/zama";

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
  verified_at: number;
  signature: `0x${string}`;
  oracle_signature?: string;
  verification_id_bytes32: `0x${string}`;
  attestation_hash_bytes32: `0x${string}`;
}

interface KybFieldErrors {
  companyName?: string;
  country?: string;
  registrationNumber?: string;
  taxID?: string;
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
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [stage, setStage] = useState<Stage>("AUTH_CHOICE");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<KybFieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [kybStep, setKybStep] = useState(0);
  const [isCheckingCredentials, setIsCheckingCredentials] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState("United States");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [taxID, setTaxID] = useState("");

  const [kybResult, setKybResult] = useState<KYBResult | null>(null);
  const [isMintingSBT, setIsMintingSBT] = useState(false);
  const [isEncryptingFHE, setIsEncryptingFHE] = useState(false);
  const [sbtTxHash, setSbtTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [fheTxHash, setFheTxHash] = useState<`0x${string}` | undefined>(undefined);

  const browserWalletConnector = connectors.find((connector) => connector.id === "injected");
  const walletConnectConnector = connectors.find((connector) => connector.id === "walletConnect");
  const activeWallet = wallet ?? (isConnected && address ? address : null);
  const hasAuthenticatedWallet = isLoggedIn || isConnected;

  const {
    isSuccess: isSbtReceiptSuccess,
    error: sbtReceiptError,
  } = useWaitForTransactionReceipt({ hash: sbtTxHash });

  const {
    isSuccess: isFheReceiptSuccess,
    error: fheReceiptError,
  } = useWaitForTransactionReceipt({ hash: fheTxHash });

  useEffect(() => {
    if (!isInitializing && authError) {
      setError(authError);
    }
  }, [authError, isInitializing]);

  useEffect(() => {
    if (!hasAuthenticatedWallet || !activeWallet || isInitializing || !publicClient) return;

    const client = publicClient;
    const walletAddress = activeWallet;
    let active = true;

    async function checkExistingSBTAndRoute() {
      setStage("WALLET_READY");
      setIsCheckingCredentials(true);

      try {
        const hasSBT = (await client.readContract({
          address: SBT_ADDRESS,
          abi: SBT_ABI,
          functionName: "hasValidSBT",
          args: [walletAddress],
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
          args: [walletAddress],
        })) as boolean;

        if (!active) return;

        if (hasFHE) {
          router.replace(nextPath);
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

    checkExistingSBTAndRoute();

    return () => {
      active = false;
    };
  }, [hasAuthenticatedWallet, activeWallet, isInitializing, publicClient, router, nextPath]);

  useEffect(() => {
    if (!isSbtReceiptSuccess) return;
    setIsMintingSBT(false);
    setSbtTxHash(undefined);
    setStage("SBT_MINTED");
  }, [isSbtReceiptSuccess]);

  useEffect(() => {
    if (!sbtReceiptError) return;
    setIsMintingSBT(false);
    setSbtTxHash(undefined);
    setError(sbtReceiptError instanceof Error ? sbtReceiptError.message : "SBT minting failed.");
  }, [sbtReceiptError]);

  useEffect(() => {
    if (!isFheReceiptSuccess) return;
    setIsEncryptingFHE(false);
    setFheTxHash(undefined);
    setStage("FHE_SYNCED");
  }, [isFheReceiptSuccess]);

  useEffect(() => {
    if (!fheReceiptError) return;
    setIsEncryptingFHE(false);
    setFheTxHash(undefined);
    setError(fheReceiptError instanceof Error ? fheReceiptError.message : "FHE compliance transaction failed.");
  }, [fheReceiptError]);

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

  async function handleWalletLogin(connectorId: "injected" | "walletConnect") {
    setError(null);

    try {
      const connector = connectors.find((item) => item.id === connectorId);

      if (!connector) {
        throw new Error(
          connectorId === "walletConnect"
            ? "WalletConnect is not configured."
            : "No browser wallet connector is available.",
        );
      }

      const connection = await connectAsync({ connector });
      const connectedWallet = connection.accounts[0];

      if (!connectedWallet) {
        throw new Error("Connected wallet address was not available.");
      }

      document.cookie = `arbitra_session=${connectedWallet}; path=/; max-age=86400; SameSite=Strict`;
      setStage("WALLET_READY");
    } catch (walletError) {
      console.error(walletError);
      setError(walletError instanceof Error ? walletError.message : "Wallet connection failed.");
    }
  }

  async function handleKYBSubmit() {
    const nextFieldErrors: KybFieldErrors = {};

    if (!companyName.trim()) nextFieldErrors.companyName = "Company name is required.";
    if (!country.trim()) nextFieldErrors.country = "Country is required.";
    if (!registrationNumber.trim()) nextFieldErrors.registrationNumber = "Registration number is required.";
    if (!taxID.trim()) nextFieldErrors.taxID = "Tax ID is required.";

    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      setError("Please correct the highlighted KYB fields.");
      return;
    }

    if (!activeWallet) {
      setError("A connected wallet is required before verification.");
      setStage("WALLET_READY");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/kyb-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: activeWallet,
          companyName,
          country,
          registrationNumber,
          taxID,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setStage("WALLET_READY");
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
    if (!activeWallet || !kybResult) return;

    setIsMintingSBT(true);
    setError(null);

    try {
      const hash = await writeContractAsync({
        address: KYB_ORACLE_ADDRESS,
        abi: KYB_ORACLE_ABI,
        functionName: "submitKYBAttestation",
        args: [
          activeWallet,
          kybResult.verification_id_bytes32,
          kybResult.attestation_hash_bytes32,
          kybResult.risk_score,
          BigInt(kybResult.verified_at),
          kybResult.signature,
        ],
      });
      setSbtTxHash(hash);
    } catch (mintError) {
      console.error(mintError);
      setIsMintingSBT(false);
      setError(mintError instanceof Error ? mintError.message : "SBT minting failed.");
    }
  }

  async function handleFHESubmit() {
    if (!activeWallet || !kybResult) return;

    setIsEncryptingFHE(true);
    setError(null);

    try {
      await getZamaSDK();

      const taxIdDigits = taxID.replace(/\D/g, "");
      if (!taxIdDigits || taxIdDigits.length > 9) {
        throw new Error("Invalid Tax ID format.");
      }

      const taxIDInt = Number.parseInt(taxIdDigits, 10);
      if (!Number.isSafeInteger(taxIDInt)) {
        throw new Error("Tax ID must fit into a 32-bit unsigned integer.");
      }

      const encTax = await encryptUint32(BigInt(taxIDInt), activeWallet, IDENTITY_ADDRESS);
      const encKyb = await encryptBool(kybResult.company_status === "verified", activeWallet, IDENTITY_ADDRESS);
      const encRisk = await encryptUint8(BigInt(kybResult.risk_score), activeWallet, IDENTITY_ADDRESS);

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
      setFheTxHash(hash);
    } catch (fheError) {
      console.error(fheError);
      setIsEncryptingFHE(false);
      setError(fheError instanceof Error ? fheError.message : "FHE compliance transaction failed.");
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
                    {isLoading || isInitializing ? <Spinner /> : "Login"}
                  </button>
                  {browserWalletConnector && (
                    <button onClick={() => handleWalletLogin("injected")} style={secondaryBtnStyle}>
                      Connect Browser Wallet
                    </button>
                  )}
                  {walletConnectConnector && (
                    <button onClick={() => handleWalletLogin("walletConnect")} style={secondaryBtnStyle}>
                      Connect with WalletConnect
                    </button>
                  )}
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
                  Wallet Connected: {truncAddr(activeWallet ?? "")}
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
                        Wallet Connected: {truncAddr(activeWallet ?? "")}
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
                      <input
                        value={companyName}
                        onChange={(event) => {
                          setCompanyName(event.target.value);
                          setFieldErrors((current) => ({ ...current, companyName: undefined }));
                        }}
                        style={{
                          ...inputStyle,
                          border: fieldErrors.companyName ? "1px solid rgba(255,45,107,0.55)" : inputStyle.border,
                        }}
                      />
                      {fieldErrors.companyName && (
                        <p style={{ color: "#FF5E8C", fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                          {fieldErrors.companyName}
                        </p>
                      )}
                    </div>
                    <div>
                      <label style={labelStyle}>Country</label>
                      <input
                        value={country}
                        onChange={(event) => {
                          setCountry(event.target.value);
                          setFieldErrors((current) => ({ ...current, country: undefined }));
                        }}
                        style={{
                          ...inputStyle,
                          border: fieldErrors.country ? "1px solid rgba(255,45,107,0.55)" : inputStyle.border,
                        }}
                      />
                      {fieldErrors.country && (
                        <p style={{ color: "#FF5E8C", fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                          {fieldErrors.country}
                        </p>
                      )}
                    </div>
                    <div>
                      <label style={labelStyle}>Business Registration Number</label>
                      <input
                        value={registrationNumber}
                        onChange={(event) => {
                          setRegistrationNumber(event.target.value);
                          setFieldErrors((current) => ({ ...current, registrationNumber: undefined }));
                        }}
                        style={{
                          ...inputStyle,
                          border: fieldErrors.registrationNumber ? "1px solid rgba(255,45,107,0.55)" : inputStyle.border,
                        }}
                      />
                      {fieldErrors.registrationNumber && (
                        <p style={{ color: "#FF5E8C", fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                          {fieldErrors.registrationNumber}
                        </p>
                      )}
                    </div>
                    <div>
                      <label style={labelStyle}>Tax ID</label>
                      <input
                        value={taxID}
                        onChange={(event) => {
                          setTaxID(event.target.value);
                          setFieldErrors((current) => ({ ...current, taxID: undefined }));
                        }}
                        style={{
                          ...inputStyle,
                          border: fieldErrors.taxID ? "1px solid rgba(255,45,107,0.55)" : inputStyle.border,
                        }}
                      />
                      {fieldErrors.taxID && (
                        <p style={{ color: "#FF5E8C", fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                          {fieldErrors.taxID}
                        </p>
                      )}
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
