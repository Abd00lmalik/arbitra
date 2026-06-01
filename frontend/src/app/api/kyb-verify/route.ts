import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import {
  KYB_ORACLE_ABI,
  KYB_ORACLE_ADDRESS,
} from "@/lib/contracts";

export const runtime = "nodejs";

interface MockKYBOracleResult {
  verification_id: string;
  company_status: "verified" | "rejected" | "pending";
  sanctions_flag: boolean;
  pep_flag: boolean;
  risk_score: number;
  oracle_signature: string;
}

function runMockKYBPipeline(input: {
  companyName: string;
  country: string;
  registrationNumber: string;
  taxID: string;
}): MockKYBOracleResult {
  if (!input.companyName || input.companyName.length < 2) {
    return {
      verification_id: "KYB-MOCK-FAIL",
      company_status: "rejected",
      sanctions_flag: false,
      pep_flag: false,
      risk_score: 100,
      oracle_signature: "0xMOCK_SIGNED_ATTESTATION",
    };
  }

  let riskScore = 15 + Math.floor(Math.random() * 20);

  const inputHash = createHash("sha256")
    .update(input.companyName + input.country + input.registrationNumber + input.taxID)
    .digest("hex");
  const hashByte = parseInt(inputHash.slice(0, 2), 16);
  riskScore = Math.min(75, riskScore + (hashByte % 20));

  return {
    verification_id: `KYB-MOCK-${10000 + Math.floor(Math.random() * 89999)}`,
    company_status: "verified",
    sanctions_flag: false,
    pep_flag: false,
    risk_score: riskScore,
    oracle_signature: "0xMOCK_SIGNED_ATTESTATION",
  };
}

export async function POST(req: NextRequest) {
  const verifierKey = process.env.VERIFIER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!verifierKey) {
    return NextResponse.json({ error: "VERIFIER_PRIVATE_KEY not set" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { wallet, companyName, country, registrationNumber, taxID } = body as {
    wallet: string;
    companyName: string;
    country: string;
    registrationNumber: string;
    taxID: string;
  };

  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  if (!companyName?.trim() || !country?.trim() || !registrationNumber?.trim() || !taxID?.trim()) {
    return NextResponse.json({ error: "All KYB fields required" }, { status: 400 });
  }

  const kybResult = runMockKYBPipeline({ companyName, country, registrationNumber, taxID });

  if (kybResult.company_status !== "verified") {
    return NextResponse.json({
      error: "Business verification failed. Please check your registration details.",
      verification_id: kybResult.verification_id,
      company_status: kybResult.company_status,
      oracle_signature: kybResult.oracle_signature,
    }, { status: 422 });
  }

  const verificationIdHash = createHash("sha256")
    .update(kybResult.verification_id)
    .digest("hex");

  const attestationPayload = JSON.stringify({
    wallet,
    verificationId: kybResult.verification_id,
    companyStatus: kybResult.company_status,
    sanctionsFlag: kybResult.sanctions_flag,
    pepFlag: kybResult.pep_flag,
    riskScore: kybResult.risk_score,
    timestamp: Date.now(),
  });
  const attestationHash = createHash("sha256").update(attestationPayload).digest("hex");

  const verificationIdBytes32 = `0x${verificationIdHash.padStart(64, "0")}` as `0x${string}`;
  const attestationHashBytes32 = `0x${attestationHash.padStart(64, "0")}` as `0x${string}`;

  try {
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com"),
    });

    const nonce = await publicClient.readContract({
      address: KYB_ORACLE_ADDRESS as `0x${string}`,
      abi: KYB_ORACLE_ABI,
      functionName: "nonces",
      args: [wallet as `0x${string}`],
    }) as bigint;

    const account = privateKeyToAccount(verifierKey);
    const timestamp = Math.floor(Date.now() / 1000);

    const signature = await account.signTypedData({
      domain: {
        name: "Arbitra",
        version: "2",
        chainId: 11155111,
        verifyingContract: KYB_ORACLE_ADDRESS as `0x${string}`,
      },
      types: {
        KYBAttestation: [
          { name: "wallet", type: "address" },
          { name: "verificationId", type: "bytes32" },
          { name: "attestationHash", type: "bytes32" },
          { name: "riskScore", type: "uint8" },
          { name: "timestamp", type: "uint256" },
          { name: "nonce", type: "uint256" },
        ],
      },
      primaryType: "KYBAttestation",
      message: {
        wallet: wallet as `0x${string}`,
        verificationId: verificationIdBytes32,
        attestationHash: attestationHashBytes32,
        riskScore: kybResult.risk_score,
        timestamp: BigInt(timestamp),
        nonce,
      },
    });

    return NextResponse.json({
      verification_id: kybResult.verification_id,
      company_status: kybResult.company_status,
      sanctions_flag: kybResult.sanctions_flag,
      pep_flag: kybResult.pep_flag,
      risk_score: kybResult.risk_score,
      oracle_signature: kybResult.oracle_signature,
      signature,
      timestamp,
      verificationIdBytes32,
      attestationHashBytes32,
      kybApproved: true,
      kybAttestationHash: attestationHashBytes32,
      message: "Business verified. Signature generated.",
    });
  } catch (error) {
    console.error("[kyb-verify] signature generation error:", error);
    return NextResponse.json({
      error: "Oracle attestation signature generation failed.",
      detail: String(error),
    }, { status: 502 });
  }
}
