"use client";

/**
 * Zama FHEVM SDK integration for Arbitra.
 * Uses @zama-fhe/relayer-sdk/web (browser sub-path).
 * IMPORTANT: This module must only be imported in client components.
 *            The initSDK/createInstance calls touch IndexedDB which does not
 *            exist during Next.js SSR.
 */

import { useEffect, useState } from "react";

/* Sub-path import required — bare import fails (anti-pattern #15) */
import {
  createInstance,
  initSDK,
  SepoliaConfig,
} from "@zama-fhe/relayer-sdk/web";

export type FhevmInstance = Awaited<ReturnType<typeof createInstance>>;

let instanceCache: FhevmInstance | null = null;
let initPromise: Promise<FhevmInstance> | null = null;

/**
 * Initialize and return the Zama SDK instance (singleton).
 * Safe to call multiple times; only initializes once.
 */
export async function getFhevmInstance(
  provider: unknown
): Promise<FhevmInstance> {
  if (instanceCache) return instanceCache;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    /* initSDK pre-loads WASM modules; calling it first gives control over timing */
    await initSDK();
    instanceCache = await createInstance({
      ...SepoliaConfig,
      network: provider as Parameters<typeof createInstance>[0]["network"],
    });
    return instanceCache;
  })();

  return initPromise;
}

/**
 * React hook that lazily initializes the Zama SDK instance.
 * Gated behind useEffect to avoid SSR IndexedDB errors (anti-pattern #19c).
 */
export function useFhevmInstance(): FhevmInstance | null {
  const [instance, setInstance] = useState<FhevmInstance | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (typeof window === "undefined" || !window.ethereum) return;

      try {
        const inst = await getFhevmInstance(window.ethereum);
        if (!cancelled) setInstance(inst);
      } catch (err) {
        console.error("[Zama] Failed to initialize FHEVM instance:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return instance;
}

/**
 * Encrypt a single euint64 value for a specific contract and user.
 * Returns { handles, inputProof } ready for contract calls.
 */
export async function encryptUint64(
  instance: FhevmInstance,
  value: bigint,
  contractAddress: string,
  userAddress: string
): Promise<{ handle: Uint8Array; inputProof: Uint8Array }> {
  const input = instance.createEncryptedInput(contractAddress, userAddress);
  input.add64(value);
  const encrypted = await input.encrypt();
  return {
    handle: encrypted.handles[0],
    inputProof: encrypted.inputProof,
  };
}

/**
 * Encrypt two euint64 values in a single input (shared proof).
 * Used for uploadInvoice (faceValue + dueDate).
 */
export async function encryptTwoUint64(
  instance: FhevmInstance,
  value1: bigint,
  value2: bigint,
  contractAddress: string,
  userAddress: string
): Promise<{
  handle1: Uint8Array;
  handle2: Uint8Array;
  inputProof: Uint8Array;
}> {
  const input = instance.createEncryptedInput(contractAddress, userAddress);
  input.add64(value1);
  input.add64(value2);
  const encrypted = await input.encrypt();
  return {
    handle1: encrypted.handles[0],
    handle2: encrypted.handles[1],
    inputProof: encrypted.inputProof,
  };
}

/**
 * Perform EIP-712 userDecrypt for a set of handles from a contract.
 * The caller must have ACL permission (via FHE.allow) on each handle.
 * Returns a bare Record (not wrapped in .clearValues) per anti-pattern #18.
 */
export async function userDecryptHandles(
  instance: FhevmInstance,
  handles: Array<{ handle: string; contractAddress: string }>,
  signer: {
    signTypedData: (
      domain: object,
      types: object,
      value: object
    ) => Promise<string>;
    getAddress: () => Promise<string>;
  }
): Promise<Record<string, bigint | boolean | string>> {
  const userAddress = await signer.getAddress();
  const keypair = instance.generateKeypair();

  const startTimestamp = Math.floor(Date.now() / 1000);
  const durationDays = 7;

  const contractAddresses = [...new Set(handles.map((h) => h.contractAddress))];

  const eip712 = instance.createEIP712(
    keypair.publicKey,
    contractAddresses,
    startTimestamp,
    durationDays
  );

  /* Drop EIP712Domain from types — ethers v6 derives it from domain */
  const { EIP712Domain: _omit, ...typesWithoutDomain } = eip712.types;

  const signature = await signer.signTypedData(
    eip712.domain,
    typesWithoutDomain as Record<string, Array<{ name: string; type: string }>>,
    eip712.message
  );

  /* userDecrypt returns a bare Record, NOT an object with .clearValues */
  const clearValues = await instance.userDecrypt(
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
