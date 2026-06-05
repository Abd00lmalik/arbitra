/*
 * @file gemini.ts
 * @description Gemini Flash client for AI-powered risk assessment and invoice PDF parsing.
 *              Only used server-side in the API route — never called from the browser.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export interface RiskAssessmentInput {
  invoiceId: number;
  supplierAddress: string;
  buyerAddress: string;
  uploadTimestamp: number;
  isFactored: boolean;
  isRepaid: boolean;
  /* Optional decrypted values (if available from grantRiskAssessmentAccess) */
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

/*
 * Generate AI risk assessment for an invoice using Gemini Flash.
 * Falls back to a deterministic mock when GEMINI_API_KEY is not set.
 */
export async function generateRiskAssessment(
  input: RiskAssessmentInput
): Promise<RiskAssessmentResult> {
  if (!GEMINI_API_KEY) {
    return getMockRiskAssessment(input);
  }

  const prompt = buildPrompt(input);

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 512,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    console.error("[Gemini] API error:", response.status);
    return getMockRiskAssessment(input);
  }

  const data = await response.json();
  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

  try {
    const parsed = JSON.parse(text);
    return {
      riskScore: Number(parsed.riskScore) || 50,
      riskLabel: parsed.riskLabel || "Medium",
      summary: parsed.summary || "Risk assessment complete.",
      factors: Array.isArray(parsed.factors) ? parsed.factors : [],
      recommendation: parsed.recommendation || "Review before investing.",
    };
  } catch (e) {
    console.error("[Gemini] Parse error:", e);
    return getMockRiskAssessment(input);
  }
}

/*
 * Parse invoice PDF bytes via Gemini Flash multimodal input.
 * Extracts face value, due date, debtor, and generates a unique fingerprint.
 */
export async function parseInvoicePDF(
  pdfBase64: string,
  logisticsProof?: {
    logisticsProofBase64?: string;
    logisticsFileName?: string;
  }
): Promise<{
  faceValue: bigint;
  dueDate: bigint;
  fingerprint: bigint;
  baseRate: bigint;
  reputationMultiplier: bigint;
  debtor: string;
}> {
  const logisticsProofHash = buildLogisticsProofHash(logisticsProof?.logisticsProofBase64);

  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured. Invoice PDF parsing cannot run.");
  }

  const prompt = `You are an institutional trade finance underwriting agent.
Analyze this invoice PDF and extract the following details for trade finance factoring.
Return ONLY valid JSON in this exact structure:
{
  "amount": <number, the invoice total amount in USD, e.g., 1250.50>,
  "dueDate": "<YYYY-MM-DD, the maturity date of the invoice>",
  "invoiceNumber": "<string, the unique invoice identifier>",
  "debtorAddress": "<string, a valid Ethereum address for the buyer/debtor, or empty string if not present>",
  "suggestedBaseRateBps": <integer, suggested base rate in basis points>,
  "suggestedReputationMultiplier": <integer, multiplier based on company size/risk>,
  "supplierTaxId": "<string, supplier tax identifier if present, otherwise empty string>",
  "debtorTaxId": "<string, debtor tax identifier if present, otherwise empty string>"
}`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: pdfBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 256,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Gemini PDF API error ${response.status}: ${errorBody.slice(0, 300)}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text || typeof text !== "string") {
      throw new Error("Gemini did not return invoice JSON text.");
    }

    const parsed = JSON.parse(text);

    const amount = Number(parsed.amount);
    const dueDateStr = String(parsed.dueDate ?? "");
    const invoiceNumber = String(parsed.invoiceNumber ?? "");
    const debtorAddress = String(parsed.debtorAddress ?? "");
    const baseRateBps = Number(parsed.suggestedBaseRateBps);
    const repMultiplier = Number(parsed.suggestedReputationMultiplier);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Gemini response did not include a valid positive invoice amount.");
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDateStr)) {
      throw new Error("Gemini response did not include a valid YYYY-MM-DD due date.");
    }

    if (!invoiceNumber) {
      throw new Error("Gemini response did not include an invoice number.");
    }

    if (debtorAddress && !/^0x[0-9a-fA-F]{40}$/.test(debtorAddress)) {
      throw new Error("Gemini response did not include a valid debtor wallet address.");
    }

    if (!Number.isInteger(baseRateBps) || baseRateBps <= 0) {
      throw new Error("Gemini response did not include a valid base rate.");
    }

    if (!Number.isInteger(repMultiplier) || repMultiplier <= 0) {
      throw new Error("Gemini response did not include a valid reputation multiplier.");
    }

    /* Hash the invoice number string into a positive 63-bit integer for the FHE fingerprint */
    let hash = 5381n;
    const uniqueMaterial = [
      invoiceNumber,
      parsed.supplierTaxId || "",
      parsed.debtorTaxId || "",
      logisticsProofHash,
      logisticsProof?.logisticsFileName || "",
    ].join("|");
    for (let i = 0; i < uniqueMaterial.length; i++) {
      hash = (hash * 33n) + BigInt(uniqueMaterial.charCodeAt(i));
    }
    const fingerprint = hash & 0x7fffffffffffffffn;

    const dueDateTimestamp = Math.floor(new Date(dueDateStr).getTime() / 1000);
    if (!Number.isFinite(dueDateTimestamp) || dueDateTimestamp <= 0) {
      throw new Error("Gemini response due date could not be converted to a timestamp.");
    }

    return {
      faceValue: BigInt(Math.round(amount * 1_000_000)), /* 6 decimals for USDC */
      dueDate: BigInt(dueDateTimestamp),
      fingerprint,
      baseRate: BigInt(baseRateBps),
      reputationMultiplier: BigInt(repMultiplier),
      debtor: debtorAddress,
    };
  } catch (e) {
    console.error("[Gemini PDF] Failed to parse PDF:", e);
    throw e;
  }
}

