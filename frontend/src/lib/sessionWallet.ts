/*
 * @file sessionWallet.ts
 * @description Helpers for reading the wallet address persisted in the Arbitra session cookie.
 */

export function readSessionWallet(): `0x${string}` | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie.match(/(?:^|;\s*)arbitra_session=([^;]+)/);
  const value = match?.[1]?.trim();

  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    return null;
  }

  return value as `0x${string}`;
}
