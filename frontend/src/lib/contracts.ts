/*
 * @file contracts.ts
 * @description Arbitra contract addresses, ABIs, and helper utilities.
 *              All dynamic addresses are fetched from NEXT_PUBLIC_* environment variables.
 */

export const ARBITRA_REGISTRY_ADDRESS = (
  process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ?? "0x0000000000000000000000000000000000000000"
) as `0x${string}`;

/*
 * Confidential USDC - ERC-7984 wrapped USDC from Zama Wrappers Registry.
 * Underlying: USDC 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
 * Registry:   0x2f0750Bbb0A246059d80e94c454586a7F27a128e
 */
export const CUSDC_ADDRESS = (
  process.env.NEXT_PUBLIC_CUSDC_ADDRESS ?? "0x0000000000000000000000000000000000000000"
) as `0x${string}`;

/* Deprecated: Use CUSDC_ADDRESS */
export const CUSDT_ADDRESS = CUSDC_ADDRESS;

/* Underlying USDC address (Circle official or mock) */
export const USDC_ADDRESS = (
  process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
) as `0x${string}`;

/* Collateral Vault address */
export const COLLATERAL_VAULT_ADDRESS = (
  process.env.NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS ?? "0x0000000000000000000000000000000000000000"
) as `0x${string}`;

/* Escrow Receiver address */
export const ESCROW_RECEIVER_ADDRESS = (
  process.env.NEXT_PUBLIC_ESCROW_RECEIVER_ADDRESS ?? "0x0000000000000000000000000000000000000000"
) as `0x${string}`;

/* Zama Wrappers Registry */
export const WRAPPERS_REGISTRY_ADDRESS = "0x2f0750Bbb0A246059d80e94c454586a7F27a128e" as const;
export const WRAPPERS_REGISTRY = WRAPPERS_REGISTRY_ADDRESS;

export const SEPOLIA_CHAIN_ID = 11155111;
export const ETHERSCAN_BASE = "https://sepolia.etherscan.io";
export const TOKEN_DECIMALS = 6; /* USDC uses 6 decimals */
export const TOKEN_SYMBOL = "USDC";
export const CTOKEN_SYMBOL = "cUSDC";

/* Convert USDC human amount (e.g. 1000.50) to micro-units (bigint) */
export function toMicroUnits(humanAmount: number): bigint {
  return BigInt(Math.round(humanAmount * 10 ** TOKEN_DECIMALS));
}

