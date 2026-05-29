import { NextRequest, NextResponse } from "next/server";
import { generateRiskAssessment } from "@/lib/gemini";
import type { RiskAssessmentInput } from "@/lib/gemini";

/**
 * POST /api/risk-assessment
 * Accepts RiskAssessmentInput JSON body, returns RiskAssessmentResult.
 * Server-side only — GEMINI_API_KEY stays on the server.
 */
export async function POST(req: NextRequest) {
  try {
    const body: RiskAssessmentInput = await req.json();

    /* Basic validation */
    if (
      typeof body.invoiceId !== "number" ||
      typeof body.supplierAddress !== "string" ||
      typeof body.buyerAddress !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const result = await generateRiskAssessment(body);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("[/api/risk-assessment] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
