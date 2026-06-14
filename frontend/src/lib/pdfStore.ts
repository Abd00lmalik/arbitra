import { Redis } from "@upstash/redis";
import fs from "fs";
import path from "path";

// Initialize Redis if environment variables are present
const redis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  ? new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    })
  : null;

// Local filesystem fallback directory
const LOCAL_CACHE_DIR = path.join(process.cwd(), "cache", "pdfs");

export async function storeInvoicePdf(invoiceId: number, pdfBase64: string): Promise<void> {
  const cleanBase64 = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;
  
  if (redis) {
    await redis.set(`invoice_pdf:${invoiceId}`, cleanBase64, { ex: 72 * 60 * 60 }); // 72 hours expiry
  } else {
    // Local filesystem fallback
    try {
      if (!fs.existsSync(LOCAL_CACHE_DIR)) {
        fs.mkdirSync(LOCAL_CACHE_DIR, { recursive: true });
      }
      const filePath = path.join(LOCAL_CACHE_DIR, `${invoiceId}.pdf.base64`);
      fs.writeFileSync(filePath, cleanBase64, "utf8");
    } catch (err) {
      console.error("[pdfStore] Failed to write local PDF cache:", err);
    }
  }
}

export async function getInvoicePdf(invoiceId: number): Promise<string | null> {
  if (redis) {
    return await redis.get<string>(`invoice_pdf:${invoiceId}`);
  } else {
    // Local filesystem fallback
    try {
      const filePath = path.join(LOCAL_CACHE_DIR, `${invoiceId}.pdf.base64`);
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, "utf8");
      }
    } catch (err) {
      console.error("[pdfStore] Failed to read local PDF cache:", err);
    }
    return null;
  }
}
