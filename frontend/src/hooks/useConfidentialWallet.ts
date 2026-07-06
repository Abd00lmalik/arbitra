"use client";

/*
 * @file useConfidentialWallet.ts
 * @description Shared cUSDC wallet hook used by both wallet surfaces and the
 *              factoring flow. It centralizes wrapper validation, decryption
 *              permit handling, shield, resumable unshield, and operator
 *              approval for invoice funding.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clearPendingUnshield,
  indexedDBStorage,
  loadPendingUnshield,
  savePendingUnshield,
} from "@zama-fhe/sdk";
import {
  useConfidentialBalance,
  useConfidentialIsOperator,
  useConfidentialSetOperator,
  useGrantPermit,
  useHasPermit,
  useShield,
  useUnshield,
  useResumeUnshield,
} from "@zama-fhe/react-sdk";
import { useAccount, useBalance, useReadContract } from "wagmi";
import {
  ARBITRA_REGISTRY_ADDRESS,
  CUSDC_ABI,
  CUSDC_ADDRESS,
  DEFAULT_OPERATOR_EXPIRY_SECONDS,
  TOKEN_DECIMALS,
  USDC_ADDRESS,
  ZERO_ADDRESS,
  ZERO_ENCRYPTED_VALUE,
} from "@/lib/contracts";
import {
  type ConfidentialBalanceState,
  deriveConfidentialBalanceState,
  getZamaErrorMessage,
} from "@/lib/confidentialWalletState";

type ActionPhase = "idle" | "pending" | "success" | "error";
type UnshieldPhase = "idle" | "submitting" | "waiting" | "finalizing" | "success" | "error";

function isConfiguredAddress(address: string | undefined) {
  return Boolean(address) && address !== ZERO_ADDRESS;
}

export interface ConfidentialWalletState {
  address?: `0x${string}`;
  isConfigured: boolean;
  ethBalance?: bigint;
  usdcBalance?: bigint;
  balanceState: ConfidentialBalanceState;
  hasPermit: boolean;
  isOperatorApproved: boolean;
  pendingUnshieldTxHash: `0x${string}` | null;
  shieldPhase: ActionPhase;
  shieldError: string | null;
  unshieldPhase: UnshieldPhase;
  unshieldError: string | null;
  operatorPhase: ActionPhase;
  operatorError: string | null;
  grantPermit: () => Promise<void>;
  shield: (amount: bigint) => Promise<void>;
  unshield: (amount: bigint) => Promise<void>;
  resumePendingUnshield: () => Promise<void>;
  setRegistryOperator: () => Promise<void>;
}

export function useConfidentialWallet(walletAddress?: `0x${string}` | null): ConfidentialWalletState {
  const { address: connectedAddress } = useAccount();
  const resolvedAddress = walletAddress ?? connectedAddress;
  const wrapperAddress = CUSDC_ADDRESS === ZERO_ADDRESS ? undefined : CUSDC_ADDRESS;
  const tokenAddress = (wrapperAddress ?? ZERO_ADDRESS) as `0x${string}`;
  const isConfigured = isConfiguredAddress(wrapperAddress);

  const [pendingUnshieldTxHash, setPendingUnshieldTxHash] = useState<`0x${string}` | null>(null);
  const [shieldPhase, setShieldPhase] = useState<ActionPhase>("idle");
  const [shieldError, setShieldError] = useState<string | null>(null);
  const [unshieldPhase, setUnshieldPhase] = useState<UnshieldPhase>("idle");
  const [unshieldError, setUnshieldError] = useState<string | null>(null);
  const [operatorPhase, setOperatorPhase] = useState<ActionPhase>("idle");
  const [operatorError, setOperatorError] = useState<string | null>(null);

  const { data: ethBalance } = useBalance({
    address: resolvedAddress,
    chainId: 11155111,
    query: { enabled: Boolean(resolvedAddress) },
  });

  const { data: usdcBalance } = useBalance({
    address: resolvedAddress,
    token: USDC_ADDRESS,
    chainId: 11155111,
    query: { enabled: Boolean(resolvedAddress) },
  });

  const { data: rawHandle } = useReadContract({
    address: wrapperAddress as `0x${string}` | undefined,
    abi: CUSDC_ABI,
    functionName: "confidentialBalanceOf",
    args: resolvedAddress ? [resolvedAddress] : undefined,
    query: { enabled: Boolean(wrapperAddress) && Boolean(resolvedAddress) },
  });

  const { data: wrapperUnderlying } = useReadContract({
    address: wrapperAddress as `0x${string}` | undefined,
    abi: CUSDC_ABI,
    functionName: "underlying",
    query: { enabled: Boolean(wrapperAddress) },
  });

  const { data: wrapperDecimals } = useReadContract({
    address: wrapperAddress as `0x${string}` | undefined,
    abi: CUSDC_ABI,
    functionName: "decimals",
    query: { enabled: Boolean(wrapperAddress) },
  });

  const wrapperValidationMessage = useMemo(() => {
    if (!isConfigured) {
      return "cUSDC is not configured for this Sepolia deployment yet.";
    }

    if (
      wrapperUnderlying &&
      `${wrapperUnderlying}`.toLowerCase() !== USDC_ADDRESS.toLowerCase()
    ) {
      return "Configured cUSDC does not wrap the official Sepolia USDC token.";
    }

    if (wrapperDecimals !== undefined && Number(wrapperDecimals) !== TOKEN_DECIMALS) {
      return "Configured cUSDC uses the wrong token decimals.";
    }

    return null;
  }, [isConfigured, wrapperDecimals, wrapperUnderlying]);

  const isWrapperValid = useMemo(() => {
    if (!isConfigured) {
      return false;
    }

    if (!wrapperUnderlying || wrapperDecimals === undefined) {
      return false;
    }

    return (
      `${wrapperUnderlying}`.toLowerCase() === USDC_ADDRESS.toLowerCase() &&
      Number(wrapperDecimals) === TOKEN_DECIMALS
    );
  }, [isConfigured, wrapperDecimals, wrapperUnderlying]);

  const isWrapperValidationPending = useMemo(() => {
    if (!isConfigured) {
      return false;
    }

    return wrapperUnderlying === undefined || wrapperDecimals === undefined;
  }, [isConfigured, wrapperDecimals, wrapperUnderlying]);

  const { data: hasPermitResult } = useHasPermit(
    { contractAddresses: wrapperAddress ? [wrapperAddress] : [] },
    { enabled: Boolean(wrapperAddress) && Boolean(resolvedAddress) },
  );
  const hasPermit = hasPermitResult === true;

  const grantPermitMutation = useGrantPermit();

  const balanceQuery = useConfidentialBalance(
    {
      address: tokenAddress,
      account: resolvedAddress,
    },
    {
      enabled:
        Boolean(wrapperAddress) &&
        Boolean(resolvedAddress) &&
        hasPermit &&
        isWrapperValid &&
        rawHandle !== ZERO_ENCRYPTED_VALUE,
    },
  );

  const operatorQuery = useConfidentialIsOperator(
    {
      address: wrapperAddress as `0x${string}` | undefined,
      holder: resolvedAddress,
      spender: ARBITRA_REGISTRY_ADDRESS,
    },
    {
      enabled: Boolean(wrapperAddress) && Boolean(resolvedAddress) && isWrapperValid,
    },
  );

  const shieldMutation = useShield({ address: tokenAddress, optimistic: true });
  const unshieldMutation = useUnshield(tokenAddress);
  const resumeUnshieldMutation = useResumeUnshield(tokenAddress);
  const setOperatorMutation = useConfidentialSetOperator(tokenAddress);

  const refreshPendingUnshield = useCallback(async () => {
    if (!wrapperAddress) {
      setPendingUnshieldTxHash(null);
      return;
    }

    const saved = await loadPendingUnshield(indexedDBStorage, wrapperAddress);
    setPendingUnshieldTxHash(saved as `0x${string}` | null);
  }, [wrapperAddress]);

  useEffect(() => {
    void refreshPendingUnshield();
  }, [refreshPendingUnshield]);

  const balanceState = useMemo(
    () =>
      deriveConfidentialBalanceState({
        wrapperAddress,
        wrapperMessage: wrapperValidationMessage,
        isWrapperValidationPending,
        isWrapperValid,
        hasPermit,
        rawHandle: rawHandle as string | undefined,
        isLoading: balanceQuery.isLoading || balanceQuery.isRefetching,
        balance: balanceQuery.data,
        error: balanceQuery.error,
      }),
    [
      balanceQuery.data,
      balanceQuery.error,
      balanceQuery.isLoading,
      balanceQuery.isRefetching,
      hasPermit,
      isWrapperValidationPending,
      isWrapperValid,
      rawHandle,
      wrapperAddress,
      wrapperValidationMessage,
    ],
  );

  const grantPermit = useCallback(async () => {
    if (!wrapperAddress) {
      return;
    }

    await grantPermitMutation.mutateAsync([wrapperAddress]);
  }, [grantPermitMutation, wrapperAddress]);

  const shield = useCallback(async (amount: bigint) => {
    if (!wrapperAddress) {
      return;
    }

    setShieldPhase("pending");
    setShieldError(null);

    try {
      await shieldMutation.mutateAsync({
        amount,
        approvalStrategy: "exact",
        onApprovalSubmitted: () => {
          setShieldPhase("pending");
        },
        onShieldSubmitted: () => {
          setShieldPhase("pending");
        },
      });

      setShieldPhase("success");
    } catch (error) {
      setShieldPhase("error");
      setShieldError(getZamaErrorMessage(error, "Shielding USDC into cUSDC failed."));
      throw error;
    }
  }, [shieldMutation, wrapperAddress]);

  const unshield = useCallback(async (amount: bigint) => {
    if (!wrapperAddress) {
      return;
    }

    setUnshieldPhase("submitting");
    setUnshieldError(null);

    try {
      await unshieldMutation.mutateAsync({
        amount,
        onUnwrapSubmitted: async (txHash) => {
          setUnshieldPhase("waiting");
          await savePendingUnshield(indexedDBStorage, wrapperAddress, txHash);
          setPendingUnshieldTxHash(txHash);
        },
        onFinalizing: () => {
          setUnshieldPhase("finalizing");
        },
        onFinalizeSubmitted: () => {
          setUnshieldPhase("finalizing");
        },
      });

      await clearPendingUnshield(indexedDBStorage, wrapperAddress);
      setPendingUnshieldTxHash(null);
      setUnshieldPhase("success");
    } catch (error) {
      setUnshieldPhase("error");
      setUnshieldError(getZamaErrorMessage(error, "Unshielding cUSDC back to USDC failed."));
      throw error;
    }
  }, [unshieldMutation, wrapperAddress]);

  const resumePendingUnshield = useCallback(async () => {
    if (!wrapperAddress || !pendingUnshieldTxHash) {
      return;
    }

    setUnshieldPhase("waiting");
    setUnshieldError(null);

    try {
      await resumeUnshieldMutation.mutateAsync({
        unwrapTxHash: pendingUnshieldTxHash,
        onFinalizing: () => {
          setUnshieldPhase("finalizing");
        },
        onFinalizeSubmitted: () => {
          setUnshieldPhase("finalizing");
        },
      });

      await clearPendingUnshield(indexedDBStorage, wrapperAddress);
      setPendingUnshieldTxHash(null);
      setUnshieldPhase("success");
    } catch (error) {
      setUnshieldPhase("error");
      setUnshieldError(getZamaErrorMessage(error, "Resuming the pending cUSDC unshield failed."));
      throw error;
    }
  }, [pendingUnshieldTxHash, resumeUnshieldMutation, wrapperAddress]);

  const setRegistryOperator = useCallback(async () => {
    if (!wrapperAddress) {
      return;
    }

    setOperatorPhase("pending");
    setOperatorError(null);

    try {
      await setOperatorMutation.mutateAsync({
        operator: ARBITRA_REGISTRY_ADDRESS,
        until: Math.floor(Date.now() / 1000) + DEFAULT_OPERATOR_EXPIRY_SECONDS,
      });

      setOperatorPhase("success");
    } catch (error) {
      setOperatorPhase("error");
      setOperatorError(getZamaErrorMessage(error, "Authorizing the registry as a cUSDC operator failed."));
      throw error;
    }
  }, [setOperatorMutation, wrapperAddress]);

  return {
    address: resolvedAddress,
    isConfigured,
    ethBalance: ethBalance?.value,
    usdcBalance: usdcBalance?.value,
    balanceState,
    hasPermit,
    isOperatorApproved: operatorQuery.data === true,
    pendingUnshieldTxHash,
    shieldPhase,
    shieldError,
    unshieldPhase,
    unshieldError,
    operatorPhase,
    operatorError,
    grantPermit,
    shield,
    unshield,
    resumePendingUnshield,
    setRegistryOperator,
  };
}
