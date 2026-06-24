"use client";

import { useState } from "react";
import { GlassCard } from "../ui/GlassCard";
import { NeonButton } from "../ui/NeonButton";
import { useRiskAssessment } from "@/hooks/useRiskAssessment";
import type { RiskAssessmentInput, RiskAssessmentResult } from "@/lib/risk-assessment";
import type { InvoiceOnChain } from "@/lib/contracts";

interface RiskAssessmentPanelProps {
  invoice: InvoiceOnChain;
  decryptedValues?: {
    faceValue?: bigint;
    dueDate?: bigint;
    discountRate?: bigint;
  };
  repaymentRatioBps?: number;
}

function RiskMeter({ score }: { score: number }) {
  const color =
    score < 33 ? "#00FF88" : score < 66 ? "#FFC400" : "#FF2D9B";
  const label = score < 33 ? "Low Risk" : score < 66 ? "Medium Risk" : "High Risk";

  return (
    <div className="space-y-2" role="img" aria-label={`Risk score: ${score} out of 100, ${label}`}>
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">Risk Score</span>
        <span style={{ color }} className="font-bold font-mono">
          {score}/100
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.08)" }}
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${score}%`,
            background: `linear-gradient(90deg, #00FF88, ${color})`,
          }}
        />
      </div>
      <div className="text-xs text-center font-medium" style={{ color }}>
        {label}
      </div>
    </div>
  );
}

function AssessmentResult({ result }: { result: RiskAssessmentResult }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <RiskMeter score={result.riskScore} />

      {/* Summary */}
      <div
        className="p-3 rounded-xl text-xs text-slate-300 leading-relaxed"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {result.summary}
      </div>

      {/* Factors */}
      <div>
        <div className="text-xs font-semibold text-slate-400 mb-2">Key Factors</div>
        <ul className="space-y-1.5" aria-label="Risk factors">
          {result.factors.map((factor, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-xs text-slate-400"
            >
              <span
                className="mt-0.5 w-3 h-3 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{
                  background:
                    result.riskLabel === "Low"
                      ? "rgba(0,255,136,0.2)"
                      : result.riskLabel === "High"
                      ? "rgba(255,45,155,0.2)"
                      : "rgba(255,196,0,0.2)",
                  color:
                    result.riskLabel === "Low"
                      ? "#00FF88"
                      : result.riskLabel === "High"
                      ? "#FF2D9B"
                      : "#FFC400",
                }}
                aria-hidden="true"
              >
                •
              </span>
              {factor}
            </li>
          ))}
        </ul>
      </div>

      {/* Recommendation */}
      <div
        className="p-3 rounded-xl"
        style={{
          background:
            result.riskLabel === "Low"
              ? "rgba(0,255,136,0.06)"
              : result.riskLabel === "High"
              ? "rgba(255,45,155,0.06)"
              : "rgba(255,196,0,0.06)",
          border: `1px solid ${
            result.riskLabel === "Low"
              ? "rgba(0,255,136,0.15)"
              : result.riskLabel === "High"
              ? "rgba(255,45,155,0.15)"
              : "rgba(255,196,0,0.15)"
          }`,
        }}
      >
        <div className="text-[10px] font-semibold uppercase tracking-wider mb-1"
          style={{
            color:
              result.riskLabel === "Low"
                ? "#00FF88"
                : result.riskLabel === "High"
                ? "#FF2D9B"
                : "#FFC400",
          }}
        >
          Recommendation
        </div>
        <div className="text-xs text-slate-300">{result.recommendation}</div>
      </div>
    </div>
  );
}

export function RiskAssessmentPanel({
  invoice,
  decryptedValues,
  repaymentRatioBps,
}: RiskAssessmentPanelProps) {
  const { assessment, isLoading, error, fetchAssessment } = useRiskAssessment();

  const handleAssess = async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const dueDays = decryptedValues?.dueDate
      ? Math.max(0, Math.floor((Number(decryptedValues.dueDate) - nowSec) / 86400))
      : undefined;

    const input: RiskAssessmentInput = {
      invoiceId: Number(invoice.invoiceId),
      supplierAddress: invoice.supplier,
      buyerAddress: invoice.buyer,
      uploadTimestamp: Number(invoice.uploadTimestamp),
      isFactored: invoice.isFactored,
      isRepaid: invoice.isRepaid,
      dueDaysHint: dueDays,
      discountRateBpsHint: decryptedValues?.discountRate
        ? Number(decryptedValues.discountRate)
        : undefined,
      repaymentRatioBpsHint: repaymentRatioBps,
    };

    await fetchAssessment(input);
  };

  return (
    <GlassCard className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-neon-purple" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2L14 11H2L8 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M8 7v2M8 11v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span className="text-sm font-semibold text-white">Risk Assessment</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">Deterministic</span>
      </div>

      {/* Content */}
      {!assessment && !isLoading && (
        <div className="text-center py-4">
          <div className="text-slate-500 text-sm mb-4">
            Get a deterministic risk assessment for this invoice based on supplier history,
            maturity, and discount rate.
          </div>
          <NeonButton
            variant="secondary"
            size="sm"
            onClick={handleAssess}
            id={`risk-assess-${invoice.invoiceId}`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
              <path d="M5 7l1.5 1.5L9 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Analyze Risk
          </NeonButton>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-3 py-6">
          <svg className="w-5 h-5 animate-spin text-neon-purple" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-slate-400">Calculating risk profile...</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20 text-neon-pink text-xs mb-3">
          {error}
        </div>
      )}

      {assessment && <AssessmentResult result={assessment} />}

      {assessment && (
        <button
          onClick={handleAssess}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors mt-3 w-full text-center"
        >
          Refresh assessment
        </button>
      )}
    </GlassCard>
  );
}
