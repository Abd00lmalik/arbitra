/**
 * @file route.ts
 * @description Backend-only mint endpoint: submits a pre-signed KYB attestation on-chain
 *              using the verifier private key. The client never sends its own wallet for
 *              this privileged call - the server wallet pays gas and signs the tx.
 */

import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  KYB_ORACLE_ABI,
  KYB_ORACLE_ADDRESS,
  INVESTOR_KYB_ORACLE_ADDRESS,
} from "@/lib/contracts";

export const runtime = "nodejs";

const EXPECTED_VERIFIER_ADDRESS =
  process.env.PLATFORM_VERIFIER_ADDRESS ||
  process.env.ORACLE_BACKEND_ADDRESS ||
  "0x7e0Af9e55184b2b4bd5bac455493c035d51eee3E";

const DEFAULT_SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

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
  testnet: true,
});

interface MintRequestBody {
  wallet: string;
  verificationIdBytes32: string;
  attestationHashBytes32: string;
  riskScore: number;
  timestamp: number;
  signature: string;
  role?: string;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
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

export async function POST(req: NextRequest) {
  try {
    const normalizedVerifierKey = normalizeVerifierKey(process.env.VERIFIER_PRIVATE_KEY);
    if (!normalizedVerifierKey) {
      console.error("[KYB Mint API] FATAL: VERIFIER_PRIVATE_KEY is not set.");
      return jsonError("Server configuration error: verifier key not configured.", 500);
    }

    let body: MintRequestBody | null = null;
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON request body.", 400);
    }

    if (!body) return jsonError("Missing request body.", 400);

    const {
      wallet,
      verificationIdBytes32,
      attestationHashBytes32,
      riskScore,
      timestamp,
      signature,
      role,
    } = body;

    if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
      return jsonError("Invalid wallet address.", 400);
    }
    if (!verificationIdBytes32 || !attestationHashBytes32 || !signature) {
      return jsonError("Missing required attestation fields.", 400);
    }
    if (typeof riskScore !== "number" || riskScore < 0 || riskScore > 100) {
      return jsonError("Invalid risk score.", 400);
    }
    if (typeof timestamp !== "number" || timestamp <= 0) {
      return jsonError("Invalid timestamp.", 400);
    }

    let account;
    try {
      account = privateKeyToAccount(normalizedVerifierKey);
    } catch (error) {
      console.error("[KYB Mint API] Invalid VERIFIER_PRIVATE_KEY format.", error);
      return jsonError("Server configuration error: invalid verifier key format.", 500);
    }

    if (account.address.toLowerCase() !== EXPECTED_VERIFIER_ADDRESS.toLowerCase()) {
      console.error("[KYB Mint API] VERIFIER_PRIVATE_KEY derives to an unexpected signer.", {
        signerAddress: account.address,
        expectedSignerAddress: EXPECTED_VERIFIER_ADDRESS,
      });
      return jsonError(
        "Server configuration error: verifier key does not match the authorized oracle signer.",
        500,
      );
    }

    const isInvestor = role === "investor";
    const oracleAddress = isInvestor ? INVESTOR_KYB_ORACLE_ADDRESS : KYB_ORACLE_ADDRESS;

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    if (!oracleAddress || oracleAddress === ZERO_ADDRESS) {
      return jsonError(`Oracle address not configured for role: ${role ?? "supplier"}.`, 500);
    }

    const rpcUrl =
      process.env.SEPOLIA_RPC_URL ||
      process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL ||
      DEFAULT_SEPOLIA_RPC_URL;

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const walletBalance = await publicClient.getBalance({ address: account.address });
    if (walletBalance === 0n) {
      console.error("[KYB Mint API] Server wallet has no ETH for gas.");
      return jsonError("Verifier wallet has no Sepolia ETH for gas.", 500);
    }

    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(rpcUrl),
    });

    console.log("[KYB Mint API] Submitting attestation for wallet:", wallet);

    const txHash = await walletClient.writeContract({
      address: oracleAddress as `0x${string}`,
      abi: KYB_ORACLE_ABI,
      functionName: "submitKYBAttestation",
      args: [
        wallet as `0x${string}`,
        verificationIdBytes32 as `0x${string}`,
        attestationHashBytes32 as `0x${string}`,
        riskScore,
        BigInt(timestamp),
        signature as `0x${string}`,
      ],
    });

    console.log("[KYB Mint API] On-chain attestation submitted:", txHash);

    return NextResponse.json({ success: true, txHash });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[KYB Mint API] Unhandled error:", message);
    return jsonError(`SBT minting failed: ${message}`, 500);
  }
}
