/*
 * @file UploadInvoiceForm.tsx
 * @description progressive 4-step wizard form for PDF drag-and-drop, detail review,
 *              collateral vault locking, and local ZK proof FHE encryption submission.
 */

"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useAccount, useBalance, usePublicClient, useReadContracts, useWaitForTransactionReceipt } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { formatEther, parseEther, parseGwei } from "viem";
import { useRouter } from "next/navigation";
import { GlassCard } from "../ui/GlassCard";
import { NeonButton } from "../ui/NeonButton";
import { FHEBadge } from "../ui/FHEBadge";

import {
  useUploadInvoice,
  useInvoiceCount,
  useApproveUSDC,
  useStakeCollateral,
  useUSDCBalance,
  useUSDCAllowance
} from "@/hooks/useArbitraRegistry";
import { useActiveWalletClient } from "@/hooks/useActiveWalletClient";
import { useZama } from "@/providers/ZamaProvider";
import {
  ARBITRA_REGISTRY_ADDRESS,
  ARBITRA_REGISTRY_ABI,
  COLLATERAL_VAULT_ADDRESS,
  COLLATERAL_VAULT_ABI,
  FINGERPRINT_REGISTRY_ABI,
  FINGERPRINT_REGISTRY_ADDRESS,
  USDC_ADDRESS,
  USDC_ABI,
  fromMicroUnits,
} from "@/lib/contracts";
import { encryptFiveUint64, encryptTwoUint64, userDecryptHandles } from "@/lib/zama";

interface UploadInvoiceFormProps {
  onSuccess?: (invoiceId: bigint) => void;
}

interface ParsedInvoiceDetails {
  faceValue: bigint;
  dueDate: bigint;
  fingerprint: bigint;
  fingerprint64: bigint;
  baseRate: bigint;
  reputationMultiplier: bigint;
  debtor: string;
}

type WizardStep = 1 | 2 | 3 | 4 | 5; 
/*
 * 1: PDF Upload (Drag & Drop)
 * 2: Details Review & Adjust
 * 3: Collateral Staking & Lock (5% USDC)
 * 4: FHE Encryption & Submission
 * 5: Success / Error Display
 */

type EncryptionSubstep = "idle" | "params" | "zkp" | "sign" | "blockchain";

const FALLBACK_SEPOLIA_GAS_PRICE  = parseGwei("2");
/* Realistic minimum for a single FHE transaction at typical Sepolia gas prices.
 * FHE ops need ~1-3M gas; at 35 Gwei that is ~0.07 ETH minimum.              */
const MIN_FRAUD_CHECK_GAS_BUFFER  = parseEther("0.05");
const MIN_ETH_FOR_UPLOAD          = parseEther("0.02");
/* Hard gas caps — prevents Wagmi/viem's inflated simulation estimates           */
const FRAUD_CHECK_GAS_CAP         = 2_500_000n;
const UPLOAD_GAS_CAP              = 1_800_000n;

function formatEthAmount(value: bigint) {
  return Number.parseFloat(formatEther(value)).toFixed(4);
}

function formatGasAwareError(error: unknown, liveGasPrice?: bigint, customGasCap?: bigint) {
  const errObj = error as any;
  const fullMessage = [
    errObj?.message,
    errObj?.details,
    errObj?.shortMessage,
    error instanceof Error ? error.message : "",
    String(error)
  ].filter(Boolean).join(" | ");

  const rawMessage =
    typeof error === "object" && error !== null && "shortMessage" in error && typeof (error as { shortMessage?: unknown }).shortMessage === "string"
      ? (error as { shortMessage: string }).shortMessage
      : error instanceof Error
        ? error.message
        : String(error);

  if (fullMessage.toLowerCase().includes("could not coalesce error") || fullMessage.toLowerCase().includes("coalesce")) {
    return "Transaction simulation failed. This usually means your wallet has insufficient Sepolia ETH for gas, or there is an address mismatch in your Vercel dashboard configuration (e.g., using old/stale contract addresses). Please ensure your wallet has Sepolia ETH and that the Vercel dashboard environment variables match the latest deployed contract addresses.";
  }

  const isInsufficientFunds = fullMessage.toLowerCase().includes("insufficient funds") || fullMessage.toLowerCase().includes("exceeds the balance");
  
  if (isInsufficientFunds) {
    const insufficientFundsMatch = fullMessage.match(/have\s+(\d+)\s+want\s+(\d+)/i);
    if (insufficientFundsMatch) {
      const haveWei = BigInt(insufficientFundsMatch[1]);
      const wantWei = BigInt(insufficientFundsMatch[2]);
      const shortfallWei = wantWei > haveWei ? wantWei - haveWei : 0n;
      return `Insufficient ETH for gas. Wallet balance: ${formatEthAmount(haveWei)} ETH. Required: ${formatEthAmount(wantWei)} ETH. Add about ${formatEthAmount(shortfallWei)} ETH more on Sepolia and try again.`;
    }

    if (liveGasPrice) {
      const estLimit = customGasCap ?? UPLOAD_GAS_CAP;
      /* Add a standard 50% margin to the estimate to match wallet buffers */
      const bufferedGasPrice = (liveGasPrice * 15n) / 10n;
      const requiredWei = estLimit * bufferedGasPrice;
      return `Insufficient ETH for gas. You need approximately ${formatEthAmount(requiredWei)} Sepolia ETH (covering the gas limit ceiling of ${Number(estLimit).toLocaleString()} gas at current gas prices) to submit this transaction. Please fund your wallet and try again.`;
    }

    return "Insufficient ETH for gas. Please fund your wallet with Sepolia ETH and try again.";
  }

  return rawMessage || "Transaction failed.";
}

