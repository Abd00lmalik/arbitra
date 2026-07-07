/*
 * @file useArbitraRegistry.ts
 * @description React hooks for connecting the frontend to Arbitra v2.0 Smart Contracts.
 */

"use client";

import { useReadContract, useWriteContract, useWatchContractEvent, useAccount, useReadContracts } from "wagmi";
import { useCallback } from "react";
import {
  ARBITRA_REGISTRY_ADDRESS,
  ARBITRA_REGISTRY_ABI,
  USDC_ADDRESS,
  USDC_ABI,
  COLLATERAL_VAULT_ADDRESS,
  COLLATERAL_VAULT_ABI,
  InvoiceStatus,
  parseInvoiceHandles,
  parseInvoiceTuple,
  parseUnderwritingHandles,
  type InvoiceOnChain,
  type InvoiceHandles,
  type InvoiceTupleSource,
  EXTENDED_INVOICE_VIEW_ABI,
  LEGACY_INVOICE_VIEW_ABI,
  CUSDC_ADDRESS,
  CUSDC_ABI,
} from "@/lib/contracts";

const STAKE_GAS_LIMIT = 500_000n;

function resolveRegistryAddress(address?: `0x${string}`) {
  return address ?? ARBITRA_REGISTRY_ADDRESS;
}

function isMissingInvoice(parsed: InvoiceOnChain | undefined) {
  if (!parsed) return true;

  return (
    parsed.faceValuePlaintext === 0n &&
    parsed.discountRatePlaintext === 0n &&
    parsed.uploadTimestamp === 0n &&
    parsed.maturityTimestamp === 0n &&
    parsed.supplier.toLowerCase() === "0x0000000000000000000000000000000000000000" &&
    parsed.debtor.toLowerCase() === "0x0000000000000000000000000000000000000000"
  );
}

