/*
 * @file ingestion.service.ts
 * @description Orchestrates deterministic PDF extraction, OCR fallback, parsing, and status reporting.
 */

import type { ExtractionResult, InvoiceDraft } from "./types";
import { assertPdfPageLimit, countPdfPages, extractPdfText } from "./pdf.extractor";
import { parseInvoiceText } from "./invoice.parser";
import { validateExtractionText } from "./ingestion.validator";
import type { PipelineTimer } from "./pipeline-timing";

export type IngestionResult = {
  draft: InvoiceDraft;
  extraction: ExtractionResult;
  rawText: string;
};

export type IngestionDependencies = {
  extractPdfText: typeof extractPdfText;
  loadOcrExtractor: () => Promise<typeof import("./ocr.extractor").extractOcrText>;
  countPdfPages: typeof countPdfPages;
};

/**
 * Run the deterministic invoice ingestion pipeline with a single OCR fallback.
 *
 * @param pdfBuffer Source PDF bytes.
 * @returns Parsed invoice draft plus extraction metadata.
 */
export async function ingestInvoice(pdfBuffer: Buffer, timer?: PipelineTimer): Promise<IngestionResult> {
  return ingestInvoiceWithDependencies(pdfBuffer, {
    extractPdfText,
    loadOcrExtractor: async () => {
      const { extractOcrText } = await import("./ocr.extractor");
      return extractOcrText;
    },
    countPdfPages,
  }, timer);
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
  timer?: PipelineTimer,
): Promise<IngestionResult> {
  const pageCount = await measure(timer, "PDF page validation", () => dependencies.countPdfPages(pdfBuffer));
  assertPdfPageLimit(pageCount);

  const pdfTextResult = await measure(
    timer,
    "PDF text extraction",
    () => dependencies.extractPdfText(pdfBuffer),
    (result) => `${result.text.length} chars from ${pageCount} pages`,
  );
  const pdfValidation = await measure(
    timer,
    "validation",
    () => validateExtractionText(pdfTextResult.text),
    (result) => result.isValid ? "text layer sufficient" : result.issues.join(" "),
  );

  if (pdfValidation.isValid) {
    const draft = await measure(
      timer,
      "deterministic parsing",
      () => parseInvoiceText(pdfTextResult.text, "pdf-text", 92, pdfTextResult.rawTextHash),
      (result) => result.status,
    );
    timer?.skip("OCR fallback", "text layer sufficient");

    return {
      draft,
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

  const ocrTextResult = await measure(
    timer,
    "OCR fallback",
    async () => {
      const extractOcrText = await dependencies.loadOcrExtractor();
      return extractOcrText(pdfBuffer);
    },
    (result) => `${result.text.length} chars confidence=${Math.max(0, Math.min(100, result.confidence))}`,
  );
  const ocrValidation = await measure(
    timer,
    "validation",
    () => validateExtractionText(ocrTextResult.text),
    (result) => result.isValid ? "OCR text sufficient" : result.issues.join(" "),
  );
  const draft = await measure(
    timer,
    "deterministic parsing",
    () => parseInvoiceText(
      ocrTextResult.text,
      "ocr",
      Math.max(0, Math.min(100, ocrTextResult.confidence)),
      ocrTextResult.rawTextHash,
    ),
    (result) => result.status,
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

async function measure<T>(
  timer: PipelineTimer | undefined,
  stage: Parameters<PipelineTimer["measure"]>[0],
  action: () => Promise<T> | T,
  detail?: (value: T) => string | undefined,
): Promise<T> {
  return timer ? timer.measure(stage, action, detail) : action();
}
