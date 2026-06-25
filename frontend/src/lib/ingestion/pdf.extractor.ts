/*
 * @file pdf.extractor.ts
 * @description Extracts raw text from PDFs without using any external inference or heuristics.
 */

import { createHash } from "crypto";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { execFile } from "child_process";
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
  const workspaceRoot = process.cwd();
  const tempDir = await mkdtemp(path.join(tmpdir(), "arbitra-pdf-"));
  const pdfPath = path.join(tempDir, "invoice.pdf");
  const cliPath = path.join(workspaceRoot, "node_modules", "pdf-parse", "bin", "cli.mjs");

  try {
    await writeFile(pdfPath, pdfBuffer);
    const { stdout } = await execFileAsync(
      process.execPath,
      [cliPath, "text", pdfPath],
      {
        cwd: workspaceRoot,
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    const text = stdout.replace(/\u0000/g, " ").trim();

    return {
      text,
      rawTextHash: createHash("sha256").update(text, "utf8").digest("hex"),
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
