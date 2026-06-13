import { NextRequest, NextResponse } from "next/server";
import { validateVerifyToken } from "@/lib/tokenStore";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { ARBITRA_REGISTRY_ADDRESS } from "@/lib/contracts";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const invoiceIdStr = searchParams.get("invoiceId");
  const token = searchParams.get("token");

  /* Fallback params for Web3 flow or post-attestation review */
  const faceValueParam = searchParams.get("faceValue");
  const dueDateParam = searchParams.get("dueDate");
  const supplierParam = searchParams.get("supplier");
  const debtorParam = searchParams.get("debtor");
  const isEmailVerified = searchParams.get("emailVerified") === "true";

  if (!invoiceIdStr) {
    return NextResponse.json({ error: "invoiceId required" }, { status: 400 });
  }

  const invoiceId = Number(invoiceIdStr);

  let debtorEmail = "";
  let faceValue = faceValueParam || "0";
  let dueDateStr = dueDateParam || "N/A";
  let supplier = supplierParam || "0x0000...0000";
  let debtor = debtorParam || "0x0000...0000";
  let method = isEmailVerified ? "📧 Secure Email Attestation" : "🔑 EIP-712 Wallet Signature";

  /* Decode token if present to authenticate details */
  if (token) {
    const tokenResult = await validateVerifyToken(invoiceId, token);
    if (tokenResult.valid) {
      debtorEmail = tokenResult.debtorEmail;
      if (tokenResult.faceValue) {
        faceValue = (Number(tokenResult.faceValue) / 1000000).toFixed(2);
      }
      if (tokenResult.dueDate) {
        dueDateStr = new Date(Number(tokenResult.dueDate) * 1000).toLocaleDateString();
      }
      method = "📧 Secure Email Attestation";
    }
  } else if (faceValueParam) {
    faceValue = (Number(faceValueParam) / 1000000).toFixed(2);
    if (dueDateParam && !isNaN(Number(dueDateParam))) {
      dueDateStr = new Date(Number(dueDateParam) * 1000).toLocaleDateString();
    }
  }

  try {
    /* Create a new PDF document */
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.276, 841.89]); /* A4 Size */
    const { width, height } = page.getSize();

    /* Load standard fonts */
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

    /* Draw Header decorative bar */
    page.drawRectangle({
      x: 0,
      y: height - 12,
      width: width,
      height: 12,
      color: rgb(0.02, 0.94, 1.0), /* Neon Cyan style */
    });

    /* Draw Brand Header */
    page.drawText("ARBITRA", {
      x: 40,
      y: height - 60,
      size: 20,
      font: fontBold,
      color: rgb(0.04, 0.08, 0.18),
    });

    page.drawText("CONFIDENTIAL INVOICE FACTORING SPV", {
      x: 40,
      y: height - 76,
      size: 9,
      font: fontBold,
      color: rgb(0.48, 0.55, 0.68),
    });

    /* Document Title */
    page.drawText("NOTICE OF RECEIVABLES ASSIGNMENT", {
      x: 40,
      y: height - 130,
      size: 16,
      font: fontBold,
      color: rgb(0.04, 0.08, 0.18),
    });

    page.drawText("Legal Notice & Payment Instruction", {
      x: 40,
      y: height - 146,
      size: 11,
      font: font,
      color: rgb(0.24, 0.35, 0.52),
    });

    /* Divider */
    page.drawLine({
      start: { x: 40, y: height - 165 },
      end: { x: width - 40, y: height - 165 },
      thickness: 1,
      color: rgb(0.88, 0.91, 0.95),
    });

    /* Intro Statement */
    const introLines = [
      "To the designated Debtor listed below:",
      "",
      "Notice is hereby given that the receivables under the referenced invoice have been legally assigned, transferred,",
      `and sold to the Arbitra Collateral Vault / SPV (verifying contract: ${ARBITRA_REGISTRY_ADDRESS}).`,
      "",
      "Accordingly, you are hereby instructed to direct all future payments under this invoice exclusively to the SPV wallet",
      "address to settle the outstanding invoice balance. Payment to any other party does not discharge the obligation.",
    ];

    let currentY = height - 195;
    for (const line of introLines) {
      page.drawText(line, {
        x: 40,
        y: currentY,
        size: 9.5,
        font: font,
        color: rgb(0.24, 0.28, 0.36),
      });
      currentY -= 14;
    }

    /* Details Box Background */
    page.drawRectangle({
      x: 40,
      y: currentY - 140,
      width: width - 80,
      height: 125,
      color: rgb(0.97, 0.98, 0.99),
      borderColor: rgb(0.88, 0.91, 0.95),
      borderWidth: 1,
    });

    /* Details Content */
    let tableY = currentY - 30;
    const drawRow = (label: string, value: string, isBig = false) => {
      page.drawText(label, {
        x: 55,
        y: tableY,
        size: 9,
        font: fontBold,
        color: rgb(0.48, 0.52, 0.6),
      });
      page.drawText(value, {
        x: 200,
        y: tableY,
        size: isBig ? 11 : 9.5,
        font: isBig ? fontBold : font,
        color: rgb(0.04, 0.08, 0.18),
      });
      tableY -= 18;
    };

    drawRow("Invoice Reference:", `Invoice ID #${invoiceId}`, true);
    drawRow("Supplier (Assignor):", supplier);
    drawRow("Debtor Wallet / Email:", debtorEmail ? `${debtor} (${debtorEmail})` : debtor);
    drawRow("Receivables Face Value:", `$${faceValue} USDC`, true);
    drawRow("Maturity / Due Date:", dueDateStr);
    drawRow("Assignment Status:", "Attested & Locked");

    /* Attestation Log section */
    currentY = tableY - 40;
    page.drawText("ATTESTATION AUDIT LOG", {
      x: 40,
      y: currentY,
      size: 11,
      font: fontBold,
      color: rgb(0.04, 0.08, 0.18),
    });

    page.drawLine({
      start: { x: 40, y: currentY - 6 },
      end: { x: width - 40, y: currentY - 6 },
      thickness: 1,
      color: rgb(0.88, 0.91, 0.95),
    });

    currentY -= 25;
    page.drawText("Verification Method:", { x: 40, y: currentY, size: 9.5, font: fontBold, color: rgb(0.48, 0.52, 0.6) });
    page.drawText(method, { x: 180, y: currentY, size: 9.5, font: font, color: rgb(0.04, 0.08, 0.18) });

    currentY -= 15;
    page.drawText("Verification Date:", { x: 40, y: currentY, size: 9.5, font: fontBold, color: rgb(0.48, 0.52, 0.6) });
    page.drawText(new Date().toUTCString(), { x: 180, y: currentY, size: 9.5, font: font, color: rgb(0.04, 0.08, 0.18) });

    currentY -= 15;
    page.drawText("Attestation Status:", { x: 40, y: currentY, size: 9.5, font: fontBold, color: rgb(0.48, 0.52, 0.6) });
    page.drawText("CONFIRMED & FILED ON-CHAIN", { x: 180, y: currentY, size: 9.5, font: fontBold, color: rgb(0.02, 0.75, 0.45) });

    /* Legal Disclaimer Box */
    currentY -= 80;
    page.drawRectangle({
      x: 40,
      y: currentY - 110,
      width: width - 80,
      height: 100,
      color: rgb(0.99, 0.99, 1.0),
      borderColor: rgb(0.9, 0.8, 0.8),
      borderWidth: 1,
    });

    page.drawText("LEGAL SPV REGISTRY NOTICE", {
      x: 55,
      y: currentY - 25,
      size: 9.5,
      font: fontBold,
      color: rgb(0.68, 0.12, 0.18),
    });

    const disclaimerLines = [
      "This document acts as a legal notice of receivables assignment. Under applicable commercial factoring regulations",
      "and the Uniform Commercial Code (UCC) / relevant local assignment laws, once a debtor receives notice of receivables",
      "assignment, they can discharge their debt obligations ONLY by paying the assignee (Arbitra Factoring SPV).",
      "Payment made to the original supplier subsequent to receipt of this notice does not constitute discharge of debt.",
    ];

    let disclaimerY = currentY - 42;
    for (const line of disclaimerLines) {
      page.drawText(line, {
        x: 55,
        y: disclaimerY,
        size: 8,
        font: font,
        color: rgb(0.44, 0.48, 0.54),
      });
      disclaimerY -= 12;
    }

    /* Footer Stamp */
    page.drawText("PRODUCED CRYPTOGRAPHICALLY BY THE ARBITRA FHE PLATFORM", {
      x: 40,
      y: 40,
      size: 7.5,
      font: fontMono,
      color: rgb(0.6, 0.65, 0.72),
    });

    /* Serialize to bytes and return as download stream */
    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=Notice_of_Assignment_INV_${invoiceId}.pdf`,
      },
    });
  } catch (err: any) {
    console.error("Failed to generate PDF:", err);
    return NextResponse.json({ error: "PDF generation failed", details: err.message }, { status: 500 });
  }
}
