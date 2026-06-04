import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, defineChain, formatEther, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";
import {
  IDENTITY_ABI,
  IDENTITY_ADDRESS,
} from "@/lib/contracts";

export const runtime = "nodejs";

const EXPECTED_VERIFIER_ADDRESS = "0x7e0Af9e55184b2b4bd5bac455493c035d51eee3E";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
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

interface ComplianceStoreRequestBody {
  wallet: string;
  taxID: string;
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

function toHex(value: Uint8Array | string): `0x${string}` {
  if (typeof value === "string") return value as `0x${string}`;
  return (`0x${Array.from(value).map((part) => part.toString(16).padStart(2, "0")).join("")}`) as `0x${string}`;
}

export async function POST(req: NextRequest) {
  let requestBody: ComplianceStoreRequestBody | null = null;

  try {
    const normalizedVerifierKey = normalizeVerifierKey(process.env.VERIFIER_PRIVATE_KEY);
    if (!normalizedVerifierKey) {
      return jsonError("Server configuration error: verifier key not configured.", 500);
    }

    if (!IDENTITY_ADDRESS || IDENTITY_ADDRESS === ZERO_ADDRESS) {
      return jsonError("Server configuration error: identity contract address not configured.", 500);
    }

    const account = privateKeyToAccount(normalizedVerifierKey);
    if (account.address.toLowerCase() !== EXPECTED_VERIFIER_ADDRESS.toLowerCase()) {
      return jsonError("Server configuration error: verifier key does not match the authorized relayer signer.", 500);
    }

    requestBody = await req.json().catch(() => null);
    if (!requestBody) {
      return jsonError("Invalid JSON request body.", 400);
    }

    const { wallet, taxID, kybApproved, riskScore } = requestBody;
    if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
      return jsonError("Invalid wallet address.", 400);
    }

    const taxIdDigits = taxID.replace(/\D/g, "");
    if (!taxIdDigits || taxIdDigits.length > 9) {
      return jsonError("Invalid Tax ID format.", 400);
    }

    if (!Number.isInteger(riskScore) || riskScore < 0 || riskScore > 255) {
      return jsonError("Risk score must be an integer between 0 and 255.", 400);
    }

    const taxIDInt = Number.parseInt(taxIdDigits, 10);
    if (!Number.isSafeInteger(taxIDInt)) {
      return jsonError("Tax ID must fit into a 32-bit unsigned integer.", 400);
    }

    const rpcUrl =
      process.env.SEPOLIA_RPC_URL ||
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
      process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL ||
      DEFAULT_SEPOLIA_RPC_URL;

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const walletBalance = await publicClient.getBalance({ address: account.address });
    console.log("[Compliance API] Server wallet balance:", `${formatEther(walletBalance)} ETH`);
    if (walletBalance === 0n) {
      return jsonError("Server relayer has no Sepolia ETH for gas.", 503);
    }

    const sdk = await createInstance({
      ...SepoliaConfig,
      network: rpcUrl,
    });

    const encryptedInput = sdk.createEncryptedInput(IDENTITY_ADDRESS, account.address);
    encryptedInput.add32(BigInt(taxIDInt));
    encryptedInput.addBool(kybApproved);
    encryptedInput.add8(BigInt(riskScore));
    const encrypted = await encryptedInput.encrypt();

    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const txHash = await walletClient.writeContract({
      address: IDENTITY_ADDRESS,
      abi: IDENTITY_ABI,
      functionName: "submitEncryptedComplianceFor",
      args: [
        wallet as `0x${string}`,
        toHex(encrypted.handles[0]),
        toHex(encrypted.inputProof),
        toHex(encrypted.handles[1]),
        toHex(encrypted.inputProof),
        toHex(encrypted.handles[2]),
        toHex(encrypted.inputProof),
      ],
      gas: 500000n,
    });

    console.log("[Compliance API] Submitted encrypted compliance on-chain:", txHash);

    return NextResponse.json({
      success: true,
      txHash,
      relayerAddress: account.address,
      message: "Encrypted compliance submitted on-chain.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Compliance API] Unhandled error:", {
      message,
      wallet: requestBody?.wallet,
      identityAddress: IDENTITY_ADDRESS,
    });
    return jsonError(`Encrypted compliance submission failed: ${message}`, 500);
  }
}
