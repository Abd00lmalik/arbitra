/**
 * @file contracts.ts
 * @description Arbitra v2.2 contract addresses, ABIs, and utility helpers.
 *
 * ARCHITECTURE NOTE:
 * Payment token: Standard ERC-20 USDC on Sepolia (NOT wrapped cUSDC).
 * FHE layer:     Zama FHEVM encrypts invoice face values, due dates,
 *                discount rates, purchase prices, and fingerprints.
 *                FHE calculations run on-chain via ArbitraRiskCalculator.
 * This hybrid design keeps full homomorphic encryption for data privacy
 * while using standard USDC for frictionless payments.
 */

const USE_ENV_CONTRACT_ADDRESSES =
  process.env.NEXT_PUBLIC_USE_ENV_CONTRACT_ADDRESSES === "true";

const envAddress = (
  key: string,
  fallback: `0x${string}`,
): `0x${string}` => {
  if (!USE_ENV_CONTRACT_ADDRESSES) return fallback;

  const value = process.env[key];
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) return fallback;
  return value as `0x${string}`;
};

/* Payment Token */
export const USDC_ADDRESS =
  envAddress(
    "NEXT_PUBLIC_USDC_ADDRESS",
    "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  );

/* Protocol Contracts */
export const ARBITRA_REGISTRY_ADDRESS =
  envAddress(
    "NEXT_PUBLIC_REGISTRY_ADDRESS",
    "0xDE46d22134f0a9595188aA96dFFAC82561172b9f",
  );

export const ESCROW_RECEIVER_ADDRESS =
  envAddress(
    "NEXT_PUBLIC_ESCROW_RECEIVER_ADDRESS",
    "0x6B1Abb3e6d0918F9B86e975Ef0FE93a8eBd81FAA",
  );

export const COLLATERAL_VAULT_ADDRESS =
  envAddress(
    "NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS",
    "0x5abc39D2a5D37CCB994B85298924a415415F2658",
  );

export const FINGERPRINT_REGISTRY_ADDRESS =
  envAddress(
    "NEXT_PUBLIC_FINGERPRINT_REGISTRY_ADDRESS",
    "0x4De4d767a628aa021f5E3bb6CC8B3Bf80880C4eC",
  );

export const SBT_ADDRESS =
  envAddress(
    "NEXT_PUBLIC_SBT_ADDRESS",
    "0x1B88e4d2c70F137B0F7e40c52921D03e7849DF65",
  );

export const INVESTOR_SBT_ADDRESS =
  envAddress(
    "NEXT_PUBLIC_INVESTOR_SBT_ADDRESS",
    "0x52DfdBA750528207216f3d558D5f3aD04Be23e3b",
  );

export const KYB_ORACLE_ADDRESS =
  envAddress(
    "NEXT_PUBLIC_KYB_ORACLE_ADDRESS",
    "0x8a8f06F0A8dc3dAD0e76f1eBd6CA0834f021f862",
  );

export const INVESTOR_KYB_ORACLE_ADDRESS =
  envAddress(
    "NEXT_PUBLIC_INVESTOR_KYB_ORACLE_ADDRESS",
    "0xAB15403eE452d22A3F1a45Ba458B8c4beBcf3f9D",
  );

export const IDENTITY_ADDRESS =
  envAddress(
    "NEXT_PUBLIC_IDENTITY_ADDRESS",
    "0xF343B260c40C77670c40ED575dF8f42B8b1EB592",
  );


/* Constants */
export const TOKEN_DECIMALS  = 6;
export const TOKEN_SYMBOL    = "USDC";
export const ETHERSCAN_BASE  = "https://sepolia.etherscan.io";
export const COLLATERAL_BPS  = 500; /* 5% of face value */
export const DEFAULT_OPERATOR_EXPIRY_SECONDS = 31536000; /* 365 days */

/* Utilities */
export const toMicro = (n: number): bigint =>
  BigInt(Math.round(n * 10 ** TOKEN_DECIMALS));

export const fromMicro = (b: bigint): string =>
  (Number(b) / 10 ** TOKEN_DECIMALS).toLocaleString("en-US", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

export const truncAddr = (a?: string): string =>
  a && a.length > 10 ? `${a.slice(0, 6)}...${a.slice(-4)}` : (a ?? "");

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

/* Invoice Status */
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
  riskScore?: `0x${string}`;
  riskBand?: `0x${string}`;
  fingerprintHash: `0x${string}`;
  faceValuePlaintext: bigint;
  discountRatePlaintext: bigint;
  supplier: `0x${string}`;
  investor: `0x${string}`;
  debtor: `0x${string}`;
  buyer: `0x${string}`;
  uploadTimestamp: bigint;
  maturityTimestamp: bigint;
  status: InvoiceStatus;
  isFactored: boolean;
  isRepaid: boolean;
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
  riskScoreClear?: bigint;
  riskBandClear?: bigint;
  fingerprintClear?: bigint;
}

export interface InvoiceHandles {
  faceValueHandle: `0x${string}`;
  dueDateHandle: `0x${string}`;
  purchasePriceHandle: `0x${string}`;
  discountRateHandle: `0x${string}`;
  riskScoreHandle?: `0x${string}`;
  riskBandHandle?: `0x${string}`;
}

export const LEGACY_INVOICE_VIEW_ABI = [
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
      { name: "faceValuePlaintext", type: "uint256" },
      { name: "discountRatePlaintext", type: "uint256" },
      { name: "supplier",           type: "address" },
      { name: "investor",           type: "address" },
      { name: "debtor",             type: "address" },
      { name: "uploadTimestamp",    type: "uint256" },
      { name: "maturityTimestamp",  type: "uint256" },
      { name: "status",             type: "uint8"   },
      { name: "geminiUnderwritingEnabled", type: "bool" },
      { name: "debtorAttestationHash",     type: "bytes32" },
      { name: "collateralStaked",   type: "bool"    },
      { name: "debtorEmailHash",    type: "bytes32" },
      { name: "isEmailVerified",    type: "bool"    },
    ],
  },
] as const;