function buildLogisticsProofHash(proofBase64?: string): string {
  if (!proofBase64) return "NO_LOGISTICS_PROOF";
  let hash = 5381n;
  for (let i = 0; i < proofBase64.length; i++) {
    hash = (hash * 33n + BigInt(proofBase64.charCodeAt(i))) & 0xffffffffffffffffn;
  }
  return hash.toString(16);
}

function buildPrompt(input: RiskAssessmentInput): string {
  const repaymentRatio = input.repaymentRatioBpsHint
    ? `${(input.repaymentRatioBpsHint / 100).toFixed(1)}%`
    : "Unknown (no history)";

  const discountRate = input.discountRateBpsHint
    ? `${(input.discountRateBpsHint / 100).toFixed(2)}%`
    : "Unknown";

  const dueDays = input.dueDaysHint !== undefined ? `${input.dueDaysHint} days` : "Unknown";
  const faceValue = input.faceValueHint || "Encrypted";

  return `You are a credit risk analyst for an invoice factoring platform using blockchain and FHE encryption.

Analyze the following invoice and return a JSON risk assessment:

Invoice Details:
- Invoice ID: #${input.invoiceId}
- Status: ${input.isFactored ? "Factored (sold)" : "Available for factoring"}${input.isRepaid ? ", Repaid" : ""}
- Supplier: ${input.supplierAddress}
- Buyer: ${input.buyerAddress}
- Face Value: ${faceValue} (encrypted on-chain for privacy)
- Days to Maturity: ${dueDays}
- Discount Rate: ${discountRate} (computed from repayment history)
- Supplier Repayment History: ${repaymentRatio} on-time repayment rate
- Upload Date: ${new Date(input.uploadTimestamp * 1000).toLocaleDateString()}

Context: This is a decentralized invoice factoring protocol. Lower discount rates indicate better supplier credit history. The FHE (Fully Homomorphic Encryption) system protects exact financial figures.

Return ONLY valid JSON in this exact format:
{
  "riskScore": <integer 0-100, lower is better>,
  "riskLabel": "<Low|Medium|High>",
  "summary": "<2-3 sentence assessment>",
  "factors": ["<risk factor 1>", "<risk factor 2>", "<risk factor 3>"],
  "recommendation": "<actionable recommendation for investor>"
}`;
}

function getMockRiskAssessment(input: RiskAssessmentInput): RiskAssessmentResult {
  const hasHistory = input.repaymentRatioBpsHint !== undefined;
  const ratioPct = hasHistory ? input.repaymentRatioBpsHint! / 100 : 70;
  const dueDays = input.dueDaysHint ?? 30;

  let riskScore: number;
  let riskLabel: "Low" | "Medium" | "High";

  if (ratioPct >= 85 && dueDays >= 20) {
    riskScore = 20 + Math.floor(Math.random() * 15);
    riskLabel = "Low";
  } else if (ratioPct >= 60) {
    riskScore = 40 + Math.floor(Math.random() * 20);
    riskLabel = "Medium";
  } else {
    riskScore = 65 + Math.floor(Math.random() * 20);
    riskLabel = "High";
  }

  const factors = [
    hasHistory
      ? `Supplier has ${ratioPct.toFixed(0)}% historical on-time repayment rate`
      : "Supplier has no repayment history on Arbitra",
    dueDays < 15
      ? `Invoice matures in ${dueDays} days — tight timeline`
      : `${dueDays}-day maturity provides reasonable runway`,
    input.isFactored ? "Invoice already purchased by another investor" : "Invoice available for factoring",
  ];

  return {
    riskScore,
    riskLabel,
    summary: `This invoice presents ${riskLabel.toLowerCase()} risk based on supplier history and maturity timeline. ${hasHistory ? `The supplier's ${ratioPct.toFixed(0)}% repayment ratio is a key signal.` : "No prior repayment history increases uncertainty."}`,
    factors,
    recommendation:
      riskLabel === "Low"
        ? "Favorable investment. Consider factoring at the computed discount rate."
        : riskLabel === "Medium"
        ? "Review supplier history off-chain before committing capital."
        : "High risk. Require additional collateral or skip this invoice.",
  };
}
