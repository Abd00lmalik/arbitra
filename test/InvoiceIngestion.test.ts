/*
 * @file InvoiceIngestion.test.ts
 * @description Verifies deterministic invoice parsing, OCR fallback control, and Gemini removal from ingestion.
 */

import { expect } from "chai";
import fs from "fs";
import path from "path";
import { parseInvoiceText } from "../frontend/src/lib/ingestion/invoice.parser";
import { validateExtractionText } from "../frontend/src/lib/ingestion/ingestion.validator";
import { ingestInvoiceWithDependencies } from "../frontend/src/lib/ingestion/ingestion.service";

describe("Deterministic invoice ingestion", () => {
  const sampleText = [
    "Invoice Number: INV-2048",
    "Invoice Date: 2026-06-01",
    "Due Date: 2026-07-01",
    "Supplier: Atlas Supply Ltd",
    "Debtor: Meridian Retail PLC",
    "Debtor Email: ap@meridian.example",
    "Supplier Tax ID: SUP-77881",
    "Debtor Tax ID: DEB-11229",
    "Total Due USD 12500.50",
    "Widgets Batch A 12500.50",
  ].join("\n");

  it("returns the same InvoiceDraft for identical text input", () => {
    const first = parseInvoiceText(sampleText, "pdf-text", 92, "hash-a");
    const second = parseInvoiceText(sampleText, "pdf-text", 92, "hash-a");

    expect(first).to.deep.equal(second);
    expect(first.status).to.equal("success");
    expect(first.invoiceId).to.equal("INV-2048");
    expect(first.faceValue).to.equal(12500.5);
  });

  it("accepts strong native PDF extraction without invoking OCR", async () => {
    let ocrCalled = false;
    const result = await ingestInvoiceWithDependencies(Buffer.from("fake-pdf"), {
      extractPdfText: async () => ({
        text: sampleText,
        rawTextHash: "pdf-hash",
      }),
      extractOcrText: async () => {
        ocrCalled = true;
        return {
          text: "should-not-run",
          confidence: 0,
          rawTextHash: "ocr-hash",
        };
      },
    });

    expect(result.extraction.method).to.equal("pdf-text");
    expect(result.extraction.isValid).to.equal(true);
    expect(ocrCalled).to.equal(false);
  });

  it("falls back to OCR once when native text extraction is incomplete", async () => {
    let ocrCalls = 0;
    const result = await ingestInvoiceWithDependencies(Buffer.from("fake-pdf"), {
      extractPdfText: async () => ({
        text: "blurred scan",
        rawTextHash: "pdf-short",
      }),
      extractOcrText: async () => {
        ocrCalls += 1;
        return {
          text: sampleText,
          confidence: 88,
          rawTextHash: "ocr-good",
        };
      },
    });

    expect(validateExtractionText("blurred scan").isValid).to.equal(false);
    expect(ocrCalls).to.equal(1);
    expect(result.extraction.method).to.equal("ocr");
    expect(result.draft.status).to.equal("success");
    expect(result.draft.extractionMeta.rawTextHash).to.equal("ocr-good");
  });

  it("marks the draft incomplete when both extraction stages fail validation", async () => {
    const result = await ingestInvoiceWithDependencies(Buffer.from("fake-pdf"), {
      extractPdfText: async () => ({
        text: "too short",
        rawTextHash: "pdf-short",
      }),
      extractOcrText: async () => ({
        text: "still incomplete",
        confidence: 12,
        rawTextHash: "ocr-short",
      }),
    });

    expect(result.extraction.method).to.equal("ocr");
    expect(result.extraction.isValid).to.equal(false);
    expect(result.draft.status).to.equal("incomplete");
  });

  it("contains no Gemini references in the ingestion module tree", () => {
    const ingestionDir = path.join(process.cwd(), "frontend", "src", "lib", "ingestion");
    const files = fs.readdirSync(ingestionDir);

    for (const file of files) {
      const fullPath = path.join(ingestionDir, file);
      const contents = fs.readFileSync(fullPath, "utf8");
      expect(contents.toLowerCase()).to.not.include("gemini");
    }
  });
});
