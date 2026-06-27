/*
 * @file ocr.extractor.ts
 * @description Runs local OCR with bundled Tesseract data and fails gracefully when screenshot rendering is unavailable.
 */

import path from "path";
import { createHash } from "crypto";
import { execFile } from "child_process";
import { existsSync } from "fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { promisify } from "util";
import { createWorker } from "tesseract.js";
import { resolvePackageAsset } from "./runtime-paths";
import { withTimeout } from "./pipeline-timing";

const execFileAsync = promisify(execFile);
const workerPath = resolvePackageAsset("tesseract.js", "dist", "worker.min.js");
const corePath = resolvePackageAsset("tesseract.js-core");
const langPath = resolvePackageAsset("@tesseract.js-data/eng", "4.0.0");
export const OCR_TIMEOUT_MS = 12_000;
const OCR_MAX_PAGES = 2;
const ocrRendererPath = findOcrRendererPath();

/**
 * Render the first pages of a PDF into PNGs using the local pdf-parse CLI.
 *
 * @param pdfPath Source PDF path.
 * @param outputDir Target directory for screenshots.
 */
async function renderPdfScreenshots(pdfPath: string, outputDir: string): Promise<void> {
  if (!ocrRendererPath) {
    throw new Error("OCR screenshot renderer is unavailable in this runtime.");
  }

  await execFileAsync(
    process.execPath,
    [ocrRendererPath, "screenshot", pdfPath, "--output", outputDir, "--scale", "1.6"],
    {
      cwd: path.dirname(ocrRendererPath),
      maxBuffer: 16 * 1024 * 1024,
      timeout: OCR_TIMEOUT_MS,
      killSignal: "SIGKILL",
    },
  );
}

/**
 * Extract text from a scanned PDF using local OCR only.
 *
 * @param pdfBuffer Source PDF bytes.
 * @returns OCR text plus confidence and a stable hash.
 */
export async function extractOcrText(pdfBuffer: Buffer): Promise<{ text: string; confidence: number; rawTextHash: string }> {
  const tempDir = await mkdtemp(path.join(tmpdir(), "arbitra-ocr-"));
  const pdfPath = path.join(tempDir, "invoice.pdf");
  const screenshotDir = path.join(tempDir, "screens");
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;

  try {
    await writeFile(pdfPath, pdfBuffer);
    try {
      await withTimeout("OCR fallback", OCR_TIMEOUT_MS, renderPdfScreenshots(pdfPath, screenshotDir));
    } catch (error) {
      const fallbackText = "OCR fallback unavailable: PDF screenshot rendering is not supported in this runtime.";
      return {
        text: fallbackText,
        confidence: 0,
        rawTextHash: createHash("sha256").update(fallbackText, "utf8").digest("hex"),
      };
    }

    worker = await withTimeout("OCR fallback", OCR_TIMEOUT_MS, createWorker("eng", 1, {
      workerPath,
      corePath,
      langPath,
      cachePath: path.join(tmpdir(), "arbitra-tesseract-cache"),
      gzip: true,
    }));

    const screenshotFiles = (await readdir(screenshotDir))
      .filter((entry) => entry.toLowerCase().endsWith(".png"))
      .sort()
      .slice(0, OCR_MAX_PAGES);

    if (screenshotFiles.length === 0) {
      const fallbackText = "OCR fallback unavailable: no screenshot pages were produced for this PDF.";
      return {
        text: fallbackText,
        confidence: 0,
        rawTextHash: createHash("sha256").update(fallbackText, "utf8").digest("hex"),
      };
    }

    const pageTexts: string[] = [];
    const confidences: number[] = [];

    for (const screenshotFile of screenshotFiles) {
      const imageBuffer = await readFile(path.join(screenshotDir, screenshotFile));
      const result = await withTimeout("OCR fallback", OCR_TIMEOUT_MS, worker.recognize(imageBuffer));
      const text = result.data.text.replace(/\u0000/g, " ").trim();

      if (text) {
        pageTexts.push(text);
      }

      if (Number.isFinite(result.data.confidence)) {
        confidences.push(result.data.confidence);
      }
    }

    const mergedText = pageTexts.join("\n\n").trim();
    const confidence = confidences.length > 0
      ? Math.round(confidences.reduce((sum, value) => sum + value, 0) / confidences.length)
      : 0;

    return {
      text: mergedText,
      confidence,
      rawTextHash: createHash("sha256").update(mergedText, "utf8").digest("hex"),
    };
  } finally {
    if (worker) {
      await worker.terminate();
    }
    await rm(tempDir, { recursive: true, force: true });
  }
}

function findOcrRendererPath(): string | null {
  try {
    return resolvePackageAsset("pdf-parse", "bin", "cli.mjs");
  } catch {
    const root = process.cwd();
    const candidates = [
      path.join(root, "node_modules", "pdfjs-dist", "legacy", "image_decoders", "pdf2png.mjs"),
      path.join(root, "node_modules", "pdfjs-dist", "bin", "pdf2png.mjs"),
    ];
    return candidates.find((candidate) => existsSync(candidate)) ?? null;
  }
}
