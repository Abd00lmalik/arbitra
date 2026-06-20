/*
 * @file zama.ts
 * @description Zama FHEVM SDK initialization and encryption/decryption helpers.
 *              Uses @zama-fhe/relayer-sdk/web (v0.4.1) for web environment.
 */

export type FhevmInstance = any;

let sdkInstance: any | null = null;
let sdkInitPromise: Promise<any> | null = null;
let sdkProviderRef: any | null = null;

const SEPOLIA_CHAIN_ID = "0xaa36a7";
const DEFAULT_SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const DEFAULT_SEPOLIA_RELAYER_URL = "https://relayer.testnet.zama.org/v2";

function resolveBrowserProvider(preferredProvider?: any) {
  if (preferredProvider) return preferredProvider;
  if (typeof window === "undefined") return null;
  return (window as any).web3authProvider ?? (window as any).ethereum ?? null;
}

function getSepoliaRpcUrl() {
  return (
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    DEFAULT_SEPOLIA_RPC_URL
  );
}

function getSepoliaRelayerUrl() {
  return process.env.NEXT_PUBLIC_ZAMA_RELAYER_URL || DEFAULT_SEPOLIA_RELAYER_URL;
}

async function assertSepoliaProvider(provider: any) {
  if (!provider || typeof provider.request !== "function") return;

  const chainId = await provider.request({ method: "eth_chainId" });
  if (typeof chainId === "string" && chainId.toLowerCase() !== SEPOLIA_CHAIN_ID) {
    throw new Error("FHEVM encryption is only available on Sepolia. Switch your wallet to chain 11155111 and try again.");
  }
}

export function resetZamaSDK() {
  sdkInstance = null;
  sdkInitPromise = null;
  sdkProviderRef = null;
}

export async function getZamaSDK(network?: any) {
  if (typeof window === "undefined") {
    throw new Error("FHEVM SDK is only available in the browser.");
  }

  try {
    const resolvedNetwork = resolveBrowserProvider(network);
    if (!resolvedNetwork) {
      throw new Error("No wallet provider detected for FHE encryption.");
    }
    await assertSepoliaProvider(resolvedNetwork);

    if (sdkInstance && sdkProviderRef === resolvedNetwork) {
      return sdkInstance;
    }

    if (sdkInitPromise && sdkProviderRef === resolvedNetwork) {
      return await sdkInitPromise;
    }

    if (sdkProviderRef && sdkProviderRef !== resolvedNetwork) {
      resetZamaSDK();
    }

    sdkProviderRef = resolvedNetwork;

    /* Load relayer-sdk 0.4.1 /web */
    sdkInitPromise = (async () => {
      const { initSDK, createInstance, SepoliaConfigV2 } = await import("@zama-fhe/relayer-sdk/web");
      const sepoliaRpcUrl = getSepoliaRpcUrl();
      const relayerUrl = getSepoliaRelayerUrl();
      console.info("[FHE] Initializing Zama SDK on Sepolia");
      console.info("[FHE] Using RPC:", sepoliaRpcUrl);
      console.info("[FHE] Using relayer:", relayerUrl);
      await initSDK();
      const instance = await createInstance({
        ...SepoliaConfigV2,
        network: sepoliaRpcUrl,
        relayerUrl,
      });
      console.info("[FHE] Instance created successfully");
      sdkInstance = instance;
      return sdkInstance;
    })();

    return await sdkInitPromise;
  } catch (e) {
    sdkInitPromise = null;
    if (!sdkInstance) {
      sdkProviderRef = null;
    }
    console.error("[Arbitra] FHEVM init failed:", e);
    throw new Error(e instanceof Error ? e.message : "FHEVM SDK initialization failed.");
  }
}

export const getFhevmInstance = getZamaSDK;

/*
 * Encrypt a uint64 value for on-chain submission.
 * Returns the externalEuint64 handle and ZKPoK proof bytes as hex strings.
 */
