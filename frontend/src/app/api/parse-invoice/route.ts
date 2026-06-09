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
const GEMINI_MODELS = ["gemini-3.5-flash", "gemini-2.5-flash"] as const;

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

type GeminiModel = (typeof GEMINI_MODELS)[number];

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

function cleanGeminiJson(rawText: string) {
  const cleaned = rawText
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    return cleaned.slice(jsonStart, jsonEnd + 1);
  }

  return cleaned;
}

function toText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/,/g, "").replace(/[^0-9.-]/g, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toCents(value: unknown, alreadyCents = false) {
  const parsed = toNumber(value);
  if (parsed === null) {
    return 0;
  }

  if (alreadyCents) {
    const looksLikeDollars = typeof value === "string" && /[$.]/.test(value);
    return Math.round(looksLikeDollars || !Number.isInteger(parsed) ? parsed * 100 : parsed);
  }

  return Math.round(parsed * 100);
}

function getGeminiText(geminiData: any) {
  const parts = geminiData?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
}

function parseJsonFields(rawText: string): InvoiceFields {
  const parsed = JSON.parse(cleanGeminiJson(rawText)) as Partial<InvoiceFields> & {
    invoice_number?: unknown;
    issue_date?: unknown;
    invoiceDate?: unknown;
    invoice_date?: unknown;
    maturity_date?: unknown;
    dueDate?: unknown;
    due_date?: unknown;
    total_amount_cents?: unknown;
    totalAmount?: unknown;
    total_amount?: unknown;
    amount?: unknown;
    faceValueUSD?: unknown;
    face_value_usd?: unknown;
    currency?: unknown;
    debtor_name?: unknown;
    debtor_email?: unknown;
    debtor_tax_id?: unknown;
    supplier_name?: unknown;
    supplier_tax_id?: unknown;
    debtorAddress?: unknown;
    debtor_address?: unknown;
  };
  const totalAmountCents =
    toCents(parsed.totalAmountCents ?? parsed.total_amount_cents, true) ||
    toCents(parsed.faceValueUSD ?? parsed.face_value_usd ?? parsed.totalAmount ?? parsed.total_amount ?? parsed.amount);

  return {
    invoiceNumber: toText(parsed.invoiceNumber) || toText(parsed.invoice_number),
    issueDate:
      toText(parsed.issueDate) ||
      toText(parsed.issue_date) ||
      toText(parsed.invoiceDate) ||
      toText(parsed.invoice_date),
    maturityDate:
      toText(parsed.maturityDate) ||
      toText(parsed.maturity_date) ||
      toText(parsed.dueDate) ||
      toText(parsed.due_date),
    totalAmountCents,
    currency: toText(parsed.currency) || "USD",
    debtorName: toText(parsed.debtorName) || toText(parsed.debtor_name),
    debtorEmail: toText(parsed.debtorEmail) || toText(parsed.debtor_email),
    debtorTaxId: toText(parsed.debtorTaxId) || toText(parsed.debtor_tax_id),
    supplierName: toText(parsed.supplierName) || toText(parsed.supplier_name),
    supplierTaxId: toText(parsed.supplierTaxId) || toText(parsed.supplier_tax_id),
    debtorAddress: toText(parsed.debtorAddress) || toText(parsed.debtor_address),
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
  const dateCandidate = /^\d{4}-\d{2}-\d{2}$/.test(dateText) ? `${dateText}T00:00:00.000Z` : dateText;
  const seconds = Math.floor(new Date(dateCandidate).getTime() / 1000);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function toIsoDate(seconds: number) {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

function validateAndNormalize(fields: InvoiceFields, logisticsData: Record<string, string>, sourceName: string) {
  const warnings: string[] = [];

  if (!fields.invoiceNumber) {
    const fallbackMaterial = [
      sourceName,
      fields.supplierName,
      fields.debtorName,
      fields.totalAmountCents.toString(),
      fields.issueDate,
      fields.maturityDate,
    ].join("|");
    fields.invoiceNumber = `INV-${hashFingerprint(fallbackMaterial).toString(16).toUpperCase()}`;
    warnings.push("Invoice number was missing in the PDF, so a deterministic invoice reference was generated.");
  }

  if (!Number.isInteger(fields.totalAmountCents) || fields.totalAmountCents <= 0) {
    throw new Error("Gemini could not find a valid positive invoice amount in the PDF.");
  }

  const issueDateSeconds = toDateSeconds(fields.issueDate);
  if (!issueDateSeconds) {
    fields.issueDate = toIsoDate(Math.floor(Date.now() / 1000));
    warnings.push("Issue date was missing or invalid, so today's date was used for review.");
  }

  let dueDateSeconds = toDateSeconds(fields.maturityDate);
  if (!dueDateSeconds) {
    const fallbackBase = toDateSeconds(fields.issueDate) ?? Math.floor(Date.now() / 1000);
    dueDateSeconds = fallbackBase + 30 * 24 * 60 * 60;
    fields.maturityDate = toIsoDate(dueDateSeconds);
    warnings.push("Maturity date was missing or invalid, so issue date plus 30 days was used for review.");
  }

  if (fields.debtorAddress && !/^0x[0-9a-fA-F]{40}$/.test(fields.debtorAddress)) {
    fields.debtorAddress = "";
    warnings.push("Debtor wallet address in the extracted data was invalid and must be entered manually.");
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
    warnings,
  };
}

async function callGeminiPdfWithModel(geminiKey: string, pdfBase64: string, prompt: string, model: GeminiModel) {
  const cleanBase64 = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;
  const geminiRes = await fetch(`${GEMINI_API_URL}/${model}:generateContent?key=${geminiKey}`, {
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
    }),
  });

  if (!geminiRes.ok) {
    const errBody = await geminiRes.text();
    throw new Error(`${model} PDF API error ${geminiRes.status}: ${errBody}`);
  }

  const geminiData = await geminiRes.json();
  const rawText = getGeminiText(geminiData);
  if (!rawText) {
    throw new Error("Gemini returned empty response.");
  }

  return parseJsonFields(rawText);
}

async function callGeminiPdf(geminiKey: string, pdfBase64: string, prompt: string) {
  let lastError: unknown = null;

  for (const model of GEMINI_MODELS) {
    try {
      return {
        fields: await callGeminiPdfWithModel(geminiKey, pdfBase64, prompt, model),
        model,
      };
    } catch (error) {
      lastError = error;
      console.warn(`[parse-invoice] ${model} PDF parse failed:`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gemini PDF parsing failed for all configured models.");
}

async function callGeminiTextFallbackWithModel(geminiKey: string, invoiceText: string, model: GeminiModel) {
  const fallbackRes = await fetch(`${GEMINI_API_URL}/${model}:generateContent?key=${geminiKey}`, {
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
    }),
  });

  if (!fallbackRes.ok) {
    const errBody = await fallbackRes.text();
    throw new Error(`${model} text fallback error ${fallbackRes.status}: ${errBody}`);
  }

  const fallbackData = await fallbackRes.json();
  const rawFallback = getGeminiText(fallbackData);
  if (!rawFallback) {
    throw new Error(`${model} fallback returned empty response.`);
  }

  return parseJsonFields(rawFallback);
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

  let lastError: unknown = null;

  for (const model of GEMINI_MODELS) {
    try {
      return {
        fields: await callGeminiTextFallbackWithModel(geminiKey, invoiceText, model),
        model,
      };
    } catch (error) {
      lastError = error;
      console.warn(`[parse-invoice] ${model} text fallback failed:`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gemini text fallback failed for all configured models.");
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
      const parsed = await callGeminiPdf(apiKey, pdfBase64, PARSE_PROMPT);
      invoiceFields = parsed.fields;
      parseMethod = `${parsed.model}-native-pdf`;
    } catch (pathAError) {
      console.warn("[parse-invoice] Native PDF pass 1 failed, trying OCR-focused retry:", pathAError);

      try {
        const parsed = await callGeminiPdf(
          apiKey,
          pdfBase64,
          `${PARSE_PROMPT}

This PDF may be a scanned invoice. Use the rendered page images and OCR what you can from the document itself.
Do not guess fields that are not visible.`
        );
        invoiceFields = parsed.fields;
        parseMethod = `${parsed.model}-native-pdf-ocr-retry`;
      } catch (pathBError) {
        console.warn("[parse-invoice] Native PDF retry failed, trying text fallback:", pathBError);

        try {
          const parsed = await callGeminiTextFallback(apiKey, pdfBuffer);
          invoiceFields = parsed.fields;
          parseMethod = `${parsed.model}-text-fallback`;
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

    const normalized = validateAndNormalize(invoiceFields, logisticsData, pdfFile.name);

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
      parseWarnings: normalized.warnings,
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
