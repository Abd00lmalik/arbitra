/*
 * @file pdf-text-worker.cjs
 * @description Node-only helper that extracts PDF text with pdfjs-dist outside the Next.js bundle graph.
 */

const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");

async function main() {
  const pdfPath = process.argv[2];

  const data = pdfPath
    ? require("fs").readFileSync(pdfPath)
    : await readStdin();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(data),
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

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks)));
    process.stdin.on("error", reject);
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(message);
  process.exit(1);
});
