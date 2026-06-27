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
      const text = extractPageText(content.items);

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

function extractPageText(items) {
  const rows = [];

  for (const item of items) {
    if (typeof item?.str !== "string" || !item.str.trim()) {
      continue;
    }

    const transform = Array.isArray(item.transform) ? item.transform : [];
    const x = typeof transform[4] === "number" ? transform[4] : 0;
    const y = typeof transform[5] === "number" ? transform[5] : 0;
    const width = typeof item.width === "number" ? item.width : item.str.length * 5;
    const row = rows.find((candidate) => Math.abs(candidate.y - y) < 3);

    if (row) {
      row.parts.push({ x, width, text: item.str });
    } else {
      rows.push({ y, parts: [{ x, width, text: item.str }] });
    }
  }

  return rows
    .sort((left, right) => right.y - left.y)
    .map((row) => joinRowParts(row.parts))
    .filter(Boolean)
    .join("\n");
}

function joinRowParts(parts) {
  const ordered = parts.sort((left, right) => left.x - right.x);
  let line = "";
  let previousEnd = null;

  for (const part of ordered) {
    const gap = previousEnd === null ? 0 : part.x - previousEnd;
    const separator = gap > 18 ? "  " : " ";
    line = `${line}${line ? separator : ""}${part.text}`;
    previousEnd = part.x + part.width;
  }

  return line
    .replace(/\u0000/g, " ")
    .replace(/[ \t]{3,}/g, "  ")
    .replace(/[ \t]+$/g, "")
    .trim();
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(message);
  process.exit(1);
});