function isAddressLike(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function isStructurallyValidInvoice(parsed: InvoiceOnChain | undefined) {
  if (!parsed) return false;

  return (
    isAddressLike(parsed.supplier) &&
    isAddressLike(parsed.investor) &&
    isAddressLike(parsed.debtor) &&
    typeof parsed.uploadTimestamp === "bigint" &&
    typeof parsed.maturityTimestamp === "bigint" &&
    Number.isInteger(parsed.status) &&
    parsed.status >= InvoiceStatus.Pending &&
    parsed.status <= InvoiceStatus.Slashed
  );
}

type InvoiceCandidate = {
  invoice: InvoiceOnChain;
  source: InvoiceTupleSource;
};

function toInvoiceCandidate(
  invoiceId: bigint | number | undefined,
  raw: readonly unknown[] | undefined,
  source: InvoiceTupleSource,
): InvoiceCandidate | null {
  if (invoiceId === undefined) return null;

  if (!Array.isArray(raw)) return null;

  try {
    const invoice = parseInvoiceTuple(BigInt(invoiceId), raw, source);
    return isMissingInvoice(invoice) || !isStructurallyValidInvoice(invoice) ? null : { invoice, source };
  } catch {
    return null;
  }
}

function chooseInvoiceTuple(
  invoiceId: bigint | number | undefined,
  extendedRaw: readonly unknown[] | undefined,
  legacyRaw: readonly unknown[] | undefined,
) {
  if (invoiceId === undefined) return undefined;

  const candidates = [
    toInvoiceCandidate(invoiceId, extendedRaw, "extended"),
    toInvoiceCandidate(invoiceId, legacyRaw, "legacy"),
  ]
    .filter((candidate): candidate is InvoiceCandidate => Boolean(candidate))
    .sort((left, right) => {
      if (left.invoice.uploadTimestamp === right.invoice.uploadTimestamp) {
        if (left.source === right.source) return 0;
        return left.source === "extended" ? -1 : 1;
      }

      return left.invoice.uploadTimestamp > right.invoice.uploadTimestamp ? -1 : 1;
    });

  return candidates[0];
}
/*
 * Hook: read all invoice IDs from the registry.
 */
export function useAllInvoiceIds() {
  return useReadContract({
    address: ARBITRA_REGISTRY_ADDRESS,
    abi: ARBITRA_REGISTRY_ABI,
    functionName: "getAllInvoiceIds",
    query: {
      refetchInterval: 15_000,
    },
  });
}

/*
 * Hook: read a single invoice's data.
 */
export function useInvoice(
  invoiceId: bigint | number | undefined,
  registryAddress?: `0x${string}`,
) {
  const targetRegistryAddress = resolveRegistryAddress(registryAddress);
  const extendedInvoiceResult = useReadContract({
    address: targetRegistryAddress,
    abi: EXTENDED_INVOICE_VIEW_ABI,
    functionName: "invoices",
    args: invoiceId !== undefined ? [BigInt(invoiceId)] : undefined,
    query: { enabled: invoiceId !== undefined },
  });

  const legacyInvoiceResult = useReadContract({
    address: targetRegistryAddress,
    abi: LEGACY_INVOICE_VIEW_ABI,
    functionName: "invoices",
    args: invoiceId !== undefined ? [BigInt(invoiceId)] : undefined,
    query: { enabled: invoiceId !== undefined },
  });

  const underwritingResult = useReadContract({
    address: targetRegistryAddress,
    abi: ARBITRA_REGISTRY_ABI,
    functionName: "getUnderwritingHandles",
    args: invoiceId !== undefined ? [BigInt(invoiceId)] : undefined,
    query: {
      enabled: invoiceId !== undefined,
      retry: false,
    },
  });

  const activeInvoice = chooseInvoiceTuple(
    invoiceId,
    extendedInvoiceResult.data as readonly unknown[] | undefined,
    legacyInvoiceResult.data as readonly unknown[] | undefined,
  );
  const underwritingHandles = underwritingResult.data
    ? parseUnderwritingHandles(underwritingResult.data as readonly unknown[])
    : undefined;
  const activeInvoiceResult =
    activeInvoice?.source === "extended" ? extendedInvoiceResult : legacyInvoiceResult;
  const invoiceReadPending =
    !activeInvoice && (extendedInvoiceResult.isLoading || legacyInvoiceResult.isLoading);

  return {
    ...activeInvoiceResult,
    error: activeInvoice ? undefined : (extendedInvoiceResult.error ?? legacyInvoiceResult.error),
    data:
      activeInvoice && underwritingHandles
        ? {
            ...activeInvoice.invoice,
            riskScore: underwritingHandles.riskScoreHandle,
            riskBand: underwritingHandles.riskBandHandle,
          }
        : activeInvoice?.invoice,
    isLoading: invoiceReadPending || underwritingResult.isLoading,
    refetch: async () => {
      const [extendedRefetch, legacyRefetch] = await Promise.all([
        extendedInvoiceResult.refetch(),
        legacyInvoiceResult.refetch(),
        underwritingResult.refetch(),
      ]);
      return activeInvoice?.source === "extended" ? extendedRefetch : legacyRefetch;
    },
  };
}

/*
 * Hook: read final underwriting handles for an invoice.
 */
export function useUnderwritingHandles(invoiceId: bigint | undefined) {
  const result = useReadContract({
    address: ARBITRA_REGISTRY_ADDRESS,
    abi: ARBITRA_REGISTRY_ABI,
    functionName: "getUnderwritingHandles",
    args: invoiceId ? [invoiceId] : undefined,
    query: {
      enabled: !!invoiceId,
      retry: false,
    },
  });

  return {
    ...result,
    data: result.data
      ? parseUnderwritingHandles(result.data as readonly unknown[])
      : undefined,
  };
}

/*
 * Hook: read encrypted handles for an invoice.
 */
export function useInvoiceHandles(invoiceId: bigint | undefined) {
  const invoiceResult = useReadContract({
    address: ARBITRA_REGISTRY_ADDRESS,
    abi: ARBITRA_REGISTRY_ABI,
    functionName: "getInvoiceHandles",
    args: invoiceId ? [invoiceId] : undefined,
    query: { enabled: !!invoiceId },
  });

  const underwritingResult = useReadContract({
    address: ARBITRA_REGISTRY_ADDRESS,
    abi: ARBITRA_REGISTRY_ABI,
    functionName: "getUnderwritingHandles",
    args: invoiceId ? [invoiceId] : undefined,
    query: {
      enabled: !!invoiceId,
      retry: false,
    },
  });

  const invoiceHandles = invoiceResult.data
    ? parseInvoiceHandles(invoiceResult.data as readonly unknown[])
    : undefined;
  const underwritingHandles = underwritingResult.data
    ? parseUnderwritingHandles(underwritingResult.data as readonly unknown[])
    : undefined;

  return {
    ...invoiceResult,
    data:
      invoiceHandles && underwritingHandles
        ? { ...invoiceHandles, ...underwritingHandles }
        : invoiceHandles,
    isLoading: invoiceResult.isLoading || underwritingResult.isLoading,
    refetch: async () => {
      const [invoiceRefetch] = await Promise.all([
        invoiceResult.refetch(),
        underwritingResult.refetch(),
      ]);
      return invoiceRefetch;
    },
  };
}

/*
 * Hook: read all invoices for a supplier.
 */
export function useSupplierInvoices(supplier: `0x${string}` | undefined) {
  return useReadContract({
    address: ARBITRA_REGISTRY_ADDRESS,
    abi: ARBITRA_REGISTRY_ABI,
    functionName: "getSupplierInvoices",
    args: supplier ? [supplier] : undefined,
    query: { enabled: !!supplier },
  });
}

/*
 * Hook: read all invoices purchased by an investor.
 */
export function useInvestorInvoices(investor: `0x${string}` | undefined) {
  return useReadContract({
    address: ARBITRA_REGISTRY_ADDRESS,
    abi: ARBITRA_REGISTRY_ABI,
    functionName: "getInvestorInvoices",
    args: investor ? [investor] : undefined,
    query: { enabled: !!investor },
  });
}

/*
 * Hook: read supplier credit stats.
 */
export function useSupplierStats(supplier: `0x${string}` | undefined) {
  return useReadContract({
    address: ARBITRA_REGISTRY_ADDRESS,
    abi: ARBITRA_REGISTRY_ABI,
    functionName: "supplierStats",
    args: supplier ? [supplier] : undefined,
    query: { enabled: !!supplier },
  });
}

/*
 * Hook: read total invoice count.
 */
export function useInvoiceCount() {
  return useReadContract({
    address: ARBITRA_REGISTRY_ADDRESS,
    abi: ARBITRA_REGISTRY_ABI,
    functionName: "invoiceCount",
  });
}

/*
 * Hook: factor (purchase) an invoice.
 */
export function useFactorInvoice() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();

  const factorInvoice = useCallback(
    async (invoiceId: bigint, gasLimit?: bigint) => {
      return writeContractAsync({
        address: ARBITRA_REGISTRY_ADDRESS,
        abi: ARBITRA_REGISTRY_ABI,
        functionName: "factorInvoice",
        args: [invoiceId],
        gas: gasLimit,
      });
    },
    [writeContractAsync]
  );

  return { factorInvoice, isPending, error, txHash: data };
}

