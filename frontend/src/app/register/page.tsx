/*
 * @file page.tsx
 * @description Authentication and KYB onboarding entrypoint for Arbitra suppliers.
 */

"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useAccount,
  useChainId,
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

type Stage =
  | "AUTH_CHOICE"
  | "WALLET_READY"
  | "KYB_FORM"
  | "KYB_PENDING"
  | "KYB_APPROVED"
  | "SBT_MINTED"
  | "FHE_SYNCED";

interface KYBResult {
  success?: boolean;
  requiresClientMint?: boolean;
  verification_id: string;
  company_status: string;
  sanctions_flag: boolean;
  pep_flag: boolean;
  risk_score: number;
  verified_at: number;
  signature?: `0x${string}`;
  oracle_signature?: string;
  verification_id_bytes32: `0x${string}`;
  attestation_hash_bytes32: `0x${string}`;
  txHash?: `0x${string}`;
  signerAddress?: `0x${string}`;
  mintFallbackReason?: string;
  message?: string;
}

function buildFallbackKybResult(
  taxIdValue: string,
  walletAddress: `0x${string}`,
): KYBResult {
  return {
    company_status: "verified",
    verification_id: "RESTORED-SBT-HOLDER",
    sanctions_flag: false,
    pep_flag: false,
    risk_score: 25,
    verified_at: Math.floor(Date.now() / 1000),
    verification_id_bytes32: "0x0000000000000000000000000000000000000000000000000000000000000000",
    attestation_hash_bytes32: "0x0000000000000000000000000000000000000000000000000000000000000000",
    signature: undefined,
    requiresClientMint: false,
    success: true,
    signerAddress: walletAddress,
    message: taxIdValue
      ? "Using restored compliance defaults for encrypted storage."
      : "Enter your Tax ID to finalize encrypted compliance.",
  };
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null) {
    const candidate = error as { shortMessage?: string; message?: string; cause?: { message?: string } };
    if (candidate.shortMessage) return candidate.shortMessage;
    if (candidate.message) return candidate.message;
    if (candidate.cause?.message) return candidate.cause.message;
  }
  return "Unexpected transaction failure.";
}

async function parseJsonResponse(response: Response): Promise<Record<string, unknown> | null> {
  const responseText = await response.text();
  if (!responseText) return null;

  try {
    return JSON.parse(responseText) as Record<string, unknown>;
  } catch (error) {
    console.error("[Register] Failed to parse KYB API response as JSON.", error, responseText);
    return null;
  }
}

async function pollForReceipt(txHash: `0x${string}`, maxAttempts = 30): Promise<boolean> {
  const rpcUrl =
    process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL ||
    "https://ethereum-sepolia-rpc.publicnode.com";

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getTransactionReceipt",
          params: [txHash],
          id: attempt + 1,
        }),
      });

      const data = await response.json() as {
        result?: { status?: string | null } | null;
      };

      if (data.result) {
        return data.result.status === "0x1";
      }
    } catch (error) {
      console.error("[Register] Receipt polling failed. Retrying...", error);
    }

    await new Promise((resolve) => window.setTimeout(resolve, 3000));
  }

  throw new Error("Transaction not confirmed after 90 seconds. Check Sepolia Etherscan.");
}

const SBT_CHECK_TIMEOUT_MS = 10_000;

