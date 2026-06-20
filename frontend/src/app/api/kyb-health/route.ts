import { NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";

export const runtime = "nodejs";

const EXPECTED_VERIFIER_ADDRESS =
  process.env.PLATFORM_VERIFIER_ADDRESS ||
  process.env.ORACLE_BACKEND_ADDRESS ||
  "0x7e0Af9e55184b2b4bd5bac455493c035d51eee3E";

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

export async function GET() {
  /*
   * Temporary production diagnostic endpoint.
   * Remove after verifying the deployed VERIFIER_PRIVATE_KEY configuration.
   */
  try {
    const normalizedVerifierKey = normalizeVerifierKey(process.env.VERIFIER_PRIVATE_KEY);
    if (!normalizedVerifierKey) {
      return NextResponse.json({
        status: "error",
        issue: "VERIFIER_PRIVATE_KEY not set",
        expectedSignerAddress: EXPECTED_VERIFIER_ADDRESS,
      });
    }

    const account = privateKeyToAccount(normalizedVerifierKey);
    const matches = account.address.toLowerCase() === EXPECTED_VERIFIER_ADDRESS.toLowerCase();

    return NextResponse.json({
      status: matches ? "ok" : "wrong_key",
      signerAddress: account.address,
      expectedSignerAddress: EXPECTED_VERIFIER_ADDRESS,
      matches,
    });
  } catch (error) {
    return NextResponse.json({
      status: "invalid_key_format",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
