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
    const pdfBase64 = body.pdf;

    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid pdf base64 data" },
        { status: 400 }
      );
    }

    const result = await parseInvoicePDF(pdfBase64);

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
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
