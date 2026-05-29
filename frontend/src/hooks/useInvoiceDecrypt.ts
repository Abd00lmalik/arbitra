"use client";

import { useState, useCallback } from "react";
import { useZama } from "@/providers/ZamaProvider";
import { ARBITRA_REGISTRY_ADDRESS } from "@/lib/contracts";
import { userDecryptHandles } from "@/lib/zama";

interface DecryptedValues {
  faceValue?: bigint;
  dueDate?: bigint;
  purchasePrice?: bigint;
  discountRate?: bigint;
}

interface UseInvoiceDecryptResult {
  decrypted: DecryptedValues | null;
  isDecrypting: boolean;
  error: string | null;
  decrypt: (
    handles: {
      faceValueHandle: `0x${string}`;
      dueDateHandle: `0x${string}`;
      purchasePriceHandle: `0x${string}`;
      discountRateHandle: `0x${string}`;
    },
    signer: {
      signTypedData: (d: object, t: object, v: object) => Promise<string>;
      getAddress: () => Promise<string>;
    }
  ) => Promise<void>;
}

/**
 * Hook to perform EIP-712 userDecrypt on invoice handles.
 * The caller must have ACL permission on each handle (via FHE.allow in the contract).
 * Supplier always has permission; investor gets permission after factoring.
 */
export function useInvoiceDecrypt(): UseInvoiceDecryptResult {
  const { instance } = useZama();
  const [decrypted, setDecrypted] = useState<DecryptedValues | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decrypt = useCallback(
    async (
      handles: {
        faceValueHandle: `0x${string}`;
        dueDateHandle: `0x${string}`;
        purchasePriceHandle: `0x${string}`;
        discountRateHandle: `0x${string}`;
      },
      signer: {
        signTypedData: (d: object, t: object, v: object) => Promise<string>;
        getAddress: () => Promise<string>;
      }
    ) => {
      if (!instance) {
        setError("FHEVM SDK not initialized. Connect your wallet.");
        return;
      }

      setIsDecrypting(true);
      setError(null);

      try {
        const contractAddress = ARBITRA_REGISTRY_ADDRESS;

        /*
         * Build the list of handle-contract pairs.
         * userDecrypt returns a bare Record<handle, value> (not wrapped in .clearValues).
         * This follows the anti-pattern guide: userDecrypt != publicDecrypt shape.
         */
        const handlePairs = [
          { handle: handles.faceValueHandle, contractAddress },
          { handle: handles.dueDateHandle, contractAddress },
          { handle: handles.purchasePriceHandle, contractAddress },
          { handle: handles.discountRateHandle, contractAddress },
        ];

        const clearValues = await userDecryptHandles(instance, handlePairs, signer);

        setDecrypted({
          faceValue: clearValues[handles.faceValueHandle] as bigint | undefined,
          dueDate: clearValues[handles.dueDateHandle] as bigint | undefined,
          purchasePrice: clearValues[handles.purchasePriceHandle] as bigint | undefined,
          discountRate: clearValues[handles.discountRateHandle] as bigint | undefined,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Decryption failed";
        console.error("[useInvoiceDecrypt] Error:", msg);
        /* Surface actionable error: SenderNotAllowed means the user lacks ACL */
        if (msg.includes("SenderNotAllowed") || msg.includes("not allowed")) {
          setError(
            "You do not have permission to decrypt this invoice. Only the supplier and investor (after factoring) can decrypt."
          );
        } else {
          setError(`Decryption failed: ${msg}`);
        }
      } finally {
        setIsDecrypting(false);
      }
    },
    [instance]
  );

  return { decrypted, isDecrypting, error, decrypt };
}
