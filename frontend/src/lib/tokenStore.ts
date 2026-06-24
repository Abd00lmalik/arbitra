/*
 * @file tokenStore.ts
 * @description Stateless verification token helpers backed by signed JWT payloads.
 */

import { createHash } from "crypto";
import { SignJWT, jwtVerify } from "jose";

const TOKEN_TTL_SECONDS = 72 * 60 * 60;

type VerifyTokenPayload = {
  invoiceId: number;
  debtorEmail: string;
  faceValue?: string;
  dueDate?: string;
  invoiceNumber?: string;
};

function getTokenSecret() {
  const secret =
    process.env.VERIFIER_PRIVATE_KEY ||
    process.env.RESEND_API_KEY;

  if (!secret) {
    throw new Error("Verification token secret is not configured.");
  }

  return new TextEncoder().encode(secret);
}

export async function createVerifyToken(
  invoiceId: number,
  debtorEmail: string,
  faceValue?: string,
  dueDate?: string,
  invoiceNumber?: string
): Promise<string> {
  return new SignJWT({
    invoiceId,
    debtorEmail,
    faceValue,
    dueDate,
    invoiceNumber,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(getTokenSecret());
}

export async function validateVerifyToken(
  invoiceId: number,
  rawToken: string
): Promise<{ valid: true; debtorEmail: string; emailHash: string; faceValue?: string; dueDate?: string; invoiceNumber?: string } | { valid: false }> {
  if (!rawToken) {
    return { valid: false };
  }

  try {
    const { payload } = await jwtVerify(rawToken, getTokenSecret());
    if (Number(payload.invoiceId) !== invoiceId) {
      return { valid: false };
    }

    const debtorEmail = typeof payload.debtorEmail === "string" ? payload.debtorEmail : "";
    if (!debtorEmail) {
      return { valid: false };
    }

    const faceValue = typeof payload.faceValue === "string" ? payload.faceValue : undefined;
    const dueDate = typeof payload.dueDate === "string" ? payload.dueDate : undefined;
    const invoiceNumber = typeof payload.invoiceNumber === "string" ? payload.invoiceNumber : undefined;
    const emailHash = createHash("sha256").update(debtorEmail.toLowerCase().trim()).digest("hex");

    return {
      valid: true,
      debtorEmail,
      emailHash,
      faceValue,
      dueDate,
      invoiceNumber,
    };
  } catch {
    return { valid: false };
  }
}

export async function consumeVerifyToken(
  invoiceId: number,
  rawToken: string
): Promise<void> {
  void invoiceId;
  void rawToken;
}

export function computeEmailHash(email: string): `0x${string}` {
  return ("0x" + createHash("sha256")
    .update(email.toLowerCase().trim())
    .digest("hex")) as `0x${string}`;
}
