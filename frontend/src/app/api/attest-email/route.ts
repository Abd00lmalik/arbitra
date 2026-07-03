/**
 * @file route.ts
 * @description Confirms debtor email verification through the authorized platform verifier.
 */

import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARBITRA_REGISTRY_ADDRESS, REGISTRY_ABI } from "@/lib/contracts";
import { computeEmailHash, consumeVerifyToken, validateVerifyToken } from "@/lib/tokenStore";

export const runtime = "nodejs";

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

const EMAIL_ATTESTATION_DOMAIN = {
  name: "Arbitra",
  version: "2",
  chainId: 11155111,
  verifyingContract: ARBITRA_REGISTRY_ADDRESS,
} as const;

const LEGACY_REGISTRY_CANDIDATES: readonly `0x${string}`[] = [
  ARBITRA_REGISTRY_ADDRESS,
  "0xDE46d22134f0a9595188aA96dFFAC82561172b9f",
  "0x5a84fa82958D375ffD0d8DA8e8E205173De326e4",
  "0x709A65C50a592079df4Ac376a8E31eF35D5D9a39",
] as const;

const EMAIL_ATTESTATION_TYPES = {
  EmailAttestation: [
    { name: "invoiceId", type: "uint256" },
    { name: "emailHash", type: "bytes32" },
    { name: "verifiedAt", type: "uint256" },
    { name: "expiresAt", type: "uint256" },
  ],
} as const;

function jsonError(message: string, status: number, detail?: Record<string, unknown>) {
  return NextResponse.json(
    detail ? { error: message, ...detail } : { error: message },
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

function getRpcUrl(): string {
  return process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL || DEFAULT_SEPOLIA_RPC_URL;
}

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

async function resolveRegistryAddress(
  publicClient: ReturnType<typeof createPublicClient>,
  invoiceId: bigint,
  hintedRegistry?: `0x${string}`,
): Promise<`0x${string}` | null> {
  const candidates = [
    hintedRegistry,
    ...LEGACY_REGISTRY_CANDIDATES,
  ].filter((value, index, list): value is `0x${string}` => Boolean(value) && list.indexOf(value) === index);

  for (const registryAddress of candidates) {
    try {
      const invoice = await publicClient.readContract({
        address: registryAddress,
        abi: REGISTRY_ABI,
        functionName: "invoices",
        args: [invoiceId],
      }) as readonly unknown[];

      const supplier = invoice[7] as `0x${string}` | undefined;
      if (supplier && !sameAddress(supplier, "0x0000000000000000000000000000000000000000")) {
        return registryAddress;
      }
    } catch {
      continue;
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  let verifierKey: `0x${string}` | null = null;

  try {
    verifierKey = normalizeVerifierKey(process.env.VERIFIER_PRIVATE_KEY);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid verifier key format";
    return jsonError(message, 500);
  }

  if (!verifierKey) {
    return jsonError("VERIFIER_PRIVATE_KEY not configured", 500);
  }

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Invalid JSON", 400);

  const { invoiceId, token } = body as { invoiceId: number; token: string };

  /* Token is intentionally consumed only after the verifier transaction is accepted. */
  const result = await validateVerifyToken(invoiceId, token);
  if (!result.valid) {
    return jsonError("Token invalid or expired", 401);
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + (72 * 60 * 60);
  const emailHash = computeEmailHash(result.debtorEmail) as `0x${string}`;

  try {
    const account = privateKeyToAccount(verifierKey);
    const rpcUrl = getRpcUrl();
    const client = createWalletClient({
      account,
      chain: sepolia,
      transport: http(rpcUrl),
    });
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const resolvedRegistryAddress = await resolveRegistryAddress(
      publicClient,
      BigInt(invoiceId),
      result.registryAddress,
    );

    if (!resolvedRegistryAddress) {
      return jsonError("Invoice registry mismatch", 409, {
        detail: "Could not resolve a live registry that contains this invoice ID.",
        invoiceId,
        hintedRegistry: result.registryAddress ?? null,
      });
    }

    const platformVerifier = await publicClient.readContract({
      address: resolvedRegistryAddress,
      abi: REGISTRY_ABI,
      functionName: "platformVerifier",
    }) as `0x${string}`;

    if (!sameAddress(account.address, platformVerifier)) {
      console.error("[Attest Email API] Platform verifier misconfigured.", {
        registry: ARBITRA_REGISTRY_ADDRESS,
        expectedPlatformVerifier: platformVerifier,
        actualSigner: account.address,
      });

      return jsonError("Platform verifier misconfigured", 500, {
        detail: "VERIFIER_PRIVATE_KEY does not match the on-chain registry platformVerifier.",
        registry: resolvedRegistryAddress,
        expectedPlatformVerifier: platformVerifier,
        actualSigner: account.address,
      });
    }

    const signature = await client.signTypedData({
      domain: {
        ...EMAIL_ATTESTATION_DOMAIN,
        verifyingContract: resolvedRegistryAddress,
      },
      types: EMAIL_ATTESTATION_TYPES,
      primaryType: "EmailAttestation",
      message: {
        invoiceId: BigInt(invoiceId),
        emailHash,
        verifiedAt: BigInt(now),
        expiresAt: BigInt(expiresAt),
      },
    });

    const txHash = await client.writeContract({
      address: resolvedRegistryAddress,
      abi: REGISTRY_ABI,
      functionName: "confirmInvoiceEmailVerified",
      args: [
        BigInt(invoiceId),
        emailHash,
        BigInt(now),
        BigInt(expiresAt),
        signature,
      ],
    });

    await consumeVerifyToken(invoiceId, token);

    return NextResponse.json({
      success: true,
      signature,
      emailHash,
      verifiedAt: now,
      expiresAt,
      verifierAddress: account.address,
      registryAddress: resolvedRegistryAddress,
      txHash,
    });
  } catch (err: unknown) {
    console.error("Attestation broadcast failed:", err);
    const message = err instanceof Error ? err.message : "Failed to broadcast attestation transaction";
    return jsonError(message, 500);
  }
}