export const EXTENDED_INVOICE_VIEW_ABI = [
  {
    type: "function", name: "invoices",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "faceValue",          type: "bytes32" },
      { name: "dueDate",            type: "bytes32" },
      { name: "purchasePrice",      type: "bytes32" },
      { name: "discountRateBps",    type: "bytes32" },
      { name: "riskScore",          type: "bytes32" },
      { name: "riskBand",           type: "bytes32" },
      { name: "fingerprintHash",    type: "bytes32" },
      { name: "faceValuePlaintext", type: "uint256" },
      { name: "discountRatePlaintext", type: "uint256" },
      { name: "supplier",           type: "address" },
      { name: "investor",           type: "address" },
      { name: "debtor",             type: "address" },
      { name: "uploadTimestamp",    type: "uint256" },
      { name: "maturityTimestamp",  type: "uint256" },
      { name: "status",             type: "uint8"   },
      { name: "geminiUnderwritingEnabled", type: "bool" },
      { name: "debtorAttestationHash",     type: "bytes32" },
      { name: "collateralStaked",   type: "bool"    },
      { name: "debtorEmailHash",    type: "bytes32" },
      { name: "isEmailVerified",    type: "bool"    },
    ],
  },
] as const;

export const UNDERWRITING_HANDLES_ABI = [
  {
    type: "function", name: "getUnderwritingHandles",
    stateMutability: "view",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [
      { name: "riskScoreHandle", type: "bytes32" },
      { name: "riskBandHandle", type: "bytes32" },
    ],
  },
] as const;

function toBigIntValue(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" || typeof value === "string") return BigInt(value);
  return 0n;
}

