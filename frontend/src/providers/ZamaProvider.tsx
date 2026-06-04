"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
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
  const attemptedProviderRef = useRef<any>(null);

  const resolveProvider = useCallback(() => {
    if (typeof window === "undefined") return null;
    return (window as any).web3authProvider ?? (window as any).ethereum ?? null;
  }, []);

  const init = useCallback(async () => {
    const provider = resolveProvider();
    if (!provider) {
      attemptedProviderRef.current = null;
      setInstance(null);
      setIsReady(false);
      setError(null);
      return;
    }

    if (attemptedProviderRef.current === provider && (instance || error || isReady)) {
      return;
    }

    attemptedProviderRef.current = provider;

    try {
      /* Dynamic import ensures WASM is not loaded during SSR */
      const { getFhevmInstance } = await import("@/lib/zama");
      const inst = await getFhevmInstance(provider);
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

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;

    const poll = window.setInterval(() => {
      const provider = resolveProvider();
      const hasInstance = provider !== null;
      if (!hasInstance && (instance || isReady || error)) {
        attemptedProviderRef.current = null;
        setInstance(null);
        setIsReady(false);
        setError(null);
        return;
      }

      if (hasInstance && attemptedProviderRef.current !== provider) {
        void init();
      }
    }, 1000);

    return () => window.clearInterval(poll);
  }, [mounted, resolveProvider, init, instance, isReady, error]);

  /* Do not render until mounted to prevent SSR hydration mismatch */
  if (!mounted) return null;

  return (
    <ZamaContext.Provider value={{ instance, isReady, error, reinit: init }}>
      {children}
    </ZamaContext.Provider>
  );
}
