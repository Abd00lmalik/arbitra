"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { FhevmInstance } from "@/lib/zama";

interface ZamaContextValue {
  instance: FhevmInstance | null;
  isReady: boolean;
  error: string | null;
  reinit: () => void;
}

const ZamaContext = createContext<ZamaContextValue>({
  instance: null,
  isReady: false,
  error: null,
  reinit: () => {},
});

export function useZama() {
  return useContext(ZamaContext);
}

interface Props {
  children: React.ReactNode;
}

/*
 * ZamaProvider initializes the FHEVM SDK lazily on the client side.
 * Gated behind useEffect to prevent SSR IndexedDB errors (anti-pattern #19c).
 * Returns null until mounted so wagmi + relayer SDK only evaluate on the client.
 */
export function ZamaProvider({ children }: Props) {
  const [mounted, setMounted] = useState(false);
  const [instance, setInstance] = useState<FhevmInstance | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const init = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setError("No Ethereum provider detected. Install MetaMask.");
      return;
    }

    try {
      /* Dynamic import ensures WASM is not loaded during SSR */
      const { getFhevmInstance } = await import("@/lib/zama");
      const inst = await getFhevmInstance(window.ethereum);
      setInstance(inst);
      setIsReady(true);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[ZamaProvider] Init failed:", msg);
      setError(`FHEVM init failed: ${msg}`);
      setIsReady(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    init();
  }, [mounted, init]);

  /* Do not render until mounted to prevent SSR hydration mismatch */
  if (!mounted) return null;

  return (
    <ZamaContext.Provider value={{ instance, isReady, error, reinit: init }}>
      {children}
    </ZamaContext.Provider>
  );
}
