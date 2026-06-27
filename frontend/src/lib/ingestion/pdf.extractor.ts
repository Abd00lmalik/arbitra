/*
 * @file pdf.extractor.ts
 * @description Extracts raw text from PDFs without using any external inference or heuristics.
 */

import { execFile } from "child_process";
import { createHash } from "crypto";
import { existsSync } from "fs";
import path from "path";
import { promisify } from "util";
import { PDFDocument } from "pdf-lib";
import { PipelineLimitError, withTimeout } from "./pipeline-timing";
import { resolvePackageAsset } from "./runtime-paths";

const execFileAsync = promisify(execFile);
export const MAX_PDF_PAGES = 8;
export const PDF_EXTRACTION_TIMEOUT_MS = 4_000;

/**
 * Count PDF pages without rendering or text extraction.
 *
 * @param pdfBuffer Source PDF bytes.
 * @returns Number of pages in the document.
 * @throws If the PDF cannot be loaded.
 */
export async function countPdfPages(pdfBuffer: Buffer): Promise<number> {
  try {
    const document = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    return document.getPageCount();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new PipelineLimitError("PDF page validation", `PDF could not be read: ${detail}`);
  }
}

/**
 * Enforce the maximum page budget before expensive extraction.
 *
 * @param pageCount Number of pages in the document.
 * @throws If the page count exceeds the configured upload limit.
 */
export function assertPdfPageLimit(pageCount: number): void {
  if (pageCount > MAX_PDF_PAGES) {
    throw new PipelineLimitError(
      "PDF page validation",
      `PDF has ${pageCount} pages. Maximum is ${MAX_PDF_PAGES} pages.`,
    );
  }
}

/**
 * Extract raw text from a PDF buffer using native PDF parsing only.
 *
 * @param pdfBuffer Source PDF bytes.
 * @returns Raw text plus a stable hash of the extracted payload.
 * @throws If the PDF cannot be parsed.
 */
export async function extractPdfText(pdfBuffer: Buffer): Promise<{ text: string; rawTextHash: string }> {
  try {
    return await withTimeout("PDF text extraction", PDF_EXTRACTION_TIMEOUT_MS, extractPdfTextInProcess(pdfBuffer));
  } catch (error) {
    if (error instanceof Error && error.name === "PipelineTimeoutError") {
      throw error;
    }

    return extractPdfTextWithWorker(pdfBuffer);
  }
}

async function extractPdfTextInProcess(pdfBuffer: Buffer): Promise<{ text: string; rawTextHash: string }> {
  const pdfjs = await import(resolvePackageAsset("pdfjs-dist", "legacy", "build", "pdf.js"));
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    verbosity: 0,
    isEvalSupported: false,
    useWorkerFetch: false,
    disableFontFace: true,
  });

  try {
    const document = await loadingTask.promise;
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item: { str?: unknown }) => (typeof item?.str === "string" ? item.str : ""))
        .join(" ")
        .replace(/\u0000/g, " ")
        .trim();

      if (text) {
        pageTexts.push(text);
      }
    }

    return buildTextResult(pageTexts.join("\n\n").trim());
  } finally {
    await loadingTask.destroy();
  }
}

async function extractPdfTextWithWorker(pdfBuffer: Buffer): Promise<{ text: string; rawTextHash: string }> {
  const workerPath = resolvePdfTextWorkerPath();
  const child = execFileAsync(process.execPath, [workerPath], {
    cwd: process.cwd(),
    maxBuffer: 16 * 1024 * 1024,
    timeout: PDF_EXTRACTION_TIMEOUT_MS + 500,
    killSignal: "SIGKILL",
  });

  child.child.stdin?.end(pdfBuffer);

  const { stdout } = await withTimeout("PDF text extraction", PDF_EXTRACTION_TIMEOUT_MS, child);
  return buildTextResult(stdout.trim());
}

function resolvePdfTextWorkerPath(): string {
  const candidates = [
    path.join(process.cwd(), "src", "lib", "ingestion", "pdf-text-worker.cjs"),
    path.join(process.cwd(), "frontend", "src", "lib", "ingestion", "pdf-text-worker.cjs"),
    path.join(__dirname, "pdf-text-worker.cjs"),
  ];
  const workerPath = candidates.find((candidate) => existsSync(candidate));

  if (!workerPath) {
    throw new Error("PDF text worker is unavailable in this runtime.");
  }

  return workerPath;
}

function buildTextResult(text: string): { text: string; rawTextHash: string } {
  return {
    text,
    rawTextHash: createHash("sha256").update(text, "utf8").digest("hex"),
  };
}
