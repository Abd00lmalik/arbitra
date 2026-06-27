/*
 * @file types.ts
 * @description Shared deterministic invoice ingestion types for parsing, OCR, and route responses.
 */

export type ExtractionMethod = "pdf-text" | "ocr";

export type IngestionStage =
  | "request received"
  | "PDF read"
  | "PDF page validation"
  | "PDF text extraction"
  | "validation"
  | "OCR fallback"
  | "deterministic parsing"
  | "JSON response";

export type StageTiming = {
  stage: IngestionStage;
  durationMs: number;
  status: "ok" | "skipped" | "failed";
  detail?: string;
};

export type IngestionTiming = {
  requestId: string;
  totalMs: number;
  stages: StageTiming[];
};

export type InvoiceLineItem = {
  description: string;
  amount: number;
};

export type InvoiceDraft = {
  invoiceId: string | null;
  supplier: string | null;
  debtor: string | null;
  faceValue: number | null;
  dueDate: string | null;
  lineItems: InvoiceLineItem[];
  extractionMeta: {
    method: ExtractionMethod;
    confidence: number;
    rawTextHash: string;
  };
  status: "success" | "incomplete";
};

export type InvoiceFields = {
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

export type ExtractionResult = {
  method: ExtractionMethod;
  text: string;
  confidence: number;
  rawTextHash: string;
  isValid: boolean;
  issues: string[];
};
