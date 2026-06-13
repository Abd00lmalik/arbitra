/**
 * @file route.ts
 * @description Relays encrypted compliance storage transactions for verified supplier wallets.
 */

import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, defineChain, formatEther, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";
import {
  IDENTITY_ABI,
  IDENTITY_ADDRESS,
} from "@/lib/contracts";

export const runtime = "nodejs";
export const maxDuration = 60;

const EXPECTED_VERIFIER_ADDRESS =
  process.env.PLATFORM_VERIFIER_ADDRESS ||
  process.env.ORACLE_BACKEND_ADDRESS ||
  "0x7e0Af9e55184b2b4bd5bac455493c035d51eee3E";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEFAULT_SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const FHE_COMPLIANCE_GAS_LIMIT = 4_000_000n;

const sepolia = defineChain({
  id: 11155111,
  name: "Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://11155111.rpc.thirdweb.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Etherscan",
      url: "https://sepolia.etherscan.io",
      apiUrl: "https://api-sepolia.etherscan.io/api",
    },
  },
  contracts: {
    multicall3: {
      address: "0xca11bde05977b3631167028862be2a173976ca11",
      blockCreated: 751532,
    },
    ensUniversalResolver: {
      address: "0xeeeeeeee14d718c2b47d9923deab1335e144eeee",
      blockCreated: 8928790,
    },
  },
  testnet: true,
});

interface ComplianceStoreRequestBody {
  wallet: string;
  taxID?: string;
  kybApproved: boolean;
  riskScore: number;
}

function jsonError(message: string, status: number, detail?: string) {
  return NextResponse.json(
    detail ? { error: message, detail } : { error: message },
    { status },
  );
}

