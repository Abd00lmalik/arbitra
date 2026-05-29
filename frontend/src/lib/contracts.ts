/**
 * Contract addresses and ABI for Arbitra.
 * Addresses sourced from NEXT_PUBLIC_ env vars (set after deployment).
 *
 * Payment token: cUSDT — official Confidential USDT from Zama Wrappers Registry.
 * Registry (Sepolia): 0x2f0750Bbb0A246059d80e94c454586a7F27a128e
 * Get test cUSDT by wrapping Sepolia USDT at: https://app.zama.ai
 */

export const ARBITRA_REGISTRY_ADDRESS =
  (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as `0x${string}`) ||
  ("0x0000000000000000000000000000000000000000" as `0x${string}`);

/** cUSDT — Confidential USDT ERC-7984 wrapper (resolved from Zama Wrappers Registry at deploy time) */
export const CUSDT_ADDRESS =
  (process.env.NEXT_PUBLIC_CUSDT_ADDRESS as `0x${string}`) ||
  ("0x0000000000000000000000000000000000000000" as `0x${string}`);

/** Zama Wrappers Registry address on Sepolia (read-only, for UI display) */
export const WRAPPERS_REGISTRY_ADDRESS = "0x2f0750Bbb0A246059d80e94c454586a7F27a128e" as `0x${string}`;

/**
 * URL for getting test cUSDT on Sepolia.
 * Users wrap Sepolia USDT → cUSDT via the Zama Portfolio app.
 */
export const CUSDT_FAUCET_URL = "https://app.zama.ai";

export const ARBITRA_REGISTRY_ABI = [
  /* ── View ── */
  {
    name: "invoiceCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "invoices",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [
      { name: "faceValue", type: "bytes32" },
      { name: "dueDate", type: "bytes32" },
      { name: "purchasePrice", type: "bytes32" },
      { name: "discountRate", type: "bytes32" },
      { name: "supplier", type: "address" },
      { name: "investor", type: "address" },
      { name: "buyer", type: "address" },
      { name: "isFactored", type: "bool" },
      { name: "isRepaid", type: "bool" },
      { name: "uploadTimestamp", type: "uint256" },
    ],
  },
  {
    name: "getAllInvoiceIds",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "ids", type: "uint256[]" }],
  },
  {
    name: "getSupplierInvoices",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "supplier", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "getInvestorInvoices",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "investor", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "getInvoiceHandles",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [
      { name: "faceValueHandle", type: "bytes32" },
      { name: "dueDateHandle", type: "bytes32" },
      { name: "purchasePriceHandle", type: "bytes32" },
      { name: "discountRateHandle", type: "bytes32" },
    ],
  },
  {
    name: "getSupplierRatioHandle",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "supplier", type: "address" }],
    outputs: [{ name: "ratioHandle", type: "bytes32" }],
  },
  {
    name: "supplierStats",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "supplier", type: "address" }],
    outputs: [
      { name: "totalInvoices", type: "bytes32" },
      { name: "repaidInvoices", type: "bytes32" },
      { name: "repaymentRatioBps", type: "bytes32" },
      { name: "initialized", type: "bool" },
    ],
  },
  {
    name: "isInvestorApproved",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "investor", type: "address" }],
    outputs: [{ name: "approved", type: "bool" }],
  },
  /* ── Write ── */
  {
    name: "uploadInvoice",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encFaceValue", type: "bytes32" },
      { name: "proofFaceValue", type: "bytes" },
      { name: "encDueDate", type: "bytes32" },
      { name: "proofDueDate", type: "bytes" },
      { name: "buyer", type: "address" },
    ],
    outputs: [{ name: "invoiceId", type: "uint256" }],
  },
  {
    name: "factorInvoice",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "triggerRepayment",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "grantRiskAssessmentAccess",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [],
  },
  /* ── Events ── */
  {
    name: "InvoiceUploaded",
    type: "event",
    inputs: [
      { name: "invoiceId", type: "uint256", indexed: true },
      { name: "supplier", type: "address", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    name: "InvoiceFactored",
    type: "event",
    inputs: [
      { name: "invoiceId", type: "uint256", indexed: true },
      { name: "investor", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    name: "InvoiceRepaid",
    type: "event",
    inputs: [
      { name: "invoiceId", type: "uint256", indexed: true },
      { name: "supplier", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  /* ── Custom Errors ── */
  {
    name: "InvestorNotApprovedOperator",
    type: "error",
    inputs: [
      { name: "investor", type: "address" },
      { name: "registry", type: "address" },
    ],
  },
] as const;

/**
 * Minimal ERC-7984 ABI for cUSDT interactions from the frontend.
 * Used by the "Approve & Factor" flow to call setOperator on cUSDT.
 */
export const CUSDT_ABI = [
  {
    name: "setOperator",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "until", type: "uint48" },
    ],
    outputs: [],
  },
  {
    name: "isOperator",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "holder", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "confidentialBalanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

/** Invoice data shape from chain (handles are bytes32 opaque) */
export interface InvoiceOnChain {
  invoiceId: bigint;
  faceValue: `0x${string}`;
  dueDate: `0x${string}`;
  purchasePrice: `0x${string}`;
  discountRate: `0x${string}`;
  supplier: `0x${string}`;
  investor: `0x${string}`;
  buyer: `0x${string}`;
  isFactored: boolean;
  isRepaid: boolean;
  uploadTimestamp: bigint;
}

/** Decoded invoice with plaintext FHE fields (after userDecrypt) */
export interface InvoiceDecoded extends InvoiceOnChain {
  faceValueClear?: bigint;
  dueDateClear?: bigint;
  purchasePriceClear?: bigint;
  discountRateClear?: bigint;
}

/** Format cUSDT micro-unit amount as readable USDT string */
export function formatCUSDT(microUnits: bigint | undefined): string {
  if (microUnits === undefined) return "—";
  const dollars = Number(microUnits) / 1_000_000;
  return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} cUSDT`;
}

/** @deprecated Use formatCUSDT */
export const formatCUSDC = formatCUSDT;

/** Format a Unix timestamp as locale date string */
export function formatTimestamp(ts: bigint | number | undefined): string {
  if (ts === undefined) return "—";
  return new Date(Number(ts) * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Format BPS discount rate */
export function formatBps(bps: bigint | undefined): string {
  if (bps === undefined) return "—";
  return `${(Number(bps) / 100).toFixed(2)}%`;
}

/** Days until due date from now */
export function daysUntilDue(dueTimestamp: bigint | undefined): number {
  if (dueTimestamp === undefined) return 0;
  const nowSec = Math.floor(Date.now() / 1000);
  const diff = Number(dueTimestamp) - nowSec;
  return Math.max(0, Math.floor(diff / 86400));
}

/** Short address display */
export function shortAddress(addr: string): string {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/** Default operator approval duration: 7 days in seconds */
export const DEFAULT_OPERATOR_EXPIRY_SECONDS = 7 * 24 * 60 * 60;
