import { NextRequest, NextResponse }  from "next/server";
import { createHash }                 from "crypto";
import { createPublicClient, http }   from "viem";
import { privateKeyToAccount }        from "viem/accounts";
import { sepolia }                    from "viem/chains";
import {
  KYB_ORACLE_ADDRESS,
  KYB_ORACLE_ABI,
} from "@/lib/contracts";

export const runtime = "nodejs";

/* ── MockKYBOracleService: simulates real KYB provider response ── */
function runMockKYBPipeline(input: {
  companyName:        string;
  country:            string;
  registrationNumber: string;
  taxID:              string;
}): {
  verification_id:  string;
  company_status:   "verified" | "rejected" | "pending";
  sanctions_flag:   boolean;
  pep_flag:         boolean;
  risk_score:       number;
} {
  /* Simulate validation */
  if (!input.companyName || input.companyName.length < 2) {
    return {
      verification_id: "KYB-MOCK-FAIL",
      company_status:  "rejected",
      sanctions_flag:  false,
      pep_flag:        false,
      risk_score:      100,
    };
  }

  /* Simulate risk scoring: base 15-35 for clean profiles, with minor adjustments */
  let riskScore = 15 + Math.floor(Math.random() * 20);

  const inputHash = createHash("sha256")
    .update(input.companyName + input.country + input.registrationNumber)
    .digest("hex");
  const hashByte = parseInt(inputHash.slice(0, 2), 16);
  riskScore = Math.min(75, riskScore + (hashByte % 20));

  const verificationNumber = 10000 + Math.floor(Math.random() * 89999);
  const verificationId     = `KYB-MOCK-${verificationNumber}`;

  return {
    verification_id: verificationId,
    company_status:  "verified",
    sanctions_flag:  false,
    pep_flag:        false,
    risk_score:      riskScore,
  };
}

export async function POST(req: NextRequest) {
  const verifierKey = process.env.VERIFIER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!verifierKey) {
    return NextResponse.json({ error: "VERIFIER_PRIVATE_KEY not set" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { wallet, companyName, country, registrationNumber, taxID } = body as {
    wallet:             string;
    companyName:        string;
    country:            string;
    registrationNumber: string;
    taxID:              string;
  };

  /* Input validation */
  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }
  if (!companyName?.trim() || !country || !registrationNumber?.trim() || !taxID?.trim()) {
    return NextResponse.json({ error: "All KYB fields required" }, { status: 400 });
  }

  /* Run mock KYB pipeline */
  const kybResult = runMockKYBPipeline({ companyName, country, registrationNumber, taxID });

  if (kybResult.company_status !== "verified") {
    return NextResponse.json({
      error: "Business verification failed. Please check your registration details.",
      verification_id: kybResult.verification_id,
      company_status:  kybResult.company_status,
    }, { status: 422 });
  }

  /* Prepare on-chain attestation hashes */
  const verificationIdHash = createHash("sha256")
    .update(kybResult.verification_id)
    .digest("hex");

  const attestationPayload = JSON.stringify({
    wallet,
    verificationId: kybResult.verification_id,
    companyStatus: kybResult.company_status,
    sanctionsFlag: kybResult.sanctions_flag,
    pepFlag:       kybResult.pep_flag,
    riskScore:     kybResult.risk_score,
    timestamp:     Date.now(),
  });
  const attestationHash = createHash("sha256").update(attestationPayload).digest("hex");

  const verificationIdBytes32 = `0x${verificationIdHash.padStart(64, "0")}` as `0x${string}`;
  const attestationHashBytes32 = `0x${attestationHash.padStart(64, "0")}`  as `0x${string}`;

  try {
    /* Read current user nonce from the MockKYBOracle contract to prevent signature replay */
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

    /* Sign EIP-712 KYB attestation */
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await account.signTypedData({
      domain: {
        name:    "Arbitra",
        version: "2",
        chainId: 11155111,
        verifyingContract: KYB_ORACLE_ADDRESS as `0x${string}`,
      },
      types: {
        KYBAttestation: [
          { name: "wallet",           type: "address" },
          { name: "verificationId",   type: "bytes32" },
          { name: "attestationHash",  type: "bytes32" },
          { name: "riskScore",        type: "uint8"   },
          { name: "timestamp",        type: "uint256" },
          { name: "nonce",            type: "uint256" },
        ],
      },
      primaryType: "KYBAttestation",
      message: {
        wallet:          wallet as `0x${string}`,
        verificationId:  verificationIdBytes32,
        attestationHash: attestationHashBytes32,
        riskScore:       kybResult.risk_score,
        timestamp:       BigInt(timestamp),
        nonce:           nonce,
      },
    });

    /* Return signed payload and details to the client */
    return NextResponse.json({
      verification_id:  kybResult.verification_id,
      company_status:   kybResult.company_status,
      sanctions_flag:   kybResult.sanctions_flag,
      pep_flag:         kybResult.pep_flag,
      risk_score:       kybResult.risk_score,
      timestamp,
      signature,
      verificationIdBytes32,
      attestationHashBytes32,
      message:          "Business verified. Signature generated.",
    });

  } catch (e) {
    console.error("[kyb-verify] signature generation error:", e);
    return NextResponse.json({
      error: "Oracle attestation signature generation failed.",
      detail: String(e),
    }, { status: 502 });
  }
}
