/*
 * @file risk-assessment.ts
 * @description Deterministic risk scoring helpers for the investor assessment UI and API.
 */

export interface RiskAssessmentInput {
  invoiceId: number;
  supplierAddress: string;
  buyerAddress: string;
  uploadTimestamp: number;
  isFactored: boolean;
  isRepaid: boolean;
  faceValueHint?: string;
  dueDaysHint?: number;
  discountRateBpsHint?: number;
  repaymentRatioBpsHint?: number;
}

export interface RiskAssessmentResult {
  riskScore: number;
  riskLabel: "Low" | "Medium" | "High" | "Unknown";
  summary: string;
  factors: string[];
  recommendation: string;
}

/**
 * Compute a deterministic mock risk profile from current on-chain and decrypted hints.
 *
 * @param input Invoice metadata and optional decrypted hints.
 * @returns Stable risk assessment without external inference.
 */
export function generateRiskAssessment(input: RiskAssessmentInput): RiskAssessmentResult {
  const ratioPct = input.repaymentRatioBpsHint !== undefined ? input.repaymentRatioBpsHint / 100 : 65;
  const dueDays = input.dueDaysHint ?? 30;
  const discountRatePct = input.discountRateBpsHint !== undefined ? input.discountRateBpsHint / 100 : 3;

  let riskScore = 45;
  riskScore -= Math.min(20, Math.max(0, ratioPct - 60) / 2);
  riskScore += dueDays < 15 ? 12 : dueDays > 45 ? -4 : 3;
  riskScore += discountRatePct > 8 ? 10 : discountRatePct > 5 ? 5 : 0;
  riskScore += input.isFactored ? -3 : 4;
  riskScore += input.isRepaid ? -10 : 0;
  riskScore = Math.max(5, Math.min(95, Math.round(riskScore)));

  const riskLabel = riskScore <= 30
    ? "Low"
    : riskScore <= 60
      ? "Medium"
      : "High";

  const factors = [
    input.repaymentRatioBpsHint !== undefined
      ? `Counterparty history shows ${ratioPct.toFixed(0)}% prior repayment performance.`
      : "Counterparty history is unavailable on-chain, which increases underwriting uncertainty.",
    dueDays < 15
      ? `Maturity is only ${dueDays} days away, leaving a tight repayment window.`
      : `Maturity sits at ${dueDays} days, which gives normal settlement runway.`,
    discountRatePct > 5
      ? `The ${discountRatePct.toFixed(2)}% discount signals elevated compensation for risk or illiquidity.`
      : `The ${discountRatePct.toFixed(2)}% discount remains within a typical short-duration receivables range.`,
    input.isFactored
      ? "The invoice is already factored, so monitoring shifts toward repayment execution quality."
      : "The invoice is still open for factoring, so investors must price both origination and repayment risk.",
  ];

  const summary = [
    `Invoice #${input.invoiceId} scores ${riskScore}/100 on Arbitra's deterministic assessment model.`,
    input.repaymentRatioBpsHint !== undefined
      ? `Supplier repayment history contributes a ${ratioPct.toFixed(0)}% prior-performance signal.`
      : "No repayment history was supplied, so the model leans conservative on counterparty quality.",
    `The current tenor is ${dueDays} days and the discount indication is ${discountRatePct.toFixed(2)}%.`,
  ].join(" ");

  const recommendation =
    riskLabel === "Low"
      ? "Suitable for standard factoring review with normal monitoring."
      : riskLabel === "Medium"
        ? "Proceed only after reviewing debtor quality and off-chain documentation."
        : "Treat as heightened risk and require stronger diligence before funding.";

  return {
    riskScore,
    riskLabel,
    summary,
    factors,
    recommendation,
  };
}
