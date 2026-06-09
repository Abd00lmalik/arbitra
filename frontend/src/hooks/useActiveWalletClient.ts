/*
 * @file useActiveWalletClient.ts
 * @description Returns the correct wallet interface for whichever wallet type
 *              the user is authenticated with.
 *
 *              Web3Auth embedded wallet (social / email):
 *                Exposes the raw EIP-1193 provider so callers can build an
 *                ethers.js BrowserProvider — the only approach proven to work
 *                reliably with the Web3Auth SDK.  Do NOT build a viem
 *                WalletClient from the Web3Auth provider; viem's JSON-RPC
 *                account path calls eth_sendTransaction with an explicit
 *                "from" field that some providers ignore, causing the wrong
 *                signer to be used and on-chain msg.sender mismatches.
 *
 *              External wallet (MetaMask / Keystone / WalletConnect):
 *                Uses wagmi's standard useWalletClient() hook which is
 *                already correctly bound to the external connector.
 *
 *  Usage:
 *    const { walletClient, activeWallet, isEmbedded, getEmbeddedSigner }
 *          = useActiveWalletClient();
 *
 *    if (isEmbedded) {
 *      const signer = await getEmbeddedSigner();
 *      // use ethers.js Contract(addr, abi, signer)
 *    } else {
 *      await walletClient.writeContract({ account: activeWallet, ... });
 *    }
 */

"use client";

import { useCallback } from "react";
import { useWalletClient, useAccount } from "wagmi";
import { type WalletClient } from "viem";
import { useWeb3Auth } from "@/providers/Web3AuthProvider";

export interface ActiveWalletResult {
  /** Viem WalletClient for EXTERNAL wallets (null when using embedded wallet) */
  walletClient: WalletClient | null;
  /** Ethereum address of the active signer */
  activeWallet: `0x${string}` | undefined;
  /** True when the active wallet is a Web3Auth embedded (social/email) wallet */
  isEmbedded: boolean;
  /** True when a usable signer is available */
  isReady: boolean;
  /**
   * Returns an ethers.js JsonRpcSigner for the embedded wallet.
   * Throws if called for a non-embedded wallet session.
   * Import ethers lazily: const { ethers } = await import("ethers");
   */
  getEmbeddedSigner: () => Promise<any>;
}

/**
 * Unified wallet interface that correctly handles both embedded (Web3Auth) and
 * external (MetaMask / Keystone / WalletConnect) wallets.
 */
export function useActiveWalletClient(): ActiveWalletResult {
  const { wallet: web3AuthWallet, getProvider } = useWeb3Auth();
  const { data: wagmiWalletClient } = useWalletClient();
  const { address: wagmiAddress } = useAccount();

  const isEmbedded = Boolean(web3AuthWallet);

  /* For external wallets: wagmi's walletClient is already correct. */
  const walletClient: WalletClient | null = isEmbedded
    ? null
    : (wagmiWalletClient ?? null);

  const activeWallet: `0x${string}` | undefined = isEmbedded
    ? (web3AuthWallet ?? undefined)
    : (wagmiWalletClient?.account?.address ?? wagmiAddress);

  const getEmbeddedSigner = useCallback(async () => {
    if (!isEmbedded) {
      throw new Error("getEmbeddedSigner() called for a non-embedded wallet session.");
    }
    const provider = getProvider();
    if (!provider) {
      throw new Error("Web3Auth provider is not available. Please log in again.");
    }
    const { ethers } = await import("ethers");
    const ethProvider = new ethers.BrowserProvider(provider);
    const signer = await ethProvider.getSigner();
    return signer;
  }, [isEmbedded, getProvider]);

  return {
    walletClient,
    activeWallet,
    isEmbedded,
    isReady: isEmbedded ? Boolean(web3AuthWallet && getProvider()) : Boolean(wagmiWalletClient && activeWallet),
    getEmbeddedSigner,
  };
}
