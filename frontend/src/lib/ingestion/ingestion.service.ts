/*
 * @file ingestion.service.ts
 * @description Orchestrates deterministic PDF extraction, OCR fallback, parsing, and status reporting.
 */

import type { ExtractionResult, InvoiceDraft } from "./types";
import { extractPdfText } from "./pdf.extractor";
import { parseInvoiceText } from "./invoice.parser";
import { validateExtractionText } from "./ingestion.validator";

export type IngestionResult = {
  draft: InvoiceDraft;
  extraction: ExtractionResult;
  rawText: string;
};

export type IngestionDependencies = {
  extractPdfText: typeof extractPdfText;
  extractOcrText: typeof import("./ocr.extractor").extractOcrText;
};

/**
 * Run the deterministic invoice ingestion pipeline with a single OCR fallback.
 *
 * @param pdfBuffer Source PDF bytes.
 * @returns Parsed invoice draft plus extraction metadata.
 */
export async function ingestInvoice(pdfBuffer: Buffer): Promise<IngestionResult> {
  const { extractOcrText } = await import("./ocr.extractor");

  return ingestInvoiceWithDependencies(pdfBuffer, {
    extractPdfText,
    extractOcrText,
  });
}

/**
 * Run the deterministic invoice ingestion pipeline with injectable dependencies for tests.
 *
 * @param pdfBuffer Source PDF bytes.
 * @param dependencies Extraction implementations.
 * @returns Parsed invoice draft plus extraction metadata.
 */
export async function ingestInvoiceWithDependencies(
  pdfBuffer: Buffer,
  dependencies: IngestionDependencies,
): Promise<IngestionResult> {
  const pdfTextResult = await dependencies.extractPdfText(pdfBuffer);
  const pdfValidation = validateExtractionText(pdfTextResult.text);

  if (pdfValidation.isValid) {
    return {
      draft: parseInvoiceText(pdfTextResult.text, "pdf-text", 92, pdfTextResult.rawTextHash),
      extraction: {
        method: "pdf-text",
        text: pdfTextResult.text,
        confidence: 92,
        rawTextHash: pdfTextResult.rawTextHash,
        isValid: true,
        issues: [],
      },
      rawText: pdfTextResult.text,
    };
  }

  const ocrTextResult = await dependencies.extractOcrText(pdfBuffer);
  const ocrValidation = validateExtractionText(ocrTextResult.text);
  const draft = parseInvoiceText(
    ocrTextResult.text,
    "ocr",
    Math.max(0, Math.min(100, ocrTextResult.confidence)),
    ocrTextResult.rawTextHash,
  );

  return {
    draft: {
      ...draft,
      status: ocrValidation.isValid ? draft.status : "incomplete",
    },
    extraction: {
      method: "ocr",
      text: ocrTextResult.text,
      confidence: Math.max(0, Math.min(100, ocrTextResult.confidence)),
      rawTextHash: ocrTextResult.rawTextHash,
      isValid: ocrValidation.isValid,
      issues: [...pdfValidation.issues, ...ocrValidation.issues],
    },
    rawText: ocrTextResult.text,
  };
}
