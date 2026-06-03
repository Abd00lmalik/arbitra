/*
 * @file Web3AuthProvider.tsx
 * @description Web3Auth authentication provider managing sessions, non-custodial wallets, and cookie-based routing guards.
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

/* ── Context Interface ── */
interface Web3AuthContextType {
  wallet:          `0x${string}` | null;
  email:           string | null;
  isLoggedIn:      boolean;
  isInitializing:  boolean;
  login:           (method?: "email" | "wallet") => Promise<void>;
  logout:          () => Promise<void>;
  getProvider:     () => any;
  getUserInfo:     () => Promise<{ email: string; name: string } | null>;
  authError:       string | null;
}

const Web3AuthContext = createContext<Web3AuthContextType>({
  wallet:          null,
  email:           null,
  isLoggedIn:      false,
  isInitializing:  true,
  login:           async () => {},
  logout:          async () => {},
  getProvider:     () => null,
  getUserInfo:     async () => null,
  authError:       null,
});

/* ── Cookie helpers (client-side only) ── */
function setSessionCookie(walletAddress: string) {
  /* Set cookie accessible by Next.js middleware. Max-age of 24 hours. */
  document.cookie = `arbitra_session=${walletAddress}; path=/; max-age=86400; SameSite=Strict`;
}

function clearSessionCookie() {
  document.cookie = "arbitra_session=; path=/; max-age=0";
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

/* ── Provider ── */
export function Web3AuthProvider({ children }: { children: ReactNode }) {
  const [web3auth,       setWeb3auth]       = useState<any>(null);
  const [wallet,         setWallet]         = useState<`0x${string}` | null>(null);
  const [email,          setEmail]          = useState<string | null>(null);
  const [isLoggedIn,     setIsLoggedIn]     = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [providerRef,    setProviderRef]    = useState<any>(null);
  const [authError,      setAuthError]      = useState<string | null>(null);

  /* ── Restore session helper ── */
  const restoreSession = useCallback(async (instance: any) => {
    try {
      const prov = instance.provider;
      (window as any).web3authProvider = prov;
      setProviderRef(prov);
      setAuthError(null);

      const { walletAddress, userInfo } = await connectEmbeddedWallet(instance, prov);

      setWallet(walletAddress);
      setEmail(userInfo?.email ?? null);
      setSessionCookie(walletAddress);
      await connectWeb3AuthWagmi();
      setIsLoggedIn(true);
    } catch (e) {
      console.error("[Web3Auth] session restore error:", e);
      setWallet(null);
      setEmail(null);
      setIsLoggedIn(false);
      setProviderRef(null);
      clearSessionCookie();
      setAuthError(e instanceof Error ? e.message : "Session restoration failed");
    }
  }, []);

  /* ── Initialize Web3Auth on client only ── */
  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    const init = async () => {
      try {
        /* Dynamic import to prevent SSR crashes */
        const { Web3Auth } = await import("@web3auth/modal");
        const { AuthAdapter } = await import("@web3auth/auth-adapter");
        const { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } = await import("@web3auth/base");
        const { EthereumPrivateKeyProvider } = await import("@web3auth/ethereum-provider");

        const chainConfig = {
          chainNamespace:   CHAIN_NAMESPACES.EIP155,
          chainId:          "0xaa36a7",
          rpcTarget:        process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com",
          displayName:      "Sepolia Testnet",
          blockExplorerUrl: "https://sepolia.etherscan.io",
          ticker:           "ETH",
          tickerName:       "Ethereum",
        };

        const privateKeyProvider = new EthereumPrivateKeyProvider({
          config: { chainConfig },
        });

        const web3AuthClientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://arbitra-dapp.vercel.app";
        if (!web3AuthClientId || web3AuthClientId.includes("your_")) {
          throw new Error(
            "[Web3Auth] NEXT_PUBLIC_WEB3AUTH_CLIENT_ID is not set. Add it to Vercel Environment Variables and redeploy.",
          );
        }

        const instance = new Web3Auth({
          clientId:        web3AuthClientId,
          web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
          privateKeyProvider,
          uiConfig: {
            appName:             "Arbitra",
            appUrl:              appUrl,
            theme:               { primary: "#00F0FF" },
            loginMethodsOrder:   ["google", "email_passwordless"],
            defaultLanguage:     "en",
            modalZIndex:         "99999",
          },
        });

        const authAdapter = new AuthAdapter({
          privateKeyProvider,
          adapterSettings: {
            clientId: web3AuthClientId,
            network: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
            uxMode: "popup",
          },
        });

        instance.configureAdapter(authAdapter);

        await instance.initModal();
        if (cancelled) return;

        setWeb3auth(instance);

        /* Restore session if already connected */
        if (instance.connected && instance.provider) {
          await restoreSession(instance);
        } else {
          /* No active session - clear any stale cookie */
          clearSessionCookie();
        }
      } catch (e) {
        console.error("[Web3Auth] init error:", e);
        setAuthError(e instanceof Error ? e.message : "Web3Auth initialization failed");
      } finally {
        if (!cancelled) setIsInitializing(false);
      }
    };

    init();
    return () => { cancelled = true; };
  }, [restoreSession]);

  /* ── Login ── */
  const login = useCallback(async (method: "email" | "wallet" = "email") => {
    if (!web3auth) throw new Error("Web3Auth not initialized");

    setAuthError(null);

    const prov = method === "email"
      ? await web3auth.connect()
      : await web3auth.connect();

    if (!prov) throw new Error("Login cancelled or failed");

    (window as any).web3authProvider = prov;
    setProviderRef(prov);

    const { walletAddress, userInfo } = await connectEmbeddedWallet(web3auth, prov);

    setWallet(walletAddress);
    setEmail(userInfo?.email ?? null);
    setSessionCookie(walletAddress);
    await connectWeb3AuthWagmi();
    setIsLoggedIn(true);
    setAuthError(null);
  }, [web3auth]);

  /* ── Logout ── */
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

    /* Disconnect Wagmi */
    try {
      const { disconnect } = await import("@wagmi/core");
      const { wagmiConfig } = await import("./WagmiProvider");
      await disconnect(wagmiConfig);
    } catch (e) {
      console.error("[Web3Auth] Wagmi disconnect failed:", e);
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
    <Web3AuthContext.Provider value={{
      wallet,
      email,
      isLoggedIn,
      isInitializing,
      login,
      logout,
      getProvider,
      getUserInfo,
      authError,
    }}>
      {children}
    </Web3AuthContext.Provider>
  );
}

export const useWeb3Auth = () => useContext(Web3AuthContext);