function normalizeVerifierKey(rawKey: string | undefined): `0x${string}` | null {
  if (!rawKey) return null;

  const trimmedKey = rawKey.trim();
  if (!trimmedKey) return null;

  const normalizedKey = trimmedKey.startsWith("0x") ? trimmedKey : `0x${trimmedKey}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalizedKey)) {
    throw new Error("VERIFIER_PRIVATE_KEY must be a 32-byte hex string.");
  }

  return normalizedKey as `0x${string}`;
}

function normalizeTaxId(rawTaxId: string | undefined): string {
  return String(rawTaxId ?? "").trim().replace(/[\s\-./]/g, "");
}

function encodeTaxIdToUint32(normalizedTaxId: string): bigint {
  let numeric = 0n;

  for (const char of normalizedTaxId.toUpperCase()) {
    numeric = (numeric * 36n + BigInt(Number.parseInt(char, 36))) % 4_294_967_295n;
  }

  return numeric === 0n ? 1n : numeric;
}

function toHex(value: Uint8Array | string): `0x${string}` {
  if (typeof value === "string") return value as `0x${string}`;
  return (`0x${Array.from(value).map((part) => part.toString(16).padStart(2, "0")).join("")}`) as `0x${string}`;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms.`)), timeoutMs);
    }),
  ]);
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  let requestBody: ComplianceStoreRequestBody | null = null;

  try {
    console.log("[Compliance API] Starting compliance-store request", {
      identityAddress: IDENTITY_ADDRESS,
      envIdentityAddress: process.env.NEXT_PUBLIC_IDENTITY_ADDRESS,
      hasVerifierKey: Boolean(process.env.VERIFIER_PRIVATE_KEY),
      hasSepoliaRpc: Boolean(process.env.SEPOLIA_RPC_URL || process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
    });

    const normalizedVerifierKey = normalizeVerifierKey(process.env.VERIFIER_PRIVATE_KEY);
    if (!normalizedVerifierKey) {
      return jsonError("Server configuration error: verifier key not configured.", 500);
    }

    if (!IDENTITY_ADDRESS || IDENTITY_ADDRESS === ZERO_ADDRESS) {
      return jsonError(
        "Server configuration error: identity contract address not configured.",
        500,
        "Set NEXT_PUBLIC_IDENTITY_ADDRESS to 0x928742F2f286187B79E154e0A27a0b82EF2cEaf7 in Vercel.",
      );
    }

    const account = privateKeyToAccount(normalizedVerifierKey);
    if (account.address.toLowerCase() !== EXPECTED_VERIFIER_ADDRESS.toLowerCase()) {
      console.error("[Compliance API] Verifier signer mismatch", {
        actualSigner: account.address,
        expectedSigner: EXPECTED_VERIFIER_ADDRESS,
      });
      return jsonError(
        "Server configuration error: verifier key does not match the authorized relayer signer.",
        500,
        `Expected ${EXPECTED_VERIFIER_ADDRESS}, got ${account.address}.`,
      );
    }

    requestBody = await req.json().catch(() => null);
    if (!requestBody) {
      return jsonError("Invalid JSON request body.", 400);
    }

    const { wallet, taxID, kybApproved, riskScore } = requestBody;
    if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
      return jsonError("Invalid wallet address.", 400);
    }

    const normalizedTaxId = normalizeTaxId(taxID);
    if (!normalizedTaxId) {
      return jsonError("Tax ID is required.", 400);
    }

    if (!/^[A-Za-z0-9]{4,30}$/.test(normalizedTaxId)) {
      return jsonError("Invalid Tax ID format.", 400);
    }

    if (!Number.isInteger(riskScore) || riskScore < 0 || riskScore > 255) {
      return jsonError("Risk score must be an integer between 0 and 255.", 400);
    }

    const taxIDInt = encodeTaxIdToUint32(normalizedTaxId);

    const rpcUrl =
      process.env.SEPOLIA_RPC_URL ||
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
      process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL ||
      DEFAULT_SEPOLIA_RPC_URL;

    console.log("[Compliance API] Request payload accepted", {
      wallet,
      riskScore,
      rpcUrl,
      relayerAddress: account.address,
    });

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const walletBalance = await publicClient.getBalance({ address: account.address });
    console.log("[Compliance API] Server wallet balance:", `${formatEther(walletBalance)} ETH`);
    if (walletBalance === 0n) {
      return jsonError("Server relayer has no Sepolia ETH for gas.", 503);
    }

    console.log("[Compliance API] Initializing relayer SDK...");
    const sdk = await withTimeout(
      createInstance({
        ...SepoliaConfig,
        network: rpcUrl,
      }),
      20_000,
      "Relayer SDK initialization",
    );
    console.log("[Compliance API] Relayer SDK initialized", {
      elapsedMs: Date.now() - startedAt,
    });

    const encryptedInput = sdk.createEncryptedInput(IDENTITY_ADDRESS, account.address);
    encryptedInput.add32(taxIDInt);
    encryptedInput.addBool(kybApproved);
    encryptedInput.add8(BigInt(riskScore));
    console.log("[Compliance API] Encrypting compliance payload...");
    const encrypted = await withTimeout(
      encryptedInput.encrypt(),
      25_000,
      "Compliance encryption",
    );
    console.log("[Compliance API] Encryption complete", {
      elapsedMs: Date.now() - startedAt,
    });

    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const contractArgs = [
      wallet as `0x${string}`,
      toHex(encrypted.handles[0]),
      toHex(encrypted.inputProof),
      toHex(encrypted.handles[1]),
      toHex(encrypted.inputProof),
      toHex(encrypted.handles[2]),
      toHex(encrypted.inputProof),
    ] as const;

    console.log("[Compliance API] Using fixed FHE gas limit for relayed compliance transaction...", {
      gasLimit: FHE_COMPLIANCE_GAS_LIMIT.toString(),
      elapsedMs: Date.now() - startedAt,
    });

    console.log("[Compliance API] Submitting relayed compliance transaction...");
    const txHash = await walletClient.writeContract({
      address: IDENTITY_ADDRESS,
      abi: IDENTITY_ABI,
      functionName: "submitEncryptedComplianceFor",
      args: contractArgs,
      gas: FHE_COMPLIANCE_GAS_LIMIT,
    });

    console.log("[Compliance API] Submitted encrypted compliance on-chain:", {
      txHash,
      elapsedMs: Date.now() - startedAt,
    });

    console.log("[Compliance API] Waiting for compliance transaction receipt...");
    const receipt = await withTimeout(
      publicClient.waitForTransactionReceipt({ hash: txHash }),
      60_000,
      "Compliance transaction confirmation",
    );

    if (receipt.status !== "success") {
      console.error("[Compliance API] Compliance transaction reverted", {
        txHash,
        blockNumber: receipt.blockNumber?.toString(),
        gasUsed: receipt.gasUsed?.toString(),
      });
      return jsonError(
        "Encrypted compliance transaction reverted on Sepolia.",
        500,
        `txHash: ${txHash}`,
      );
    }

    console.log("[Compliance API] Compliance transaction confirmed", {
      txHash,
      blockNumber: receipt.blockNumber?.toString(),
      gasUsed: receipt.gasUsed?.toString(),
      elapsedMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      success: true,
      txHash,
      relayerAddress: account.address,
      blockNumber: receipt.blockNumber?.toString(),
      gasUsed: receipt.gasUsed?.toString(),
      elapsedMs: Date.now() - startedAt,
      message: "Encrypted compliance submitted on-chain.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Compliance API] Unhandled error:", {
      message,
      wallet: requestBody?.wallet,
      identityAddress: IDENTITY_ADDRESS,
      elapsedMs: Date.now() - startedAt,
    });
    return jsonError("Encrypted compliance submission failed.", 500, message);
  }
}