/*
 * Hook: upload a new invoice (takes 5 encrypted handles and proofs plus the protocol config flags).
 */
export function useUploadInvoice() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();

  const uploadInvoice = useCallback(
    async (
      encFaceValue: `0x${string}`,
      proofFaceValue: `0x${string}`,
      encDueDate: `0x${string}`,
      proofDueDate: `0x${string}`,
      encFingerprint: `0x${string}`,
      proofFingerprint: `0x${string}`,
      encBaseRate: `0x${string}`,
      proofBaseRate: `0x${string}`,
      encRepMultiplier: `0x${string}`,
      proofRepMultiplier: `0x${string}`,
      debtor: `0x${string}`,
      enableUnderwriting: boolean,
      faceValuePlaintext: bigint,
      plaintextFingerprint: bigint,
      discountRatePlaintext: bigint,
      gasLimit?: bigint,
    ) => {
      return writeContractAsync({
        address: ARBITRA_REGISTRY_ADDRESS,
        abi: ARBITRA_REGISTRY_ABI,
        functionName: "uploadInvoice",
        gas: gasLimit,
        args: [
          encFaceValue, proofFaceValue,
          encDueDate, proofDueDate,
          encFingerprint, proofFingerprint,
          encBaseRate, proofBaseRate,
          encRepMultiplier, proofRepMultiplier,
          debtor,
          enableUnderwriting,
          faceValuePlaintext,
          plaintextFingerprint,
          discountRatePlaintext
        ],
      });
    },
    [writeContractAsync]
  );

  return { uploadInvoice, isPending, error, txHash: data };
}

