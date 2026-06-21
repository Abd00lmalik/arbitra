/**
 * @file route.ts
 * @description Mock lockbox bank webhook that signs settlement payment proofs.
 */

import { NextRequest, NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { ESCROW_RECEIVER_ADDRESS } from "@/lib/contracts";
import { keccak256, toBytes } from "viem";

export const runtime = "nodejs";

const SETTLEMENT_DOMAIN = {
  name: "ArbitraSettlement",
  version: "1",
  chainId: 11155111,
  verifyingContract: ESCROW_RECEIVER_ADDRESS,
} as const;

const PAYMENT_RECEIVED_TYPES = {
  PaymentReceived: [
    { name: "invoiceId", type: "uint256" },
    { name: "paymentReference", type: "bytes32" },
    { name: "amount", type: "uint256" },
    { name: "receivedAt", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

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

function toBytes32Commitment(value: string): `0x${string}` {
  return keccak256(toBytes(value));
}

export async function POST(req: NextRequest) {
  let verifierKey: `0x${string}` | null = null;
  try {
    verifierKey = normalizeVerifierKey(process.env.VERIFIER_PRIVATE_KEY);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid verifier key format";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!verifierKey) {
    return NextResponse.json({ error: "VERIFIER_PRIVATE_KEY not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const {
    invoiceId,
    amount,
    paymentReference,
    bankTraceId,
  } = body as {
    invoiceId?: string | number;
    amount?: string;
    paymentReference?: string;
    bankTraceId?: string;
  };

  if (invoiceId === undefined || amount === undefined) {
    return NextResponse.json({ error: "invoiceId and amount are required" }, { status: 400 });
  }

  const invoiceIdBigInt = BigInt(invoiceId);
  const amountBigInt = BigInt(amount);
  const receivedAt = BigInt(Math.floor(Date.now() / 1000));
  const nonce = BigInt(Date.now());
  const paymentReferencePlain = paymentReference || `ARB-LOCKBOX-${invoiceIdBigInt.toString()}-${nonce.toString()}`;
  const bankTracePlain = bankTraceId || `MOCKBANK-${invoiceIdBigInt.toString()}-${nonce.toString()}`;
  const paymentReferenceHash = toBytes32Commitment(paymentReferencePlain);
  const bankTraceHash = toBytes32Commitment(bankTracePlain);

  const account = privateKeyToAccount(verifierKey);
  const signature = await account.signTypedData({
    domain: SETTLEMENT_DOMAIN,
    types: PAYMENT_RECEIVED_TYPES,
    primaryType: "PaymentReceived",
    message: {
      invoiceId: invoiceIdBigInt,
      paymentReference: paymentReferenceHash,
      amount: amountBigInt,
      receivedAt,
      nonce,
    },
  });

  return NextResponse.json({
    success: true,
    proof: {
      invoiceId: invoiceIdBigInt.toString(),
      paymentReference: paymentReferenceHash,
      paymentReferencePlain,
      amount: amountBigInt.toString(),
      receivedAt: receivedAt.toString(),
      nonce: nonce.toString(),
      bankTraceId: bankTraceHash,
      bankTracePlain,
      signature,
      verifierAddress: account.address,
    },
    webhook: {
      receivedAt: new Date(Number(receivedAt) * 1000).toISOString(),
      source: "mock-spv-lockbox",
      status: "PAYMENT_RECEIVED",
    },
  });
}
