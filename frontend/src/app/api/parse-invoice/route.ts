/*
 * @file route.ts
 * @description POST /api/parse-invoice ingests invoices with deterministic parsing and local OCR fallback.
 */

import { NextRequest, NextResponse } from "next/server";
import { ingestInvoice } from "@/lib/ingestion/ingestion.service";
import { buildInvoiceFields } from "@/lib/ingestion/invoice.parser";
import type { InvoiceFields } from "@/lib/ingestion/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_BASE_RATE_BPS = 300;
const DEFAULT_REPUTATION_MULTIPLIER = 5;

function hashFingerprint(material: string) {
  let hash = 5381n;
  for (let i = 0; i < material.length; i += 1) {
    hash = hash * 33n + BigInt(material.charCodeAt(i));
  }
  return hash & 0x7fffffffffffffffn;
}

function hashFingerprint64(material: string) {
  return hashFingerprint(material);
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
    throw new Error("A valid positive invoice amount could not be extracted from the PDF.");
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
    fingerprint64: hashFingerprint64(fingerprintMaterial),
    baseRate: BigInt(DEFAULT_BASE_RATE_BPS),
    reputationMultiplier: BigInt(DEFAULT_REPUTATION_MULTIPLIER),
    debtor: fields.debtorAddress ?? "",
    warnings,
  };
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

    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());
    const fileSizeMB = pdfBuffer.length / (1024 * 1024);

    if (fileSizeMB > 19) {
      return NextResponse.json(
        { error: `PDF too large (${fileSizeMB.toFixed(1)}MB). Maximum is 19MB.` },
        { status: 413 },
      );
    }

    const { logisticsVerified, logisticsData } = await parseLogistics(xmlFile);
    const ingestion = await ingestInvoice(pdfBuffer);

    if (ingestion.draft.faceValue === null || !ingestion.draft.dueDate) {
      return NextResponse.json(
        {
          error: "Failed to extract the required invoice fields from the uploaded PDF.",
          details: ingestion.extraction.issues.join(" "),
          invoiceDraft: ingestion.draft,
          extractionMeta: ingestion.draft.extractionMeta,
        },
        { status: 422 },
      );
    }

    const invoiceFields = buildInvoiceFields(ingestion.rawText, ingestion.draft);
    const normalized = validateAndNormalize(invoiceFields, logisticsData, pdfFile.name);

    return NextResponse.json({
      success: true,
      invoiceDraft: ingestion.draft,
      invoiceFields,
      logisticsVerified,
      logisticsData,
      parseMethod: ingestion.extraction.method,
      extractionMeta: ingestion.draft.extractionMeta,
      faceValue: normalized.faceValue.toString(),
      dueDate: normalized.dueDate.toString(),
      fingerprint: normalized.fingerprint.toString(),
      fingerprint64: normalized.fingerprint64.toString(),
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
