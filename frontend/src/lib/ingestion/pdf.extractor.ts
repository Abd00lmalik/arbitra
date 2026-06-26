/*
 * @file pdf.extractor.ts
 * @description Extracts raw text from PDFs without using any external inference or heuristics.
 */

import { createHash } from "crypto";
const { PDFParse } = require("pdf-parse");

/**
 * Extract raw text from a PDF buffer using native PDF parsing only.
 *
 * @param pdfBuffer Source PDF bytes.
 * @returns Raw text plus a stable hash of the extracted payload.
 * @throws If the PDF cannot be parsed.
 */
export async function extractPdfText(pdfBuffer: Buffer): Promise<{ text: string; rawTextHash: string }> {
  const parser = new PDFParse({ data: pdfBuffer });
  try {
    const result = await parser.getText();
    const text = result.text.replace(/\u0000/g, " ").trim();

    return {
      text,
      rawTextHash: createHash("sha256").update(text, "utf8").digest("hex"),
    };
  } finally {
    await parser.destroy();
  }
}
