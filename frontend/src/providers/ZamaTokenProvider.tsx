"use client";

/*
 * @file ZamaTokenProvider.tsx
 * @description Client-only React SDK provider for ERC-7984 token flows on
 *              Sepolia. This is kept separate from the legacy relayer provider
 *              used elsewhere in Arbitra so confidential token operations can
 *              use the new Zama SDK without disturbing existing custom FHE
 *              contract flows.
 */

import { PropsWithChildren, useMemo } from "react";
import { createConfig, indexedDBStorage, sepolia as zamaSepolia, type FheChain } from "@zama-fhe/sdk";
import { EthersProvider, EthersSigner } from "@zama-fhe/sdk/ethers";
import { ViemProvider, ViemSigner } from "@zama-fhe/sdk/viem";
import { web } from "@zama-fhe/sdk/web";
import { ZamaProvider } from "@zama-fhe/react-sdk";
import { createPublicClient, http } from "viem";
import { sepolia as viemSepolia } from "viem/chains";
import { usePublicClient, useWalletClient } from "wagmi";
import { useWeb3Auth } from "@/providers/Web3AuthProvider";

const DEFAULT_SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const DEFAULT_SEPOLIA_RELAYER_URL = "https://relayer.testnet.zama.org/v2";

function buildSepoliaChain(): FheChain {
  return {
    ...zamaSepolia,
    network:
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
      process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL ||
      DEFAULT_SEPOLIA_RPC_URL,
    relayerUrl:
      process.env.NEXT_PUBLIC_ZAMA_RELAYER_URL ||
      DEFAULT_SEPOLIA_RELAYER_URL,
  };
}

export function ZamaTokenProvider({ children }: PropsWithChildren) {
  const { data: walletClient } = useWalletClient();
  const wagmiPublicClient = usePublicClient({ chainId: 11155111 });
  const { getProvider } = useWeb3Auth();

  const config = useMemo(() => {
    const chain = buildSepoliaChain();
    const rpcUrl = typeof chain.network === "string" ? chain.network : DEFAULT_SEPOLIA_RPC_URL;
    const publicClient =
      wagmiPublicClient ??
      createPublicClient({
        chain: viemSepolia,
        transport: http(rpcUrl),
      });

    const relayers = { [chain.id]: web() };
    const baseConfig = {
      chains: [chain] as [FheChain],
      relayers,
      storage: indexedDBStorage,
      permitStorage: indexedDBStorage,
    };

    const embeddedProvider = typeof window !== "undefined" ? getProvider() : null;
    if (embeddedProvider) {
      return createConfig({
        ...baseConfig,
        provider: new EthersProvider({ ethereum: embeddedProvider }),
        signer: new EthersSigner({ ethereum: embeddedProvider }),
      });
    }

    const injectedProvider =
      typeof window !== "undefined" && typeof (window as Window & { ethereum?: unknown }).ethereum !== "undefined"
        ? ((window as Window & { ethereum?: any }).ethereum ?? undefined)
        : undefined;

    if (walletClient) {
      return createConfig({
        ...baseConfig,
        provider: new ViemProvider({ publicClient }),
        signer: new ViemSigner({
          walletClient,
          ethereum: injectedProvider,
        }),
      });
    }

    return createConfig({
      ...baseConfig,
      provider: new ViemProvider({ publicClient }),
    });
  }, [getProvider, wagmiPublicClient, walletClient]);

  return <ZamaProvider config={config}>{children}</ZamaProvider>;
}
