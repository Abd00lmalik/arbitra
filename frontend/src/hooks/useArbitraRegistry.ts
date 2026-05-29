"use client";

import { useReadContract, useWriteContract, useWatchContractEvent, useAccount } from "wagmi";
import { useCallback, useState } from "react";
import {
  ARBITRA_REGISTRY_ADDRESS,
  ARBITRA_REGISTRY_ABI,
  CUSDT_ADDRESS,
  CUSDT_ABI,
  type InvoiceOnChain,
} from "@/lib/contracts";

/**
 * Hook: read all invoice IDs from the registry.
 */
export function useAllInvoiceIds() {
  return useReadContract({
    address: ARBITRA_REGISTRY_ADDRESS,
    abi: ARBITRA_REGISTRY_ABI,
    functionName: "getAllInvoiceIds",
  });
}

/**
 * Hook: read a single invoice's data.
 */
export function useInvoice(invoiceId: bigint | number | undefined) {
  return useReadContract({
    address: ARBITRA_REGISTRY_ADDRESS,
    abi: ARBITRA_REGISTRY_ABI,
    functionName: "invoices",
    args: invoiceId !== undefined ? [BigInt(invoiceId)] : undefined,
    query: { enabled: invoiceId !== undefined },
  });
}

/**
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

/**
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

/**
 * Hook: read encrypted handles for an invoice.
 */
export function useInvoiceHandles(invoiceId: bigint | undefined) {
  return useReadContract({
    address: ARBITRA_REGISTRY_ADDRESS,
    abi: ARBITRA_REGISTRY_ABI,
    functionName: "getInvoiceHandles",
    args: invoiceId ? [invoiceId] : undefined,
    query: { enabled: !!invoiceId },
  });
}

/**
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

/**
 * Hook: read total invoice count.
 */
export function useInvoiceCount() {
  return useReadContract({
    address: ARBITRA_REGISTRY_ADDRESS,
    abi: ARBITRA_REGISTRY_ABI,
    functionName: "invoiceCount",
  });
}

/**
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
      });
    },
    [writeContractAsync]
  );

  return { factorInvoice, isPending, error, txHash: data };
}

/**
 * Hook: trigger repayment for a factored invoice.
 */
export function useTriggerRepayment() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();

  const triggerRepayment = useCallback(
    async (invoiceId: bigint) => {
      return writeContractAsync({
        address: ARBITRA_REGISTRY_ADDRESS,
        abi: ARBITRA_REGISTRY_ABI,
        functionName: "triggerRepayment",
        args: [invoiceId],
      });
    },
    [writeContractAsync]
  );

  return { triggerRepayment, isPending, error, txHash: data };
}

/**
 * Hook: upload a new invoice.
 * Returns the write function that accepts encrypted handles and proof.
 */
export function useUploadInvoice() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();

  const uploadInvoice = useCallback(
    async (
      encFaceValue: `0x${string}`,
      proofFaceValue: `0x${string}`,
      encDueDate: `0x${string}`,
      proofDueDate: `0x${string}`,
      buyer: `0x${string}`
    ) => {
      return writeContractAsync({
        address: ARBITRA_REGISTRY_ADDRESS,
        abi: ARBITRA_REGISTRY_ABI,
        functionName: "uploadInvoice",
        args: [encFaceValue, proofFaceValue, encDueDate, proofDueDate, buyer],
      });
    },
    [writeContractAsync]
  );

  return { uploadInvoice, isPending, error, txHash: data };
}

/**
 * Hook: grant risk assessment access for an invoice (transient ACL).
 */
export function useGrantRiskAccess() {
  const { writeContractAsync, isPending, error } = useWriteContract();

  const grantAccess = useCallback(
    async (invoiceId: bigint) => {
      return writeContractAsync({
        address: ARBITRA_REGISTRY_ADDRESS,
        abi: ARBITRA_REGISTRY_ABI,
        functionName: "grantRiskAssessmentAccess",
        args: [invoiceId],
      });
    },
    [writeContractAsync]
  );

  return { grantAccess, isPending, error };
}

/**
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

/**
 * Hook: check if investor is approved on registry as a operator.
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

/**
 * Hook: set registry as approved operator on cUSDT.
 */
export function useSetOperator() {
  const { writeContractAsync, isPending, error, data } = useWriteContract();

  const setOperator = useCallback(
    async (operator: `0x${string}`, until: number) => {
      return writeContractAsync({
        address: CUSDT_ADDRESS,
        abi: CUSDT_ABI,
        functionName: "setOperator",
        args: [operator, BigInt(until)],
      });
    },
    [writeContractAsync]
  );

  return { setOperator, isPending, error, txHash: data };
}

/**
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
      discountRate: "0x0000000000000000000000000000000000000000000000000000000000000004",
      supplier: address || "0x1111111111111111111111111111111111111111",
      investor: "0x0000000000000000000000000000000000000000",
      buyer: "0x2222222222222222222222222222222222222222",
      isFactored: false,
      isRepaid: false,
      uploadTimestamp: BigInt(Math.floor(Date.now() / 1000) - 86400),
    },
    {
      invoiceId: 2n,
      faceValue: "0x0000000000000000000000000000000000000000000000000000000000000011",
      dueDate: "0x0000000000000000000000000000000000000000000000000000000000000012",
      purchasePrice: "0x0000000000000000000000000000000000000000000000000000000000000013",
      discountRate: "0x0000000000000000000000000000000000000000000000000000000000000014",
      supplier: "0x3333333333333333333333333333333333333333",
      investor: address || "0x4444444444444444444444444444444444444444",
      buyer: "0x5555555555555555555555555555555555555555",
      isFactored: true,
      isRepaid: false,
      uploadTimestamp: BigInt(Math.floor(Date.now() / 1000) - 2 * 86400),
    },
  ];
}
