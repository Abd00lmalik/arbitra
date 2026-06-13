/**
 * @file PlaidModal.tsx
 * @description Mock Plaid Link interface for Web2 bank authentication and checking account mapping.
 */

import React, { useState } from "react";
import { GlassCard } from "../ui/GlassCard";
import { NeonButton } from "../ui/NeonButton";

interface PlaidModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (bankName: string, accountNumber: string) => void;
}

type Step = "select" | "login" | "mfa" | "account" | "success";

const MOCK_BANKS = [
  { name: "Chase", code: "chase", color: "from-blue-600 to-blue-800" },
  { name: "Bank of America", code: "bofa", color: "from-red-600 to-red-800" },
  { name: "Silicon Valley Bank", code: "svb", color: "from-cyan-600 to-blue-900" },
  { name: "Citibank", code: "citi", color: "from-blue-500 to-cyan-500" },
  { name: "Wells Fargo", code: "wells", color: "from-yellow-600 to-red-700" },
  { name: "HSBC", code: "hsbc", color: "from-red-700 to-stone-800" }
];

export function PlaidModal({ isOpen, onClose, onSuccess }: PlaidModalProps) {
  const [step, setStep] = useState<Step>("select");
  const [selectedBank, setSelectedBank] = useState<typeof MOCK_BANKS[0] | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("checking");
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleBankSelect = (bank: typeof MOCK_BANKS[0]) => {
    setSelectedBank(bank);
    setStep("login");
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setStep("mfa");
    }, 1000);
  };

  const handleMfaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setStep("account");
    }, 1000);
  };

  const handleAccountConfirm = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setStep("success");
    }, 1200);
  };

  const handleFinalize = () => {
    if (selectedBank) {
      onSuccess(selectedBank.name, "Checking (...9823)");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
      <GlassCard className="w-full max-w-md p-6 relative overflow-hidden flex flex-col min-h-[480px]">
        {/* Plaid Top Branding */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-gradient-to-tr from-stone-900 to-stone-700 flex items-center justify-center border border-white/10">
              <span className="text-white text-xs font-black">P</span>
            </span>
            <span className="text-white font-bold text-sm tracking-wide font-sans">plaid</span>
            <span className="text-[10px] bg-white/5 border border-white/10 text-slate-400 px-1.5 py-0.5 rounded uppercase font-semibold">Sandbox</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Loading Spinner overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <div className="w-8 h-8 rounded-full border-2 border-neon-cyan/20 border-t-neon-cyan animate-spin mb-3" />
            <span className="text-xs text-slate-400 font-medium">Securing connection...</span>
          </div>
        )}

        {/* Step 1: Select Bank */}
        {step === "select" && (
          <div className="flex-1 flex flex-col pt-4">
            <h3 className="text-white font-bold text-base mb-1">Link your bank</h3>
            <p className="text-slate-400 text-xs mb-6">
              Select your financial institution to authenticate and verify billing details.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {MOCK_BANKS.map((bank) => (
                <button
                  key={bank.code}
                  onClick={() => handleBankSelect(bank)}
                  className="p-4 rounded-xl border border-white/5 bg-white/2 hover:bg-white/5 hover:border-white/15 transition-all text-left group relative overflow-hidden"
                >
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${bank.color} flex items-center justify-center text-white text-xs font-extrabold shadow-sm group-hover:scale-105 transition-transform`}>
                    {bank.name.charAt(0)}
                  </div>
                  <div className="text-white font-semibold text-xs mt-3">{bank.name}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">Secure Link</div>
                </button>
              ))}
            </div>
            <div className="mt-auto text-center">
              <p className="text-[10px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                By linking your bank, you agree to Plaid’s End User Privacy Policy. Your credentials are never shared with Arbitra.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Login */}
        {step === "login" && selectedBank && (
          <form onSubmit={handleLoginSubmit} className="flex-1 flex flex-col pt-4">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-6 h-6 rounded bg-gradient-to-tr ${selectedBank.color} flex items-center justify-center text-white text-[10px] font-black`}>
                {selectedBank.name.charAt(0)}
              </div>
              <span className="text-xs text-slate-400">Log in to {selectedBank.name}</span>
            </div>
            <h3 className="text-white font-bold text-base mb-1">Enter your credentials</h3>
            <p className="text-slate-400 text-xs mb-6">
              Use your bank portal username and password to establish connection.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5">Username</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. debtor_corporate"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white/3 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-neon-cyan/50"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/3 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-neon-cyan/50"
                />
              </div>
            </div>

            <div className="mt-auto pt-6 flex gap-3">
              <NeonButton
                variant="ghost"
                type="button"
                onClick={() => setStep("select")}
                className="flex-1"
              >
                Back
              </NeonButton>
              <NeonButton
                variant="primary"
                type="submit"
                className="flex-1"
              >
                Log In
              </NeonButton>
            </div>
          </form>
        )}

        {/* Step 3: MFA OTP */}
        {step === "mfa" && selectedBank && (
          <form onSubmit={handleMfaSubmit} className="flex-1 flex flex-col pt-4">
            <h3 className="text-white font-bold text-base mb-1">Security Code Required</h3>
            <p className="text-slate-400 text-xs mb-6">
              We’ve sent a 6-digit verification code to your registered corporate email.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5">Enter Code</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="e.g. 123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-white/3 border border-white/10 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold tracking-widest text-white focus:outline-none focus:border-neon-cyan/50"
                />
              </div>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setOtp("123456")}
                  className="text-[10px] text-neon-cyan hover:underline"
                >
                  Autofill code (123456)
                </button>
              </div>
            </div>

            <div className="mt-auto pt-6 flex gap-3">
              <NeonButton
                variant="ghost"
                type="button"
                onClick={() => setStep("login")}
                className="flex-1"
              >
                Back
              </NeonButton>
              <NeonButton
                variant="primary"
                type="submit"
                className="flex-1"
              >
                Submit Code
              </NeonButton>
            </div>
          </form>
        )}

        {/* Step 4: Account Selection */}
        {step === "account" && selectedBank && (
          <div className="flex-1 flex flex-col pt-4">
            <h3 className="text-white font-bold text-base mb-1">Select account</h3>
            <p className="text-slate-400 text-xs mb-6">
              Choose the primary commercial operating account to authorize for payment settle verification.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => setSelectedAccount("checking")}
                className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition-all ${
                  selectedAccount === "checking"
                    ? "bg-neon-cyan/5 border-neon-cyan/40"
                    : "bg-white/2 border-white/5 hover:border-white/10"
                }`}
              >
                <div>
                  <div className="text-xs font-semibold text-white">Commercial checking account</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Operating Account (*9823)</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-white">$248,500.00</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">Available Balance</div>
                </div>
              </button>

              <button
                onClick={() => setSelectedAccount("savings")}
                className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition-all opacity-60 ${
                  selectedAccount === "savings"
                    ? "bg-neon-cyan/5 border-neon-cyan/40"
                    : "bg-white/2 border-white/5 hover:border-white/10"
                }`}
              >
                <div>
                  <div className="text-xs font-semibold text-white">Corporate reserve savings</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Treasury Account (*1043)</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-white">$1,450,200.00</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">Available Balance</div>
                </div>
              </button>
            </div>

            <div className="mt-auto pt-6 flex gap-3">
              <NeonButton
                variant="ghost"
                type="button"
                onClick={() => setStep("mfa")}
                className="flex-1"
              >
                Back
              </NeonButton>
              <NeonButton
                variant="primary"
                onClick={handleAccountConfirm}
                className="flex-1"
              >
                Authorize Link
              </NeonButton>
            </div>
          </div>
        )}

        {/* Step 5: Success Screen */}
        {step === "success" && selectedBank && (
          <div className="flex-1 flex flex-col items-center justify-center text-center pt-8">
            <div className="w-14 h-14 rounded-full bg-neon-green/10 border border-neon-green/30 flex items-center justify-center text-neon-green mb-4 animate-bounce">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="text-white font-bold text-lg mb-1">Account Connected</h3>
            <p className="text-slate-400 text-xs max-w-xs mx-auto mb-6">
              Your {selectedBank.name} commercial account has been linked successfully. Bank routing and authorization are verified.
            </p>

            <div className="w-full bg-white/2 rounded-xl p-4 border border-white/5 space-y-2.5 text-left text-xs mb-8">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Institution</span>
                <span className="text-white font-semibold">{selectedBank.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Account Type</span>
                <span className="text-white font-medium">Checking (...9823)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Verification</span>
                <span className="text-neon-green font-semibold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-neon-green inline-block animate-ping" />
                  Plaid Identity Match
                </span>
              </div>
            </div>

            <button
              onClick={handleFinalize}
              className="w-full neon-btn-primary py-3 rounded-xl text-xs font-semibold"
            >
              Continue to Invoice Attestation →
            </button>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
