/*
 * @file zama.ts
 * @description Zama FHEVM SDK initialization and encryption/decryption helpers.
 *              Uses @zama-fhe/relayer-sdk/web (v0.4.1) for web environment.
 */

export type FhevmInstance = any;

let sdkInstance: any | null = null;

export async function getZamaSDK() {
  if (typeof window === "undefined") return null;
  if (sdkInstance) return sdkInstance;

  try {
    /* Load relayer-sdk 0.4.1 /web */
    const { initSDK, createInstance, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/web");
    await initSDK();
    const instance = await createInstance({
      ...SepoliaConfig,
      relayerUrl: "https://relayer.testnet.zama.org",
      network: window.ethereum as any,
    });
    sdkInstance = instance;
    return sdkInstance;
  } catch (e) {
    console.error("[Arbitra] FHEVM init failed:", e);
    return null;
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
