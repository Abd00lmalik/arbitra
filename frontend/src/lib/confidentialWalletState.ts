/*
 * @file confidentialWalletState.ts
 * @description Shared wallet-state helpers for confidential cUSDC balances.
 */

import { matchZamaError } from "@zama-fhe/sdk";
import { ZERO_ADDRESS, ZERO_ENCRYPTED_VALUE } from "./contracts";

export type ConfidentialBalanceState =
  | { kind: "not_configured"; message: string }
  | { kind: "wrapper_invalid"; message: string }
  | { kind: "needs_permit" }
  | { kind: "never_shielded"; message: string }
  | { kind: "loading" }
  | { kind: "zero_balance"; balance: bigint }
  | { kind: "ready"; balance: bigint }
  | { kind: "error"; message: string };

export function getZamaErrorMessage(error: unknown, fallback = "Confidential wallet action failed."): string {
  return (
    matchZamaError(error, {
      NO_CIPHERTEXT: () => "You have not shielded USDC into cUSDC yet.",
      SIGNING_REJECTED: () => "Wallet signature was cancelled.",
      TRANSACTION_REVERTED: (zamaError) => zamaError.message,
      INSUFFICIENT_CONFIDENTIAL_BALANCE: () => "Not enough cUSDC is available for this action.",
      INSUFFICIENT_ERC20_BALANCE: () => "Not enough public USDC is available for shielding.",
      RELAYER_REQUEST_FAILED: () => "The confidential relayer request failed. Please retry.",
      _: (unknownError) => {
        if (unknownError instanceof Error && unknownError.message) {
          return unknownError.message;
        }

        return fallback;
      },
    }) ?? fallback
  );
}

interface DeriveConfidentialBalanceStateParams {
  wrapperAddress?: string;
  wrapperMessage?: string | null;
  isWrapperValidationPending?: boolean;
  isWrapperValid: boolean;
  hasPermit: boolean;
  rawHandle?: string;
  isLoading: boolean;
  balance?: bigint;
  error?: unknown;
}

export function deriveConfidentialBalanceState(
  params: DeriveConfidentialBalanceStateParams,
): ConfidentialBalanceState {
  if (!params.wrapperAddress || params.wrapperAddress === ZERO_ADDRESS) {
    return {
      kind: "not_configured",
      message: "cUSDC is not configured for this Sepolia deployment yet.",
    };
  }

  if (params.isWrapperValidationPending) {
    return { kind: "loading" };
  }

  if (!params.isWrapperValid) {
    return {
      kind: "wrapper_invalid",
      message:
        params.wrapperMessage ||
        "Configured cUSDC does not wrap the official Sepolia USDC token.",
    };
  }

  if (params.rawHandle === ZERO_ENCRYPTED_VALUE) {
    return {
      kind: "never_shielded",
      message: "No cUSDC ciphertext exists for this wallet yet. Shield USDC to get started.",
    };
  }

  if (!params.hasPermit) {
    return { kind: "needs_permit" };
  }

  if (params.isLoading) {
    return { kind: "loading" };
  }

  if (params.error) {
    const neverShielded = matchZamaError(params.error, {
      NO_CIPHERTEXT: () => true,
      _: () => false,
    });

    if (neverShielded) {
      return {
        kind: "never_shielded",
        message: "No cUSDC ciphertext exists for this wallet yet. Shield USDC to get started.",
      };
    }

    return {
      kind: "error",
      message: getZamaErrorMessage(params.error, "Unable to read your confidential cUSDC balance."),
    };
  }

  if (params.balance === 0n) {
    return { kind: "zero_balance", balance: 0n };
  }

  if (params.balance !== undefined) {
    return { kind: "ready", balance: params.balance };
  }

  return { kind: "loading" };
}
