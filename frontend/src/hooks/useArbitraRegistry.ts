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
  type InvoiceOnChain,
  type InvoiceHandles,
} from "@/lib/contracts";

const FHE_FACTOR_GAS_LIMIT  = 5_000_000n;
/* uploadInvoice calls FingerprintRegistry + RiskCalculator inline via FHE coprocessor.
 * Gas estimation overflows Sepolia's block cap (16,777,216). Cap explicitly at 14M. */
const FHE_UPLOAD_GAS_LIMIT  = 1_800_000n;
const STAKE_GAS_LIMIT        = 500_000n;
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
export function useInvoice(invoiceId: bigint | number | undefined) {
  const result = useReadContract({
    address: ARBITRA_REGISTRY_ADDRESS,
    abi: ARBITRA_REGISTRY_ABI,
    functionName: "invoices",
    args: invoiceId !== undefined ? [BigInt(invoiceId)] : undefined,
    query: { enabled: invoiceId !== undefined },
  });

  return {
    ...result,
    data:
      invoiceId !== undefined && result.data
        ? parseInvoiceTuple(BigInt(invoiceId), result.data as readonly unknown[])
        : undefined,
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
 * Hook: read encrypted handles for an invoice.
 */
export function useInvoiceHandles(invoiceId: bigint | undefined) {
  const result = useReadContract({
    address: ARBITRA_REGISTRY_ADDRESS,
    abi: ARBITRA_REGISTRY_ABI,
    functionName: "getInvoiceHandles",
    args: invoiceId ? [invoiceId] : undefined,
    query: { enabled: !!invoiceId },
  });

  return {
    ...result,
    data: result.data ? parseInvoiceHandles(result.data as readonly unknown[]) : undefined,
  };
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
    async (invoiceId: bigint) => {
      return writeContractAsync({
        address: ARBITRA_REGISTRY_ADDRESS,
        abi: ARBITRA_REGISTRY_ABI,
        functionName: "factorInvoice",
        args: [invoiceId],
        gas: FHE_FACTOR_GAS_LIMIT,
      });
    },
    [writeContractAsync]
  );

  return { factorInvoice, isPending, error, txHash: data };
}

/*
 * Hook: upload a new invoice (takes 5 encrypted handles and proofs, debtor, and gemini config).
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
      enableGemini: boolean,
      faceValuePlaintext: bigint,
      plaintextFingerprint: bigint
    ) => {
      return writeContractAsync({
        address: ARBITRA_REGISTRY_ADDRESS,
        abi: ARBITRA_REGISTRY_ABI,
        functionName: "uploadInvoice",
        gas: FHE_UPLOAD_GAS_LIMIT,
        args: [
          encFaceValue, proofFaceValue,
          encDueDate, proofDueDate,
          encFingerprint, proofFingerprint,
          encBaseRate, proofBaseRate,
          encRepMultiplier, proofRepMultiplier,
          debtor,
          enableGemini,
          faceValuePlaintext,
          plaintextFingerprint
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
export function useConfirmInvoice() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();

  const confirmInvoice = useCallback(
    async (invoiceId: bigint, signature: `0x${string}`, commitment: `0x${string}`) => {
      return writeContractAsync({
        address: ARBITRA_REGISTRY_ADDRESS,
        abi: ARBITRA_REGISTRY_ABI,
        functionName: "confirmInvoice",
        args: [invoiceId, signature, commitment],
      });
    },
    [writeContractAsync]
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
 * Hook: check if investor is approved on registry as an operator.
 */
export function useIsInvestorApproved(investor: `0x${string}` | undefined) {
  return useReadContract({
    address: ARBITRA_REGISTRY_ADDRESS,
    abi: ARBITRA_REGISTRY_ABI,
    functionName: "isInvestorApproved",
    args: investor ? [investor] : undefined,
    query: { enabled: !!investor },
  });
}

/*
 * Hook: set registry as approved operator on USDC.
 */
export function useSetOperator() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();

  const setOperator = useCallback(
    async (operator: `0x${string}`, until: number) => {
      return writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "approve",
        args: [operator, 115792089237316195423570985008687907853269984665640564039457584007913129639935n],
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

  const contracts = ids.map((id) => ({
    address: ARBITRA_REGISTRY_ADDRESS,
    abi: ARBITRA_REGISTRY_ABI,
    functionName: "invoices",
    args: [id],
  }));

  const { data: results, isLoading: isLoadingInvoices, refetch } = useReadContracts({
    contracts,
    query: {
      enabled: ids.length > 0,
      refetchInterval: 15_000,
    },
  });

  const invoices: InvoiceOnChain[] = [];
  if (results && ids.length > 0) {
    results.forEach((res, index) => {
      if (res.status === "success" && res.result) {
        invoices.push(parseInvoiceTuple(ids[index], res.result as readonly unknown[]));
      }
    });
  }

  return {
    data: invoices,
    isLoading: isLoadingIds || isLoadingInvoices,
    refetch,
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
      fingerprintHash: "0x0000000000000000000000000000000000000000000000000000000000000005",
      faceValuePlaintext: 1_000_000n,
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
      fingerprintHash: "0x0000000000000000000000000000000000000000000000000000000000000015",
      faceValuePlaintext: 2_000_000n,
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
