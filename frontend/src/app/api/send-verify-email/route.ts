import { NextRequest, NextResponse } from "next/server";
import { createVerifyToken }         from "@/lib/tokenStore";
import { sendVerifyEmail }            from "@/lib/email";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const resendKey = process.env.RESEND_API_KEY?.trim() || undefined;

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

    console.log(`[send-verify-email] INV-${invoiceId} | to=${debtorEmail.replace(/(.{2}).*(@.*)/, "$1***$2")} | resendKey=${resendKey ? "SET" : "MISSING"}`);

    if (!resendKey) {
      console.warn("[send-verify-email] RESEND_API_KEY is not set or empty — email skipped. Add it in Vercel dashboard or .env.local.");
      return NextResponse.json({
        success: false,
        verifyUrl,
        error: "Email not configured — copy the verification link below to share with your debtor manually.",
      });
    }

    try {
      const { id } = await sendVerifyEmail(
        { to: debtorEmail, invoiceId, token, supplierName, invoiceNumber: `INV-${invoiceId}` },
        resendKey
      );

      console.log(`[send-verify-email] Sent OK | emailId=${id}`);
      return NextResponse.json({
        success: true,
        emailId: id,
        verifyUrl,
        message: `Verification email sent to ${debtorEmail.replace(/(.{2}).*(@.*)/, "$1***$2")}`,
      });
    } catch (emailError) {
      console.error("[send-verify-email] Resend API error:", emailError);
      return NextResponse.json({
        success: false,
        verifyUrl,
        error: `Resend delivery failed: ${String(emailError)}`,
      });
    }
  } catch (e) {
    console.error("[send-verify-email] Token generation error:", e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 502 });
  }
}