export function parseInvoiceTuple(invoiceId: bigint, raw: readonly unknown[]): InvoiceOnChain {
  const isExtendedTuple = raw.length >= 20;
  const statusIndex = isExtendedTuple ? 14 : 12;
  const debtorIndex = isExtendedTuple ? 11 : 9;
  const supplierIndex = isExtendedTuple ? 9 : 7;
  const investorIndex = isExtendedTuple ? 10 : 8;
  const uploadTimestampIndex = isExtendedTuple ? 12 : 10;
  const maturityTimestampIndex = isExtendedTuple ? 13 : 11;
  const geminiIndex = isExtendedTuple ? 15 : 13;
  const attestationIndex = isExtendedTuple ? 16 : 14;
  const collateralIndex = isExtendedTuple ? 17 : 15;
  const debtorEmailIndex = isExtendedTuple ? 18 : 16;
  const emailVerifiedIndex = isExtendedTuple ? 19 : 17;
  const faceValuePlaintextIndex = isExtendedTuple ? 7 : 5;
  const discountRatePlaintextIndex = isExtendedTuple ? 8 : 6;
  const fingerprintIndex = isExtendedTuple ? 6 : 4;
  const riskScore = isExtendedTuple ? (raw[4] as `0x${string}`) : undefined;
  const riskBand = isExtendedTuple ? (raw[5] as `0x${string}`) : undefined;
  const status = Number(raw[statusIndex]) as InvoiceStatus;
  const debtor = raw[debtorIndex] as `0x${string}`;

  return {
    invoiceId,
    faceValue: raw[0] as `0x${string}`,
    dueDate: raw[1] as `0x${string}`,
    purchasePrice: raw[2] as `0x${string}`,
    discountRateBps: raw[3] as `0x${string}`,
    riskScore,
    riskBand,
    fingerprintHash: raw[fingerprintIndex] as `0x${string}`,
    faceValuePlaintext: toBigIntValue(raw[faceValuePlaintextIndex]),
    discountRatePlaintext: toBigIntValue(raw[discountRatePlaintextIndex]),
    supplier: raw[supplierIndex] as `0x${string}`,
    investor: raw[investorIndex] as `0x${string}`,
    debtor,
    buyer: debtor,
    uploadTimestamp: toBigIntValue(raw[uploadTimestampIndex]),
    maturityTimestamp: toBigIntValue(raw[maturityTimestampIndex]),
    status,
    isFactored: status >= InvoiceStatus.Factored,
    isRepaid: status === InvoiceStatus.Settled,
    geminiUnderwritingEnabled: Boolean(raw[geminiIndex]),
    debtorAttestationHash: raw[attestationIndex] as `0x${string}`,
    collateralStaked: Boolean(raw[collateralIndex]),
    debtorEmailHash: raw[debtorEmailIndex] as `0x${string}`,
    isEmailVerified: Boolean(raw[emailVerifiedIndex]),
  };
}

export function parseInvoiceHandles(raw: readonly unknown[]): InvoiceHandles {
  return {
    faceValueHandle: raw[0] as `0x${string}`,
    dueDateHandle: raw[1] as `0x${string}`,
    purchasePriceHandle: raw[2] as `0x${string}`,
    discountRateHandle: raw[3] as `0x${string}`,
  };
}

