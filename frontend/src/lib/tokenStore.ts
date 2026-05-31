/*
 * @file tokenStore.ts
 * @description Secure verification token store backed by Upstash Redis.
 *              Tokens expire after 72 hours. Only SHA-256 hashes of tokens
 *              are stored — never plaintext tokens.
 */

import { createHash, randomBytes } from "crypto";
import { Redis }                   from "@upstash/redis";

const TOKEN_TTL_SECONDS = 72 * 60 * 60; /* 72 hours */

/* ── Redis client (Upstash) ── */
const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/* ── Key format ── */
const key = (invoiceId: number, tokenHash: string) =>
  `arbitra:verify:${invoiceId}:${tokenHash}`;

/* ── Token operations ── */

/** Generate a new secure token and store its hash in Redis along with details */
export async function createVerifyToken(
  invoiceId: number,
  debtorEmail: string,
  faceValue?: string,
  dueDate?: string
): Promise<string> {
  const raw       = randomBytes(32).toString("hex");
  const hash      = createHash("sha256").update(raw).digest("hex");
  const emailHash = createHash("sha256").update(debtorEmail.toLowerCase().trim()).digest("hex");

  await redis.set(
    key(invoiceId, hash),
    JSON.stringify({ debtorEmail, emailHash, faceValue, dueDate, createdAt: Date.now() }),
    { ex: TOKEN_TTL_SECONDS }
  );

  return raw; /* Return raw token — sent once in email URL, never stored */
}

/** Validate a token and return stored metadata if valid */
export async function validateVerifyToken(
  invoiceId: number,
  rawToken: string
): Promise<{ valid: true; debtorEmail: string; emailHash: string; faceValue?: string; dueDate?: string } | { valid: false }> {
  if (!rawToken || rawToken.length !== 64) return { valid: false };

  const hash  = createHash("sha256").update(rawToken).digest("hex");
  const data  = await redis.get(key(invoiceId, hash));

  if (!data) return { valid: false };

  const parsed = typeof data === "string" ? JSON.parse(data) : data;
  return {
    valid:       true,
    debtorEmail: parsed.debtorEmail,
    emailHash:   parsed.emailHash,
    faceValue:   parsed.faceValue,
    dueDate:     parsed.dueDate,
  };
}

/** Delete a token after use (one-time use enforcement) */
export async function consumeVerifyToken(
  invoiceId: number,
  rawToken: string
): Promise<void> {
  const hash  = createHash("sha256").update(rawToken).digest("hex");
  await redis.del(key(invoiceId, hash));
}

/** Compute email hash for on-chain commitment */
export function computeEmailHash(email: string): `0x${string}` {
  return ("0x" + createHash("sha256")
    .update(email.toLowerCase().trim())
    .digest("hex")) as `0x${string}`;
}
