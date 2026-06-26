/*
 * @file pdf.extractor.ts
 * @description Extracts raw text from PDFs without using any external inference or heuristics.
 */

import { execFile } from "child_process";
import { createHash } from "crypto";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Extract raw text from a PDF buffer using native PDF parsing only.
 *
 * @param pdfBuffer Source PDF bytes.
 * @returns Raw text plus a stable hash of the extracted payload.
 * @throws If the PDF cannot be parsed.
 */
export async function extractPdfText(pdfBuffer: Buffer): Promise<{ text: string; rawTextHash: string }> {
  const tempDir = await mkdtemp(path.join(tmpdir(), "arbitra-pdf-text-"));
  const pdfPath = path.join(tempDir, "invoice.pdf");
  const workerPath = path.join(process.cwd(), "src", "lib", "ingestion", "pdf-text-worker.cjs");

  try {
    await writeFile(pdfPath, pdfBuffer);
    const { stdout } = await execFileAsync(process.execPath, [workerPath, pdfPath], {
      cwd: process.cwd(),
      maxBuffer: 16 * 1024 * 1024,
    });
    const mergedText = stdout.trim();

    return {
      text: mergedText,
      rawTextHash: createHash("sha256").update(mergedText, "utf8").digest("hex"),
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
