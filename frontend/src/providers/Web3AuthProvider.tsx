/**
 * @file Web3AuthProvider.tsx
 * @description Web3Auth provider for Arbitra.
 *              Provides email-based passwordless login with embedded non-custodial wallet creation.
 *              Bridges the resulting EIP-1193 provider to Wagmi.
 */

"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Web3Auth }          from "@web3auth/modal";
import { CHAIN_NAMESPACES,
         WEB3AUTH_NETWORK }  from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";

/* ── Sepolia chain config for Web3Auth ── */
const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId:        "0xaa36a7", /* 11155111 hex */
  rpcTarget:      process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com",
  displayName:    "Sepolia Testnet",
  blockExplorerUrl: "https://sepolia.etherscan.io",
  ticker:         "ETH",
  tickerName:     "Ethereum",
};

const privateKeyProvider = new EthereumPrivateKeyProvider({
  config: { chainConfig },
});

/* ── Web3Auth Context Type ── */
interface Web3AuthContextType {
  provider:    any | null;
  wallet:      `0x${string}` | null;
  email:       string | null;
  isLoggedIn:  boolean;
  isLoading:   boolean;
  login:       () => Promise<void>;
  logout:      () => Promise<void>;
  getUserInfo: () => Promise<{ email: string; name: string } | null>;
}

const Web3AuthContext = createContext<Web3AuthContextType>({
  provider: null, wallet: null, email: null,
  isLoggedIn: false, isLoading: true,
  login: async () => {}, logout: async () => {}, getUserInfo: async () => null,
});

export function Web3AuthProvider({ children }: { children: ReactNode }) {
  const [web3authInstance, setWeb3authInstance] = useState<Web3Auth | null>(null);
  const [provider,   setProvider]   = useState<any | null>(null);
  const [wallet,     setWallet]     = useState<`0x${string}` | null>(null);
  const [email,      setEmail]      = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading,  setIsLoading]  = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const init = async () => {
      try {
        const sdk = new Web3Auth({
          clientId:         process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID ?? "BPi5afRIN-3m9ABdJaZ-cGAChr5oH4p7F3xG3zB59-A1rW8K25b9-9z7y_57y-A1rW8K25b9-9z7y_57y", /* Fallback dev client ID */
          web3AuthNetwork:  WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
          privateKeyProvider,
          uiConfig: {
            appName:     "Arbitra",
            appUrl:      window.location.origin,
            theme:       { primary: "#00F0FF" },
            loginMethodsOrder: ["email_passwordless"],
            defaultLanguage: "en",
            modalZIndex: "99999",
          },
        });

        await sdk.initModal();
        setWeb3authInstance(sdk);

        if (sdk.connected && sdk.provider) {
          const prov = sdk.provider;
          (window as any).web3authProvider = prov;
          setProvider(prov);
          setIsLoggedIn(true);

          const { ethers } = await import("ethers");
          const ethProvider = new ethers.BrowserProvider(prov as any);
          const signer = await ethProvider.getSigner();
          setWallet((await signer.getAddress()) as `0x${string}`);

          const info = await sdk.getUserInfo();
          setEmail(info.email ?? null);

          /* Bridge to Wagmi */
          try {
            const { connect } = await import("@wagmi/core");
            const { wagmiConfig } = await import("./WagmiProvider");
            const web3authConnector = wagmiConfig.connectors.find(c => c.id === "web3auth");
            if (web3authConnector) {
              await connect(wagmiConfig, { connector: web3authConnector });
            }
          } catch (e) {
            console.warn("[Web3Auth] Wagmi auto-connect warning:", e);
          }
        }
      } catch (e) {
        console.error("[Web3Auth] Initialization failed:", e);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const login = async () => {
    if (!web3authInstance) throw new Error("Web3Auth not initialized");

    const prov = await web3authInstance.connect();
    if (!prov) return;

    (window as any).web3authProvider = prov;
    setProvider(prov);
    setIsLoggedIn(true);

    const { ethers } = await import("ethers");
    const ethProvider = new ethers.BrowserProvider(prov as any);
    const signer = await ethProvider.getSigner();
    setWallet((await signer.getAddress()) as `0x${string}`);

    const info = await web3authInstance.getUserInfo();
    setEmail(info.email ?? null);

    /* Bridge to Wagmi */
    try {
      const { connect } = await import("@wagmi/core");
      const { wagmiConfig } = await import("./WagmiProvider");
      const web3authConnector = wagmiConfig.connectors.find(c => c.id === "web3auth");
      if (web3authConnector) {
        await connect(wagmiConfig, { connector: web3authConnector });
      }
    } catch (e) {
      console.error("[Web3Auth] Wagmi connect failed:", e);
    }
  };

  const logout = async () => {
    if (!web3authInstance) return;

    await web3authInstance.logout();
    (window as any).web3authProvider = undefined;
    setProvider(null);
    setWallet(null);
    setEmail(null);
    setIsLoggedIn(false);

    /* Disconnect Wagmi */
    try {
      const { disconnect } = await import("@wagmi/core");
      const { wagmiConfig } = await import("./WagmiProvider");
      await disconnect(wagmiConfig);
    } catch (e) {
      console.error("[Web3Auth] Wagmi disconnect failed:", e);
    }
  };

  const getUserInfo = async () => {
    if (!web3authInstance || !web3authInstance.connected) return null;
    const info = await web3authInstance.getUserInfo();
    return { email: info.email ?? "", name: info.name ?? "" };
  };

  return (
    <Web3AuthContext.Provider value={{
      provider, wallet, email, isLoggedIn, isLoading, login, logout, getUserInfo,
    }}>
      {children}
    </Web3AuthContext.Provider>
  );
}

export const useWeb3Auth = () => useContext(Web3AuthContext);
