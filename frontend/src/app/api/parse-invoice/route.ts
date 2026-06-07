/*
 * @file route.ts
 * @description POST /api/parse-invoice extracts invoice fields from PDF uploads with Gemini.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_BASE_RATE_BPS = 300;
const DEFAULT_REPUTATION_MULTIPLIER = 5;
const GEMINI_MODEL = "gemini-2.5-flash";

type InvoiceFields = {
  invoiceNumber: string | null;
  supplierName: string | null;
  debtorName: string | null;
  debtorEmail: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  faceValueUSD: number | null;
  currency: string | null;
  description: string | null;
  debtorAddress?: string | null;
  supplierTaxId?: string | null;
  debtorTaxId?: string | null;
  suggestedBaseRateBps?: number | null;
  suggestedReputationMultiplier?: number | null;
};

const extractionPrompt = `You are an invoice data extractor. Read this invoice PDF and extract the following fields.
Return ONLY a valid JSON object. No markdown, no code fences, no explanation.
If a field is not found, use null.

Required JSON format:
{
  "invoiceNumber": "string or null",
  "supplierName": "string or null",
  "debtorName": "string or null",
  "debtorEmail": "string or null",
  "invoiceDate": "YYYY-MM-DD or null",
  "dueDate": "YYYY-MM-DD or null",
  "faceValueUSD": number or null,
  "currency": "string or null",
  "description": "string or null",
  "debtorAddress": "valid Ethereum address or null",
  "supplierTaxId": "string or null",
  "debtorTaxId": "string or null",
  "suggestedBaseRateBps": number or null,
  "suggestedReputationMultiplier": number or null
}`;

const invoiceJsonSchema = {
  type: "object",
  properties: {
    invoiceNumber: { type: ["string", "null"], description: "Invoice number or reference." },
    supplierName: { type: ["string", "null"], description: "Supplier or seller legal name." },
    debtorName: { type: ["string", "null"], description: "Buyer or debtor legal name." },
    debtorEmail: { type: ["string", "null"], description: "Buyer or debtor email address." },
    invoiceDate: { type: ["string", "null"], description: "Invoice issue date in YYYY-MM-DD format." },
    dueDate: { type: ["string", "null"], description: "Payment due date in YYYY-MM-DD format." },
    faceValueUSD: { type: ["number", "null"], description: "Invoice amount in USD as a number." },
    currency: { type: ["string", "null"], description: "Invoice currency code like USD, EUR, GBP." },
    description: { type: ["string", "null"], description: "Goods or services description." },
    debtorAddress: { type: ["string", "null"], description: "Ethereum address only if explicitly present in the document." },
    supplierTaxId: { type: ["string", "null"], description: "Supplier tax ID or registration number." },
    debtorTaxId: { type: ["string", "null"], description: "Buyer tax ID or registration number." },
    suggestedBaseRateBps: { type: ["integer", "null"], description: "Suggested base rate in basis points." },
    suggestedReputationMultiplier: { type: ["integer", "null"], description: "Suggested reputation multiplier integer." },
  },
  required: [
    "invoiceNumber",
    "supplierName",
    "debtorName",
    "debtorEmail",
    "invoiceDate",
    "dueDate",
    "faceValueUSD",
    "currency",
    "description",
    "debtorAddress",
    "supplierTaxId",
    "debtorTaxId",
    "suggestedBaseRateBps",
    "suggestedReputationMultiplier",
  ],
  additionalProperties: false,
} as const;

function cleanGeminiJson(rawText: string) {
  return rawText
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
}

function parseJsonFields(rawText: string): InvoiceFields {
  const parsed = JSON.parse(cleanGeminiJson(rawText)) as Partial<InvoiceFields>;
  return {
    invoiceNumber: typeof parsed.invoiceNumber === "string" ? parsed.invoiceNumber : null,
    supplierName: typeof parsed.supplierName === "string" ? parsed.supplierName : null,
    debtorName: typeof parsed.debtorName === "string" ? parsed.debtorName : null,
    debtorEmail: typeof parsed.debtorEmail === "string" ? parsed.debtorEmail : null,
    invoiceDate: typeof parsed.invoiceDate === "string" ? parsed.invoiceDate : null,
    dueDate: typeof parsed.dueDate === "string" ? parsed.dueDate : null,
    faceValueUSD: typeof parsed.faceValueUSD === "number" ? parsed.faceValueUSD : null,
    currency: typeof parsed.currency === "string" ? parsed.currency : null,
    description: typeof parsed.description === "string" ? parsed.description : null,
    debtorAddress: typeof parsed.debtorAddress === "string" ? parsed.debtorAddress : null,
    supplierTaxId: typeof parsed.supplierTaxId === "string" ? parsed.supplierTaxId : null,
    debtorTaxId: typeof parsed.debtorTaxId === "string" ? parsed.debtorTaxId : null,
    suggestedBaseRateBps: typeof parsed.suggestedBaseRateBps === "number" ? parsed.suggestedBaseRateBps : null,
    suggestedReputationMultiplier:
      typeof parsed.suggestedReputationMultiplier === "number" ? parsed.suggestedReputationMultiplier : null,
  };
}

function hashFingerprint(material: string) {
  let hash = 5381n;
  for (let i = 0; i < material.length; i++) {
    hash = hash * 33n + BigInt(material.charCodeAt(i));
  }
  return hash & 0x7fffffffffffffffn;
}

function toDateSeconds(dateText: string | null) {
  if (!dateText) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;
  const seconds = Math.floor(new Date(`${dateText}T00:00:00.000Z`).getTime() / 1000);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function validateAndNormalize(fields: InvoiceFields, logisticsData: Record<string, string>) {
  if (!fields.invoiceNumber) {
    throw new Error("Gemini response did not include an invoice number.");
  }

  if (typeof fields.faceValueUSD !== "number" || !Number.isFinite(fields.faceValueUSD) || fields.faceValueUSD <= 0) {
    throw new Error("Gemini response did not include a valid positive invoice amount.");
  }

  const dueDateSeconds = toDateSeconds(fields.dueDate);
  if (!dueDateSeconds) {
    throw new Error("Gemini response did not include a valid YYYY-MM-DD due date.");
  }

  if (fields.debtorAddress && !/^0x[0-9a-fA-F]{40}$/.test(fields.debtorAddress)) {
    throw new Error("Gemini response included an invalid debtor wallet address.");
  }

  const baseRate = Number.isInteger(fields.suggestedBaseRateBps) && Number(fields.suggestedBaseRateBps) > 0
    ? Number(fields.suggestedBaseRateBps)
    : DEFAULT_BASE_RATE_BPS;
  const reputationMultiplier =
    Number.isInteger(fields.suggestedReputationMultiplier) && Number(fields.suggestedReputationMultiplier) > 0
      ? Number(fields.suggestedReputationMultiplier)
      : DEFAULT_REPUTATION_MULTIPLIER;

  const fingerprintMaterial = [
    fields.invoiceNumber,
    fields.supplierTaxId ?? "",
    fields.debtorTaxId ?? "",
    fields.debtorName ?? "",
    logisticsData.trackingNumber ?? "",
    logisticsData.deliveryDate ?? "",
  ].join("|");

  return {
    faceValue: BigInt(Math.round(fields.faceValueUSD * 1_000_000)),
    dueDate: BigInt(dueDateSeconds),
    fingerprint: hashFingerprint(fingerprintMaterial),
    baseRate: BigInt(baseRate),
    reputationMultiplier: BigInt(reputationMultiplier),
    debtor: fields.debtorAddress ?? "",
  };
}

async function callGeminiPdf(geminiKey: string, pdfBase64: string, prompt: string) {
  const geminiRes = await fetch(`${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${geminiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: "application/pdf",
                data: pdfBase64,
              },
            },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
        responseJsonSchema: invoiceJsonSchema,
      },
    }),
  });

  if (!geminiRes.ok) {
    const errBody = await geminiRes.text();
    throw new Error(`${GEMINI_MODEL} PDF API error ${geminiRes.status}: ${errBody}`);
  }

  const geminiData = await geminiRes.json();
  const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText || typeof rawText !== "string") {
    throw new Error("Gemini returned empty response.");
  }

  return parseJsonFields(rawText);
}

async function callGeminiTextFallback(geminiKey: string, pdfBuffer: Buffer) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: pdfBuffer });
  const pdfData = await parser.getText();
  await parser.destroy();
  const invoiceText = pdfData.text?.trim();

  if (!invoiceText || invoiceText.length < 20) {
    throw new Error("PDF appears to be empty or image-only. No text extracted.");
  }

  const fallbackRes = await fetch(`${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${geminiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `${extractionPrompt}

Invoice text content:
---
${invoiceText.slice(0, 12000)}
---`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
        responseJsonSchema: invoiceJsonSchema,
      },
    }),
  });

  if (!fallbackRes.ok) {
    const errBody = await fallbackRes.text();
    throw new Error(`${GEMINI_MODEL} text fallback error ${fallbackRes.status}: ${errBody}`);
  }

  const fallbackData = await fallbackRes.json();
  const rawFallback = fallbackData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawFallback || typeof rawFallback !== "string") {
    throw new Error("Gemini fallback returned empty response.");
  }

  return parseJsonFields(rawFallback);
}

async function getRequestFiles(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    return {
      pdfFile: formData.get("pdf") as File | null,
      xmlFile: formData.get("xml") as File | null,
    };
  }

  const body = await req.json();
  const pdfBase64 = body.pdfBase64 ?? body.pdf;
  if (!pdfBase64 || typeof pdfBase64 !== "string" || pdfBase64.length < 100) {
    return { pdfFile: null, xmlFile: null };
  }

  const pdfBuffer = Buffer.from(pdfBase64, "base64");
  return {
    pdfFile: new File([pdfBuffer], "invoice.pdf", { type: "application/pdf" }),
    xmlFile: null,
  };
}

async function parseLogistics(xmlFile: File | null) {
  if (!xmlFile) {
    return {
      logisticsVerified: false,
      logisticsData: {
        trackingNumber: "",
        deliveryDate: "",
        carrier: "",
      },
    };
  }

  const xml = await xmlFile.text();
  return {
    logisticsVerified:
      /<DeliveryConfirmed>\s*true\s*<\/DeliveryConfirmed>/i.test(xml) ||
      /<Status>\s*DELIVERED\s*<\/Status>/i.test(xml) ||
      /<DeliveryStatus>\s*Delivered\s*<\/DeliveryStatus>/i.test(xml),
    logisticsData: {
      trackingNumber: xml.match(/<TrackingNumber>(.*?)<\/TrackingNumber>/)?.[1] ?? "",
      deliveryDate: xml.match(/<DeliveryDate>(.*?)<\/DeliveryDate>/)?.[1] ?? "",
      carrier: xml.match(/<Carrier>(.*?)<\/Carrier>/)?.[1] ?? "",
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const { pdfFile, xmlFile } = await getRequestFiles(req);

    if (!pdfFile) {
      return NextResponse.json({ error: "PDF file required" }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured on the server" },
        { status: 500 }
      );
    }

    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());
    const fileSizeMB = pdfBuffer.length / (1024 * 1024);

    if (fileSizeMB > 19) {
      return NextResponse.json(
        { error: `PDF too large (${fileSizeMB.toFixed(1)}MB). Maximum is 19MB.` },
        { status: 413 }
      );
    }

    const pdfBase64 = pdfBuffer.toString("base64");
    const { logisticsVerified, logisticsData } = await parseLogistics(xmlFile);
    let invoiceFields: InvoiceFields;
    let parseMethod: string;

    try {
      invoiceFields = await callGeminiPdf(geminiKey, pdfBase64, extractionPrompt);
      parseMethod = `${GEMINI_MODEL}-native-pdf`;
    } catch (pathAError) {
      console.warn("[parse-invoice] Native PDF pass 1 failed, trying OCR-focused retry:", pathAError);

      try {
        invoiceFields = await callGeminiPdf(
          geminiKey,
          pdfBase64,
          `${extractionPrompt}

This PDF may be a scanned invoice. Use the rendered page images and OCR what you can from the document itself.
Do not guess fields that are not visible.`
        );
        parseMethod = `${GEMINI_MODEL}-native-pdf-ocr-retry`;
      } catch (pathBError) {
        console.warn("[parse-invoice] Native PDF retry failed, trying text fallback:", pathBError);

        try {
          invoiceFields = await callGeminiTextFallback(geminiKey, pdfBuffer);
          parseMethod = `${GEMINI_MODEL}-text-fallback`;
        } catch (pathCError) {
          console.error("[parse-invoice] All parse paths failed:", pathCError);
          return NextResponse.json(
            {
              error: "Failed to extract invoice data from the uploaded PDF.",
              details: String(pathCError),
            },
            { status: 422 }
          );
        }
      }
    }

    const normalized = validateAndNormalize(invoiceFields, logisticsData);

    return NextResponse.json({
      success: true,
      invoiceFields,
      logisticsVerified,
      logisticsData,
      parseMethod,
      faceValue: normalized.faceValue.toString(),
      dueDate: normalized.dueDate.toString(),
      fingerprint: normalized.fingerprint.toString(),
      baseRate: normalized.baseRate.toString(),
      reputationMultiplier: normalized.reputationMultiplier.toString(),
      debtor: normalized.debtor,
    });
  } catch (err) {
    console.error("[parse-invoice] Unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
