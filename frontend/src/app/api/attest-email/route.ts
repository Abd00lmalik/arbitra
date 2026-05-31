import { NextRequest, NextResponse }             from "next/server";
import { validateVerifyToken, consumeVerifyToken, computeEmailHash } from "@/lib/tokenStore";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount }                   from "viem/accounts";
import { sepolia }                               from "viem/chains";
import { ARBITRA_REGISTRY_ADDRESS, REGISTRY_ABI } from "@/lib/contracts";

export const runtime = "nodejs";

const EMAIL_ATTESTATION_DOMAIN = {
  name:              "Arbitra",
  version:           "2",
  chainId:           11155111,
  verifyingContract: ARBITRA_REGISTRY_ADDRESS,
} as const;

const EMAIL_ATTESTATION_TYPES = {
  EmailAttestation: [
    { name: "invoiceId",   type: "uint256" },
    { name: "emailHash",   type: "bytes32" },
    { name: "verifiedAt",  type: "uint256" },
    { name: "expiresAt",   type: "uint256" },
  ],
} as const;

export async function POST(req: NextRequest) {
  const verifierKey = process.env.VERIFIER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!verifierKey) {
    return NextResponse.json({ error: "VERIFIER_PRIVATE_KEY not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { invoiceId, token } = body as { invoiceId: number; token: string };

  /* Validate the token (does NOT consume yet — tx may fail) */
  const result = await validateVerifyToken(invoiceId, token);
  if (!result.valid) {
    return NextResponse.json({ error: "Token invalid or expired" }, { status: 401 });
  }

  const now        = Math.floor(Date.now() / 1000);
  const expiresAt  = now + (72 * 60 * 60); /* 72h from now */
  const emailHash  = computeEmailHash(result.debtorEmail) as `0x${string}`;

  /* Sign EIP-712 with platform verifier key */
  const account = privateKeyToAccount(verifierKey);
  const client  = createWalletClient({
    account,
    chain: sepolia,
    transport: http(process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL)
  });
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL)
  });

  try {
    const signature = await client.signTypedData({
      domain:      EMAIL_ATTESTATION_DOMAIN,
      types:       EMAIL_ATTESTATION_TYPES,
      primaryType: "EmailAttestation",
      message: {
        invoiceId:  BigInt(invoiceId),
        emailHash,
        verifiedAt: BigInt(now),
        expiresAt:  BigInt(expiresAt),
      },
    });

    /* Submit confirmInvoiceEmailVerified transaction using the verifier wallet */
    const txHash = await client.writeContract({
      address: ARBITRA_REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: "confirmInvoiceEmailVerified",
      args: [
        BigInt(invoiceId),
        emailHash,
        BigInt(now),
        BigInt(expiresAt),
        signature
      ]
    });

    /* Wait for confirmation to guarantee transaction is settled */
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    /* Consume token after successful signing & submission (one-time use) */
    await consumeVerifyToken(invoiceId, token);

    return NextResponse.json({
      success: true,
      signature,
      emailHash,
      verifiedAt:  now,
      expiresAt,
      verifierAddress: account.address,
      txHash,
    });
  } catch (err: any) {
    console.error("Attestation broadcast failed:", err);
    return NextResponse.json({
      error: err.message || "Failed to broadcast attestation transaction"
    }, { status: 500 });
  }
}

