"use client";

import { useState, useCallback } from "react";
import { useAccount, useWalletClient } from "wagmi";
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

type SubmitState = "idle" | "encrypting" | "submitting" | "success" | "error";

export function UploadInvoiceForm({ onSuccess }: UploadInvoiceFormProps) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { instance, isReady: zamaReady, error: zamaError } = useZama();
  const { uploadInvoice, isPending } = useUploadInvoice();

  const [form, setForm] = useState<FormState>({
    faceValueCUSDT: "",
    dueDateISO: "",
    buyerAddress: "",
  });
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    },
    []
  );

  const validate = (): string | null => {
    const faceValue = parseFloat(form.faceValueCUSDT);
    if (!form.faceValueCUSDT || isNaN(faceValue) || faceValue <= 0) {
      return "Face value must be a positive number.";
    }
    if (faceValue > 3356) {
      return `Max demo invoice is $3,356 cUSDT due to euint64 overflow limits. See §SCALE_DAYS constraint.`;
    }
    if (!form.dueDateISO) {
      return "Due date is required.";
    }
    const dueTs = new Date(form.dueDateISO).getTime() / 1000;
    if (dueTs <= Date.now() / 1000) {
      return "Due date must be in the future.";
    }
    if (!form.buyerAddress.match(/^0x[0-9a-fA-F]{40}$/)) {
      return "Buyer address must be a valid Ethereum address (0x...).";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validationError = validate();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    if (!instance || !address || !walletClient) {
      setErrorMsg(
        "Connect your wallet and wait for FHEVM to initialize."
      );
      return;
    }

    try {
      setSubmitState("encrypting");

      /* Convert face value to micro-units (6 decimals like USDT) */
      const faceValueMicro = BigInt(Math.round(parseFloat(form.faceValueCUSDT) * 1_000_000));
      const dueTimestamp = BigInt(Math.floor(new Date(form.dueDateISO).getTime() / 1000));

      /* Encrypt both values in one input (single shared proof) */
      const { handle1, handle2, inputProof } = await encryptTwoUint64(
        instance,
        faceValueMicro,
        dueTimestamp,
        ARBITRA_REGISTRY_ADDRESS,
        address
      );

      /* Convert Uint8Array handles to hex strings for the contract call */
      const toHex = (b: Uint8Array): `0x${string}` =>
        ("0x" + Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("")) as `0x${string}`;

      const handle1Hex = toHex(handle1);
      const proofHex = toHex(inputProof);
      const handle2Hex = toHex(handle2);

      setSubmitState("submitting");

      const hash = await uploadInvoice(
        handle1Hex,
        proofHex,
        handle2Hex,
        proofHex,
        form.buyerAddress as `0x${string}`
      );

      setTxHash(hash || null);
      setSubmitState("success");
      setForm({ faceValueCUSDT: "", dueDateISO: "", buyerAddress: "" });
    } catch (err) {
      console.error("[UploadInvoiceForm] Error:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(`Transaction failed: ${msg}`);
      setSubmitState("error");
    }
  };

  const isLoading = submitState === "encrypting" || submitState === "submitting" || isPending;

  const stateLabel = {
    idle: "Upload Invoice",
    encrypting: "Encrypting with FHE...",
    submitting: "Submitting to blockchain...",
    success: "Invoice Uploaded!",
    error: "Try Again",
  }[submitState];

  return (
    <GlassCard className="p-6 max-w-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Upload Invoice</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Face value and due date are encrypted with FHE before submission
          </p>
        </div>
        <FHEBadge />
      </div>

      {/* FHEVM status */}
      {zamaError && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
          ⚠️ FHEVM: {zamaError}
        </div>
      )}

      {!zamaReady && !zamaError && (
        <div className="mb-4 p-3 rounded-xl bg-neon-cyan/5 border border-neon-cyan/10 text-neon-cyan text-xs flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse" aria-hidden="true" />
          Initializing FHEVM SDK...
        </div>
      )}

      {/* Success state */}
      {submitState === "success" && txHash && (
        <div className="mb-4 p-4 rounded-xl bg-neon-green/10 border border-neon-green/20">
          <div className="text-neon-green font-medium text-sm mb-1">
            ✓ Invoice uploaded successfully!
          </div>
          <div className="text-xs text-slate-500 font-mono break-all">
            Tx: {txHash.slice(0, 20)}...{txHash.slice(-8)}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="space-y-4">
          {/* Face Value */}
          <div>
            <label htmlFor="faceValueCUSDT" className="block text-sm text-slate-400 mb-1.5">
              Face Value (cUSDT)
              <span className="ml-1 text-xs text-slate-600">• max $3,356 demo limit</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" aria-hidden="true">$</span>
              <input
                id="faceValueCUSDT"
                name="faceValueCUSDT"
                type="number"
                min="0.01"
                max="3356"
                step="0.01"
                value={form.faceValueCUSDT}
                onChange={handleChange}
                className="glass-input pl-8"
                placeholder="1000.00"
                required
                aria-describedby="faceValue-desc"
              />
              <span id="faceValue-desc" className="sr-only">Maximum $3,356 cUSDT for this demo</span>
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <FHEBadge size="sm" animated label="Encrypted" />
              </div>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label htmlFor="dueDateISO" className="block text-sm text-slate-400 mb-1.5">
              Due Date
            </label>
            <div className="relative">
              <input
                id="dueDateISO"
                name="dueDateISO"
                type="date"
                value={form.dueDateISO}
                onChange={handleChange}
                className="glass-input"
                style={{ colorScheme: "dark" }}
                min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                required
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <FHEBadge size="sm" animated label="Encrypted" />
              </div>
            </div>
          </div>

          {/* Buyer Address */}
          <div>
            <label htmlFor="buyerAddress" className="block text-sm text-slate-400 mb-1.5">
              Buyer Address
              <span className="ml-1 text-xs text-slate-600">• plaintext on-chain</span>
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
              pattern="^0x[0-9a-fA-F]{40}$"
            />
          </div>
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20 text-neon-pink text-xs">
            {errorMsg}
          </div>
        )}

        {/* FHE flow explanation */}
        <div className="mt-4 p-3 rounded-xl flex gap-3 items-start"
          style={{ background: "rgba(0,240,255,0.04)", border: "1px solid rgba(0,240,255,0.08)" }}>
          <svg className="w-4 h-4 text-neon-cyan mt-0.5 flex-shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 1.5L13 4v5c0 3-2.2 5.5-5 6C5.2 14.5 3 12 3 9V4L8 1.5z" stroke="currentColor" strokeWidth="1.2" />
            <path d="M5.5 8L7 9.5L10.5 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="text-xs text-slate-400">
            <strong className="text-neon-cyan">FHE Flow:</strong> Face value and due date are encrypted
            client-side using Zama FHEVM before being submitted. Your wallet signs a ZK proof.
            The contract receives ciphertexts — the exact amounts are never visible on-chain.
          </div>
        </div>

        {/* Submit */}
        <NeonButton
          type="submit"
          variant="primary"
          loading={isLoading}
          disabled={!zamaReady || !address}
          className="w-full mt-5"
          id="upload-invoice-submit"
        >
          {isLoading ? stateLabel : "🔒 Encrypt & Upload Invoice"}
        </NeonButton>

        {!address && (
          <p className="text-center text-xs text-slate-500 mt-2">
            Connect your wallet to upload invoices
          </p>
        )}
      </form>
    </GlassCard>
  );
}