export function UploadInvoiceForm({ onSuccess }: UploadInvoiceFormProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const router = useRouter();

  /* Unified wallet detection: embedded (Web3Auth social/email) vs external (MetaMask / Keystone / WC) */
  const { walletClient, activeWallet, isEmbedded, getEmbeddedSigner } = useActiveWalletClient();

  const { instance, isReady: zamaReady } = useZama();
  const { uploadInvoice } = useUploadInvoice();
  
  const { approveUSDC, isPending: approvePending } = useApproveUSDC();
  const { stakeCollateral, isPending: stakePending } = useStakeCollateral();
  const { data: rawCount } = useInvoiceCount();
  const { data: usdcBalance, refetch: refetchUSDC } = useUSDCBalance(activeWallet);
  const { data: ethBalance } = useBalance({
    address: activeWallet,
    query: { enabled: !!activeWallet },
  });
  const nextInvoiceId = rawCount !== undefined ? BigInt(rawCount) + 1n : 1n;

  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [encryptionSubstep, setEncryptionSubstep] = useState<EncryptionSubstep>("idle");
  const [isDragActive, setIsDragActive] = useState<boolean>(false);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isFraudChecking, setIsFraudChecking] = useState<boolean>(false);
  const [fraudCheckAwaitingWallet, setFraudCheckAwaitingWallet] = useState<boolean>(false);
  const [fraudCheckStep, setFraudCheckStep] = useState<string | null>(null);
  const [fraudCheckTxHash, setFraudCheckTxHash] = useState<`0x${string}` | null>(null);
  const [stakeStep, setStakeStep] = useState<string | null>(null);
  const [isStaking, setIsStaking] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [logisticsFile, setLogisticsFile] = useState<File | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [localStakeTxHash, setLocalStakeTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [invoice, setInvoice] = useState<ParsedInvoiceDetails>({
    faceValue: 0n,
    dueDate: 0n,
    fingerprint: 0n,
    fingerprint64: 0n,
    baseRate: 0n,
    reputationMultiplier: 0n,
    debtor: "",
  });

  const [debtorEmail, setDebtorEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [fraudCheckDisplayGasPrice, setFraudCheckDisplayGasPrice] = useState<bigint>(FALLBACK_SEPOLIA_GAS_PRICE);

  const { data: allowance, refetch: refetchAllowance } = useUSDCAllowance(activeWallet, COLLATERAL_VAULT_ADDRESS);
  const requiredCollateral = (invoice.faceValue * 500n) / 10000n; /* 5% */
  const isApproved = allowance !== undefined ? BigInt(allowance) >= requiredCollateral : false;
  const { data: collateralStatus } = useReadContracts({
    contracts: [
      {
        address: COLLATERAL_VAULT_ADDRESS,
        abi: COLLATERAL_VAULT_ABI,
        functionName: "stakedCollateralByFingerprint",
        args: [invoice.fingerprint],
      },
      {
        address: COLLATERAL_VAULT_ADDRESS,
        abi: COLLATERAL_VAULT_ABI,
        functionName: "supplierByFingerprint",
        args: [invoice.fingerprint],
      },
    ],
    query: { enabled: wizardStep === 3 && invoice.fingerprint !== 0n },
  });
  const existingStake = collateralStatus?.[0]?.result as bigint | undefined;
  const existingSupplier = collateralStatus?.[1]?.result as `0x${string}` | undefined;
  const alreadyStaked = Boolean(
    activeWallet &&
    existingStake &&
    existingStake > 0n &&
    existingSupplier &&
    existingSupplier.toLowerCase() === activeWallet.toLowerCase(),
  );
  const { isLoading: isFraudCheckConfirming, isSuccess: isFraudCheckConfirmed } = useWaitForTransactionReceipt({
    hash: fraudCheckTxHash ?? undefined,
    query: { enabled: !!fraudCheckTxHash },
  });
  const canAffordUpload = ethBalance?.value !== undefined ? ethBalance.value >= MIN_ETH_FOR_UPLOAD : false;

  useEffect(() => {
    if (invoice.fingerprint) {
      const saved = localStorage.getItem(`arbitra_stake_${invoice.fingerprint.toString()}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.txHash) {
            setLocalStakeTxHash(parsed.txHash);
          }
        } catch (e) {
          console.error("Failed to parse saved stake", e);
        }
      }
    } else {
      setLocalStakeTxHash(null);
    }
  }, [invoice.fingerprint]);

  useEffect(() => {
    if (!publicClient) {
      return;
    }

    let cancelled = false;

    const syncGasPrice = async () => {
      try {
        const liveGasPrice = await publicClient.getGasPrice();
        if (!cancelled) {
          setFraudCheckDisplayGasPrice(liveGasPrice);
        }
      } catch (gasError) {
        console.warn("[upload] Failed to read live Sepolia gas price, using fallback.", gasError);
        if (!cancelled) {
          setFraudCheckDisplayGasPrice(FALLBACK_SEPOLIA_GAS_PRICE);
        }
      }
    };

    void syncGasPrice();
    return () => {
      cancelled = true;
    };
  }, [publicClient]);

  /* Handle Drag Events */
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  }, []);

  const isLogisticsFile = (file: File) =>
    file.type === "text/xml" ||
    file.type === "application/xml" ||
    file.name.toLowerCase().endsWith(".xml") ||
    file.name.toLowerCase().endsWith(".json");

  /* Process invoice and logistics proof files through the AI parsing API. */
  const processFiles = async (pdfFile: File, proofFile: File | null) => {
    if (pdfFile.type !== "application/pdf") {
      setErrorMsg("Please upload a valid PDF invoice document.");
      return;
    }

    if (proofFile && !isLogisticsFile(proofFile)) {
      setErrorMsg("Logistics proof must be XML or JSON.");
      return;
    }

    setIsParsing(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append("pdf", pdfFile);
      if (proofFile) {
        formData.append("xml", proofFile);
      }
        
      const res = await fetch("/api/parse-invoice", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        const errorText = data.details ? `${data.error ?? "Failed to parse invoice via Gemini AI."} ${data.details}` : data.error;
        throw new Error(errorText ?? "Failed to parse invoice via Gemini AI.");
      }
        
      setInvoice({
        faceValue: BigInt(data.faceValue),
        dueDate: BigInt(data.dueDate),
        fingerprint: BigInt(data.fingerprint),
        fingerprint64: BigInt(data.fingerprint64),
        baseRate: BigInt(data.baseRate),
        reputationMultiplier: BigInt(data.reputationMultiplier),
        debtor: data.debtor,
      });

      setWizardStep(2);
      setIsParsing(false);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "An error occurred during invoice parsing.");
      setIsParsing(false);
    }
  };

  /* Drop Event handler */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const pdfFile = files.find((file) => file.type === "application/pdf") ?? files[0];
      const proofFile = files.find((file) => file !== pdfFile && isLogisticsFile(file)) ?? null;
      setInvoiceFile(pdfFile);
      setLogisticsFile(proofFile);
      processFiles(pdfFile, proofFile);
    }
  }, []);

  /* Input File Change handler */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setInvoiceFile(file);
      processFiles(file, logisticsFile);
    }
  };

  const handleLogisticsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogisticsFile(file);
      if (invoiceFile) {
        processFiles(invoiceFile, file);
      }
    }
  };

  /* Step 2 Form Updates */
  const handleDebtorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInvoice(prev => ({ ...prev, debtor: e.target.value }));
  };

  const runEncryptedDuplicatePreflight = async (fingerprint: bigint) => {
    if (!instance || !activeWallet || !publicClient || (!isEmbedded && !walletClient)) {
      throw new Error("FHEVM SDK or Wallet signer not available for duplicate check.");
    }

    setFraudCheckStep("Encrypting invoice fingerprint and face value...");
    const encryptedInputs = await encryptTwoUint64(
      instance,
      fingerprint,
      invoice.faceValue,
      FINGERPRINT_REGISTRY_ADDRESS,
      activeWallet
    );

    /* Check ETH balance before attempting a gas-heavy FHE transaction */
    const walletBalance = await publicClient.getBalance({ address: activeWallet });
    const gasPrice = await publicClient.getGasPrice().catch(() => FALLBACK_SEPOLIA_GAS_PRICE);
    const gasPriceGwei = (Number(gasPrice) / 1e9).toFixed(3);
    const estimatedCost = FRAUD_CHECK_GAS_CAP * gasPrice;    /* Need 20% headroom above the estimated cost so a gas-price spike mid-tx doesn't fail */
    const requiredBalance = (estimatedCost * 12n) / 10n;
    if (walletBalance < requiredBalance) {
      const shortfall = requiredBalance - walletBalance;
      throw new Error(
        `Insufficient ETH for fraud check gas. Balance: ${formatEthAmount(walletBalance)} ETH. ` +
        `At current gas price (${gasPriceGwei} Gwei) the fraud check costs ~${formatEthAmount(estimatedCost)} ETH. ` +
        `You need at least ${formatEthAmount(shortfall)} more ETH. ` +
        `Get free Sepolia ETH at sepoliafaucet.com or via the Alchemy faucet.`
      );
    }

    /* Skip simulateContract — its gas/maxFeePerGas estimates are inflated for FHE calls
     * and produce impossible tx costs (e.g. 74 ETH). Write directly with a capped gas.  */
    setFraudCheckStep(`Gas: ${gasPriceGwei} Gwei · Est. cost: ~${formatEthAmount(estimatedCost)} ETH — awaiting wallet approval...`);
    setFraudCheckAwaitingWallet(true);
    setFraudCheckStep("Check your wallet — approve the fraud check transaction.");

    let duplicateTxHash: `0x${string}`;
    if (isEmbedded) {
      const signer = await getEmbeddedSigner();
      const { ethers } = await import("ethers");
      const contract = new ethers.Contract(FINGERPRINT_REGISTRY_ADDRESS, FINGERPRINT_REGISTRY_ABI, signer);
      const tx = await contract.checkInvoiceUniqueness(
        encryptedInputs.handle1,
        encryptedInputs.inputProof,
        encryptedInputs.handle2,
        encryptedInputs.inputProof,
        { gasLimit: FRAUD_CHECK_GAS_CAP }
      );
      duplicateTxHash = tx.hash as `0x${string}`;
    } else {
      duplicateTxHash = await walletClient!.writeContract({
        chain: walletClient!.chain,
        account: activeWallet,
        address: FINGERPRINT_REGISTRY_ADDRESS,
        abi: FINGERPRINT_REGISTRY_ABI,
        functionName: "checkInvoiceUniqueness",
        args: [
          encryptedInputs.handle1,
          encryptedInputs.inputProof,
          encryptedInputs.handle2,
          encryptedInputs.inputProof,
        ],
        gas: FRAUD_CHECK_GAS_CAP,
      });
    }
    setFraudCheckTxHash(duplicateTxHash);
    setFraudCheckAwaitingWallet(false);

    setFraudCheckStep("Waiting for Sepolia confirmation...");
    const duplicateReceipt = await publicClient.waitForTransactionReceipt({
      hash: duplicateTxHash,
      confirmations: 1,
      timeout: 120_000,
    });
    if (duplicateReceipt.status !== "success") {
      throw new Error("Encrypted duplicate check transaction reverted.");
    }

    setFraudCheckStep("Reading duplicate check handle...");
    const duplicateHandle = await publicClient.readContract({
      address: FINGERPRINT_REGISTRY_ADDRESS,
      abi: FINGERPRINT_REGISTRY_ABI,
      functionName: "getDuplicateCheckHandle",
      args: [activeWallet],
    }) as `0x${string}`;

    if (!duplicateHandle || duplicateHandle === "0x0000000000000000000000000000000000000000000000000000000000000000") {
      throw new Error("Fingerprint registry did not return a duplicate check handle.");
    }

    const signerAdapter = {
      getAddress: async () => activeWallet,
      signTypedData: async (
        domain: object,
        types: object,
        value: object
      ) => {
        if (isEmbedded) {
          const signer = await getEmbeddedSigner();
          const cleanTypes = { ...types } as any;
          delete cleanTypes.EIP712Domain;
          return signer.signTypedData(domain, cleanTypes, value);
        } else {
          const primaryType = Object.keys(types).find((key) => key !== "EIP712Domain") ?? "";
          return walletClient!.signTypedData({
            account: activeWallet,
            domain: domain as any,
            types: types as any,
            primaryType: primaryType as any,
            message: value as any,
          });
        }
      },
    };

    setFraudCheckStep("Decrypting fraud check result...");
    const duplicateValues = await userDecryptHandles(
      instance,
      [{ handle: duplicateHandle, contractAddress: FINGERPRINT_REGISTRY_ADDRESS }],
      signerAdapter
    );

    if (duplicateValues[duplicateHandle] === true || duplicateValues[duplicateHandle] === 1n) {
      throw new Error("Duplicate Financing Detected: This invoice has already been registered on-chain. Double-financing has been blocked by the FHE duplicate check.");
    }

    setFraudCheckStep("Invoice verified unique. No duplicate found.");
  };

  const handleNextStep2 = async () => {
    setErrorMsg(null);
    setFraudCheckTxHash(null);
    setFraudCheckStep(null);
    setFraudCheckAwaitingWallet(false);

    /* Validate email first — it's always required */
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(debtorEmail)) {
      setErrorMsg("Please enter a valid debtor email address.");
      return;
    }

    /* Validate wallet only if provided */
    if (invoice.debtor && !invoice.debtor.match(/^0x[0-9a-fA-F]{40}$/)) {
      setErrorMsg("Debtor wallet must be a valid Ethereum address (or leave blank to use email flow).");
      return;
    }

    setIsFraudChecking(true);
    try {
      await runEncryptedDuplicatePreflight(invoice.fingerprint);
      setWizardStep(3);
      refetchUSDC();
      refetchAllowance();
    } catch (e: any) {
      const message = formatGasAwareError(e, fraudCheckDisplayGasPrice, FRAUD_CHECK_GAS_CAP);
      setErrorMsg(message);
      setFraudCheckStep(null);
      setFraudCheckAwaitingWallet(false);
    } finally {
      setIsFraudChecking(false);
    }
  };

  /* Step 3 Collateral lock execution */
  const handleApproveCollateral = async () => {
    setErrorMsg(null);
    try {
      if (!publicClient || !activeWallet || (!isEmbedded && !walletClient)) {
        throw new Error("Wallet not connected for USDC approval.");
      }

      /* Approve a generous allowance so the user isn't re-prompted on the same session. */
      const generousAllowance = requiredCollateral * 11n;
      let approvalTxHash: `0x${string}`;

      if (isEmbedded) {
        const signer = await getEmbeddedSigner();
        const { ethers } = await import("ethers");
        const contract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
        const tx = await contract.approve(COLLATERAL_VAULT_ADDRESS, generousAllowance);
        approvalTxHash = tx.hash as `0x${string}`;
      } else {
        approvalTxHash = await walletClient!.writeContract({
          chain: walletClient!.chain,
          account: activeWallet,
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: "approve",
          args: [COLLATERAL_VAULT_ADDRESS, generousAllowance],
        });
      }
      await publicClient.waitForTransactionReceipt({ hash: approvalTxHash });
      refetchAllowance();
    } catch (e: any) {
      setErrorMsg(formatGasAwareError(e, fraudCheckDisplayGasPrice, 100_000n) || "Approval failed.");
    }
  };

  const handleStakeCollateral = async () => {
    setErrorMsg(null);
    setStakeStep(null);

    if (invoice.faceValue === 0n) {
      setErrorMsg("Invoice face value is zero. Please re-upload your PDF.");
      return;
    }

    if (alreadyStaked) {
      setWizardStep(4);
      void runProgressiveEncryption();
      return;
    }

    if (usdcBalance !== undefined && BigInt(usdcBalance) < requiredCollateral) {
      setErrorMsg(`Insufficient USDC balance. Need $${(Number(requiredCollateral) / 1e6).toFixed(2)} USDC (5% collateral) but have $${(Number(usdcBalance) / 1e6).toFixed(2)} USDC. Get test USDC from faucet.circle.com.`);
      return;
    }

    if (!activeWallet || !publicClient || (!isEmbedded && !walletClient)) {
      setErrorMsg("Wallet not connected.");
      return;
    }

    setIsStaking(true);
    try {
      /* On-chain check: skip if already staked (covers page-refresh resumption) */
      setStakeStep("Checking vault status...");
      const currentStake = await publicClient.readContract({
        address: COLLATERAL_VAULT_ADDRESS,
        abi: COLLATERAL_VAULT_ABI,
        functionName: "stakedCollateralByFingerprint",
        args: [invoice.fingerprint],
      }) as bigint;
      const currentSupplier = await publicClient.readContract({
        address: COLLATERAL_VAULT_ADDRESS,
        abi: COLLATERAL_VAULT_ABI,
        functionName: "supplierByFingerprint",
        args: [invoice.fingerprint],
      }) as `0x${string}`;

      if (currentStake > 0n && currentSupplier.toLowerCase() === activeWallet.toLowerCase()) {
        setStakeStep("Collateral already staked — continuing...");
        setIsStaking(false);
        setWizardStep(4);
        void runProgressiveEncryption();
        return;
      }

      /* Use walletClient directly with explicit account so Web3Auth embedded wallet
       * is correctly identified as the signer — wagmi writeContractAsync does not
       * pass account for embedded wallet connectors, causing silent failures.     */
      setStakeStep(`Locking $${(Number(requiredCollateral) / 1e6).toFixed(2)} USDC collateral — confirm in wallet...`);
      let stakeTxHash: `0x${string}`;
      try {
        if (isEmbedded) {
          const signer = await getEmbeddedSigner();
          const { ethers } = await import("ethers");
          const contract = new ethers.Contract(COLLATERAL_VAULT_ADDRESS, COLLATERAL_VAULT_ABI, signer);
          const tx = await contract.stakeCollateral(invoice.fingerprint, invoice.faceValue, {
            gasLimit: 500_000n
          });
          stakeTxHash = tx.hash as `0x${string}`;
        } else {
          stakeTxHash = await walletClient!.writeContract({
            chain: walletClient!.chain,
            account: activeWallet,
            address: COLLATERAL_VAULT_ADDRESS,
            abi: COLLATERAL_VAULT_ABI,
            functionName: "stakeCollateral",
            args: [invoice.fingerprint, invoice.faceValue],
            gas: 500_000n,
          });
        }
      } catch (sendErr: any) {
        /* "already known" = identical tx already in mempool from a prior click.
         * Treat as success: wait for the pending tx to confirm instead.        */
        const msg = (sendErr?.message ?? "").toLowerCase();
        if (msg.includes("already known") || msg.includes("replacement transaction") || msg.includes("nonce too low")) {
          setStakeStep("Transaction already submitted — waiting for confirmation...");
          /* Re-read from chain; if staked by now just proceed */
          const recheckStake = await publicClient.readContract({
            address: COLLATERAL_VAULT_ADDRESS,
            abi: COLLATERAL_VAULT_ABI,
            functionName: "stakedCollateralByFingerprint",
            args: [invoice.fingerprint],
          }) as bigint;
          if (recheckStake > 0n) {
            refetchUSDC();
            setIsStaking(false);
            setWizardStep(4);
            void runProgressiveEncryption();
            return;
          }
          throw new Error("A stake transaction is already pending. Please wait a moment then try again.");
        }
        throw sendErr;
      }

      setStakeStep("Waiting for on-chain confirmation...");
      const stakeReceipt = await publicClient.waitForTransactionReceipt({
        hash: stakeTxHash,
        confirmations: 1,
        timeout: 120_000,
      });
      if (stakeReceipt.status !== "success") {
        throw new Error("Collateral staking transaction reverted. Make sure USDC is approved first.");
      }

      setStakeStep("Collateral locked ✓");
      // Save to localStorage
      const stakeData = {
        fingerprint: invoice.fingerprint.toString(),
        supplier: activeWallet,
        amount: requiredCollateral.toString(),
        txHash: stakeTxHash,
        status: "STAKED_PENDING_REGISTRATION"
      };
      localStorage.setItem(`arbitra_stake_${invoice.fingerprint.toString()}`, JSON.stringify(stakeData));
      setLocalStakeTxHash(stakeTxHash);
      refetchUSDC();
      refetchAllowance();
      setIsStaking(false);
      setWizardStep(4);
      void runProgressiveEncryption();
    } catch (e: any) {
      setIsStaking(false);
      setStakeStep(null);
      const message = formatGasAwareError(e, fraudCheckDisplayGasPrice, 500_000n);
      if (message.includes("Arbitra: already staked")) {
        setWizardStep(4);
        void runProgressiveEncryption();
        return;
      }
      setErrorMsg(message || "Collateral staking failed. Ensure USDC is approved first.");
    }
  };

  /* Step 4 Progressive local encryption and submit */
  const runProgressiveEncryption = async () => {
    if (!instance || !activeWallet || !publicClient || (!isEmbedded && !walletClient)) {
      setErrorMsg("FHEVM SDK or Wallet signer not available.");
      setWizardStep(5);
      return;
    }

    try {
      const walletBalance = await publicClient.getBalance({ address: activeWallet });
      if (walletBalance < MIN_ETH_FOR_UPLOAD) {
        throw new Error(
          `You need at least ${formatEthAmount(MIN_ETH_FOR_UPLOAD)} Sepolia ETH for gas to upload an invoice.`
        );
      }

      setErrorMsg(null);
      setTxHash(null);
      setVerifyUrl(null);
      setEmailSentTo(null);
      setEmailError(null);

      /* Substep 1: Verifying params */
      setEncryptionSubstep("params");

      /* Substep 2: ZK proof generation */
      setEncryptionSubstep("zkp");
      const { handle1, handle2, handle3, handle4, handle5, inputProof } = await encryptFiveUint64(
        instance,
        invoice.faceValue,
        invoice.dueDate,
        invoice.fingerprint64,
        invoice.baseRate,
        invoice.reputationMultiplier,
        ARBITRA_REGISTRY_ADDRESS,
        activeWallet
      );

      /* Substep 3: Permitting signatures */
      setEncryptionSubstep("sign");

      const h1 = handle1;
      const h2 = handle2;
      const h3 = handle3;
      const h4 = handle4;
      const h5 = handle5;
      const proofHex = inputProof;

      /* Substep 4: Submitting to Sepolia */
      setEncryptionSubstep("blockchain");
      let hash: `0x${string}`;

      // 1. Call confirmAndRegister on the Fingerprint Registry
      let confirmTxHash: `0x${string}`;
      if (isEmbedded) {
        const signer = await getEmbeddedSigner();
        const { ethers } = await import("ethers");
        const fpContract = new ethers.Contract(FINGERPRINT_REGISTRY_ADDRESS, FINGERPRINT_REGISTRY_ABI, signer);
        const tx = await fpContract.confirmAndRegister(nextInvoiceId, { gasLimit: 500_000n });
        confirmTxHash = tx.hash as `0x${string}`;
      } else {
        confirmTxHash = await walletClient!.writeContract({
          chain: walletClient!.chain,
          account: activeWallet,
          address: FINGERPRINT_REGISTRY_ADDRESS,
          abi: FINGERPRINT_REGISTRY_ABI,
          functionName: "confirmAndRegister",
          args: [nextInvoiceId],
          gas: 500_000n,
        });
      }

      await publicClient.waitForTransactionReceipt({
        hash: confirmTxHash,
        confirmations: 1,
        timeout: 120_000,
      });

      // 2. Call uploadInvoice on the Invoice Registry
      if (isEmbedded) {
        const signer = await getEmbeddedSigner();
        const { ethers } = await import("ethers");
        const contract = new ethers.Contract(ARBITRA_REGISTRY_ADDRESS, ARBITRA_REGISTRY_ABI, signer);
        const tx = await contract.uploadInvoice(
          h1, proofHex,
          h2, proofHex,
          h3, proofHex,
          h4, proofHex,
          h5, proofHex,
          (invoice.debtor || "0x0000000000000000000000000000000000000000") as `0x${string}`,
          true,
          invoice.faceValue,
          invoice.fingerprint,
          { gasLimit: UPLOAD_GAS_CAP }
        );
        hash = tx.hash as `0x${string}`;
      } else {
        const txHashResult = await uploadInvoice(
          h1, proofHex,
          h2, proofHex,
          h3, proofHex,
          h4, proofHex,
          h5, proofHex,
          (invoice.debtor || "0x0000000000000000000000000000000000000000") as `0x${string}`,
          true,
          invoice.faceValue,
          invoice.fingerprint
        );
        if (!txHashResult) {
          throw new Error("Upload transaction hash was not returned.");
        }
        hash = txHashResult;
      }

      const uploadReceipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
        timeout: 120_000,
      });
      if (uploadReceipt.status !== "success") {
        try {
          const tx = await publicClient.getTransaction({ hash });
          await publicClient.call({
            account: tx.from,
            to: tx.to ?? undefined,
            data: tx.input,
            value: tx.value,
            blockNumber: uploadReceipt.blockNumber,
          });
        } catch (callErr: any) {
          const reason = callErr.shortMessage || callErr.message || String(callErr);
          throw new Error(`Upload invoice transaction reverted: ${reason}`);
        }
        throw new Error("Upload invoice transaction reverted on-chain.");
      }
      localStorage.removeItem(`arbitra_stake_${invoice.fingerprint.toString()}`);
      setLocalStakeTxHash(null);
      setTxHash(hash);
      setWizardStep(5);
      if (onSuccess) {
        onSuccess(nextInvoiceId);
      }
      /* Auto-send verification email — do NOT auto-redirect; let the supplier
         see the verification link and email status first */
      void router; /* keep import; navigation is now manual via the portfolio button */
      setSendingEmail(true);
      try {
        const emailRes = await fetch("/api/send-verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invoiceId: Number(nextInvoiceId),
            debtorEmail,
            supplierName: activeWallet
              ? `Supplier ${activeWallet.slice(0, 6)}...${activeWallet.slice(-4)}`
              : "Your supplier",
            faceValue: invoice.faceValue.toString(),
            dueDate: invoice.dueDate.toString(),
          }),
        });
        const emailData = await emailRes.json();
        if (emailData.verifyUrl) {
          setVerifyUrl(emailData.verifyUrl);
        }
        if (emailData.success) {
          setEmailSentTo(emailData.message);
        } else {
          setEmailError(emailData.error);
        }
      } catch (e) {
        setEmailError("Email delivery failed. Share the link manually below.");
      } finally {
        setSendingEmail(false);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(formatGasAwareError(err, fraudCheckDisplayGasPrice, UPLOAD_GAS_CAP) || "Encryption transaction failed.");
      setWizardStep(5);
    }
  };

  const handleReset = () => {
    setWizardStep(1);
    setEncryptionSubstep("idle");
    setErrorMsg(null);
    setTxHash(null);
    setVerifyUrl(null);
    setEmailSentTo(null);
    setEmailError(null);
    setLinkCopied(false);
    setInvoice({
      faceValue: 0n,
      dueDate: 0n,
      fingerprint: 0n,
      fingerprint64: 0n,
      baseRate: 0n,
      reputationMultiplier: 0n,
      debtor: "",
    });
  };

  return (
    <GlassCard className="p-6 max-w-lg relative overflow-hidden">
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "2px",
          background: "linear-gradient(90deg, #00F0FF 0%, #7B2FFF 100%)",
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white font-heading" style={{ fontFamily: "Satoshi, sans-serif" }}>
            Factor Invoice Wizard
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Step {wizardStep === 5 ? 4 : wizardStep} of 4
          </p>
        </div>
        <FHEBadge />
      </div>

      {/* Progress Bar */}
      {wizardStep < 5 && (
        <div className="w-full bg-white/5 h-1 rounded-full mb-6 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple"
            animate={{ width: `${(wizardStep / 4) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}

      <AnimatePresence mode="wait">
        {wizardStep === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="text-center">
              <h3 className="text-sm font-semibold text-white mb-1">Upload Invoice PDF</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Upload the invoice PDF and, optionally, an XML or JSON delivery receipt for logistics proof binding.
              </p>
            </div>

            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer ${
                isDragActive
                  ? "border-neon-cyan bg-neon-cyan/5"
                  : "border-slate-800 hover:border-slate-700 bg-white/2 hover:bg-white/3"
              }`}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              
              {isParsing ? (
                <div className="space-y-3 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full border-2 border-neon-cyan/20 border-t-neon-cyan animate-spin" />
                  <span className="text-xs text-slate-400">Gemini AI parsing document...</span>
                </div>
              ) : (
                <div className="space-y-2 flex flex-col items-center text-center">
                  <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-xs text-white font-medium">Drag & drop your invoice PDF</span>
                  <span className="text-[10px] text-slate-600">or include PDF + XML/JSON delivery proof together</span>
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-white/2 border border-white/5">
              <label htmlFor="logistics-input" className="block text-xs text-slate-400 mb-2">
                Optional logistics proof XML/JSON
              </label>
              <input
                id="logistics-input"
                type="file"
                accept=".xml,.json,application/xml,text/xml,application/json"
                className="text-xs text-slate-500"
                onChange={handleLogisticsFileChange}
              />
              <p className="text-[10px] text-slate-600 mt-2">
                {logisticsFile ? `Bound proof: ${logisticsFile.name}` : "The proof hash is included in the encrypted duplicate fingerprint."}
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20 text-neon-pink text-xs">
                {errorMsg}
              </div>
            )}
          </motion.div>
        )}

        {wizardStep === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="text-center">
              <h3 className="text-sm font-semibold text-white mb-1">Verify Extracted Details</h3>
              <p className="text-xs text-slate-500">
                Confirm underwriting parameters processed by Gemini AI.
              </p>
            </div>

            <div className="space-y-3 p-4 rounded-xl bg-white/2 border border-white/5 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-slate-500">Invoice Amount</span>
                <span className="text-white font-mono font-semibold">${fromMicroUnits(invoice.faceValue)} USDC</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-slate-500">Maturity Date</span>
                <span className="text-white font-mono">{new Date(Number(invoice.dueDate) * 1000).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-slate-500">AI Fingerprint</span>
                <span className="text-slate-400 font-mono truncate max-w-[150px]">0x{invoice.fingerprint.toString(16)}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-slate-500">Suggested Base Rate</span>
                <span className="text-white font-mono">{(Number(invoice.baseRate) / 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-slate-500">Reputation Multiplier</span>
                <span className="text-white font-mono">x{invoice.reputationMultiplier.toString()}</span>
              </div>
              
              <div className="pt-2">
                <label htmlFor="debtor-address" className="block text-slate-500 mb-1">
                  Debtor Wallet Address{" "}
                  <span style={{ color: "#3D4E7A", fontSize: 10, fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  id="debtor-address"
                  type="text"
                  value={invoice.debtor}
                  onChange={handleDebtorChange}
                  placeholder="0x... (leave blank if debtor has no wallet)"
                  className="glass-input font-mono w-full px-2.5 py-1.5"
                />
                <p style={{ color: "#3D4E7A", fontSize: 10, marginTop: 4 }}>
                  Only needed if the debtor will sign attestation directly via MetaMask.
                  Leave blank for the email-based verification flow.
                </p>
              </div>

              <div className="pt-2">
                <p style={{
                  color: "#3D4E7A", fontSize: 11, fontWeight: 600,
                  textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7,
                  fontFamily: "Satoshi, sans-serif",
                }}>
                  Debtor Email Address <span style={{ color: "#FF2D6B" }}>*</span>
                </p>
                <input
                  type="email"
                  value={debtorEmail}
                  onChange={e => setDebtorEmail(e.target.value)}
                  placeholder="debtor@company.com"
                  required
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${debtorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(debtorEmail)
                      ? "rgba(255,45,107,0.5)"
                      : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 12, padding: "12px 16px",
                    color: "#EEF2FF",
                    fontFamily: "Satoshi, sans-serif", fontSize: 15,
                    outline: "none", transition: "border-color 0.2s",
                  }}
                />
                <p style={{ color: "#3D4E7A", fontSize: 10, marginTop: 5 }}>
                  A secure verification link will be sent to this address.
                  The email contains zero financial data.
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20 text-neon-pink text-xs">
                {errorMsg}
              </div>
            )}

            <div className="space-y-2 rounded-xl border border-white/5 bg-white/2 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Live Sepolia gas price</span>
                <span className="font-mono text-neon-cyan">
                  {(Number(fraudCheckDisplayGasPrice) / 1e9).toFixed(3)} Gwei
                </span>
              </div>
              <p className="text-[10px] leading-relaxed text-slate-500">
                The wallet estimates gas for the fraud check transaction before approval. Typical fraud check cost is ~0.002–0.005 ETH.
              </p>
            </div>

            {fraudCheckTxHash && (
              <a
                href={`https://sepolia.etherscan.io/tx/${fraudCheckTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-xs text-cyan-400 underline"
              >
                View fraud check transaction on Etherscan
              </a>
            )}

            <div className="flex gap-3">
              <button onClick={() => setWizardStep(1)} className="flex-1 neon-btn-ghost text-xs rounded-xl py-2.5">
                Re-upload
              </button>
              <NeonButton
                variant="primary"
                onClick={handleNextStep2}
                disabled={isFraudChecking || fraudCheckAwaitingWallet || isFraudCheckConfirming || isFraudCheckConfirmed}
                className="flex-[2] text-xs"
              >
                {fraudCheckAwaitingWallet
                  ? "Confirm in your wallet..."
                  : isFraudCheckConfirming
                    ? "Confirming on Sepolia..."
                    : isFraudCheckConfirmed
                      ? "Fraud check submitted!"
                      : isFraudChecking
                        ? "Running Fraud Check..."
                        : "Submit and Run Fraud Check"}
              </NeonButton>
            </div>

            {fraudCheckAwaitingWallet && (
              <p className="text-center text-xs text-cyan-400/80">
                Check your wallet - a transaction approval is waiting.
              </p>
            )}

            {isFraudChecking && (
              <div style={{
                position: "absolute", inset: 0,
                background: "rgba(2,7,20,0.85)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 16, borderRadius: 20, zIndex: 10,
                padding: 24,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  border: "2.5px solid rgba(0,240,255,0.15)",
                  borderTopColor: "#00F0FF",
                  animation: "spin 0.9s linear infinite",
                }} />
                <p style={{
                  color: "#00F0FF", fontSize: 15, fontWeight: 600,
                  fontFamily: "Satoshi, sans-serif", textAlign: "center",
                  maxWidth: 340, lineHeight: 1.6,
                }}>
                  {fraudCheckStep ?? "Performing Cryptographic Duplicity and Collusion Verifications..."}
                </p>
                <p style={{ color: "#3D4E7A", fontSize: 12, fontFamily: "Satoshi, sans-serif", textAlign: "center" }}>
                  {fraudCheckAwaitingWallet
                    ? "Approve the transaction from your funded embedded wallet."
                    : isFraudCheckConfirming
                      ? "Waiting for Sepolia to confirm the signed fraud check."
                      : "Running FHE.eq duplicate check on encrypted invoice hashes"}
                </p>
              </div>
            )}
          </motion.div>
        )}

        {wizardStep === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="text-center">
              <h3 className="text-sm font-semibold text-white mb-1">Collateral Vault Staking</h3>
              <p className="text-xs text-slate-500">
                To prevent invoice double-financing fraud, suppliers must lock a 5% USDC security stake.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/2 border border-white/5 space-y-3 text-xs">
              <div className="flex justify-between items-center pb-1 border-b border-white/5">
                <span className="text-slate-500">Invoice Face Value</span>
                <span className="text-white font-mono">${fromMicroUnits(invoice.faceValue)} USDC</span>
              </div>
              <div className="flex justify-between items-center pb-1 border-b border-white/5">
                <span className="text-slate-500">Required Collateral (5%)</span>
                <span className="text-neon-cyan font-mono font-semibold">${fromMicroUnits(requiredCollateral)} USDC</span>
              </div>
              <div className="flex justify-between items-center pb-1 border-b border-white/5">
                <span className="text-slate-500">Your USDC Balance</span>
                <span className={`font-mono ${usdcBalance !== undefined && BigInt(usdcBalance) < requiredCollateral ? 'text-neon-pink' : 'text-white'}`}>
                  {usdcBalance !== undefined ? `$${fromMicroUnits(BigInt(usdcBalance))} USDC` : "Loading..."}
                  {usdcBalance !== undefined && BigInt(usdcBalance) < requiredCollateral && (
                    <span className="ml-2 text-[9px] text-neon-pink">(insufficient)</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Invoice Fingerprint</span>
                <span className="text-white font-mono font-semibold truncate max-w-[150px]">0x{invoice.fingerprint.toString(16)}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl flex gap-3 items-start bg-amber-400/5 border border-amber-400/10">
              <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-[10px] text-slate-400 leading-relaxed">
                Staked collateral will be fully released automatically upon successful debtor maturity repayment. If fraud or duplicate financing is confirmed, collateral is slashed.
              </div>
            </div>

            {alreadyStaked && (
              <div className="p-3 rounded-xl bg-neon-cyan/5 border border-neon-cyan/20 space-y-1.5">
                <p className="text-xs text-neon-cyan font-semibold">
                  Stake already detected for this invoice.
                </p>
                {localStakeTxHash && (
                  <p className="text-[10px] text-slate-400">
                    Transaction hash:{" "}
                    <a
                      href={`https://sepolia.etherscan.io/tx/${localStakeTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neon-cyan underline font-mono break-all"
                    >
                      {localStakeTxHash}
                    </a>
                  </p>
                )}
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20 text-neon-pink text-xs">
                {errorMsg}
              </div>
            )}

            {!canAffordUpload && (
              <div className="p-3 rounded-xl bg-amber-400/5 border border-amber-400/10 text-xs text-amber-300">
                You need at least 0.02 Sepolia ETH for gas to upload an invoice.
                <a
                  href="https://www.alchemy.com/faucets/ethereum-sepolia"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline ml-1"
                >
                  Get Sepolia ETH &rarr;
                </a>
              </div>
            )}

            {/* Live staking status */}
            {isStaking && stakeStep && (
              <div className="p-3 rounded-xl bg-neon-cyan/5 border border-neon-cyan/20 flex items-center gap-3">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan animate-spin flex-shrink-0" />
                <p className="text-xs text-neon-cyan">{stakeStep}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setWizardStep(2)}
                disabled={isStaking}
                className="flex-1 neon-btn-ghost text-xs rounded-xl"
              >
                Back
              </button>
              
              {!isApproved ? (
                <button
                  onClick={handleApproveCollateral}
                  disabled={approvePending || isStaking}
                  className="flex-[2] neon-btn-secondary py-2.5 rounded-xl text-xs"
                >
                  {approvePending ? "Approving USDC..." : "Approve 5% USDC"}
                </button>
              ) : alreadyStaked ? (
                <button
                  onClick={() => {
                    setWizardStep(4);
                    void runProgressiveEncryption();
                  }}
                  disabled={!canAffordUpload}
                  className="flex-[2] neon-btn-primary py-2.5 rounded-xl text-xs"
                >
                  Already Staked — Continue
                </button>
              ) : (
                <button
                  onClick={handleStakeCollateral}
                  disabled={isStaking || !canAffordUpload}
                  className="flex-[2] neon-btn-primary py-2.5 rounded-xl text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isStaking ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3 h-3 rounded-full border border-white/30 border-t-white animate-spin" />
                      {stakeStep ? stakeStep.split("—")[0].trim() : "Processing..."}
                    </span>
                  ) : "Lock Stake & Proceed"}
                </button>
              )}
            </div>
          </motion.div>
        )}

        {wizardStep === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-6 space-y-6"
          >
            <div className="space-y-6">
              <div className="relative mx-auto w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-neon-cyan/10 border-t-neon-cyan animate-spin" />
                <div className="absolute inset-2 rounded-full border border-dashed border-neon-purple/30 animate-reverse-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-neon-cyan">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-pulse">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
              </div>

              <div className="text-left max-w-xs mx-auto space-y-3">
                <div className="text-xs font-semibold text-slate-400 mb-2 border-b border-white/5 pb-1 text-center">
                  FHE ENCRYPTION PROCESS
                </div>
                
                {[
                  { key: "params", label: "Verifying invoice constraints" },
                  { key: "zkp", label: "Generating local ZK proofs" },
                  { key: "sign", label: "Requesting keypair permit signatures" },
                  { key: "blockchain", label: "Broadcasting encrypted payload" },
                ].map((sub) => {
                  const stepsOrder = ["params", "zkp", "sign", "blockchain"];
                  const currentIdx = stepsOrder.indexOf(encryptionSubstep);
                  const itemIdx = stepsOrder.indexOf(sub.key);
                  
                  const isCompleted = itemIdx < currentIdx;
                  const isActive = itemIdx === currentIdx;

                  return (
                    <div key={sub.key} className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        {isCompleted ? (
                          <div className="w-4 h-4 rounded-full bg-neon-green/20 border border-neon-green/40 flex items-center justify-center text-neon-green">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        ) : isActive ? (
                          <div className="w-4 h-4 rounded-full border border-neon-cyan animate-pulse flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-neon-cyan" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-700" />
                        )}
                      </div>
                      <span className={`text-xs ${isActive ? "text-white font-medium" : isCompleted ? "text-slate-400" : "text-slate-600"}`}>
                        {sub.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {wizardStep === 5 && (
          <motion.div
            key="step5"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center py-6 space-y-6"
          >
            {errorMsg ? (
              <div className="space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-neon-pink/10 border border-neon-pink/30 flex items-center justify-center text-neon-pink">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-bold text-base" style={{ fontFamily: "Satoshi, sans-serif" }}>Factoring Submission Failed</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{errorMsg}</p>
                </div>
                <button onClick={handleReset} className="neon-btn-secondary px-6 py-2 rounded-xl text-xs">
                  Reset Wizard
                </button>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <div style={{
                  width: 60, height: 60, borderRadius: "50%",
                  background: "rgba(0,255,136,0.08)",
                  border: "2px solid rgba(0,255,136,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 26, margin: "0 auto 20px",
                  boxShadow: "0 0 24px rgba(0,255,136,0.2)",
                }}>✓</div>

                <h3 style={{
                  color: "#EEF2FF", fontSize: 20, fontWeight: 800,
                  fontFamily: "Satoshi, sans-serif", marginBottom: 8,
                }}>Invoice Uploaded Successfully</h3>
                <p style={{ color: "#8B9CC8", fontSize: 13, marginBottom: 24, lineHeight: 1.65 }}>
                  Invoice <strong style={{ color: "#00F0FF" }}>INV-{nextInvoiceId.toString()}</strong> is now
                  registered on Sepolia with all fields FHE-encrypted.
                </p>

                {/* Email status */}
                <div style={{
                  background: sendingEmail
                    ? "rgba(0,240,255,0.06)"
                    : emailSentTo
                      ? "rgba(0,255,136,0.06)"
                      : emailError
                        ? "rgba(255,186,0,0.06)"
                        : "rgba(0,240,255,0.04)",
                  border: `1px solid ${sendingEmail
                    ? "rgba(0,240,255,0.2)"
                    : emailSentTo
                      ? "rgba(0,255,136,0.2)"
                      : emailError
                        ? "rgba(255,186,0,0.25)"
                        : "rgba(0,240,255,0.1)"}`,
                  borderRadius: 14, padding: "14px 18px", marginBottom: 20,
                }}>
                  {sendingEmail ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: "50%",
                        border: "2px solid rgba(0,240,255,0.2)",
                        borderTopColor: "#00F0FF",
                        animation: "spin 0.8s linear infinite",
                        flexShrink: 0,
                      }} />
                      <p style={{ color: "#00F0FF", fontSize: 13, fontWeight: 600, margin: 0 }}>
                        Sending verification email to debtor…
                      </p>
                    </div>
                  ) : emailSentTo ? (
                    <div>
                      <p style={{ color: "#00FF88", fontSize: 13, fontWeight: 600, margin: "0 0 4px" }}>
                        ✓ {emailSentTo}
                      </p>
                      <p style={{ color: "#3D4E7A", fontSize: 11, margin: 0 }}>
                        Subject: Payment Redirection and Notice of Assignment: INV-{nextInvoiceId.toString()}
                      </p>
                    </div>
                  ) : emailError ? (
                    <div>
                      <p style={{ color: "#FFBA00", fontSize: 13, fontWeight: 600, margin: 0 }}>
                        Currently automatic email sending to debtor is not available but would be soon however send the link below to debtor
                      </p>
                    </div>
                  ) : null}
                </div>

                {/* Verification link — always visible, prominent copy button */}
                {(() => {
                  const link = verifyUrl ??
                    `${typeof window !== "undefined" ? window.location.origin : "https://arbitra-dapp.vercel.app"}/verify/${nextInvoiceId.toString()}`;
                  const handleCopy = () => {
                    navigator.clipboard.writeText(link).then(() => {
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 3000);
                    }).catch(() => {
                      /* Fallback: select the text */
                      const el = document.getElementById("verify-link-text");
                      if (el) { const r = document.createRange(); r.selectNode(el); window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(r); }
                    });
                  };
                  return (
                    <div style={{
                      background: "rgba(0,240,255,0.04)",
                      border: "1px solid rgba(0,240,255,0.15)",
                      borderRadius: 14, padding: "16px 18px", marginBottom: 20,
                      textAlign: "left",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <p style={{ color: "#8B9CC8", fontSize: 11, fontWeight: 600, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          📋 Debtor Verification Link
                        </p>
                        <button
                          id="copy-link-btn"
                          onClick={handleCopy}
                          style={{
                            background: linkCopied ? "rgba(0,255,136,0.15)" : "rgba(0,240,255,0.12)",
                            border: `1px solid ${linkCopied ? "rgba(0,255,136,0.4)" : "rgba(0,240,255,0.3)"}`,
                            borderRadius: 8, padding: "5px 12px",
                            color: linkCopied ? "#00FF88" : "#00F0FF",
                            fontSize: 11, fontWeight: 700, cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                        >
                          {linkCopied ? "✓ Copied!" : "Copy Link"}
                        </button>
                      </div>
                      <p
                        id="verify-link-text"
                        style={{
                          color: "#00F0FF", fontSize: 11,
                          fontFamily: "JetBrains Mono, monospace",
                          wordBreak: "break-all", margin: 0,
                          userSelect: "all",
                        }}
                      >
                        {link}
                      </p>
                      <p style={{ color: "#3D4E7A", fontSize: 10, marginTop: 8, margin: "8px 0 0" }}>
                        Valid for 72 hours. Share this link with your debtor to complete the Notice of Assignment acknowledgement.
                      </p>
                    </div>
                  );
                })()}

                <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                  <button onClick={handleReset} className="neon-btn-secondary px-6 py-2.5 rounded-xl text-xs">
                    Upload Another
                  </button>
                  <a href="/portfolio" style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    background: "#00F0FF", color: "#020714",
                    borderRadius: 12, padding: "11px 24px",
                    fontSize: 13, fontWeight: 700,
                    fontFamily: "Satoshi, sans-serif",
                    textDecoration: "none",
                  }}>
                    View in Portfolio →
                  </a>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .animate-reverse-spin {
          animation: reverse-spin 3s linear infinite;
        }
        @keyframes reverse-spin {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </GlassCard>
  );
}
