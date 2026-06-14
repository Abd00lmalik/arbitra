import { NextRequest, NextResponse }            from "next/server";
import { validateVerifyToken, consumeVerifyToken } from "@/lib/tokenStore";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ valid: false }, { status: 400 });

  const { invoiceId, token, consume } = body as {
    invoiceId: number;
    token:     string;
    consume?:  boolean; /* true = one-time use: delete after validation */
  };

  if (!invoiceId || !token) {
    return NextResponse.json({ valid: false, error: "Missing params" }, { status: 400 });
  }

  const result = await validateVerifyToken(invoiceId, token);

  if (!result.valid) {
    return NextResponse.json({ valid: false, error: "Token invalid or expired" }, { status: 401 });
  }

  /* Mask email for display — never return full email to client */
  const maskedEmail = result.debtorEmail.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) =>
    a + "*".repeat(Math.max(1, b.length)) + c
  );

  return NextResponse.json({
    valid:       true,
    maskedEmail,
    emailHash:   result.emailHash, /* returned for on-chain commitment */
    faceValue:   result.faceValue,
    dueDate:     result.dueDate,
    invoiceNumber: result.invoiceNumber,
  });
}

