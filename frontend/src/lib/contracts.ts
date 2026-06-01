/**
 * Arbitra v2.2 contract addresses and utilities.
 *
 * ARCHITECTURE NOTE:
 * Payment token: Standard ERC-20 USDC on Sepolia (NOT wrapped cUSDC).
 * FHE layer:     Zama FHEVM encrypts invoice face values, due dates,
 *                discount rates, purchase prices, and fingerprints.
 *                FHE calculations run on-chain via ArbitraRiskCalculator.
 * This hybrid design keeps full homomorphic encryption for data privacy
 * while using standard USDC for frictionless payments.
 */

/* ── Payment token ── */
export const USDC_ADDRESS =
  (process.env.NEXT_PUBLIC_USDC_ADDRESS ??
   "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238") as `0x${string}`;

/* ── Protocol contracts ── */
export const ARBITRA_REGISTRY_ADDRESS =
  (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ??
   "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const ESCROW_RECEIVER_ADDRESS =
  (process.env.NEXT_PUBLIC_ESCROW_RECEIVER_ADDRESS ??
   "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const COLLATERAL_VAULT_ADDRESS =
  (process.env.NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS ??
   "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const FINGERPRINT_REGISTRY_ADDRESS =
  (process.env.NEXT_PUBLIC_FINGERPRINT_REGISTRY_ADDRESS ??
   "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const SBT_ADDRESS =
  (process.env.NEXT_PUBLIC_SBT_ADDRESS ??
   "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const KYB_ORACLE_ADDRESS =
  (process.env.NEXT_PUBLIC_KYB_ORACLE_ADDRESS ??
   "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const IDENTITY_ADDRESS =
  (process.env.NEXT_PUBLIC_IDENTITY_ADDRESS ??
   "0x0000000000000000000000000000000000000000") as `0x${string}`;

/* ── Constants ── */
export const TOKEN_DECIMALS  = 6;
export const TOKEN_SYMBOL    = "USDC";
export const ETHERSCAN_BASE  = "https://sepolia.etherscan.io";
export const COLLATERAL_BPS  = 500; /* 5% of face value */
export const DEFAULT_OPERATOR_EXPIRY_SECONDS = 31536000; /* 365 days */

/* ── Utilities ── */
export const toMicro = (n: number): bigint =>
  BigInt(Math.round(n * 10 ** TOKEN_DECIMALS));

export const fromMicro = (b: bigint): string =>
  (Number(b) / 10 ** TOKEN_DECIMALS).toLocaleString("en-US", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

export const truncAddr = (a?: string): string =>
  a && a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : (a ?? "");

/* Compatibility helper aliases */
export const toMicroUnits = toMicro;
export const fromMicroUnits = fromMicro;
export const truncateAddress = (a: string): string =>
  a && a.length > 10 ? `${a.slice(0, 6)}...${a.slice(-4)}` : (a ?? "");
export const shortAddress = (a: string): string =>
  !a || a === "0x0000000000000000000000000000000000000000" ? "-" : `${a.slice(0, 6)}...${a.slice(-4)}`;

export const formatUSDC = (microUnits: bigint | undefined): string => {
  if (microUnits === undefined) return "-";
  return `$${fromMicro(microUnits)} USDC`;
};

export const formatTimestamp = (ts: bigint | number | undefined): string => {
  if (ts === undefined) return "-";
  return new Date(Number(ts) * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const formatBps = (bps: bigint | undefined): string => {
  if (bps === undefined) return "-";
  return `${(Number(bps) / 100).toFixed(2)}%`;
};

export const daysUntilDue = (dueTimestamp: bigint | undefined): number => {
  if (dueTimestamp === undefined) return 0;
  const nowSec = Math.floor(Date.now() / 1000);
  const diff = Number(dueTimestamp) - nowSec;
  return Math.max(0, Math.floor(diff / 86400));
};

/* ── Invoice status ── */
export enum InvoiceStatus {
  Pending   = 0,
  Attested  = 1,
  Factored  = 2,
  Settled   = 3,
  Disputed  = 4,
  Slashed   = 5,
}

export const STATUS_LABEL: Record<number, string> = {
  0: "Pending", 1: "Attested", 2: "Factored",
  3: "Settled", 4: "Disputed", 5: "Slashed",
};

export const STATUS_COLOR: Record<number, string> = {
  0: "#FFBA00", 1: "#00F0FF", 2: "#A87FFF",
  3: "#00FF88", 4: "#FF7EB3", 5: "#FF2D6B",
};

/* Invoice data shape from chain */
export interface InvoiceOnChain {
  invoiceId: bigint;
  faceValue: `0x${string}`;
  dueDate: `0x${string}`;
  purchasePrice: `0x${string}`;
  discountRateBps: `0x${string}`;
  fingerprintHash: `0x${string}`;
  faceValuePlaintext: bigint;
  supplier: `0x${string}`;
  investor: `0x${string}`;
  debtor: `0x${string}`;
  uploadTimestamp: bigint;
  maturityTimestamp: bigint;
  status: InvoiceStatus;
  geminiUnderwritingEnabled: boolean;
  debtorAttestationHash: `0x${string}`;
  debtorEmailHash: `0x${string}`;
  isEmailVerified: boolean;
  collateralStaked: boolean;
}

export interface InvoiceDecoded extends InvoiceOnChain {
  faceValueClear?: bigint;
  dueDateClear?: bigint;
  purchasePriceClear?: bigint;
  discountRateClear?: bigint;
  fingerprintClear?: bigint;
}

/* ── Registry ABI (v2.2 — includes faceValuePlaintext) ── */
export const REGISTRY_ABI = [
  {
    type: "function", name: "uploadInvoice",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encFaceValue",          type: "bytes32" },
      { name: "proofFaceValue",        type: "bytes"   },
      { name: "encDueDate",            type: "bytes32" },
      { name: "proofDueDate",          type: "bytes"   },
      { name: "encFingerprint",        type: "bytes32" },
      { name: "proofFingerprint",      type: "bytes"   },
      { name: "encBaseRate",           type: "bytes32" },
      { name: "proofBaseRate",         type: "bytes"   },
      { name: "encReputationMultiplier", type: "bytes32" },
      { name: "proofRepMult",          type: "bytes"   },
      { name: "debtor",                type: "address" },
      { name: "enableGeminiUnderwriting", type: "bool" },
      { name: "faceValuePlaintext_",   type: "uint256" }, /* NEW in v2.2 */
    ],
    outputs: [{ name: "invoiceId", type: "uint256" }],
  },
  {
    type: "function", name: "factorInvoice",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function", name: "confirmInvoice",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId",            type: "uint256" },
      { name: "eip712Signature",      type: "bytes"   },
      { name: "attestationCommitment",type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function", name: "confirmInvoiceEmailVerified",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId",         type: "uint256" },
      { name: "emailHash",         type: "bytes32" },
      { name: "verifiedAt",        type: "uint256" },
      { name: "expiresAt",         type: "uint256" },
      { name: "platformSignature", type: "bytes"   },
    ],
    outputs: [],
  },
  {
    type: "function", name: "grantRiskAssessmentAccess",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function", name: "triggerRepayment",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function", name: "initiateDispute",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function", name: "resolveDispute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId",     type: "uint256" },
      { name: "fraudConfirmed",type: "bool"    },
    ],
    outputs: [],
  },
  {
    type: "function", name: "onEscrowSettled",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [],
  },
  /* View functions */
  {
    type: "function", name: "invoices",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "faceValue",          type: "bytes32" },
      { name: "dueDate",            type: "bytes32" },
      { name: "purchasePrice",      type: "bytes32" },
      { name: "discountRateBps",    type: "bytes32" },
      { name: "fingerprintHash",    type: "bytes32" },
      { name: "faceValuePlaintext", type: "uint256" }, /* NEW */
      { name: "supplier",           type: "address" },
      { name: "investor",           type: "address" },
      { name: "debtor",             type: "address" },
      { name: "uploadTimestamp",    type: "uint256" },
      { name: "maturityTimestamp",  type: "uint256" },
      { name: "status",             type: "uint8"   },
      { name: "geminiUnderwritingEnabled", type: "bool" },
      { name: "debtorAttestationHash",     type: "bytes32" },
      { name: "debtorEmailHash",    type: "bytes32" },
      { name: "isEmailVerified",    type: "bool"    },
      { name: "collateralStaked",   type: "bool"    },
    ],
  },
  {
    type: "function", name: "getAllInvoiceIds",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "ids", type: "uint256[]" }],
  },
  {
    type: "function", name: "getSupplierInvoices",
    stateMutability: "view",
    inputs: [{ name: "supplier", type: "address" }],
    outputs: [{ type: "uint256[]" }],
  },
  {
    type: "function", name: "getInvestorInvoices",
    stateMutability: "view",
    inputs: [{ name: "investor", type: "address" }],
    outputs: [{ type: "uint256[]" }],
  },
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
  {
    type: "function", name: "getFaceValuePlaintext",
    stateMutability: "view",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function", name: "getPurchasePricePlaintext",
    stateMutability: "view",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function", name: "invoiceCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function", name: "platformVerifier",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  /* Events */
  {
    type: "event", name: "InvoiceUploaded",
    inputs: [
      { name: "invoiceId", type: "uint256", indexed: true },
      { name: "supplier",  type: "address", indexed: true },
      { name: "debtor",    type: "address", indexed: true },
      { name: "timestamp", type: "uint256" },
    ],
  },
  {
    type: "event", name: "InvoiceAttested",
    inputs: [
      { name: "invoiceId", type: "uint256", indexed: true },
      { name: "debtor",    type: "address", indexed: true },
      { name: "timestamp", type: "uint256" },
    ],
  },
  {
    type: "event", name: "InvoiceFactored",
    inputs: [
      { name: "invoiceId", type: "uint256", indexed: true },
      { name: "investor",  type: "address", indexed: true },
      { name: "timestamp", type: "uint256" },
    ],
  },
  {
    type: "event", name: "InvoiceSettled",
    inputs: [
      { name: "invoiceId", type: "uint256", indexed: true },
      { name: "timestamp", type: "uint256" },
    ],
  },
] as const;

/* Compatibility alias */
export const ARBITRA_REGISTRY_ABI = REGISTRY_ABI;

/* ── USDC ERC-20 ABI (standard — no confidential extensions) ── */
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
    type: "function", name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to",     type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function", name: "transferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from",   type: "address" },
      { name: "to",     type: "address" },
      { name: "amount", type: "uint256" },
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

/* ── Escrow Receiver ABI (v2.2 — standard USDC settle) ── */
export const ESCROW_RECEIVER_ABI = [
  {
    type: "function", name: "settleInvoice",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function", name: "settleInvoicePlatform",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function", name: "registerEscrow",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId",         type: "uint256" },
      { name: "supplier",          type: "address" },
      { name: "investor",          type: "address" },
      { name: "encFaceValue",      type: "bytes32" },
      { name: "faceValuePlaintext",type: "uint256" },
      { name: "maturityTimestamp", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

/* ── Collateral Vault ABI ── */
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

/* ── ArbitraSBT ABI ── */
export const SBT_ABI = [
  {
    type: "function", name: "hasValidSBT",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function", name: "walletToTokenId",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function", name: "sbtRecords",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "wallet",            type: "address" },
      { name: "kybVerificationId",  type: "bytes32" },
      { name: "attestationHash",    type: "bytes32" },
      { name: "riskScoreBucket",    type: "uint8"   },
      { name: "mintTimestamp",      type: "uint256" },
      { name: "isRevoked",          type: "bool"    },
    ],
  },
  {
    type: "event", name: "SBTMinted",
    inputs: [
      { name: "wallet",            type: "address", indexed: true },
      { name: "tokenId",           type: "uint256", indexed: true },
      { name: "kybVerificationId",  type: "bytes32" },
      { name: "riskScore",         type: "uint8"   },
      { name: "timestamp",         type: "uint256" },
    ],
  },
  {
    type: "event", name: "SBTRevoked",
    inputs: [
      { name: "wallet",    type: "address", indexed: true },
      { name: "tokenId",   type: "uint256", indexed: true },
      { name: "timestamp", type: "uint256" },
    ],
  },
] as const;

/* ── MockKYBOracle ABI ── */
export const KYB_ORACLE_ABI = [
  {
    type: "function", name: "submitKYBAttestation",
    stateMutability: "nonpayable",
    inputs: [
      { name: "wallet",           type: "address" },
      { name: "verificationId",   type: "bytes32" },
      { name: "attestationHash",  type: "bytes32" },
      { name: "riskScore",        type: "uint8"   },
      { name: "timestamp",        type: "uint256" },
      { name: "signature",        type: "bytes"   },
    ],
    outputs: [],
  },
  {
    type: "function", name: "nonces",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event", name: "KYBAttestationSubmitted",
    inputs: [
      { name: "wallet",           type: "address", indexed: true },
      { name: "verificationId",   type: "bytes32", indexed: true },
      { name: "riskScore",        type: "uint8"   },
      { name: "timestamp",        type: "uint256" },
    ],
  },
] as const;

/* ── ArbitraIdentity ABI ── */
export const IDENTITY_ABI = [
  {
    type: "function", name: "submitEncryptedCompliance",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encTaxID",     type: "bytes32" },
      { name: "proofTaxID",   type: "bytes"   },
      { name: "encKybStatus", type: "bytes32" },
      { name: "proofKyb",     type: "bytes"   },
      { name: "encRisk",      type: "bytes32" },
      { name: "proofRisk",    type: "bytes"   },
    ],
    outputs: [],
  },
  {
    type: "function", name: "hasEncryptedCompliance",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function", name: "getEncryptedHandles",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [
      { name: "taxIDHandle", type: "bytes32" },
      { name: "kybHandle",   type: "bytes32" },
      { name: "riskHandle",  type: "bytes32" },
    ],
  },
  {
    type: "event", name: "EncryptedComplianceSubmitted",
    inputs: [
      { name: "wallet",    type: "address", indexed: true },
      { name: "timestamp", type: "uint256" },
    ],
  },
] as const;
