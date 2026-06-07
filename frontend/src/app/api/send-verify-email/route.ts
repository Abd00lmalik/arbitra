import { NextRequest, NextResponse } from "next/server";
import { createVerifyToken }         from "@/lib/tokenStore";
import { sendVerifyEmail }            from "@/lib/email";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const resendKey = process.env.RESEND_API_KEY;

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

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://arbitra-dapp.vercel.app";
    const token = await createVerifyToken(invoiceId, debtorEmail, faceValue, dueDate);
    const verifyUrl = `${appUrl}/verify/${invoiceId}?token=${token}`;

    if (!resendKey) {
      return NextResponse.json({
        success: false,
        verifyUrl,
        error: "RESEND_API_KEY not configured",
      });
    }

    try {
      const { id } = await sendVerifyEmail(
        { to: debtorEmail, invoiceId, token, supplierName },
        resendKey
      );

      return NextResponse.json({
        success: true,
        emailId: id,
        verifyUrl,
        message: `Verification email sent to ${debtorEmail.replace(/(.{2}).*(@.*)/, "$1***$2")}`,
      });
    } catch (emailError) {
      console.error("[send-verify-email] email error:", emailError);
      return NextResponse.json({
        success: false,
        verifyUrl,
        error: String(emailError),
      });
    }
  } catch (e) {
    console.error("[send-verify-email] token error:", e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 502 });
  }
}