async function checkSBTWithTimeout(readFn: () => Promise<boolean>): Promise<boolean> {
  try {
    return await Promise.race([
      readFn(),
      new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error("SBT check timed out")), SBT_CHECK_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    console.warn("[Arbitra] SBT check failed or timed out, defaulting to false:", error);
    return false;
  }
}

interface KybFieldErrors {
  companyName?: string;
  country?: string;
  registrationNumber?: string;
  taxID?: string;
}

function cleanTaxId(value: string): string {
  return value.replace(/[\s\-./]/g, "");
}

function validateKYBForm(values: {
  companyName: string;
  country: string;
  registrationNumber: string;
  taxID: string;
}): KybFieldErrors {
  const errors: KybFieldErrors = {};
  const normalizedRegistrationNumber = values.registrationNumber.replace(/\s/g, "");
  const normalizedTaxId = cleanTaxId(values.taxID);

  if (!values.companyName.trim()) {
    errors.companyName = "Company name is required.";
  }

  if (!values.country.trim()) {
    errors.country = "Country is required.";
  }

  if (!values.registrationNumber.trim()) {
    errors.registrationNumber = "Business Registration Number is required.";
  } else if (!/^[A-Za-z0-9\-/]{3,30}$/.test(normalizedRegistrationNumber)) {
    errors.registrationNumber = "Enter a valid registration number (for example RC-12345678).";
  }

  if (!values.taxID.trim()) {
    errors.taxID = "Tax ID is required.";
  } else if (!/^[A-Za-z0-9./-]{4,30}$/.test(values.taxID.replace(/\s/g, "")) || !/^[A-Za-z0-9]{4,30}$/.test(normalizedTaxId)) {
    errors.taxID = "Enter a valid Tax ID (for example 12-3456789 or GB123456789).";
  }

  return errors;
}

function isValidRequiredTaxId(value: string): boolean {
  return !validateKYBForm({
    companyName: "ok",
    country: "ok",
    registrationNumber: "RC-123",
    taxID: value,
  }).taxID;
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

  const { wallet, isLoggedIn, isInitializing, login, logout, authError, getProvider } = useWeb3Auth();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connectAsync, connectors } = useConnect();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [stage, setStage] = useState<Stage>("AUTH_CHOICE");
  const [error, setError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [kybStep, setKybStep] = useState(0);
  const [isCheckingCredentials, setIsCheckingCredentials] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Preparing your account status...");

  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState("United States");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [taxID, setTaxID] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [kybResult, setKybResult] = useState<KYBResult | null>(null);
  const [isMintingSBT, setIsMintingSBT] = useState(false);
  const [isEncryptingFHE, setIsEncryptingFHE] = useState(false);
  const [sbtTxHash, setSbtTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [fheTxHash, setFheTxHash] = useState<`0x${string}` | undefined>(undefined);

  const browserWalletConnector = connectors.find((connector) => connector.id === "injected");
  const walletConnectConnector = connectors.find((connector) => connector.id === "walletConnect");
  const activeWallet = wallet ?? (isConnected && address ? address : null);
  const hasAuthenticatedWallet = isLoggedIn || isConnected;
  const isCorrectNetwork = !isConnected || chainId === 11155111;
  const kybFieldErrors = submitted
    ? validateKYBForm({ companyName, country, registrationNumber, taxID })
    : {};
  const isKybFormValid = Object.keys(
    validateKYBForm({ companyName, country, registrationNumber, taxID }),
  ).length === 0;

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
    if (stage !== "WALLET_READY" || !statusError) return;

    const timeoutId = window.setTimeout(() => {
      setStatusMessage("Continuing to registration...");
      setStage("KYB_FORM");
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [stage, statusError]);

  useEffect(() => {
    if (!SBT_ADDRESS || SBT_ADDRESS === "0x0000000000000000000000000000000000000000") {
      console.error(
        "[Arbitra] CRITICAL: NEXT_PUBLIC_SBT_ADDRESS is not set. SBT reads will fail. Set this in Vercel environment variables.",
      );
    }
  }, []);

  useEffect(() => {
    if (!hasAuthenticatedWallet || !activeWallet || isInitializing || !publicClient || !isCorrectNetwork) return;

    const client = publicClient;
    const walletAddress = activeWallet;
    let active = true;

    async function checkExistingSBTAndRoute() {
      setStage("WALLET_READY");
      setIsCheckingCredentials(true);
      setStatusError(null);
      setStatusMessage("Preparing your account status...");

      try {
        const hasSBT = await checkSBTWithTimeout(async () => (
          await client.readContract({
            address: SBT_ADDRESS,
            abi: SBT_ABI,
            functionName: "hasValidSBT",
            args: [walletAddress],
          }) as boolean
        ));

        if (!active) return;

        if (!hasSBT) {
          setStatusMessage("Could not verify SBT status. Proceeding to registration...");
          setStatusError("SBT check timed out or returned no verified token. You can continue with KYB registration.");
          return;
        }

        setStatusMessage("Verified SBT. Checking encrypted compliance...");

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

        setKybResult((current) => current ?? buildFallbackKybResult("", walletAddress));
        setStatusMessage("Encrypted compliance is required before dashboard access. Please store your compliance profile to continue.");
        setStatusError(null);
        setError(null);
        setStage("SBT_MINTED");
      } catch (credentialError) {
        console.error("[Register] Credential check failed:", credentialError);
        if (active) {
          setStatusMessage("Could not verify SBT status. Proceeding to registration...");
          setStatusError("SBT check failed. Please confirm you are on Sepolia and try again if this persists.");
          setError("Unable to verify current account status.");
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
  }, [hasAuthenticatedWallet, activeWallet, isInitializing, publicClient, router, nextPath, isCorrectNetwork]);

  useEffect(() => {
    if (!isSbtReceiptSuccess) return;
    setIsMintingSBT(false);
    setStage("SBT_MINTED");
  }, [isSbtReceiptSuccess]);

  useEffect(() => {
    if (!sbtReceiptError) return;
    setIsMintingSBT(false);
    setSbtTxHash(undefined);
    setError(extractErrorMessage(sbtReceiptError));
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
    setError(extractErrorMessage(fheReceiptError));
  }, [fheReceiptError]);

  useEffect(() => {
    if (stage !== "FHE_SYNCED") return;

    const redirectTimer = window.setTimeout(() => {
      router.push(nextPath);
    }, 2000);

    return () => window.clearTimeout(redirectTimer);
  }, [stage, router, nextPath]);

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
    setStatusError(null);

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
    setStatusError(null);

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
      setStatusMessage("Preparing your account status...");
      setStage("WALLET_READY");
    } catch (walletError) {
      console.error(walletError);
      setError(walletError instanceof Error ? walletError.message : "Wallet connection failed.");
    }
  }

  async function handleResetSignIn() {
    setIsLoading(true);
    setError(null);
    setStatusError(null);
    setStatusMessage("Resetting your sign-in session...");

    try {
      await logout();
    } catch (resetError) {
      console.error("[Register] Sign-in reset failed:", resetError);
      setIsLoading(false);
      setError(resetError instanceof Error ? resetError.message : "Could not reset sign-in. Please refresh and try again.");
    }
  }

  async function handleKYBSubmit() {
    setSubmitted(true);
    if (!isKybFormValid) {
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
          taxID: taxID.trim(),
        }),
      });

      const data = await parseJsonResponse(response);
      const requiresClientMint = data?.requiresClientMint === true;
      const hasServerSubmittedTx = typeof data?.txHash === "string";

      if (!response.ok || (!requiresClientMint && !hasServerSubmittedTx && !data?.signature)) {
        const apiError =
          typeof data?.error === "string"
            ? data.error
            : response.ok
              ? "Oracle attestation signature generation failed."
              : "KYB validation failed.";
        console.error("[Register] KYB API error:", apiError, "Status:", response.status, data);
        setStage("WALLET_READY");
        throw new Error(apiError);
      }

      const kybPayload = data as unknown as KYBResult;
      setKybResult(kybPayload);
      setKybStep(0);

      if (!kybPayload.requiresClientMint && kybPayload.txHash) {
        setSbtTxHash(kybPayload.txHash);
        setIsMintingSBT(true);
        setStatusMessage("Transaction submitted. Waiting for Sepolia confirmation...");
        setStage("KYB_APPROVED");

        const confirmed = await pollForReceipt(kybPayload.txHash);
        if (!confirmed) {
          throw new Error("On-chain transaction reverted. Please try again.");
        }

        setIsMintingSBT(false);
        setStage("SBT_MINTED");
        return;
      }

      setStage("KYB_PENDING");
    } catch (submissionError) {
      setIsMintingSBT(false);
      setError(submissionError instanceof Error ? submissionError.message : "KYB processing failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMintSBT() {
    if (!activeWallet || !kybResult) return;

    if (!kybResult.signature || !kybResult.verification_id_bytes32 || !kybResult.attestation_hash_bytes32) {
      setError("KYB verification data is incomplete. Please restart the verification flow.");
      return;
    }

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
          Number(kybResult.risk_score),
          BigInt(kybResult.verified_at),
          kybResult.signature,
        ],
        chainId: 11155111,
      });
      setSbtTxHash(hash);
    } catch (mintError) {
      console.error(mintError);
      setIsMintingSBT(false);
      setError(`SBT minting failed: ${extractErrorMessage(mintError)}`);
    }
  }

  async function handleFHESubmit() {
    console.log("[FHE] Encrypt compliance button clicked");
    console.log("[FHE] Current stage:", stage);
    console.log("[FHE] Active wallet:", activeWallet);
    console.log("[FHE] Chain ID:", chainId);

    if (!activeWallet) {
      setError("A connected wallet is required before storing encrypted compliance.");
      return;
    }

    const effectiveKybResult = kybResult ?? buildFallbackKybResult(taxID, activeWallet);
    if (!kybResult) {
      console.warn("[FHE] Missing KYB result in local state. Reconstructing fallback compliance payload.");
      setKybResult(effectiveKybResult);
    }

    setIsEncryptingFHE(true);
    setError(null);
    setStatusMessage("Submitting encrypted compliance...");

    try {
      if (!isValidRequiredTaxId(taxID)) {
        setSubmitted(true);
        throw new Error("Tax ID is required before storing encrypted compliance.");
      }

      console.log("[FHE] Requesting gasless encrypted compliance submission");
      const response = await fetch("/api/compliance-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: activeWallet,
          taxID: taxID.trim(),
          kybApproved: effectiveKybResult.company_status === "verified",
          riskScore: effectiveKybResult.risk_score,
        }),
      });

      console.log("[FHE] compliance-store response status:", response.status);
      const responseText = await response.text();
      console.log("[FHE] compliance-store raw response:", responseText);

      let data: Record<string, unknown> | null = null;
      if (responseText) {
        try {
          data = JSON.parse(responseText) as Record<string, unknown>;
        } catch (parseError) {
          console.error("[FHE] Failed to parse compliance-store response JSON:", parseError);
          throw new Error(`Server returned invalid JSON: ${responseText.slice(0, 200)}`);
        }
      }

      if (!response.ok || typeof data?.txHash !== "string") {
        const apiError =
          typeof data?.error === "string"
            ? data.error
            : typeof data?.detail === "string"
              ? data.detail
              : `Encrypted compliance submission failed with HTTP ${response.status}.`;
        console.error("[FHE] compliance-store failed:", {
          status: response.status,
          error: apiError,
          detail: data?.detail,
        });
        throw new Error(apiError);
      }

      console.log("[FHE] Compliance stored! txHash:", data.txHash, "elapsedMs:", data.elapsedMs);
      setStatusMessage("Encrypted compliance confirmed on Sepolia.");
      setFheTxHash(data.txHash as `0x${string}`);
      setIsEncryptingFHE(false);
      setError(null);
      setStage("FHE_SYNCED");
    } catch (fheError) {
      console.error("[FHE] Encrypt compliance failed:", fheError);
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
          {isConnected && !isCorrectNetwork && (
            <motion.div
              key="wrong-network"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.28 }}
            >
              <GlassCard className="p-8" glow="cyan">
                <h2 style={headingStyle}>Wrong Network</h2>
                <p style={{ ...bodyStyle, marginBottom: 18 }}>
                  Please switch your wallet to <strong>Sepolia Testnet</strong> (chain ID 11155111) to continue.
                </p>
                <div
                  style={{
                    background: "rgba(255,186,0,0.08)",
                    border: "1px solid rgba(255,186,0,0.24)",
                    borderRadius: 12,
                    padding: 14,
                    color: "#FFCF6B",
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  Connected wallet: {truncAddr(activeWallet ?? "")}
                </div>
              </GlassCard>
            </motion.div>
          )}

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
                {isCheckingCredentials ? <Spinner /> : null}
                <p style={bodyStyle}>{statusMessage}</p>
                {statusError && (
                  <div
                    style={{
                      background: "rgba(255,186,0,0.1)",
                      border: "1px solid rgba(255,186,0,0.2)",
                      borderRadius: 12,
                      padding: 12,
                      color: "#FFCF6B",
                      fontSize: 13,
                      marginTop: 16,
                    }}
                  >
                    <div>{statusError}</div>
                    <button
                      type="button"
                      onClick={() => {
                        setStatusMessage("Continuing to registration...");
                        setStage("KYB_FORM");
                      }}
                      style={{
                        marginTop: 12,
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,186,0,0.35)",
                        background: "rgba(255,186,0,0.12)",
                        color: "#FFF3D1",
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: "Satoshi, sans-serif",
                        cursor: "pointer",
                      }}
                    >
                      Continue to KYB Registration
                    </button>
                  </div>
                )}
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
                      <label style={labelStyle}>Company Name *</label>
                      <input
                        value={companyName}
                        onChange={(event) => setCompanyName(event.target.value)}
                        style={{
                          ...inputStyle,
                          border: kybFieldErrors.companyName ? "1px solid rgba(255,45,107,0.55)" : inputStyle.border,
                        }}
                      />
                      {kybFieldErrors.companyName && (
                        <p style={{ color: "#FF5E8C", fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                          {kybFieldErrors.companyName}
                        </p>
                      )}
                    </div>
                    <div>
                      <label style={labelStyle}>Country *</label>
                      <input
                        value={country}
                        onChange={(event) => setCountry(event.target.value)}
                        style={{
                          ...inputStyle,
                          border: kybFieldErrors.country ? "1px solid rgba(255,45,107,0.55)" : inputStyle.border,
                        }}
                      />
                      {kybFieldErrors.country && (
                        <p style={{ color: "#FF5E8C", fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                          {kybFieldErrors.country}
                        </p>
                      )}
                    </div>
                    <div>
                      <label style={labelStyle}>Business Registration Number *</label>
                      <p style={{ color: "#4F6495", fontSize: 11, marginTop: 0, marginBottom: 8 }}>
                        e.g. RC-12345678 (Nigeria), EIN12-3456789 (US), CRN12345678 (UK)
                      </p>
                      <input
                        value={registrationNumber}
                        onChange={(event) => setRegistrationNumber(event.target.value)}
                        style={{
                          ...inputStyle,
                          border: kybFieldErrors.registrationNumber ? "1px solid rgba(255,45,107,0.55)" : inputStyle.border,
                        }}
                        placeholder="RC-12345678"
                      />
                      {kybFieldErrors.registrationNumber && (
                        <p style={{ color: "#FF5E8C", fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                          {kybFieldErrors.registrationNumber}
                        </p>
                      )}
                    </div>
                    <div>
                      <label style={labelStyle}>Tax ID / VAT Number *</label>
                      <p style={{ color: "#4F6495", fontSize: 11, marginTop: 0, marginBottom: 8 }}>
                        e.g. 12-3456789 (US EIN), GB123456789 (UK VAT), TINXXXXXXXX
                      </p>
                      <input
                        value={taxID}
                        onChange={(event) => setTaxID(event.target.value)}
                        style={{
                          ...inputStyle,
                          border: kybFieldErrors.taxID ? "1px solid rgba(255,45,107,0.55)" : inputStyle.border,
                        }}
                        placeholder="12-3456789"
                      />
                      {kybFieldErrors.taxID && (
                        <p style={{ color: "#FF5E8C", fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                          {kybFieldErrors.taxID}
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
                  {isMintingSBT
                    ? <><Spinner /> Waiting for Sepolia confirmation...</>
                    : sbtTxHash
                      ? <><Spinner /> Minting on Sepolia...</>
                      : "Mint Soulbound Token"}
                </button>
                {kybResult?.requiresClientMint && kybResult.mintFallbackReason && (
                  <p style={{ color: "#FFCF6B", fontSize: 12, marginTop: 12, marginBottom: 0 }}>
                    {kybResult.mintFallbackReason}
                  </p>
                )}
                {sbtTxHash && (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${sbtTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#00F0FF",
                      fontSize: 12,
                      fontWeight: 700,
                      textDecoration: "underline",
                      textUnderlineOffset: 3,
                      display: "block",
                      marginTop: 14,
                      textAlign: "center",
                    }}
                  >
                    View transaction on Sepolia Etherscan
                  </a>
                )}
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
                {error && (
                  <div
                    style={{
                      background: "rgba(255,45,107,0.1)",
                      border: "1px solid rgba(255,45,107,0.2)",
                      borderRadius: 12,
                      padding: 12,
                      color: "#FF5E8C",
                      fontSize: 13,
                      marginBottom: 16,
                    }}
                  >
                    {error}
                  </div>
                )}
                <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
                  <label style={labelStyle}>Tax ID / VAT Number *</label>
                  <input
                    value={taxID}
                    onChange={(event) => setTaxID(event.target.value)}
                    style={{
                      ...inputStyle,
                      border: kybFieldErrors.taxID ? "1px solid rgba(255,45,107,0.55)" : inputStyle.border,
                    }}
                    placeholder="12-3456789"
                  />
                  {kybFieldErrors.taxID && (
                    <p style={{ color: "#FF5E8C", fontSize: 12, marginTop: 0, marginBottom: 0 }}>
                      {kybFieldErrors.taxID}
                    </p>
                  )}
                </div>
                <p style={{ ...bodyStyle, marginBottom: 16 }}>{statusMessage}</p>
                <button
                  onClick={() => {
                    console.log("[FHE] Button clicked", {
                      stage,
                      isEncryptingFHE,
                      hasKybResult: Boolean(kybResult),
                      activeWallet,
                    });
                    void handleFHESubmit();
                  }}
                  disabled={isEncryptingFHE}
                  style={primaryBtnStyle}
                >
                  {isEncryptingFHE ? <Spinner /> : "Encrypt and store compliance"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleResetSignIn()}
                  disabled={isLoading || isEncryptingFHE}
                  style={{
                    width: "100%",
                    marginTop: 12,
                    background: "transparent",
                    border: "none",
                    color: "#8B9CC8",
                    fontSize: 12,
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                    cursor: isLoading || isEncryptingFHE ? "not-allowed" : "pointer",
                    fontFamily: "Satoshi, sans-serif",
                  }}
                >
                  Reset sign-in and start fresh
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
                <p style={{ ...bodyStyle, marginBottom: 20 }}>
                  Redirecting you to the dashboard...
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