export async function encryptUint64(
  instance: any,
  value: bigint,
  contractAddress: string,
  userAddress: string
): Promise<{ handle: `0x${string}`; inputProof: `0x${string}` }> {
  const activeInstance = instance || (await getZamaSDK());
  if (!activeInstance) throw new Error("FHEVM SDK not initialized");

  const input = activeInstance.createEncryptedInput(contractAddress, userAddress);
  input.add64(value);
  const encrypted = await input.encrypt();

  const toHex = (b: Uint8Array | string): `0x${string}` => {
    if (typeof b === "string") return b as `0x${string}`;
    return ("0x" + Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
  };

  return {
    handle: toHex(encrypted.handles[0]),
    inputProof: toHex(encrypted.inputProof),
  };
}

/*
 * Encrypt two uint64 values in a single input (shared proof).
 * Used for uploadInvoice (faceValue + dueDate).
 */
export async function encryptTwoUint64(
  instance: any,
  value1: bigint,
  value2: bigint,
  contractAddress: string,
  userAddress: string
): Promise<{
  handle1: `0x${string}`;
  handle2: `0x${string}`;
  inputProof: `0x${string}`;
}> {
  const activeInstance = instance || (await getZamaSDK());
  if (!activeInstance) throw new Error("FHEVM SDK not initialized");

  const input = activeInstance.createEncryptedInput(contractAddress, userAddress);
  input.add64(value1);
  input.add64(value2);
  const encrypted = await input.encrypt();

  const toHex = (b: Uint8Array | string): `0x${string}` => {
    if (typeof b === "string") return b as `0x${string}`;
    return ("0x" + Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
  };

  return {
    handle1: toHex(encrypted.handles[0]),
    handle2: toHex(encrypted.handles[1]),
    inputProof: toHex(encrypted.inputProof),
  };
}

/*
 * Encrypt five uint64 values in a single input (shared proof).
 * Used for uploadInvoice (faceValue + dueDate + fingerprint + baseRate + reputationMultiplier).
 */
export async function encryptFiveUint64(
  instance: any,
  val1: bigint,
  val2: bigint,
  val3: bigint,
  val4: bigint,
  val5: bigint,
  contractAddress: string,
  userAddress: string
): Promise<{
  handle1: `0x${string}`;
  handle2: `0x${string}`;
  handle3: `0x${string}`;
  handle4: `0x${string}`;
  handle5: `0x${string}`;
  inputProof: `0x${string}`;
}> {
  const activeInstance = instance || (await getZamaSDK());
  if (!activeInstance) throw new Error("FHEVM SDK not initialized");

  const input = activeInstance.createEncryptedInput(contractAddress, userAddress);
  input.add64(val1);
  input.add64(val2);
  input.add64(val3);
  input.add64(val4);
  input.add64(val5);
  const encrypted = await input.encrypt();

  const toHex = (b: Uint8Array | string): `0x${string}` => {
    if (typeof b === "string") return b as `0x${string}`;
    return ("0x" + Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
  };

  return {
    handle1: toHex(encrypted.handles[0]),
    handle2: toHex(encrypted.handles[1]),
    handle3: toHex(encrypted.handles[2]),
    handle4: toHex(encrypted.handles[3]),
    handle5: toHex(encrypted.handles[4]),
    inputProof: toHex(encrypted.inputProof),
  };
}

/*
 * EIP-712 userDecrypt for a set of encrypted handles.
 * Triggers a MetaMask signature prompt.
 * Compatible with useInvoiceDecrypt hook.
 */
export async function userDecryptHandles(
  instance: any,
  handles: Array<{ handle: string; contractAddress: string }>,
  signer: {
    signTypedData: (domain: object, types: object, value: object) => Promise<string>;
    getAddress: () => Promise<string>;
  }
): Promise<Record<string, bigint | boolean | string>> {
  const activeInstance = instance || (await getZamaSDK());
  if (!activeInstance) throw new Error("FHEVM SDK not initialized");

  /* EIP-712 decryption using relayer-sdk */
  const userAddress = await signer.getAddress();
  const keypair = activeInstance.generateKeypair();
  const startTimestamp = Math.floor(Date.now() / 1000);
  const durationDays = 7;
  const contractAddresses = [...new Set(handles.map((h) => h.contractAddress))];

  const eip712 = activeInstance.createEIP712(
    keypair.publicKey,
    contractAddresses,
    startTimestamp,
    durationDays
  );

  /* Drop EIP712Domain from types - ethers v6 derives it from domain */
  const { EIP712Domain: _omit, ...typesWithoutDomain } = eip712.types;

  const signature = await signer.signTypedData(
    eip712.domain,
    typesWithoutDomain as Record<string, Array<{ name: string; type: string }>>,
    eip712.message
  );

  const clearValues = await activeInstance.userDecrypt(
    handles.map((h) => ({ handle: h.handle, contractAddress: h.contractAddress })),
    keypair.privateKey,
    keypair.publicKey,
    signature,
    contractAddresses,
    userAddress,
    startTimestamp,
    durationDays
  );

  return clearValues as Record<string, bigint | boolean | string>;
}

/**
 * Encrypt a uint32 value (for taxID).
 */
export async function encryptUint32(
  value:           bigint,
  walletAddress:   `0x${string}`,
  contractAddress: `0x${string}`
): Promise<{ handle: `0x${string}`; proof: `0x${string}` }> {
  const sdk = await getZamaSDK();
  if (!sdk) throw new Error("FHEVM SDK not initialized");
  const input = sdk.createEncryptedInput(contractAddress, walletAddress);
  input.add32(value);
  const encrypted = await input.encrypt();

  const toHex = (b: Uint8Array | string): `0x${string}` => {
    if (typeof b === "string") return b as `0x${string}`;
    return ("0x" + Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
  };

  return {
    handle: toHex(encrypted.handles[0]),
    proof:  toHex(encrypted.inputProof),
  };
}

/**
 * Encrypt a boolean value (for kybStatus).
 */
export async function encryptBool(
  value:           boolean,
  walletAddress:   `0x${string}`,
  contractAddress: `0x${string}`
): Promise<{ handle: `0x${string}`; proof: `0x${string}` }> {
  const sdk = await getZamaSDK();
  if (!sdk) throw new Error("FHEVM SDK not initialized");
  const input = sdk.createEncryptedInput(contractAddress, walletAddress);
  input.addBool(value);
  const encrypted = await input.encrypt();

  const toHex = (b: Uint8Array | string): `0x${string}` => {
    if (typeof b === "string") return b as `0x${string}`;
    return ("0x" + Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
  };

  return {
    handle: toHex(encrypted.handles[0]),
    proof:  toHex(encrypted.inputProof),
  };
}

/**
 * Encrypt a uint8 value (for riskScore 0-100).
 */
export async function encryptUint8(
  value:           bigint,
  walletAddress:   `0x${string}`,
  contractAddress: `0x${string}`
): Promise<{ handle: `0x${string}`; proof: `0x${string}` }> {
  const sdk = await getZamaSDK();
  if (!sdk) throw new Error("FHEVM SDK not initialized");
  const input = sdk.createEncryptedInput(contractAddress, walletAddress);
  input.add8(value);
  const encrypted = await input.encrypt();

  const toHex = (b: Uint8Array | string): `0x${string}` => {
    if (typeof b === "string") return b as `0x${string}`;
    return ("0x" + Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
  };

  return {
    handle: toHex(encrypted.handles[0]),
    proof:  toHex(encrypted.inputProof),
  };
}
