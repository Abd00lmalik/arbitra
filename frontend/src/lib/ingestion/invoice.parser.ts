/*
 * @file invoice.parser.ts
 * @description Parses invoice text deterministically with regexes and validation heuristics only.
 */

import type { InvoiceDraft, InvoiceFields, InvoiceLineItem } from "./types";

const currencyPattern = /(?:\bUSD\b|US\$|\$|\btotal\s+due\b|\bamount\s+due\b|\bbalance\s+due\b|\bgrand\s+total\b|\btotal\b)/i;
const totalAmountPatterns = [
  /(?:total\s+due|amount\s+due|balance\s+due|grand\s+total|invoice\s+total|total)(?:\s*\([A-Z]{3}\))?[\s:]*\$?\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/i,
  /(?:total\s+due|amount\s+due|balance\s+due|grand\s+total|invoice\s+total|total)[\s:]*[A-Z]{3}\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/i,
  /(?:USD|US\$)\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/i,
  /\$\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/i,
];
const fullTextAmountPatterns = [
  /(?:total\s+due|amount\s+due|balance\s+due|grand\s+total|invoice\s+total|total)(?:\s*\([A-Z]{3}\))?[\s:]*\$?\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/i,
  /(?:total\s+due|amount\s+due|balance\s+due|grand\s+total|invoice\s+total|total)[\s:]*[A-Z]{3}\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/i,
  /(?:USD|US\$)\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/i,
];
const dueDatePatterns = [
  /(?:due\s+date|payment\s+due|maturity\s+date|pay(?:ment)?\s+by)[:\s]*([0-9]{4}-[0-9]{2}-[0-9]{2})/i,
  /(?:due\s+date|payment\s+due|maturity\s+date|pay(?:ment)?\s+by)[:\s]*([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})/i,
  /(?:due\s+date|payment\s+due|maturity\s+date|pay(?:ment)?\s+by)[:\s]*([A-Za-z]{3,9}\s+[0-9]{1,2},?\s+[0-9]{4})/i,
];
const issueDatePatterns = [
  /(?:issue\s+date|invoice\s+date|date)[:\s]*([0-9]{4}-[0-9]{2}-[0-9]{2})/i,
  /(?:issue\s+date|invoice\s+date|date)[:\s]*([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})/i,
  /(?:issue\s+date|invoice\s+date|date)[:\s]*([A-Za-z]{3,9}\s+[0-9]{1,2},?\s+[0-9]{4})/i,
];
const invoicePatterns = [
  /(?:invoice\s*(?:number|no\.?|#)|inv\s*#)[:\s]*([A-Z0-9][A-Z0-9\-\/]{2,})/i,
  /\bINV[-\/][A-Z0-9][A-Z0-9\-\/]{2,}\b/i,
  /\b[A-Z]{2,6}[-\/][0-9]{2,}(?:[-\/][A-Z0-9]+)*\b/i,
];
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

/**
 * Normalize whitespace to improve deterministic regex parsing.
 *
 * @param text Free-form extracted text.
 * @returns Normalized text.
 */
function normalizeText(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]{3,}/g, "  ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Convert common date strings into ISO YYYY-MM-DD.
 *
 * @param input Raw date string.
 * @returns ISO date if parseable, otherwise null.
 */
function normalizeDate(input: string | null): string | null {
  if (!input) {
    return null;
  }

  const value = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  if (/^\d{2}[\/-]\d{2}[\/-]\d{4}$/.test(value)) {
    const [first, second, year] = value.split(/[\/-]/);
    return `${expandYear(year)}-${first.padStart(2, "0")}-${second.padStart(2, "0")}`;
  }

  const monthMatch = value.match(/^([A-Za-z]{3,9})\s+([0-9]{1,2}),?\s+([0-9]{4})$/);
  if (monthMatch) {
    const month = monthNumber(monthMatch[1]);
    if (month) {
      return `${monthMatch[3]}-${month}-${monthMatch[2].padStart(2, "0")}`;
    }
  }

  const parsedDate = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString().slice(0, 10);
}

function expandYear(year: string): string {
  return year.length === 2 ? `20${year}` : year;
}

function monthNumber(month: string): string | null {
  const index = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ].findIndex((candidate) => month.toLowerCase().startsWith(candidate));

  return index >= 0 ? String(index + 1).padStart(2, "0") : null;
}

/**
 * Pull the first matching group from a list of patterns.
 *
 * @param text Source text.
 * @param patterns Regex patterns with a capturing group.
 * @returns Captured text if found.
 */
function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }

    if (match?.[0] && pattern !== invoicePatterns[0]) {
      return match[0].trim();
    }
  }

  return null;
}

/**
 * Parse a money string into a floating point dollar amount.
 *
 * @param value Source amount string.
 * @returns Parsed amount or null.
 */
