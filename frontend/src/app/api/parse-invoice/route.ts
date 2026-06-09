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
const GEMINI_MODEL = "gemini-1.5-flash";

type InvoiceFields = {
  invoiceNumber: string;
  issueDate: string;
  maturityDate: string;
  totalAmountCents: number;
  currency: string;
  debtorName: string;
  debtorEmail: string;
  debtorTaxId: string;
  supplierName: string;
  supplierTaxId: string;
  debtorAddress?: string;
};

const PARSE_PROMPT = `
You are an expert invoice parser. Analyze the invoice document.
Return ONLY a valid JSON object with NO markdown, NO backticks, NO explanation.
Use exactly these field names:

{
  "invoiceNumber": "string",
  "issueDate": "YYYY-MM-DD",
  "maturityDate": "YYYY-MM-DD",
  "totalAmountCents": integer,
  "currency": "USD",
  "debtorName": "string",
  "debtorEmail": "string",
  "debtorTaxId": "string",
  "supplierName": "string",
  "supplierTaxId": "string"
}

Rules: totalAmountCents = total amount x 100 as integer. Use "" for missing strings, 0 for missing numbers.
`.trim();

const invoiceJsonSchema = {
  type: "object",
  properties: {
    invoiceNumber: { type: "string", description: "Invoice number or reference." },
    issueDate: { type: "string", description: "Invoice issue date in YYYY-MM-DD format." },
    maturityDate: { type: "string", description: "Payment due date in YYYY-MM-DD format." },
    totalAmountCents: { type: "integer", description: "Invoice amount multiplied by 100." },
    currency: { type: "string", description: "Invoice currency code." },
    debtorName: { type: "string", description: "Buyer or debtor legal name." },
    debtorEmail: { type: "string", description: "Buyer or debtor email address." },
    debtorTaxId: { type: "string", description: "Buyer tax ID or registration number." },
    supplierName: { type: "string", description: "Supplier or seller legal name." },
    supplierTaxId: { type: "string", description: "Supplier tax ID or registration number." },
  },
  required: [
    "invoiceNumber",
    "issueDate",
    "maturityDate",
    "totalAmountCents",
    "currency",
    "debtorName",
    "debtorEmail",
    "debtorTaxId",
    "supplierName",
    "supplierTaxId",
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
  const parsed = JSON.parse(cleanGeminiJson(rawText)) as Partial<InvoiceFields> & {
    invoiceDate?: string | null;
    dueDate?: string | null;
    faceValueUSD?: number | null;
    debtorAddress?: string | null;
  };
  const totalAmountCents =
    typeof parsed.totalAmountCents === "number"
      ? parsed.totalAmountCents
      : typeof parsed.faceValueUSD === "number"
        ? Math.round(parsed.faceValueUSD * 100)
        : 0;

  return {
    invoiceNumber: typeof parsed.invoiceNumber === "string" ? parsed.invoiceNumber : "",
    issueDate:
      typeof parsed.issueDate === "string"
        ? parsed.issueDate
        : typeof parsed.invoiceDate === "string"
          ? parsed.invoiceDate
          : "",
    maturityDate:
      typeof parsed.maturityDate === "string"
        ? parsed.maturityDate
        : typeof parsed.dueDate === "string"
          ? parsed.dueDate
          : "",
    totalAmountCents,
    currency: typeof parsed.currency === "string" ? parsed.currency : "USD",
    debtorName: typeof parsed.debtorName === "string" ? parsed.debtorName : "",
    debtorEmail: typeof parsed.debtorEmail === "string" ? parsed.debtorEmail : "",
    debtorTaxId: typeof parsed.debtorTaxId === "string" ? parsed.debtorTaxId : "",
    supplierName: typeof parsed.supplierName === "string" ? parsed.supplierName : "",
    supplierTaxId: typeof parsed.supplierTaxId === "string" ? parsed.supplierTaxId : "",
    debtorAddress: typeof parsed.debtorAddress === "string" ? parsed.debtorAddress : "",
  };
}

function hashFingerprint(material: string) {
  let hash = 5381n;
  for (let i = 0; i < material.length; i++) {
    hash = hash * 33n + BigInt(material.charCodeAt(i));
  }
  return hash & 0x7fffffffffffffffn;
}

function toDateSeconds(dateText: string) {
  if (!dateText) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;
  const seconds = Math.floor(new Date(`${dateText}T00:00:00.000Z`).getTime() / 1000);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function validateAndNormalize(fields: InvoiceFields, logisticsData: Record<string, string>) {
  if (!fields.invoiceNumber) {
    throw new Error("Gemini response did not include an invoice number.");
  }

  if (!Number.isInteger(fields.totalAmountCents) || fields.totalAmountCents <= 0) {
    throw new Error("Gemini response did not include a valid positive invoice amount.");
  }

  const dueDateSeconds = toDateSeconds(fields.maturityDate);
  if (!dueDateSeconds) {
    throw new Error("Gemini response did not include a valid YYYY-MM-DD maturityDate.");
  }

  if (fields.debtorAddress && !/^0x[0-9a-fA-F]{40}$/.test(fields.debtorAddress)) {
    throw new Error("Gemini response included an invalid debtor wallet address.");
  }

  const fingerprintMaterial = [
    fields.invoiceNumber,
    fields.supplierTaxId ?? "",
    fields.debtorTaxId ?? "",
    fields.debtorName ?? "",
    logisticsData.trackingNumber ?? "",
    logisticsData.deliveryDate ?? "",
  ].join("|");

  return {
    faceValue: BigInt(fields.totalAmountCents) * 10_000n,
    dueDate: BigInt(dueDateSeconds),
    fingerprint: hashFingerprint(fingerprintMaterial),
    baseRate: BigInt(DEFAULT_BASE_RATE_BPS),
    reputationMultiplier: BigInt(DEFAULT_REPUTATION_MULTIPLIER),
    debtor: fields.debtorAddress ?? "",
  };
}

async function callGeminiPdf(geminiKey: string, pdfBase64: string, prompt: string) {
  const cleanBase64 = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;
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
                data: cleanBase64,
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
              text: `${PARSE_PROMPT}

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

  const cleanBase64 = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;
  const pdfBuffer = Buffer.from(cleanBase64, "base64");
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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not set in Vercel env vars. Add as server-side variable (no NEXT_PUBLIC_ prefix)." },
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
      invoiceFields = await callGeminiPdf(apiKey, pdfBase64, PARSE_PROMPT);
      parseMethod = `${GEMINI_MODEL}-native-pdf`;
    } catch (pathAError) {
      console.warn("[parse-invoice] Native PDF pass 1 failed, trying OCR-focused retry:", pathAError);

      try {
        invoiceFields = await callGeminiPdf(
          apiKey,
          pdfBase64,
          `${PARSE_PROMPT}

This PDF may be a scanned invoice. Use the rendered page images and OCR what you can from the document itself.
Do not guess fields that are not visible.`
        );
        parseMethod = `${GEMINI_MODEL}-native-pdf-ocr-retry`;
      } catch (pathBError) {
        console.warn("[parse-invoice] Native PDF retry failed, trying text fallback:", pathBError);

        try {
          invoiceFields = await callGeminiTextFallback(apiKey, pdfBuffer);
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
    return NextResponse.json(
      {
        error: "Invoice parsing failed.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
