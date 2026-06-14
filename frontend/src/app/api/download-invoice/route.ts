import { NextRequest, NextResponse } from "next/server";
import { validateVerifyToken } from "@/lib/tokenStore";
import { getInvoicePdf } from "@/lib/pdfStore";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const invoiceIdStr = searchParams.get("invoiceId");
  const token = searchParams.get("token");

  if (!invoiceIdStr) {
    return NextResponse.json({ error: "invoiceId required" }, { status: 400 });
  }

  const invoiceId = Number(invoiceIdStr);

  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 401 });
  }

  // Authenticate access using the verification token
  const tokenResult = await validateVerifyToken(invoiceId, token);
  if (!tokenResult.valid) {
    return NextResponse.json({ error: "Invalid token or unauthorized access" }, { status: 401 });
  }

  const pdfBase64 = await getInvoicePdf(invoiceId);
  if (!pdfBase64) {
    return NextResponse.json({ error: "Original invoice PDF not found" }, { status: 404 });
  }

  const pdfBuffer = Buffer.from(pdfBase64, "base64");
  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=Invoice_${invoiceId}.pdf`,
    },
  });
}