/*
 * Hook: debtor attestation confirmation.
 */
export function useConfirmInvoice(registryAddress?: `0x${string}`) {
  const { writeContractAsync, isPending, error, data } = useWriteContract();
  const targetRegistryAddress = resolveRegistryAddress(registryAddress);

  const confirmInvoice = useCallback(
    async (invoiceId: bigint, signature: `0x${string}`, commitment: `0x${string}`) => {
      return writeContractAsync({
        address: targetRegistryAddress,
        abi: ARBITRA_REGISTRY_ABI,
        functionName: "confirmInvoice",
        args: [invoiceId, signature, commitment],
      });
    },
    [targetRegistryAddress, writeContractAsync]
  );

  return { confirmInvoice, isPending, error, txHash: data };
}

/*
 * Hook: approve plain USDC spending.
 */
export function useApproveUSDC() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();

  const approveUSDC = useCallback(
    async (spender: `0x${string}`, amount: bigint) => {
      return writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "approve",
        args: [spender, amount],
      });
    },
    [writeContractAsync]
  );

  return { approveUSDC, isPending, error, txHash: data };
}

/*
 * Hook: stake collateral for an invoice on the vault.
 */
export function useStakeCollateral() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();

  const stakeCollateral = useCallback(
    async (fingerprint: bigint, faceValue: bigint) => {
      return writeContractAsync({
        address: COLLATERAL_VAULT_ADDRESS,
        abi: COLLATERAL_VAULT_ABI,
        functionName: "stakeCollateral",
        gas: STAKE_GAS_LIMIT,
        args: [fingerprint, faceValue],
      });
    },
    [writeContractAsync]
  );

  return { stakeCollateral, isPending, error, txHash: data };
}

/*
 * Hook: fetch staked collateral by invoice fingerprint.
 */
export function useStakedCollateralByFingerprint(fingerprint: bigint | undefined) {
  return useReadContract({
    address: COLLATERAL_VAULT_ADDRESS,
    abi: COLLATERAL_VAULT_ABI,
    functionName: "stakedCollateralByFingerprint",
    args: fingerprint !== undefined ? [fingerprint] : undefined,
    query: { enabled: fingerprint !== undefined },
  });
}

/*
 * Hook: fetch supplier of stake by invoice fingerprint.
 */
export function useSupplierByFingerprint(fingerprint: bigint | undefined) {
  return useReadContract({
    address: COLLATERAL_VAULT_ADDRESS,
    abi: COLLATERAL_VAULT_ABI,
    functionName: "supplierByFingerprint",
    args: fingerprint !== undefined ? [fingerprint] : undefined,
    query: { enabled: fingerprint !== undefined },
  });
}

/*
 * Hook: fetch stake state by ID (fingerprint or sequential ID).
 */
export function useStakeState(id: bigint | undefined) {
  return useReadContract({
    address: COLLATERAL_VAULT_ADDRESS,
    abi: COLLATERAL_VAULT_ABI,
    functionName: "stakeStates",
    args: id !== undefined ? [id] : undefined,
    query: { enabled: id !== undefined },
  });
}

/*
 * Hook: fetch USDC balance of an account.
 */
export function useUSDCBalance(account: `0x${string}` | undefined) {
  return useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    query: { enabled: !!account },
  });
}

/*
 * Hook: read USDC allowance for a spender.
 */
export function useUSDCAllowance(owner: `0x${string}` | undefined, spender: `0x${string}` | undefined) {
  return useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "allowance",
    args: owner && spender ? [owner, spender] : undefined,
    query: { enabled: !!owner && !!spender },
  });
}

/*
 * Hook: grant risk assessment access for an invoice (transient ACL).
 */
