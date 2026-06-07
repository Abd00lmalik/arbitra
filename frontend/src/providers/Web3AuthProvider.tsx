/*
 * @file Web3AuthProvider.tsx
 * @description Web3Auth authentication provider managing sessions, wallet persistence, and routing guards.
 */

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const WEB3AUTH_SESSION_SECONDS = 86400 * 30;
const EMBEDDED_WALLET_STORAGE_KEY = "arbitra_embedded_wallet";
const WEB3AUTH_CHAIN_ID = "0xaa36a7";
const WEB3AUTH_RPC_TARGET = "https://rpc.sepolia.org";
const WEB3AUTH_NETWORK_NAME = "Ethereum Sepolia";

interface Web3AuthContextType {
  wallet: `0x${string}` | null;
  email: string | null;
  isLoggedIn: boolean;
  isInitializing: boolean;
  login: (method?: "email" | "wallet") => Promise<void>;
  logout: () => Promise<void>;
  getProvider: () => any;
  getUserInfo: () => Promise<{ email: string; name: string } | null>;
  authError: string | null;
}

const Web3AuthContext = createContext<Web3AuthContextType>({
  wallet: null,
  email: null,
  isLoggedIn: false,
  isInitializing: true,
  login: async () => undefined,
  logout: async () => undefined,
  getProvider: () => null,
  getUserInfo: async () => null,
  authError: null,
});

function setSessionCookie(walletAddress: string) {
  document.cookie = `arbitra_session=${walletAddress}; path=/; max-age=${WEB3AUTH_SESSION_SECONDS}; SameSite=Strict`;
}

function clearSessionCookie() {
  document.cookie = "arbitra_session=; path=/; max-age=0";
}

async function syncWalletPersistence(
  walletAddress: `0x${string}`,
) {
  const storedAddress = window.localStorage.getItem(EMBEDDED_WALLET_STORAGE_KEY);

  if (!storedAddress) {
    window.localStorage.setItem(EMBEDDED_WALLET_STORAGE_KEY, walletAddress);
    console.log("[Auth] New wallet created:", walletAddress);
    return;
  }

  if (storedAddress.toLowerCase() !== walletAddress.toLowerCase()) {
    console.error("[Auth] WALLET CHANGED between sessions!", {
      previous: storedAddress,
      current: walletAddress,
    });
    window.localStorage.removeItem("arbitra_role");
    window.localStorage.setItem(EMBEDDED_WALLET_STORAGE_KEY, walletAddress);
    return;
  }

  console.log("[Auth] Session restored - same wallet:", walletAddress);
}

async function connectEmbeddedWallet(instance: any, provider: any) {
  const { ethers } = await import("ethers");
  const ethProvider = new ethers.BrowserProvider(provider);
  const signer = await ethProvider.getSigner();
  const walletAddress = await signer.getAddress() as `0x${string}`;

  if (!walletAddress) {
    throw new Error("Embedded wallet address was not available after login.");
  }

  return {
    walletAddress,
    userInfo: await instance.getUserInfo(),
  };
}

async function connectWeb3AuthWagmi() {
  const { connect } = await import("@wagmi/core");
  const { wagmiConfig } = await import("./WagmiProvider");
  const web3authConnector = wagmiConfig.connectors.find((connector) => connector.id === "web3auth");

  if (!web3authConnector) {
    throw new Error("Web3Auth wallet connector is not configured.");
  }

  await connect(wagmiConfig, { connector: web3authConnector });
}

