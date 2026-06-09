/*
 * @file useActiveWalletClient.ts
 * @description Returns the correct viem WalletClient and signer address for whichever
 *              wallet type the user is authenticated with:
 *
 *              - Web3Auth embedded wallet (social login / email OTP):
 *                Uses the raw Web3Auth EIP-1193 provider to build a dedicated viem
 *                WalletClient.  This is necessary because wagmi's walletClient is
 *                bound to whichever connector is currently "primary" in the config
 *                (could be Keystone, MetaMask, etc.) even when the user has logged
 *                in via Web3Auth.
 *
 *              - External wallet (MetaMask / Keystone / WalletConnect / etc.):
 *                Falls back to wagmi's standard useWalletClient() hook, which is
 *                already correctly bound to the external connector.
 *
 *  Usage:
 *    const { walletClient, activeWallet, isEmbedded } = useActiveWalletClient();
 */

"use client";

import { useMemo } from "react";
import { useWalletClient, useAccount } from "wagmi";
import { createWalletClient, custom, type WalletClient } from "viem";
import { sepolia } from "viem/chains";
import { useWeb3Auth } from "@/providers/Web3AuthProvider";

export interface ActiveWalletResult {
  /** Viem WalletClient bound to the CORRECT signer for this session */
  walletClient: WalletClient | null;
  /** Ethereum address of the active signer */
  activeWallet: `0x${string}` | undefined;
  /** True when the active wallet is a Web3Auth embedded (social/email) wallet */
  isEmbedded: boolean;
  /** True when a usable walletClient is available */
  isReady: boolean;
}

/**
 * Returns a unified wallet interface that works correctly regardless of
 * whether the user is authenticated via Web3Auth (embedded wallet) or an
 * external browser/hardware wallet.
 */
export function useActiveWalletClient(): ActiveWalletResult {
  const { wallet: web3AuthWallet, getProvider } = useWeb3Auth();
  const { data: wagmiWalletClient } = useWalletClient();
  const { address: wagmiAddress } = useAccount();

  const isEmbedded = Boolean(web3AuthWallet);

  const walletClient: WalletClient | null = useMemo(() => {
    if (isEmbedded) {
      /* Embedded wallet path — build a viem WalletClient from the Web3Auth
       * EIP-1193 provider.  This ensures transactions are signed by the
       * social-login key, not by whatever external wallet wagmi has active. */
      const provider = getProvider();
      if (!provider || !web3AuthWallet) return null;

      return createWalletClient({
        account: web3AuthWallet,
        chain: sepolia,
        transport: custom(provider),
      });
    }

    /* External wallet path — wagmi's walletClient is already correct */
    return wagmiWalletClient ?? null;
  }, [isEmbedded, getProvider, web3AuthWallet, wagmiWalletClient]);

  const activeWallet: `0x${string}` | undefined = isEmbedded
    ? (web3AuthWallet ?? undefined)
    : (wagmiWalletClient?.account?.address ?? wagmiAddress);

  return {
    walletClient,
    activeWallet,
    isEmbedded,
    isReady: Boolean(walletClient && activeWallet),
  };
}
