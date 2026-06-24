import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { ARBITRA_REGISTRY_ADDRESS } from "@/lib/contracts";
import { validateVerifyToken } from "@/lib/tokenStore";

export const runtime = "nodejs";

const LOCKBOX_BENEFICIARY = "Arbitra Factoring SPV";
const LOCKBOX_BANK = "Mock Settlement Bank";
const LOCKBOX_ROUTING = "021000021";
const LOCKBOX_ACCOUNT = "000417920514";
const DEFAULT_SETTLEMENT_CONTACT = "settlement@arbitra.mock";

type NoaPayload = {
  invoiceId: number;
  invoiceNumber: string;
  supplier: string;
  debtor: string;
  debtorEmail: string;
  faceValueDisplay: string;
  dueDateDisplay: string;
  verificationMethod: string;
  generatedAtUtc: string;
  paymentReference: string;
  assignmentHash: string;
  settlementInstructions: string;
  lockboxBank: string;
  lockboxBeneficiary: string;
  lockboxRouting: string;
  lockboxAccount: string;
};

function toDisplayDate(value: string) {
  if (!value) return "N/A";

  if (/^\d+$/.test(value)) {
    return new Date(Number(value) * 1000).toLocaleDateString();
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleDateString() : value;
}

function toFaceValueDisplay(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value || "0.00";
  return (numeric / 1_000_000).toFixed(2);
}

function buildAssignmentHash(parts: Array<string | number>) {
  return createHash("sha256").update(parts.join("|"), "utf8").digest("hex");
}

function buildLines(font: any, text: string, maxWidth: number, fontSize: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
      }
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function drawWrappedText(
  page: any,
  font: any,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  color: ReturnType<typeof rgb>,
  lineGap = 12,
) {
  const lines = buildLines(font, text, maxWidth, fontSize);
  let currentY = y;

  for (const line of lines) {
    page.drawText(line, {
      x,
      y: currentY,
      size: fontSize,
      font,
      color,
    });
    currentY -= lineGap;
  }

  return currentY;
}

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
  const invoiceNumberParam = searchParams.get("invoiceNumber");
  const paymentReferenceParam = searchParams.get("paymentReference");
  const generatedAtParam = searchParams.get("generatedAt");

  if (!invoiceIdStr) {
    return NextResponse.json({ error: "invoiceId required" }, { status: 400 });
  }

  const invoiceId = Number(invoiceIdStr);

  let debtorEmail = "";
  let faceValue = faceValueParam || "0";
  let dueDateStr = dueDateParam || "N/A";
  let supplier = supplierParam || "0x0000...0000";
  let debtor = debtorParam || "0x0000...0000";
  let method = isEmailVerified ? "Secure Email Attestation" : "EIP-712 Wallet Signature";
  let invoiceNumber = invoiceNumberParam || "";

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
      if (tokenResult.invoiceNumber) {
        invoiceNumber = tokenResult.invoiceNumber;
      }
      method = "Secure Email Attestation";
    }
  } else if (faceValueParam) {
    faceValue = toFaceValueDisplay(faceValueParam);
    dueDateStr = toDisplayDate(dueDateParam || "");
  }

  try {
    const generatedAtUtc = generatedAtParam || new Date().toISOString();
    const paymentReference = paymentReferenceParam || `ARB-LOCKBOX-INV-${invoiceId}`;
    const invoiceReference = invoiceNumber ? `${invoiceNumber} (ID #${invoiceId})` : `Invoice ID #${invoiceId}`;
    const assignmentHash = buildAssignmentHash([
      invoiceId,
      invoiceNumber || `INV-${invoiceId}`,
      supplier,
      debtor,
      faceValue,
      dueDateStr,
      paymentReference,
      ARBITRA_REGISTRY_ADDRESS,
    ]);
    const settlementInstructions = [
      `Remit full payment to ${LOCKBOX_BENEFICIARY} at ${LOCKBOX_BANK}.`,
      `Use payment reference ${paymentReference} on the wire or ACH memo.`,
      `Send settlement notices to ${DEFAULT_SETTLEMENT_CONTACT}.`,
    ].join(" ");
    const noaPayload: NoaPayload = {
      invoiceId,
      invoiceNumber: invoiceReference,
      supplier,
      debtor,
      debtorEmail,
      faceValueDisplay: faceValue,
      dueDateDisplay: dueDateStr,
      verificationMethod: method,
      generatedAtUtc,
      paymentReference,
      assignmentHash,
      settlementInstructions,
      lockboxBank: LOCKBOX_BANK,
      lockboxBeneficiary: LOCKBOX_BENEFICIARY,
      lockboxRouting: LOCKBOX_ROUTING,
      lockboxAccount: LOCKBOX_ACCOUNT,
    };

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
      "Accordingly, you are hereby instructed to direct all future payments under this invoice exclusively to the",
      "designated SPV lockbox settlement account. Payment to any other party does not discharge the obligation.",
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

    drawRow("Invoice Reference:", noaPayload.invoiceNumber, true);
    drawRow("Supplier (Assignor):", noaPayload.supplier);
    drawRow("Debtor Wallet / Email:", noaPayload.debtorEmail ? `${noaPayload.debtor} (${noaPayload.debtorEmail})` : noaPayload.debtor);
    drawRow("Receivables Face Value:", `$${noaPayload.faceValueDisplay} USDC`, true);
    drawRow("Maturity / Due Date:", noaPayload.dueDateDisplay);
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
    page.drawText(noaPayload.verificationMethod, { x: 180, y: currentY, size: 9.5, font: font, color: rgb(0.04, 0.08, 0.18) });

    currentY -= 15;
    page.drawText("Generated Timestamp:", { x: 40, y: currentY, size: 9.5, font: fontBold, color: rgb(0.48, 0.52, 0.6) });
    page.drawText(noaPayload.generatedAtUtc, { x: 180, y: currentY, size: 8.5, font: fontMono, color: rgb(0.04, 0.08, 0.18) });

    currentY -= 15;
    page.drawText("Attestation Status:", { x: 40, y: currentY, size: 9.5, font: fontBold, color: rgb(0.48, 0.52, 0.6) });
    page.drawText("CONFIRMED & FILED ON-CHAIN", { x: 180, y: currentY, size: 9.5, font: fontBold, color: rgb(0.02, 0.75, 0.45) });

    currentY -= 15;
    page.drawText("Assignment Hash:", { x: 40, y: currentY, size: 9.5, font: fontBold, color: rgb(0.48, 0.52, 0.6) });
    page.drawText(noaPayload.assignmentHash.slice(0, 36), { x: 180, y: currentY, size: 8, font: fontMono, color: rgb(0.04, 0.08, 0.18) });

    currentY -= 15;
    page.drawText("Payment Reference:", { x: 40, y: currentY, size: 9.5, font: fontBold, color: rgb(0.48, 0.52, 0.6) });
    page.drawText(noaPayload.paymentReference, { x: 180, y: currentY, size: 8.5, font: fontMono, color: rgb(0.04, 0.08, 0.18) });

    currentY -= 36;
    page.drawText("SETTLEMENT INSTRUCTIONS", {
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

    currentY -= 24;
    page.drawRectangle({
      x: 40,
      y: currentY - 100,
      width: width - 80,
      height: 95,
      color: rgb(0.97, 0.98, 0.99),
      borderColor: rgb(0.88, 0.91, 0.95),
      borderWidth: 1,
    });

    let lockboxY = currentY - 18;
    const drawInstructionRow = (label: string, value: string) => {
      page.drawText(label, {
        x: 55,
        y: lockboxY,
        size: 8.8,
        font: fontBold,
        color: rgb(0.48, 0.52, 0.6),
      });
      page.drawText(value, {
        x: 175,
        y: lockboxY,
        size: 8.8,
        font: fontMono,
        color: rgb(0.04, 0.08, 0.18),
      });
      lockboxY -= 15;
    };

    drawInstructionRow("Beneficiary:", noaPayload.lockboxBeneficiary);
    drawInstructionRow("Bank:", noaPayload.lockboxBank);
    drawInstructionRow("Routing:", noaPayload.lockboxRouting);
    drawInstructionRow("Account:", noaPayload.lockboxAccount);
    drawInstructionRow("Reference:", noaPayload.paymentReference);

    lockboxY -= 4;
    lockboxY = drawWrappedText(
      page,
      font,
      noaPayload.settlementInstructions,
      55,
      lockboxY,
      width - 110,
      8,
      rgb(0.24, 0.28, 0.36),
      10,
    );

    /* Legal Disclaimer Box */
    currentY = lockboxY - 28;
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
    const documentHash = createHash("sha256").update(Buffer.from(pdfBytes)).digest("hex");

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=Notice_of_Assignment_INV_${invoiceId}.pdf`,
        "X-Arbitra-Assignment-Hash": noaPayload.assignmentHash,
        "X-Arbitra-Document-Hash": documentHash,
      },
    });
  } catch (err: any) {
    console.error("Failed to generate PDF:", err);
    return NextResponse.json({ error: "PDF generation failed", details: err.message }, { status: 500 });
  }
}
