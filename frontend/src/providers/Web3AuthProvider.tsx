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

      /* Get wallet address */
      const { ethers } = await import("ethers");
      const ethProvider = new ethers.BrowserProvider(prov);
      const signer      = await ethProvider.getSigner();
      const addr        = await signer.getAddress() as `0x${string}`;

      /* Get email from Web3Auth user info */
      const info = await instance.getUserInfo();

      setWallet(addr);
      setEmail(info?.email ?? null);
      setIsLoggedIn(true);

      /* Set session cookie so middleware allows access to protected routes */
      setSessionCookie(addr);

      /* Bridge to Wagmi */
      try {
        const { connect } = await import("@wagmi/core");
        const { wagmiConfig } = await import("./WagmiProvider");
        const web3authConnector = wagmiConfig.connectors.find((c) => c.id === "web3auth");
        if (web3authConnector) {
          await connect(wagmiConfig, { connector: web3authConnector });
        }
      } catch (e) {
        console.warn("[Web3Auth] Wagmi auto-connect warning:", e);
      }
    } catch (e) {
      console.error("[Web3Auth] session restore error:", e);
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
        const configuredNetwork =
          process.env.NEXT_PUBLIC_WEB3AUTH_NETWORK ??
          WEB3AUTH_NETWORK.SAPPHIRE_DEVNET;
        if (typeof window !== "undefined") {
          (window as any).__arbitraWeb3AuthEnv = {
            hasClientId: !!web3AuthClientId,
            clientIdLength: web3AuthClientId?.length ?? 0,
            startsWithPlaceholder: !!web3AuthClientId?.includes("your_"),
            configuredNetwork,
          };
        }
        if (!web3AuthClientId || web3AuthClientId.includes("your_")) {
          throw new Error("NEXT_PUBLIC_WEB3AUTH_CLIENT_ID is missing or invalid");
        }

        const instance = new Web3Auth({
          clientId:        web3AuthClientId,
          web3AuthNetwork: configuredNetwork,
          privateKeyProvider,
          uiConfig: {
            appName:             "Arbitra",
            appUrl:              window.location.origin,
            theme:               { primary: "#00F0FF" },
            loginMethodsOrder:   ["email_passwordless"],
            defaultLanguage:     "en",
            modalZIndex:         "99999",
          },
        });

        const authAdapter = new AuthAdapter({
          privateKeyProvider,
          adapterSettings: {
            clientId: web3AuthClientId,
            network: configuredNetwork,
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
      ? await web3auth.connectTo("auth", { loginProvider: "email_passwordless" })
      : await web3auth.connect();

    if (!prov) throw new Error("Login cancelled or failed");

    (window as any).web3authProvider = prov;
    setProviderRef(prov);

    const { ethers }  = await import("ethers");
    const ethProvider = new ethers.BrowserProvider(prov);
    const signer      = await ethProvider.getSigner();
    const addr        = await signer.getAddress() as `0x${string}`;
    const info        = await web3auth.getUserInfo();

    setWallet(addr);
    setEmail(info?.email ?? null);
    setIsLoggedIn(true);

    /* Set cookie so middleware allows access to protected routes */
    setSessionCookie(addr);

    /* Bridge to Wagmi */
    try {
      const { connect } = await import("@wagmi/core");
      const { wagmiConfig } = await import("./WagmiProvider");
      const web3authConnector = wagmiConfig.connectors.find((c) => c.id === "web3auth");
      if (web3authConnector) {
        await connect(wagmiConfig, { connector: web3authConnector });
      }
    } catch (e) {
      console.error("[Web3Auth] Wagmi connect failed:", e);
    }

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
