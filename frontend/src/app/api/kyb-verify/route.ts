import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createPublicClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  KYB_ORACLE_ABI,
  KYB_ORACLE_ADDRESS,
} from "@/lib/contracts";

export const runtime = "nodejs";

const EXPECTED_VERIFIER_ADDRESS = "0x46F6935E41856D62d8f9ABd2b894ab27669a0dc9";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

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

interface MockKYBOracleResult {
  verification_id: string;
  company_status: "verified" | "rejected" | "pending";
  sanctions_flag: boolean;
  pep_flag: boolean;
  risk_score: number;
  oracle_signature: string;
}

interface KybRequestBody {
  wallet: string;
  companyName: string;
  country: string;
  registrationNumber: string;
  taxID: string;
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
  const hashByte = Number.parseInt(inputHash.slice(0, 2), 16);
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
  let requestBody: KybRequestBody | null = null;

  try {
    const normalizedVerifierKey = normalizeVerifierKey(process.env.VERIFIER_PRIVATE_KEY);
    if (!normalizedVerifierKey) {
      console.error("[KYB API] FATAL: VERIFIER_PRIVATE_KEY is not set in the environment.");
      return jsonError("Server configuration error: verifier key not configured.", 500);
    }

    if (!KYB_ORACLE_ADDRESS || KYB_ORACLE_ADDRESS === ZERO_ADDRESS) {
      console.error("[KYB API] FATAL: NEXT_PUBLIC_KYB_ORACLE_ADDRESS is missing or zero.");
      return jsonError("Server configuration error: KYB oracle address not configured.", 500);
    }

    let account;
    try {
      account = privateKeyToAccount(normalizedVerifierKey);
    } catch (error) {
      console.error("[KYB API] FATAL: Invalid VERIFIER_PRIVATE_KEY format.", error);
      return jsonError("Server configuration error: invalid verifier key format.", 500);
    }

    console.log("[KYB API] Signer address:", account.address);

    if (account.address.toLowerCase() !== EXPECTED_VERIFIER_ADDRESS.toLowerCase()) {
      console.error("[KYB API] FATAL: VERIFIER_PRIVATE_KEY derives to an unexpected signer.", {
        signerAddress: account.address,
        expectedSignerAddress: EXPECTED_VERIFIER_ADDRESS,
      });
      return jsonError("Server configuration error: verifier key does not match the authorized oracle signer.", 500);
    }

    requestBody = await req.json().catch(() => null);
    if (!requestBody) {
      return jsonError("Invalid JSON request body.", 400);
    }

    const { wallet, companyName, country, registrationNumber, taxID } = requestBody;

    console.log("[KYB API] Incoming request:", JSON.stringify({
      wallet,
      companyName,
      country,
      registrationNumber,
    }));

    if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
      return jsonError("Invalid wallet address.", 400);
    }

    if (!companyName?.trim() || !country?.trim() || !registrationNumber?.trim() || !taxID?.trim()) {
      return jsonError("All KYB fields are required.", 400);
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

    const timestamp = Math.floor(Date.now() / 1000);
    const attestationPayload = JSON.stringify({
      wallet,
      verificationId: kybResult.verification_id,
      companyStatus: kybResult.company_status,
      sanctionsFlag: kybResult.sanctions_flag,
      pepFlag: kybResult.pep_flag,
      riskScore: kybResult.risk_score,
      timestamp,
    });
    const attestationHash = createHash("sha256").update(attestationPayload).digest("hex");

    const verificationIdBytes32 = `0x${verificationIdHash.padStart(64, "0")}` as `0x${string}`;
    const attestationHashBytes32 = `0x${attestationHash.padStart(64, "0")}` as `0x${string}`;

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

    console.log("[KYB API] Oracle nonce:", nonce.toString());

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

    console.log("[KYB API] Signature generated successfully.");

    return NextResponse.json({
      verification_id: kybResult.verification_id,
      company_status: kybResult.company_status,
      sanctions_flag: kybResult.sanctions_flag,
      pep_flag: kybResult.pep_flag,
      risk_score: kybResult.risk_score,
      oracle_signature: kybResult.oracle_signature,
      signature,
      verified_at: timestamp,
      verification_id_bytes32: verificationIdBytes32,
      attestation_hash_bytes32: attestationHashBytes32,
      kybApproved: true,
      kybAttestationHash: attestationHashBytes32,
      signerAddress: account.address,
      message: "Business verified. Signature generated.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[KYB API] Unhandled error:", {
      message,
      wallet: requestBody?.wallet,
      kybOracleAddress: KYB_ORACLE_ADDRESS,
    });
    return jsonError(`Oracle attestation failed: ${message}`, 500);
  }
}