function parseAmount(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/[^0-9.]/g, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseTotalAmount(text: string, lineItems: InvoiceLineItem[]): number | null {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const totalLines = lines.filter((line) =>
    /\b(total\s+due|amount\s+due|balance\s+due|grand\s+total|invoice\s+total|total)\b/i.test(line) &&
    !/\b(subtotal|tax|vat|discount|paid)\b/i.test(line)
  );

  for (const line of totalLines) {
    const amount = firstAmount(line, totalAmountPatterns);
    if (amount !== null) {
      return amount;
    }
  }

  const labeledAmount = firstAmount(text, fullTextAmountPatterns);
  if (labeledAmount !== null) {
    return labeledAmount;
  }

  return lineItems.length > 0
    ? Number(lineItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2))
    : null;
}

function firstAmount(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const amount = parseAmount(text.match(pattern)?.[1] ?? null);
    if (amount !== null) {
      return amount;
    }
  }

  return null;
}

/**
 * Extract simple line items from invoice text.
 *
 * @param text Source invoice text.
 * @returns Deterministically parsed line items.
 */
function parseLineItems(text: string): InvoiceLineItem[] {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const items: InvoiceLineItem[] = [];

  for (const line of lines) {
    const match = line.match(/^(.{3,}?)\s+\$?([0-9][0-9,]*(?:\.[0-9]{2}))$/);
    if (!match) {
      continue;
    }

    const amount = parseAmount(match[2]);
    if (amount === null) {
      continue;
    }

    items.push({
      description: match[1].trim(),
      amount,
    });
  }

  return items.slice(0, 12);
}

function sectionAfter(text: string, labels: RegExp[], stopLabels: RegExp[]): string {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const start = lines.findIndex((line) => labels.some((label) => label.test(line)));

  if (start < 0) {
    return "";
  }

  const collected: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (stopLabels.some((label) => label.test(line))) {
      break;
    }

    collected.push(line);
  }

  return collected.join(" ").trim();
}

function compactEmail(text: string): string {
  return text
    .replace(/([A-Z0-9._%+-]+@[A-Z0-9.-]+)\s+([A-Z]{2,})(?=\s|$)/gi, "$1$2")
    .replace(/([A-Z0-9._%+-]+@[A-Z0-9.-]+)\s+([A-Z0-9.-]+\.[A-Z]{2,})(?=\s|$)/gi, "$1$2");
}

function firstNonEmptyLine(value: string): string {
  return value.split(/\n| {2,}/).map((line) => line.trim()).find(Boolean) ?? value.trim();
}

function trimInvoiceMetadata(value: string): string {
  return value
    .replace(/\s+(?:invoice\s+number|invoice\s+date|due\s+date|payment\s+terms):.*$/i, "")
    .trim();
}

function likelyBusinessName(value: string): string {
  const cleaned = trimInvoiceMetadata(value);
  return cleaned
    .split(/\s{2,}|\s+(?=Invoice\s+(?:Number|Date)|Due\s+Date|Payment\s+Terms)/i)
    .map((part) => part.trim())
    .find(Boolean) ?? cleaned;
}

function splitColumnSegments(line: string): string[] {
  return line.split(/\s{2,}/).map((part) => part.trim()).filter(Boolean);
}

function twoColumnPartySections(text: string): { supplier: string; debtor: string } {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const headerIndex = lines.findIndex((line) => /\bbill\s+from\b/i.test(line) && /\bbill\s+to\b/i.test(line));

  if (headerIndex < 0) {
    return { supplier: "", debtor: "" };
  }

  const supplier: string[] = [];
  const debtor: string[] = [];

  for (const line of lines.slice(headerIndex + 1)) {
    if (/^(description|item|subtotal|total|note|payment\s+instructions)\b/i.test(line)) {
      break;
    }

    const segments = splitColumnSegments(line);
    if (segments[0] && !/^(invoice|due date|payment terms)\b/i.test(segments[0])) {
      supplier.push(segments[0]);
    }

    if (segments[1] && !/^(invoice|due date|payment terms)\b/i.test(segments[1])) {
      debtor.push(segments[1]);
    }
  }

  return {
    supplier: supplier.join(" ").trim(),
    debtor: debtor.join(" ").trim(),
  };
}

/**
 * Parse supplier and debtor names from labeled lines.
 *
 * @param text Source text.
 * @returns Parsed party names and email hints.
 */
