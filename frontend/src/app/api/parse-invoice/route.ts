/*
 * @file route.ts
 * @description POST /api/parse-invoice
 *              Accepts a base64 encoded invoice PDF, parses it via Gemini Flash,
 *              and returns the extracted trade finance structured parameters.
 */

import { NextRequest, NextResponse } from "next/server";
import { parseInvoicePDF }           from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pdfBase64 = body.pdfBase64 ?? body.pdf;
    const logisticsProofBase64 = typeof body.logisticsProof === "string" ? body.logisticsProof : undefined;
    const logisticsFileName = typeof body.logisticsFileName === "string" ? body.logisticsFileName : undefined;

    if (!pdfBase64 || typeof pdfBase64 !== "string" || pdfBase64.length < 100) {
      return NextResponse.json(
        { error: "Invalid or empty PDF data received. Ensure the file was uploaded correctly." },
        { status: 400 }
      );
    }

    console.log(`[parse-invoice] Received PDF base64 length: ${pdfBase64.length}`);

    const result = await parseInvoicePDF(pdfBase64, {
      logisticsProofBase64,
      logisticsFileName,
    });

    return NextResponse.json({
      faceValue: result.faceValue.toString(),
      dueDate: result.dueDate.toString(),
      fingerprint: result.fingerprint.toString(),
      baseRate: result.baseRate.toString(),
      reputationMultiplier: result.reputationMultiplier.toString(),
      debtor: result.debtor,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("[/api/parse-invoice] Error:", msg);
    return NextResponse.json(
      { error: `Invoice parsing failed: ${msg}` },
      { status: 502 }
    );
  }
}
