/*
 * @file benchmark_upload_pipeline.js
 * @description Benchmarks the invoice upload ingestion pipeline with generated PDF fixtures.
 */

require("ts-node/register/transpile-only");

const path = require("path");
const Module = require("module");
const { createRequire } = Module;
const frontendRequire = createRequire(path.join(__dirname, "..", "frontend", "package.json"));
Module.globalPaths.push(path.join(__dirname, "..", "frontend", "node_modules"));
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(
      this,
      path.join(__dirname, "..", "frontend", "src", request.slice(2)),
      parent,
      isMain,
      options,
    );
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const fs = require("fs");
const { PDFDocument, StandardFonts, rgb } = frontendRequire("pdf-lib");
const { ingestInvoice } = require("../frontend/src/lib/ingestion/ingestion.service");
const { PipelineTimer } = require("../frontend/src/lib/ingestion/pipeline-timing");

const outDir = path.join(__dirname, "upload-benchmarks");

async function createDigitalPdf(filePath, pages) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (let i = 0; i < pages; i += 1) {
    const page = doc.addPage([612, 792]);
    const y = 730;
    page.drawText(`Invoice Number: INV-BENCH-${pages}-${i + 1}`, { x: 72, y, size: 14, font, color: rgb(0, 0, 0) });
    page.drawText("Invoice Date: 2026-06-01", { x: 72, y: y - 28, size: 12, font });
    page.drawText("Due Date: 2026-07-01", { x: 72, y: y - 56, size: 12, font });
    page.drawText("Supplier: Atlas Supply Ltd", { x: 72, y: y - 84, size: 12, font });
    page.drawText("Debtor: Meridian Retail PLC", { x: 72, y: y - 112, size: 12, font });
    page.drawText("Debtor Email: ap@meridian.example", { x: 72, y: y - 140, size: 12, font });
    page.drawText("Supplier Tax ID: SUP-77881", { x: 72, y: y - 168, size: 12, font });
    page.drawText("Debtor Tax ID: DEB-11229", { x: 72, y: y - 196, size: 12, font });
    page.drawText("Total Due USD 12500.50", { x: 72, y: y - 224, size: 12, font });
  }

  fs.writeFileSync(filePath, Buffer.from(await doc.save()));
}

async function createScannedLikePdf(filePath) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  page.drawRectangle({ x: 70, y: 520, width: 470, height: 120, color: rgb(0.92, 0.92, 0.92) });
  page.drawRectangle({ x: 90, y: 560, width: 300, height: 14, color: rgb(0.1, 0.1, 0.1) });
  page.drawRectangle({ x: 90, y: 535, width: 240, height: 14, color: rgb(0.1, 0.1, 0.1) });
  fs.writeFileSync(filePath, Buffer.from(await doc.save()));
}

async function runCase(name, buffer) {
  const timer = new PipelineTimer(name);
  const started = performance.now();
  try {
    const result = await ingestInvoice(buffer, timer);
    return {
      name,
      status: "ok",
      method: result.extraction.method,
      draftStatus: result.draft.status,
      totalMs: Math.round((performance.now() - started) * 10) / 10,
      stages: timer.snapshot().stages,
    };
  } catch (error) {
    return {
      name,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      totalMs: Math.round((performance.now() - started) * 10) / 10,
      stages: timer.snapshot().stages,
    };
  }
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const onePage = path.join(outDir, "one-page-digital.pdf");
  const multiPage = path.join(outDir, "multi-page-digital.pdf");
  const scanned = path.join(outDir, "scanned-like.pdf");
  const malformed = path.join(outDir, "malformed.pdf");

  await createDigitalPdf(onePage, 1);
  await createDigitalPdf(multiPage, 4);
  await createScannedLikePdf(scanned);
  fs.writeFileSync(malformed, Buffer.from("%PDF-1.7\nmalformed\n"));

  const results = [];
  results.push(await runCase("one-page digital", fs.readFileSync(onePage)));
  results.push(await runCase("multi-page digital", fs.readFileSync(multiPage)));
  results.push(await runCase("scanned pdf", fs.readFileSync(scanned)));
  results.push(await runCase("malformed pdf", fs.readFileSync(malformed)));

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
