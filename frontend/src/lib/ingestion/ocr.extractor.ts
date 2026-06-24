/*
 * @file ocr.extractor.ts
 * @description Renders scanned PDFs locally and runs OCR with bundled Tesseract language data.
 */

import path from "path";
import { createHash } from "crypto";
import { createWorker } from "tesseract.js";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const projectRoot = process.cwd();
const workerPath = path.join(projectRoot, "node_modules", "tesseract.js", "dist", "worker.min.js");
const corePath = path.join(projectRoot, "node_modules", "tesseract.js-core");
const langPath = path.join(projectRoot, "node_modules", "@tesseract.js-data", "eng", "4.0.0");

type CanvasLike = {
  width: number;
  height: number;
  toBuffer: (mimeType: string) => Buffer;
};

type CanvasAndContext = {
  canvas: CanvasLike;
  context: CanvasRenderingContext2D;
};

type CanvasModule = {
  createCanvas: (width: number, height: number) => unknown;
};

/**
 * Load the native canvas module at runtime so Next does not try to bundle the binary.
 *
 * @returns Runtime canvas module.
 */
function loadCanvasModule(): CanvasModule {
  const runtimeRequire = Function("return require")() as NodeRequire;
  const moduleName = "@napi-rs/" + "canvas";
  return runtimeRequire(moduleName) as CanvasModule;
}

/**
 * Minimal canvas factory for PDF.js page rendering in Node.
 *
 * @param width Target canvas width.
 * @param height Target canvas height.
 * @returns Canvas plus 2D context.
 */
function createCanvasSurface(
  createCanvasFn: (width: number, height: number) => unknown,
  width: number,
  height: number,
): CanvasAndContext {
  const canvas = createCanvasFn(Math.ceil(width), Math.ceil(height)) as unknown as CanvasLike & {
    getContext: (kind: "2d") => CanvasRenderingContext2D;
  };
  const context = canvas.getContext("2d");

  return {
    canvas,
    context,
  };
}

/**
 * Convert a PDF page into a PNG buffer for deterministic OCR.
 *
 * @param pdfBuffer Source PDF bytes.
 * @param pageNumber Zero-based page index.
 * @returns PNG bytes for the rendered page.
 */
async function renderPageToPng(pdfBuffer: Buffer, pageNumber: number): Promise<Buffer> {
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: false,
  });

  try {
    const { createCanvas } = loadCanvasModule();
    const document = await loadingTask.promise;
    const page = await document.getPage(pageNumber + 1);
    const viewport = page.getViewport({ scale: 2 });
    const canvasAndContext = createCanvasSurface(createCanvas, viewport.width, viewport.height);

    try {
      await page.render({
        canvasContext: canvasAndContext.context,
        viewport,
      }).promise;

      return canvasAndContext.canvas.toBuffer("image/png");
    } finally {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
    }
  } finally {
    await loadingTask.destroy();
  }
}

/**
 * Extract text from a scanned PDF using local OCR only.
 *
 * @param pdfBuffer Source PDF bytes.
 * @returns OCR text plus confidence and a stable hash.
 */
export async function extractOcrText(pdfBuffer: Buffer): Promise<{ text: string; confidence: number; rawTextHash: string }> {
  const worker = await createWorker("eng", 1, {
    workerPath,
    corePath,
    langPath,
    cachePath: path.join(projectRoot, ".tesseract-cache"),
    gzip: true,
  });

  try {
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: false,
    });
    const document = await loadingTask.promise;
    const pageCount = Math.min(document.numPages, 3);
    await loadingTask.destroy();

    const pageTexts: string[] = [];
    const confidences: number[] = [];

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const imageBuffer = await renderPageToPng(pdfBuffer, pageIndex);
      const result = await worker.recognize(imageBuffer);
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
    await worker.terminate();
  }
}