export function useGrantRiskAccess() {
  const { writeContractAsync, isPending, error } = useWriteContract();

  const grantAccess = useCallback(
    async (invoiceId: bigint) => {
      return writeContractAsync({
        address: ARBITRA_REGISTRY_ADDRESS,
        abi: ARBITRA_REGISTRY_ABI,
        functionName: "requestRiskAssessmentAccess",
        args: [invoiceId],
      });
    },
    [writeContractAsync]
  );

  return { grantAccess, isPending, error };
}

/*
 * Hook: watch for new InvoiceUploaded events.
 */
export function useInvoiceUploadedEvents(
  onUpload: (invoiceId: bigint, supplier: `0x${string}`) => void
) {
  useWatchContractEvent({
    address: ARBITRA_REGISTRY_ADDRESS,
    abi: ARBITRA_REGISTRY_ABI,
    eventName: "InvoiceUploaded",
    onLogs: (logs) => {
      for (const log of logs) {
        const args = log.args as { invoiceId?: bigint; supplier?: `0x${string}` };
        if (args.invoiceId && args.supplier) {
          onUpload(args.invoiceId, args.supplier);
        }
      }
    },
  });
}

/*
 * Hook: check if investor has approved registry as operator on cUSDC.
 */
export function useIsInvestorApproved(investor: `0x${string}` | undefined) {
  return useReadContract({
    address: CUSDC_ADDRESS as `0x${string}`,
    abi: CUSDC_ABI,
    functionName: "isOperator",
    args: investor ? [investor, ARBITRA_REGISTRY_ADDRESS] : undefined,
    query: { enabled: !!investor && !!CUSDC_ADDRESS },
  });
}

/*
 * Hook: set registry as approved operator on cUSDC.
 */
export function useSetOperator() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();

  const setOperator = useCallback(
    async (operator: `0x${string}`, until: number) => {
      return writeContractAsync({
        address: CUSDC_ADDRESS as `0x${string}`,
        abi: CUSDC_ABI,
        functionName: "setOperator",
        args: [operator, until],
      });
    },
    [writeContractAsync]
  );

  return { setOperator, isPending, error, txHash: data };
}

/*
 * Hook: read all real invoices from the registry.
 */
export function useRealInvoiceList() {
  const { data: idData, isLoading: isLoadingIds } = useAllInvoiceIds();
  const ids = (idData as bigint[]) || [];

  const extendedInvoiceContracts = ids.map((id) => ({
    address: ARBITRA_REGISTRY_ADDRESS,
    abi: EXTENDED_INVOICE_VIEW_ABI,
    functionName: "invoices",
    args: [id],
  }));

  const legacyInvoiceContracts = ids.map((id) => ({
    address: ARBITRA_REGISTRY_ADDRESS,
    abi: LEGACY_INVOICE_VIEW_ABI,
    functionName: "invoices",
    args: [id],
  }));

  const underwritingContracts = ids.map((id) => ({
    address: ARBITRA_REGISTRY_ADDRESS,
    abi: ARBITRA_REGISTRY_ABI,
    functionName: "getUnderwritingHandles",
    args: [id],
  }));

  const {
    data: extendedResults,
    isLoading: isLoadingExtendedInvoices,
    refetch: refetchExtendedInvoices,
  } = useReadContracts({
    contracts: extendedInvoiceContracts,
    query: {
      enabled: ids.length > 0,
      refetchInterval: 15_000,
    },
  });

  const {
    data: legacyResults,
    isLoading: isLoadingLegacyInvoices,
    refetch: refetchLegacyInvoices,
  } = useReadContracts({
    contracts: legacyInvoiceContracts,
    query: {
      enabled: ids.length > 0,
      refetchInterval: 15_000,
    },
  });

  const {
    data: underwritingResults,
    isLoading: isLoadingUnderwriting,
    refetch: refetchUnderwriting,
  } = useReadContracts({
    contracts: underwritingContracts,
    query: {
      enabled: ids.length > 0,
      refetchInterval: 15_000,
      retry: false,
    },
  });

  const invoices: InvoiceOnChain[] = [];
  if (ids.length > 0) {
    ids.forEach((id, index) => {
      const activeInvoice = chooseInvoiceTuple(
        id,
        extendedResults?.[index]?.status === "success"
          ? (extendedResults[index].result as readonly unknown[])
          : undefined,
        legacyResults?.[index]?.status === "success"
          ? (legacyResults[index].result as readonly unknown[])
          : undefined,
      );

      if (activeInvoice) {
        const underwriting = underwritingResults?.[index];
        if (underwriting?.status === "success" && underwriting.result) {
          const handles = parseUnderwritingHandles(underwriting.result as readonly unknown[]);
          invoices.push({
            ...activeInvoice.invoice,
            riskScore: handles.riskScoreHandle,
            riskBand: handles.riskBandHandle,
          });
        } else {
          invoices.push(activeInvoice.invoice);
        }
      }
    });
  }

  return {
    data: invoices,
    isLoading:
      isLoadingIds ||
      isLoadingExtendedInvoices ||
      isLoadingLegacyInvoices ||
      isLoadingUnderwriting,
    refetch: async () => {
      const [invoiceRefetch] = await Promise.all([
        refetchExtendedInvoices(),
        refetchLegacyInvoices(),
        refetchUnderwriting(),
      ]);
      return invoiceRefetch;
    },
  };
}

