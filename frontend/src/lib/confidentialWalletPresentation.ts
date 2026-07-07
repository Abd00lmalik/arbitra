/*
 * @file confidentialWalletPresentation.ts
 * @description Shared presentation helpers for cUSDC wallet balance states.
 */

import { fromMicro } from "./contracts";
import type { ConfidentialBalanceState } from "./confidentialWalletState";

export function getConfidentialBalanceDisplay(balanceState: ConfidentialBalanceState): string {
  if (balanceState.kind === "ready" || balanceState.kind === "zero_balance") {
    return `${fromMicro(balanceState.balance)} cUSDC`;
  }

  if (balanceState.kind === "loading") {
    return "Decrypting...";
  }

  if (balanceState.kind === "needs_permit") {
    return "Unlock to decrypt";
  }

  if (balanceState.kind === "never_shielded") {
    return "Not yet shielded";
  }

  return "Unavailable";
}

export function getConfidentialBalanceNotice(balanceState: ConfidentialBalanceState): string | null {
  if (
    balanceState.kind === "never_shielded" ||
    balanceState.kind === "error" ||
    balanceState.kind === "wrapper_invalid" ||
    balanceState.kind === "not_configured"
  ) {
    return balanceState.message;
  }

  return null;
}
