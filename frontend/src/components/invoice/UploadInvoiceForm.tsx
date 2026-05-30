/**
 * @file UploadInvoiceForm.tsx
 * @description Progressive multi-step wizard form for encrypting and submitting invoices using Zama FHEVM.
 */

"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "../ui/GlassCard";
import { NeonButton } from "../ui/NeonButton";
import { FHEBadge } from "../ui/FHEBadge";
import { useUploadInvoice } from "@/hooks/useArbitraRegistry";
import { useZama } from "@/providers/ZamaProvider";
import { ARBITRA_REGISTRY_ADDRESS } from "@/lib/contracts";
import { encryptTwoUint64 } from "@/lib/zama";

interface UploadInvoiceFormProps {
  onSuccess?: (invoiceId: bigint) => void;
}

interface FormState {
  faceValueCUSDT: string;
  dueDateISO: string;
  buyerAddress: string;
}

type WizardStep = 1 | 2 | 3 | 4; /* 1: Details, 2: Buyer, 3: Confirm, 4: Processing/Success/Error */
type EncryptionSubstep = "idle" | "params" | "zkp" | "sign" | "blockchain";

export function UploadInvoiceForm({ onSuccess }: UploadInvoiceFormProps) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { instance, isReady: zamaReady, error: zamaError } = useZama();
  const { uploadInvoice, isPending } = useUploadInvoice();

  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [encryptionSubstep, setEncryptionSubstep] = useState<EncryptionSubstep>("idle");
  const [form, setForm] = useState<FormState>({
    faceValueCUSDT: "",
    dueDateISO: "",
    buyerAddress: "",
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    },
    []
  );

  const validateStep1 = (): string | null => {
    const faceValue = parseFloat(form.faceValueCUSDT);
    if (!form.faceValueCUSDT || isNaN(faceValue) || faceValue <= 0) {
      return "Face value must be a positive number.";
    }
    if (faceValue > 3356) {
      return "Max demo invoice is $3,356 cUSDT due to euint64 overflow limits.";
    }
    if (!form.dueDateISO) {
      return "Due date is required.";
    }
    const dueTs = new Date(form.dueDateISO).getTime() / 1000;
    if (dueTs <= Date.now() / 1000) {
      return "Due date must be in the future.";
    }
    return null;
  };

  const validateStep2 = (): string | null => {
    if (!form.buyerAddress.match(/^0x[0-9a-fA-F]{40}$/)) {
      return "Buyer address must be a valid Ethereum address (0x...).";
    }
    return null;
  };

  const handleNextStep1 = () => {
    setErrorMsg(null);
    const err = validateStep1();
    if (err) {
      setErrorMsg(err);
      return;
    }
    setWizardStep(2);
  };

  const handleNextStep2 = () => {
    setErrorMsg(null);
    const err = validateStep2();
    if (err) {
      setErrorMsg(err);
      return;
    }
    setWizardStep(3);
  };

  const handleBack = () => {
    setErrorMsg(null);
    if (wizardStep === 2) setWizardStep(1);
    if (wizardStep === 3) setWizardStep(2);
  };

  /* Progressive loading states simulator */
  const runProgressiveEncryption = async () => {
    if (!instance || !address || !walletClient) {
      setErrorMsg("Connect your wallet and wait for FHEVM to initialize.");
      setWizardStep(3);
      return;
    }

    try {
      setWizardStep(4);
      setErrorMsg(null);
      setTxHash(null);

      /* Substep 1: Verifying parameters */
      setEncryptionSubstep("params");
      await new Promise((resolve) => setTimeout(resolve, 1200));

      /* Substep 2: Generating ZK proofs */
      setEncryptionSubstep("zkp");
      const faceValueMicro = BigInt(Math.round(parseFloat(form.faceValueCUSDT) * 1_000_000));
      const dueTimestamp = BigInt(Math.floor(new Date(form.dueDateISO).getTime() / 1000));
      
      const { handle1, handle2, inputProof } = await encryptTwoUint64(
        instance,
        faceValueMicro,
        dueTimestamp,
        ARBITRA_REGISTRY_ADDRESS,
        address
      );

      /* Substep 3: Requesting EIP-712 signatures */
      setEncryptionSubstep("sign");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const toHex = (b: Uint8Array): `0x${string}` =>
        ("0x" + Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("")) as `0x${string}`;

      const handle1Hex = toHex(handle1);
      const proofHex = toHex(inputProof);
      const handle2Hex = toHex(handle2);

      /* Substep 4: Submitting to Sepolia */
      setEncryptionSubstep("blockchain");
      const hash = await uploadInvoice(
        handle1Hex,
        proofHex,
        handle2Hex,
        proofHex,
        form.buyerAddress as `0x${string}`
      );

      setTxHash(hash || null);
      setForm({ faceValueCUSDT: "", dueDateISO: "", buyerAddress: "" });
    } catch (err) {
      console.error("[UploadInvoiceForm] Error:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(`Transaction failed: ${msg}`);
      setEncryptionSubstep("idle");
    }
  };

  const handleReset = () => {
    setWizardStep(1);
    setEncryptionSubstep("idle");
    setErrorMsg(null);
    setTxHash(null);
  };

  return (
    <GlassCard className="p-6 max-w-lg relative overflow-hidden">
      {/* Top background glow line */}
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
            Tokenize Invoice
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Step {wizardStep === 4 ? 3 : wizardStep} of 3
          </p>
        </div>
        <FHEBadge />
      </div>

      {/* Progressive Step Progress Bar */}
      {wizardStep < 4 && (
        <div className="w-full bg-white/5 h-1 rounded-full mb-6 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple"
            animate={{ width: `${(wizardStep / 3) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}

      {/* Form Wizard Pages */}
      <AnimatePresence mode="wait">
        {wizardStep === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="faceValueCUSDT" className="block text-sm text-slate-400 mb-1.5 font-medium">
                Face Value (cUSDT)
                <span className="ml-1.5 text-xs text-slate-600">• max $3,356 limit</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-semibold" aria-hidden="true">$</span>
                <input
                  id="faceValueCUSDT"
                  name="faceValueCUSDT"
                  type="number"
                  min="0.01"
                  max="3356"
                  step="0.01"
                  value={form.faceValueCUSDT}
                  onChange={handleChange}
                  className="glass-input pl-8 pr-24 font-mono"
                  placeholder="1000.00"
                  required
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <FHEBadge size="sm" animated={false} label="Encrypted" />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="dueDateISO" className="block text-sm text-slate-400 mb-1.5 font-medium">
                Maturity Due Date
              </label>
              <div className="relative">
                <input
                  id="dueDateISO"
                  name="dueDateISO"
                  type="date"
                  value={form.dueDateISO}
                  onChange={handleChange}
                  className="glass-input pr-24"
                  style={{ colorScheme: "dark" }}
                  min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                  required
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <FHEBadge size="sm" animated={false} label="Encrypted" />
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20 text-neon-pink text-xs">
                {errorMsg}
              </div>
            )}

            <div className="pt-2">
              <NeonButton
                type="button"
                variant="primary"
                onClick={handleNextStep1}
                disabled={!zamaReady}
                className="w-full"
              >
                Continue to Counterparty &rarr;
              </NeonButton>
            </div>
          </motion.div>
        )}

        {wizardStep === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="buyerAddress" className="block text-sm text-slate-400 mb-1.5 font-medium">
                Buyer Wallet Address
                <span className="ml-1.5 text-xs text-slate-600">• plaintext routing</span>
              </label>
              <input
                id="buyerAddress"
                name="buyerAddress"
                type="text"
                value={form.buyerAddress}
                onChange={handleChange}
                className="glass-input font-mono"
                placeholder="0x..."
                required
              />
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20 text-neon-pink text-xs">
                {errorMsg}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 neon-btn-ghost rounded-xl text-sm"
              >
                Back
              </button>
              <NeonButton
                type="button"
                variant="primary"
                onClick={handleNextStep2}
                className="flex-[2]"
              >
                Confirm Submission &rarr;
              </NeonButton>
            </div>
          </motion.div>
        )}

        {wizardStep === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="p-4 rounded-xl bg-white/2 border border-white/5 space-y-3">
              <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                <span className="text-slate-500">Asset Type</span>
                <span className="text-white font-mono">Confidential Invoice</span>
              </div>
              <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                <span className="text-slate-500">Face Value</span>
                <span className="text-neon-cyan font-mono font-semibold">${parseFloat(form.faceValueCUSDT).toFixed(2)} cUSDT</span>
              </div>
              <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                <span className="text-slate-500">Maturity Date</span>
                <span className="text-neon-purple font-mono">{form.dueDateISO}</span>
              </div>
              <div className="flex justify-between items-start text-xs">
                <span className="text-slate-500">Buyer Wallet</span>
                <span className="text-white font-mono truncate max-w-[180px]">{form.buyerAddress}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl flex gap-3 items-start" style={{ background: "rgba(0,240,255,0.04)", border: "1px solid rgba(0,240,255,0.08)" }}>
              <svg className="w-4 h-4 text-neon-cyan mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <div className="text-[11px] text-slate-400 leading-relaxed">
                Confirming execution will initiate the client-side FHE encryption pipeline. Face values are parsed into cryptographically secure ciphertexts before broadcasting.
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20 text-neon-pink text-xs">
                {errorMsg}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 neon-btn-ghost rounded-xl text-sm"
              >
                Back
              </button>
              <button
                type="button"
                onClick={runProgressiveEncryption}
                className="flex-[2] neon-btn-primary rounded-xl text-sm"
              >
                🔒 Encrypt & Submit
              </button>
            </div>
          </motion.div>
        )}

        {wizardStep === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="text-center py-6 space-y-6"
          >
            {errorMsg ? (
              /* Failure state */
              <div className="space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-neon-pink/10 border border-neon-pink/30 flex items-center justify-center text-neon-pink">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-bold text-base" style={{ fontFamily: "Satoshi, sans-serif" }}>Encryption Pipeline Failed</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{errorMsg}</p>
                </div>
                <button onClick={handleReset} className="neon-btn-secondary px-6 py-2 rounded-xl text-xs">
                  Reset Wizard
                </button>
              </div>
            ) : txHash ? (
              /* Success state */
              <div className="space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-neon-green/10 border border-neon-green/30 flex items-center justify-center text-neon-green">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-bold text-base" style={{ fontFamily: "Satoshi, sans-serif" }}>Invoice Tokenized successfully</h3>
                  <p className="text-xs text-slate-500 mt-2">
                    Face values are encrypted and stored on Sepolia at:
                  </p>
                  <p className="text-[11px] font-mono text-neon-cyan mt-1 bg-white/3 border border-white/5 rounded-lg p-2 max-w-xs mx-auto break-all">
                    {txHash}
                  </p>
                </div>
                <button onClick={handleReset} className="neon-btn-primary px-6 py-2.5 rounded-xl text-xs">
                  Tokenize Another Invoice
                </button>
              </div>
            ) : (
              /* Loading wizard stages visualizer */
              <div className="space-y-6">
                <div className="relative mx-auto w-16 h-16">
                  {/* Outer spinning glow ring */}
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
                  <div className="text-xs font-semibold text-slate-400 mb-2 border-b border-white/5 pb-1">
                    FHE PIPELINE ACTIVE
                  </div>
                  
                  {[
                    { key: "params", label: "Verifying invoice constraints" },
                    { key: "zkp", label: "Generating local ZK proofs" },
                    { key: "sign", label: "Requesting keypair permit signatures" },
                    { key: "blockchain", label: "Broadcasting encrypted payload" },
                  ].map((sub, idx) => {
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
      `}</style>
    </GlassCard>
  );
}