/*
 * Compose multiple invoices into a list by fetching each by ID.
 * Returns mock data for display when the registry is not yet deployed.
 */
export function useMockInvoiceList(): InvoiceOnChain[] {
  const { address } = useAccount();

  return [
    {
      invoiceId: 1n,
      faceValue: "0x0000000000000000000000000000000000000000000000000000000000000001",
      dueDate: "0x0000000000000000000000000000000000000000000000000000000000000002",
      purchasePrice: "0x0000000000000000000000000000000000000000000000000000000000000003",
      discountRateBps: "0x0000000000000000000000000000000000000000000000000000000000000004",
      riskScore: "0x0000000000000000000000000000000000000000000000000000000000000005",
      riskBand: "0x0000000000000000000000000000000000000000000000000000000000000006",
      fingerprintHash: "0x0000000000000000000000000000000000000000000000000000000000000007",
      faceValuePlaintext: 1_000_000n,
      discountRatePlaintext: 800n,
      supplier: address || "0x1111111111111111111111111111111111111111",
      investor: "0x0000000000000000000000000000000000000000",
      debtor: "0x2222222222222222222222222222222222222222",
      buyer: "0x2222222222222222222222222222222222222222",
      uploadTimestamp: BigInt(Math.floor(Date.now() / 1000) - 86400),
      maturityTimestamp: BigInt(Math.floor(Date.now() / 1000) + 30 * 86400),
      status: InvoiceStatus.Pending,
      isFactored: false,
      isRepaid: false,
      geminiUnderwritingEnabled: true,
      debtorAttestationHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      debtorEmailHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      isEmailVerified: false,
      collateralStaked: true,
    },
    {
      invoiceId: 2n,
      faceValue: "0x0000000000000000000000000000000000000000000000000000000000000011",
      dueDate: "0x0000000000000000000000000000000000000000000000000000000000000012",
      purchasePrice: "0x0000000000000000000000000000000000000000000000000000000000000013",
      discountRateBps: "0x0000000000000000000000000000000000000000000000000000000000000014",
      riskScore: "0x0000000000000000000000000000000000000000000000000000000000000015",
      riskBand: "0x0000000000000000000000000000000000000000000000000000000000000016",
      fingerprintHash: "0x0000000000000000000000000000000000000000000000000000000000000017",
      faceValuePlaintext: 2_000_000n,
      discountRatePlaintext: 800n,
      supplier: "0x3333333333333333333333333333333333333333",
      investor: address || "0x4444444444444444444444444444444444444444",
      debtor: "0x5555555555555555555555555555555555555555",
      buyer: "0x5555555555555555555555555555555555555555",
      uploadTimestamp: BigInt(Math.floor(Date.now() / 1000) - 2 * 86400),
      maturityTimestamp: BigInt(Math.floor(Date.now() / 1000) + 15 * 86400),
      status: InvoiceStatus.Factored,
      isFactored: true,
      isRepaid: false,
      geminiUnderwritingEnabled: true,
      debtorAttestationHash: "0x6666666666666666666666666666666666666666666666666666666666666666",
      debtorEmailHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      isEmailVerified: false,
      collateralStaked: true,
    },
  ];
}
