/*
 * @file pdf-text-worker.cjs
 * @description Node-only helper that extracts PDF text with pdfjs-dist outside the Next.js bundle graph.
 */

const fs = require("fs");
const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");

async function main() {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    throw new Error("PDF path argument is required.");
  }

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(fs.readFileSync(pdfPath)),
    verbosity: 0,
    isEvalSupported: false,
    useWorkerFetch: false,
    disableFontFace: true,
  });

  try {
    const document = await loadingTask.promise;
    const pageTexts = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => (typeof item?.str === "string" ? item.str : ""))
        .join(" ")
        .replace(/\u0000/g, " ")
        .trim();

      if (text) {
        pageTexts.push(text);
      }
    }

    process.stdout.write(pageTexts.join("\n\n"));
  } finally {
    await loadingTask.destroy();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(message);
  process.exit(1);
});