function parseParties(text: string): {
  supplierName: string;
  debtorName: string;
  debtorEmail: string;
  supplierTaxId: string;
  debtorTaxId: string;
  debtorAddress: string;
} {
  const labeledValue = (patterns: RegExp[]) => firstMatch(text, patterns) ?? "";
  const columns = twoColumnPartySections(text);
  const billFrom = sectionAfter(text, [/^bill\s+from\b/i, /^from\b/i], [
    /^bill\s+to\b/i,
    /^ship\s+to\b/i,
    /^description\b/i,
    /^item\b/i,
  ]);
  const billTo = sectionAfter(text, [/^bill\s+to\b/i, /^sold\s+to\b/i, /^customer\b/i], [
    /^description\b/i,
    /^item\b/i,
    /^subtotal\b/i,
    /^total\b/i,
    /^payment\b/i,
  ]);
  const searchable = compactEmail(text);
  const billToEmail = compactEmail(billTo).match(emailPattern)?.[0] ?? "";
  const columnDebtorEmail = compactEmail(columns.debtor).match(emailPattern)?.[0] ?? "";

  return {
    supplierName: likelyBusinessName(firstNonEmptyLine(columns.supplier)) || likelyBusinessName(firstNonEmptyLine(billFrom)) || labeledValue([
      /(?:supplier|seller|vendor|from)[:\s]*([^\n]+)/i,
      /bill\s+from[:\s]*([^\n]+)/i,
    ]),
    debtorName: likelyBusinessName(firstNonEmptyLine(columns.debtor)) || likelyBusinessName(firstNonEmptyLine(billTo)) || labeledValue([
      /(?:debtor|buyer|customer|bill\s+to|sold\s+to|to)[:\s]*([^\n]+)/i,
    ]),
    debtorEmail: columnDebtorEmail || billToEmail || labeledValue([
      /(?:debtor\s+email|buyer\s+email|customer\s+email|email)[:\s]*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
    ]) || (searchable.match(emailPattern)?.[0] ?? ""),
    supplierTaxId: labeledValue([
      /(?:supplier\s+tax\s+id|seller\s+tax\s+id|vendor\s+tax\s+id|supplier\s+tin)[:\s]*([A-Z0-9\-]+)/i,
    ]),
    debtorTaxId: labeledValue([
      /(?:debtor\s+tax\s+id|buyer\s+tax\s+id|customer\s+tax\s+id|debtor\s+tin)[:\s]*([A-Z0-9\-]+)/i,
    ]),
    debtorAddress: labeledValue([
      /(?:debtor\s+wallet|buyer\s+wallet|debtor\s+address|wallet\s+address)[:\s]*(0x[a-fA-F0-9]{40})/i,
    ]),
  };
}

/**
 * Convert a parsed draft into the legacy invoice field shape expected by upload flows.
 *
 * @param text Source invoice text.
 * @param draft Deterministic draft output.
 * @returns Legacy-compatible invoice fields.
 */
export function buildInvoiceFields(text: string, draft: InvoiceDraft): InvoiceFields {
  const normalized = normalizeText(text);
  const parties = parseParties(normalized);
  const issueDate = normalizeDate(firstMatch(normalized, issueDatePatterns)) ?? "";
  const totalAmountCents = draft.faceValue !== null ? Math.round(draft.faceValue * 100) : 0;

  return {
    invoiceNumber: draft.invoiceId ?? "",
    issueDate,
    maturityDate: draft.dueDate ?? "",
    totalAmountCents,
    currency: "USD",
    debtorName: draft.debtor ?? parties.debtorName,
    debtorEmail: parties.debtorEmail,
    debtorTaxId: parties.debtorTaxId,
    supplierName: draft.supplier ?? parties.supplierName,
    supplierTaxId: parties.supplierTaxId,
    debtorAddress: parties.debtorAddress,
  };
}

/**
 * Parse deterministic invoice fields from extracted text.
 *
 * @param rawText Extracted raw text.
 * @param method Extraction method label.
 * @param confidence Confidence score for the extraction phase.
 * @param rawTextHash Stable hash of the source text.
 * @returns Structured invoice draft.
 */
export function parseInvoiceText(
  rawText: string,
  method: InvoiceDraft["extractionMeta"]["method"],
  confidence: number,
  rawTextHash: string,
): InvoiceDraft {
  const text = normalizeText(rawText);
  const invoiceId = firstMatch(text, invoicePatterns);
  const dueDate = normalizeDate(firstMatch(text, dueDatePatterns));
  const parties = parseParties(text);
  const lineItems = parseLineItems(text);
  const faceValue = parseTotalAmount(text, lineItems);

  const status = invoiceId && dueDate && faceValue !== null ? "success" : "incomplete";

  return {
    invoiceId,
    supplier: parties.supplierName || null,
    debtor: parties.debtorName || null,
    faceValue,
    dueDate,
    lineItems,
    extractionMeta: {
      method,
      confidence,
      rawTextHash,
    },
    status,
  };
}

/**
 * Validate whether extracted text is good enough to parse directly.
 *
 * @param rawText Candidate extracted text.
 * @returns Validation result for the fallback controller.
 */
export function validateExtractionText(rawText: string): { isValid: boolean; issues: string[] } {
  const normalized = normalizeText(rawText);
  const issues: string[] = [];

  if (normalized.length < 80) {
    issues.push("Extracted text is too short.");
  }

  if (!firstMatch(normalized, invoicePatterns)) {
    issues.push("Invoice number was not found.");
  }

  if (!firstMatch(normalized, dueDatePatterns)) {
    issues.push("Due date was not found.");
  }

  if (!currencyPattern.test(normalized) || parseTotalAmount(normalized, parseLineItems(normalized)) === null) {
    issues.push("Invoice amount was not found.");
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}
