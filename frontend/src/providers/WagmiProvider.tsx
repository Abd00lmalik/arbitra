"use client";

import { createConfig, http, WagmiProvider as WagmiProviderBase } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";

/*
 * Wagmi config for Arbitra.
 * Uses Sepolia testnet. Integrates the dynamic Web3Auth provider under the injected connector.
 */
export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [
    injected({
      target: () => ({
        id: "web3auth",
        name: "Web3Auth",
        provider: typeof window !== "undefined" ? (window as any).web3authProvider : undefined,
      }),
    }),
  ],
  transports: {
    [sepolia.id]: http(
      process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL ||
        "https://ethereum-sepolia-rpc.publicnode.com"
    ),
  },
});

interface Props {
  children: React.ReactNode;
}

export function WagmiProvider({ children }: Props) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  /* Create QueryClient per-render to avoid state sharing across requests in SSR */
  const [queryClient] = useState(() => new QueryClient());

  if (!mounted) {
    return null;
  }

  return (
    <WagmiProviderBase config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProviderBase>
  );
}