export function Web3AuthProvider({ children }: { children: ReactNode }) {
  const [web3auth, setWeb3auth] = useState<any>(null);
  const [wallet, setWallet] = useState<`0x${string}` | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [providerRef, setProviderRef] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const restoreSession = useCallback(async (instance: any) => {
    try {
      const provider = instance.provider;
      (window as any).web3authProvider = provider;
      setProviderRef(provider);
      setAuthError(null);

      const { walletAddress, userInfo } = await connectEmbeddedWallet(instance, provider);
      setWallet(walletAddress);
      setEmail(userInfo?.email ?? null);
      setSessionCookie(walletAddress);
      await syncWalletPersistence(walletAddress);
      await connectWeb3AuthWagmi();
      setIsLoggedIn(true);
    } catch (error) {
      console.error("[Web3Auth] session restore error:", error);
      setWallet(null);
      setEmail(null);
      setIsLoggedIn(false);
      setProviderRef(null);
      clearSessionCookie();
      setAuthError(error instanceof Error ? error.message : "Session restoration failed");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    const init = async () => {
      try {
        const { Web3Auth } = await import("@web3auth/modal");
        const { AuthAdapter } = await import("@web3auth/auth-adapter");
        const { ADAPTER_STATUS, CHAIN_NAMESPACES, WEB3AUTH_NETWORK } = await import("@web3auth/base");
        const { EthereumPrivateKeyProvider } = await import("@web3auth/ethereum-provider");
        const web3AuthClientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://arbitra-dapp.vercel.app";

        if (!web3AuthClientId || web3AuthClientId.includes("your_")) {
          throw new Error(
            "[Web3Auth] NEXT_PUBLIC_WEB3AUTH_CLIENT_ID is not set. Add it to Vercel Environment Variables and redeploy.",
          );
        }

        const chainConfig = {
          chainNamespace: CHAIN_NAMESPACES.EIP155,
          chainId: WEB3AUTH_CHAIN_ID,
          rpcTarget: WEB3AUTH_RPC_TARGET,
          displayName: WEB3AUTH_NETWORK_NAME,
          blockExplorerUrl: "https://sepolia.etherscan.io",
          ticker: "ETH",
          tickerName: "Ethereum",
        };

        const privateKeyProvider = new EthereumPrivateKeyProvider({
          config: { chainConfig },
        });

        const instance = new Web3Auth({
          clientId: web3AuthClientId,
          web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
          sessionTime: WEB3AUTH_SESSION_SECONDS,
          privateKeyProvider,
          uiConfig: {
            uxMode: "redirect",
            appName: "Arbitra",
            appUrl,
            theme: { primary: "#00F0FF" },
            loginMethodsOrder: ["google", "email_passwordless"],
            defaultLanguage: "en",
            modalZIndex: "99999",
          },
        });

        const authAdapter = new AuthAdapter({
          privateKeyProvider,
          adapterSettings: {
            clientId: web3AuthClientId,
            network: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
            redirectUrl: `${appUrl}/register`,
            uxMode: "redirect",
          },
          loginSettings: {
            mfaLevel: "none",
          },
        });

        instance.configureAdapter(authAdapter);
        await instance.initModal();
        if (cancelled) return;

        setWeb3auth(instance);

        if (window.location.hash.includes("openlogin")) {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }

        if (instance.status === ADAPTER_STATUS.CONNECTED && instance.provider) {
          await restoreSession(instance);
        } else {
          clearSessionCookie();
        }
      } catch (error) {
        console.error("[Web3Auth] init error:", error);
        setAuthError(error instanceof Error ? error.message : "Web3Auth initialization failed");
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [restoreSession]);

  const login = useCallback(async (method: "email" | "wallet" = "email") => {
    if (!web3auth) {
      throw new Error("Web3Auth not initialized");
    }

    setAuthError(null);

    const provider = method === "email"
      ? await web3auth.connect()
      : await web3auth.connect();

    if (!provider) {
      throw new Error("Login cancelled or failed");
    }

    (window as any).web3authProvider = provider;
    setProviderRef(provider);

    const { walletAddress, userInfo } = await connectEmbeddedWallet(web3auth, provider);
    setWallet(walletAddress);
    setEmail(userInfo?.email ?? null);
    setSessionCookie(walletAddress);
    await syncWalletPersistence(walletAddress);
    await connectWeb3AuthWagmi();
    setIsLoggedIn(true);
    setAuthError(null);
  }, [web3auth]);

  const logout = useCallback(async () => {
    if (web3auth?.connected) {
      await web3auth.logout();
    }

    (window as any).web3authProvider = undefined;
    setWallet(null);
    setEmail(null);
    setIsLoggedIn(false);
    setProviderRef(null);
    setAuthError(null);
    clearSessionCookie();

    try {
      const { disconnect } = await import("@wagmi/core");
      const { wagmiConfig } = await import("./WagmiProvider");
      await disconnect(wagmiConfig);
    } catch (error) {
      console.error("[Web3Auth] Wagmi disconnect failed:", error);
    }

    window.location.href = "/register";
  }, [web3auth]);

  const getProvider = useCallback(() => providerRef, [providerRef]);

  const getUserInfo = useCallback(async () => {
    if (!web3auth || !web3auth.connected) return null;
    const info = await web3auth.getUserInfo();
    return { email: info?.email ?? "", name: info?.name ?? "" };
  }, [web3auth]);

  return (
    <Web3AuthContext.Provider
      value={{
        wallet,
        email,
        isLoggedIn,
        isInitializing,
        login,
        logout,
        getProvider,
        getUserInfo,
        authError,
      }}
    >
      {children}
    </Web3AuthContext.Provider>
  );
}

export const useWeb3Auth = () => useContext(Web3AuthContext);