/* Convert micro-units (bigint) to human USDC string */
export function fromMicroUnits(micro: bigint): string {
  const n = Number(micro) / 10 ** TOKEN_DECIMALS;
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* Format cUSDC/cUSDT micro-unit amount as readable string */
export function formatCUSDC(microUnits: bigint | undefined): string {
  if (microUnits === undefined) return "—";
  const dollars = Number(microUnits) / 10 ** TOKEN_DECIMALS;
  return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} cUSDC`;
}

/* Deprecated: Use formatCUSDC */
export const formatCUSDT = formatCUSDC;

/* Format a Unix timestamp as locale date string */
export function formatTimestamp(ts: bigint | number | undefined): string {
  if (ts === undefined) return "—";
  return new Date(Number(ts) * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* Format BPS discount rate */
export function formatBps(bps: bigint | undefined): string {
  if (bps === undefined) return "—";
  return `${(Number(bps) / 100).toFixed(2)}%`;
}

/* Days until due date from now */
export function daysUntilDue(dueTimestamp: bigint | undefined): number {
  if (dueTimestamp === undefined) return 0;
  const nowSec = Math.floor(Date.now() / 1000);
  const diff = Number(dueTimestamp) - nowSec;
  return Math.max(0, Math.floor(diff / 86400));
}

/* Truncate an Ethereum address for display: 0x1234...5678 */
export function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/* Short address display */
export function shortAddress(addr: string): string {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export const DEFAULT_OPERATOR_EXPIRY_SECONDS = 365 * 24 * 60 * 60; /* Set long default expiry */

/* InvoiceStatus enum matching Solidity */
export enum InvoiceStatus {
  Pending = 0,
  Attested = 1,
  Factored = 2,
  Settled = 3,
  Disputed = 4,
  Slashed = 5
}

/* Invoice data shape from chain (handles are bytes32 opaque) */
export interface InvoiceOnChain {
  invoiceId: bigint;
  faceValue: `0x${string}`;
  dueDate: `0x${string}`;
  purchasePrice: `0x${string}`;
  discountRateBps: `0x${string}`;
  fingerprintHash: `0x${string}`;
  supplier: `0x${string}`;
  investor: `0x${string}`;
  debtor: `0x${string}`;
  uploadTimestamp: bigint;
  maturityTimestamp: bigint;
  status: InvoiceStatus;
  geminiUnderwritingEnabled: boolean;
  debtorAttestationHash: `0x${string}`;
  collateralStaked: boolean;
}

/* Decoded invoice with plaintext FHE fields (after userDecrypt) */
export interface InvoiceDecoded extends InvoiceOnChain {
  faceValueClear?: bigint;
  dueDateClear?: bigint;
  purchasePriceClear?: bigint;
  discountRateClear?: bigint;
  fingerprintClear?: bigint;
}

/* ABIs */

export const REGISTRY_ABI = [
  /* uploadInvoice */
  {
    type: "function", name: "uploadInvoice",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encFaceValue",       type: "bytes32" },
      { name: "proofFaceValue",     type: "bytes"   },
      { name: "encDueDate",         type: "bytes32" },
      { name: "proofDueDate",       type: "bytes"   },
      { name: "encFingerprint",     type: "bytes32" },
      { name: "proofFingerprint",   type: "bytes"   },
      { name: "encBaseRate",         type: "bytes32" },
      { name: "proofBaseRate",       type: "bytes"   },
      { name: "encRepMultiplier",   type: "bytes32" },
      { name: "proofRepMultiplier", type: "bytes"   },
      { name: "debtor",             type: "address" },
      { name: "enableGemini",       type: "bool"    },
    ],
    outputs: [{ name: "invoiceId", type: "uint256" }],
  },
  /* confirmInvoice */
  {
    type: "function", name: "confirmInvoice",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId",             type: "uint256" },
      { name: "eip712Signature",       type: "bytes"   },
      { name: "attestationCommitment", type: "bytes32" },
    ],
    outputs: [],
  },
  /* factorInvoice */
  {
    type: "function", name: "factorInvoice",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [],
  },
  /* grantRiskAssessmentAccess */
  {
    type: "function", name: "grantRiskAssessmentAccess",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [],
  },
  /* checkDuplicate */
  {
    type: "function", name: "checkDuplicate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encFingerprint", type: "bytes32" },
      { name: "proof",          type: "bytes"   },
    ],
    outputs: [{ type: "bytes32" }],
  },
  /* initiateDispute */
  {
    type: "function", name: "initiateDispute",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [],
  },
  /* resolveDispute */
  {
    type: "function", name: "resolveDispute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId",      type: "uint256" },
      { name: "fraudConfirmed", type: "bool"    },
    ],
    outputs: [],
  },
  /* isInvestorApproved */
  {
    type: "function", name: "isInvestorApproved",
    stateMutability: "view",
    inputs: [{ name: "investor", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  /* getSupplierRatioHandle */
  {
    type: "function", name: "getSupplierRatioHandle",
    stateMutability: "view",
    inputs: [{ name: "supplier", type: "address" }],
    outputs: [{ type: "bytes32" }],
  },
  /* getAllInvoiceIds */
  {
    type: "function", name: "getAllInvoiceIds",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "ids", type: "uint256[]" }],
  },
  /* getSupplierInvoices */
  {
    type: "function", name: "getSupplierInvoices",
    stateMutability: "view",
    inputs: [{ name: "supplier", type: "address" }],
    outputs: [{ type: "uint256[]" }],
  },
  /* getInvestorInvoices */
  {
    type: "function", name: "getInvestorInvoices",
    stateMutability: "view",
    inputs: [{ name: "investor", type: "address" }],
    outputs: [{ type: "uint256[]" }],
  },
  /* invoices(id) - returns the full Invoice struct */
  {
    type: "function", name: "invoices",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "faceValue",                 type: "bytes32" },
      { name: "dueDate",                   type: "bytes32" },
      { name: "purchasePrice",             type: "bytes32" },
      { name: "discountRateBps",           type: "bytes32" },
      { name: "fingerprintHash",           type: "bytes32" },
      { name: "supplier",                  type: "address" },
      { name: "investor",                  type: "address" },
      { name: "debtor",                    type: "address" },
      { name: "uploadTimestamp",           type: "uint256" },
      { name: "maturityTimestamp",         type: "uint256" },
      { name: "status",                    type: "uint8"   },
      { name: "geminiUnderwritingEnabled", type: "bool"    },
      { name: "debtorAttestationHash",     type: "bytes32" },
      { name: "collateralStaked",          type: "bool"    },
    ],
  },
  /* getInvoiceHandles */
  {
    type: "function", name: "getInvoiceHandles",
    stateMutability: "view",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [
      { name: "faceValueHandle",     type: "bytes32" },
      { name: "dueDateHandle",       type: "bytes32" },
      { name: "purchasePriceHandle", type: "bytes32" },
      { name: "discountRateHandle",  type: "bytes32" },
    ],
  },
  /* invoiceCount */
  {
    type: "function", name: "invoiceCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  /* Events */
  {
    type: "event", name: "InvoiceUploaded",
    inputs: [
      { name: "invoiceId", type: "uint256", indexed: true },
      { name: "supplier",  type: "address", indexed: true },
      { name: "debtor",    type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "InvoiceAttested",
    inputs: [
      { name: "invoiceId", type: "uint256", indexed: true },
      { name: "debtor",    type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "InvoiceFactored",
    inputs: [
      { name: "invoiceId", type: "uint256", indexed: true },
      { name: "investor",  type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "InvoiceSettled",
    inputs: [
      { name: "invoiceId", type: "uint256", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

export const ARBITRA_REGISTRY_ABI = REGISTRY_ABI;

/* cUSDC minimal ABI for approvals, operator queries, and transfer callbacks */
export const CUSDC_ABI = [
  {
    type: "function", name: "confidentialApprove",
    stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }],
    outputs: [],
  },
  {
    type: "function", name: "encryptedBalanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function", name: "confidentialBalanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function", name: "setOperator",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "until", type: "uint48" }
    ],
    outputs: [],
  },
  {
    type: "function", name: "isOperator",
    stateMutability: "view",
    inputs: [
      { name: "holder", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function", name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function", name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function", name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function", name: "confidentialTransferAndCall",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to",     type: "address" },
      { name: "amount", type: "bytes32" },
      { name: "data",   type: "bytes"   },
    ],
    outputs: [{ type: "bytes32" }],
  },
] as const;

export const CUSDT_ABI = CUSDC_ABI;

/* Standard USDC ABI for wrap approval */
export const USDC_ABI = [
  {
    type: "function", name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function", name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function", name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

/* Collateral Vault ABI */
export const COLLATERAL_VAULT_ABI = [
  {
    type: "function", name: "stakeCollateral",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId", type: "uint256" },
      { name: "faceValue", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function", name: "stakedCollateral",
    stateMutability: "view",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function", name: "invoiceSupplier",
    stateMutability: "view",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
] as const;

/* Zama Wrappers Registry ABI */
export const WRAPPERS_REGISTRY_ABI = [
  {
    type: "function", name: "wrap",
    stateMutability: "nonpayable",
    inputs: [
      { name: "underlying", type: "address" },
      { name: "amount",     type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function", name: "getWrapper",
    stateMutability: "view",
    inputs: [{ name: "underlying", type: "address" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function", name: "getConfidentialTokenAddress",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "found", type: "bool" },
      { name: "confidentialToken", type: "address" },
    ],
  },
] as const;