/* Registry ABI (v2.2 includes faceValuePlaintext) */
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
      { name: "faceValuePlaintext_",   type: "uint256" },
      { name: "plaintextFingerprint",  type: "uint256" },
      { name: "discountRatePlaintext_", type: "uint256" },
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
    type: "function", name: "checkDuplicate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encFingerprint", type: "bytes32" },
      { name: "proof",          type: "bytes"   },
    ],
    outputs: [{ name: "isDuplicate", type: "bytes32" }],
  },
  {
    type: "function", name: "requestRiskAssessmentAccess",
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
      { name: "faceValuePlaintext", type: "uint256" },
      { name: "discountRatePlaintext", type: "uint256" },
      { name: "supplier",           type: "address" },
      { name: "investor",           type: "address" },
      { name: "debtor",             type: "address" },
      { name: "uploadTimestamp",    type: "uint256" },
      { name: "maturityTimestamp",  type: "uint256" },
      { name: "status",             type: "uint8"   },
      { name: "geminiUnderwritingEnabled", type: "bool" },
      { name: "debtorAttestationHash",     type: "bytes32" },
      { name: "collateralStaked",   type: "bool"    },
      { name: "debtorEmailHash",    type: "bytes32" },
      { name: "isEmailVerified",    type: "bool"    },
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
    type: "function", name: "getUnderwritingHandles",
    stateMutability: "view",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [
      { name: "riskScoreHandle", type: "bytes32" },
      { name: "riskBandHandle", type: "bytes32" },
    ],
  },
  {
    type: "function", name: "isUnderwritingAllowed",
    stateMutability: "view",
    inputs: [
      { name: "invoiceId", type: "uint256" },
      { name: "account", type: "address" },
    ],
    outputs: [
      { name: "scoreAllowed", type: "bool" },
      { name: "bandAllowed", type: "bool" },
    ],
  },
  {
    type: "function", name: "getSupplierDefaultCountHandle",
    stateMutability: "view",
    inputs: [{ name: "supplier", type: "address" }],
    outputs: [{ name: "defaultCountHandle", type: "bytes32" }],
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
  {
    type: "function", name: "isInvestorApproved",
    stateMutability: "view",
    inputs: [{ name: "investor", type: "address" }],
    outputs: [{ name: "approved", type: "bool" }],
  },
  {
    type: "function", name: "supplierStats",
    stateMutability: "view",
    inputs: [{ name: "supplier", type: "address" }],
    outputs: [
      { name: "totalInvoices", type: "bytes32" },
      { name: "repaidInvoices", type: "bytes32" },
      { name: "repaymentRatioBps", type: "bytes32" },
      { name: "defaultedInvoices", type: "bytes32" },
      { name: "initialized", type: "bool" },
    ],
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

export const FINGERPRINT_REGISTRY_ABI = [
  {
    type: "function", name: "checkInvoiceUniqueness",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encHash",        type: "bytes32" },
      { name: "proofHash",      type: "bytes"   },
      { name: "encFaceValue",   type: "bytes32" },
      { name: "proofFaceValue", type: "bytes"   },
    ],
    outputs: [{ name: "duplicateResultHandle", type: "bytes32" }],
  },
  {
    type: "function", name: "confirmAndRegister",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function", name: "getDuplicateCheckHandle",
    stateMutability: "view",
    inputs: [{ name: "supplier", type: "address" }],
    outputs: [{ name: "handle", type: "bytes32" }],
  },
  {
    type: "event", name: "DuplicateCheckInitiated",
    inputs: [
      { name: "supplier",  type: "address", indexed: true },
      { name: "timestamp", type: "uint256" },
    ],
  },
  {
    type: "event", name: "FingerprintRegistered",
    inputs: [
      { name: "invoiceId", type: "uint256", indexed: true },
      { name: "supplier",  type: "address", indexed: true },
      { name: "timestamp", type: "uint256" },
    ],
  },
] as const;

/* USDC ERC-20 ABI (standard, no confidential extensions) */
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

/* Escrow Receiver ABI (v2.3, signed settlement proof) */
export const ESCROW_RECEIVER_ABI = [
  {
    type: "function", name: "repayInvoice",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId",         type: "uint256" },
      { name: "paymentReference",  type: "bytes32" },
      { name: "amount",            type: "uint256" },
      { name: "receivedAt",        type: "uint256" },
      { name: "nonce",             type: "uint256" },
      { name: "bankTraceId",       type: "bytes32" },
      { name: "signature",         type: "bytes" },
    ],
    outputs: [],
  },
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
      { name: "purchasePricePlaintext", type: "uint256" },
      { name: "platformFeePlaintext", type: "uint256" },
      { name: "maturityTimestamp", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function", name: "getSettlementAudit",
    stateMutability: "view",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [
      { name: "paymentReference", type: "bytes32" },
      { name: "bankTraceId", type: "bytes32" },
      { name: "settlementReceiptHash", type: "bytes32" },
      { name: "settledAt", type: "uint256" },
      { name: "purchasePricePlaintext", type: "uint256" },
      { name: "supplierReservePlaintext", type: "uint256" },
      { name: "platformFeePlaintext", type: "uint256" },
    ],
  },
  {
    type: "function", name: "getSettlementCommitments",
    stateMutability: "view",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [
      { name: "paymentReference", type: "bytes32" },
      { name: "bankTraceId", type: "bytes32" },
      { name: "settlementReceiptHash", type: "bytes32" },
      { name: "settledAt", type: "uint256" },
    ],
  },
  {
    type: "function", name: "getConfidentialSettlementBalance",
    stateMutability: "view",
    inputs: [{ name: "beneficiary", type: "address" }],
    outputs: [{ name: "balanceHandle", type: "bytes32" }],
  },
  {
    type: "event", name: "SettlementFinalized",
    inputs: [
      { name: "invoiceId", type: "uint256", indexed: true },
      { name: "paymentReference", type: "bytes32", indexed: true },
      { name: "settlementReceiptHash", type: "bytes32", indexed: true },
    ],
  },
] as const;

/* Collateral Vault ABI */
export const COLLATERAL_VAULT_ABI = [
  {
    type: "function", name: "stakeCollateral",
    stateMutability: "nonpayable",
    inputs: [
      { name: "fingerprint", type: "uint256" },
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
  {
    type: "function", name: "stakedCollateralByFingerprint",
    stateMutability: "view",
    inputs: [{ name: "fingerprint", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function", name: "supplierByFingerprint",
    stateMutability: "view",
    inputs: [{ name: "fingerprint", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function", name: "stakeStates",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ type: "uint8" }],
  },
] as const;

/* ArbitraSBT ABI */
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

/* MockKYBOracle ABI */
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

/* ArbitraIdentity ABI */
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
    type: "function", name: "submitEncryptedComplianceFor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "wallet",        type: "address" },
      { name: "encTaxID",      type: "bytes32" },
      { name: "proofTaxID",    type: "bytes"   },
      { name: "encKybStatus",  type: "bytes32" },
      { name: "proofKyb",      type: "bytes"   },
      { name: "encRisk",       type: "bytes32" },
      { name: "proofRisk",     type: "bytes"   },
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
