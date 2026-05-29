"use client";

import { createConfig, http, WagmiProvider as WagmiProviderBase } from "wagmi";
import { sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/*
 * Wagmi config for Arbitra.
 * Uses Sepolia testnet. WalletConnect project ID is optional;
 * without it only injected wallets (MetaMask) work.
 */
const wagmiConfig = createConfig({
  chains: [sepolia],
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
  /* Create QueryClient per-render to avoid state sharing across requests in SSR */
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProviderBase config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProviderBase>
  );
}
