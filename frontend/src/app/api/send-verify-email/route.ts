import { NextRequest, NextResponse } from "next/server";
import { createVerifyToken }         from "@/lib/tokenStore";
import { sendVerifyEmail }            from "@/lib/email";

export const runtime = "nodejs";

/* Simple rate limiting — 3 emails per invoiceId per hour via Redis TTL */
const RATE_LIMIT_KEY = (id: number) => `arbitra:ratelimit:email:${id}`;
const RATE_LIMIT_TTL = 3600; /* 1 hour */

export async function POST(req: NextRequest) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { invoiceId, debtorEmail, supplierName, faceValue, dueDate } = body as {
    invoiceId:    number;
    debtorEmail:  string;
    supplierName?: string;
    faceValue?:   string;
    dueDate?:     string;
  };

  /* Validate inputs */
  if (!invoiceId || typeof invoiceId !== "number") {
    return NextResponse.json({ error: "invoiceId required" }, { status: 400 });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!debtorEmail || !emailRegex.test(debtorEmail)) {
    return NextResponse.json({ error: "Valid debtorEmail required" }, { status: 400 });
  }

  /* Rate limit check */
  try {
    const { getRedis } = await import("@/lib/tokenStore");
    const redis = await getRedis();
    const rlKey = RATE_LIMIT_KEY(invoiceId);
    const count = await redis.incr(rlKey);
    if (count === 1) await redis.expire(rlKey, RATE_LIMIT_TTL);
    if (count > 3) {
      return NextResponse.json(
        { error: "Too many verification emails sent for this invoice. Try again in 1 hour." },
        { status: 429 }
      );
    }
  } catch { /* Redis unavailable — allow through but log */ }

  try {
    /* Generate secure token and store hash */
    const token = await createVerifyToken(invoiceId, debtorEmail, faceValue, dueDate);

    /* Send email — zero financial data in payload */
    const { id } = await sendVerifyEmail(
      { to: debtorEmail, invoiceId, token, supplierName },
      resendKey
    );

    return NextResponse.json({
      success: true,
      emailId: id,
      message: `Verification email sent to ${debtorEmail.replace(/(.{2}).*(@.*)/, "$1***$2")}`,
    });

  } catch (e) {
    console.error("[send-verify-email] error:", e);
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
