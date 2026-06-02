import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = path.resolve("audit-artifacts");

async function ensureDir() {
  await fs.mkdir(outputDir, { recursive: true });
}

async function shot(page, name) {
  const target = path.join(outputDir, `${name}.png`);
  await page.screenshot({ path: target, fullPage: true });
  return target;
}

async function dump(name, data) {
  const target = path.join(outputDir, `${name}.json`);
  await fs.writeFile(target, JSON.stringify(data, null, 2));
  return target;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });

const evidence = {
  screenshots: [],
  notes: [],
};

try {
  await ensureDir();

  await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(5000);
  evidence.screenshots.push(await shot(page, "01-dashboard-landing"));

  await page.goto("http://localhost:3000/register?next=/dashboard", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(5000);
  evidence.screenshots.push(await shot(page, "02-register-page"));

  const pageText = await page.locator("body").innerText();
  evidence.notes.push({
    checkpoint: "register_page_text",
    pageText,
  });

  const authError = await page.locator("text=NEXT_PUBLIC_WEB3AUTH_CLIENT_ID is missing or invalid").count();
  evidence.notes.push({
    checkpoint: "web3auth_missing_client_id",
    present: authError > 0,
  });

  await dump("step1-browser-evidence", evidence);
} finally {
  await browser.close();
}
