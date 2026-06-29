"use client";

import { useState, useCallback } from "react";
import { generateRiskAssessment, type RiskAssessmentResult, type RiskAssessmentInput } from "@/lib/risk-assessment";

interface UseRiskAssessmentResult {
  assessment: RiskAssessmentResult | null;
  isLoading: boolean;
  error: string | null;
  fetchAssessment: (input: RiskAssessmentInput) => Promise<void>;
}

/**
 * Hook to compute deterministic risk assessment data after local authorized decryption.
 */
export function useRiskAssessment(): UseRiskAssessmentResult {
  const [assessment, setAssessment] = useState<RiskAssessmentResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssessment = useCallback(async (input: RiskAssessmentInput) => {
    setIsLoading(true);
    setError(null);

    try {
      const data: RiskAssessmentResult = generateRiskAssessment(input);
      setAssessment(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[useRiskAssessment] Error:", msg);
      setError(`Risk assessment failed: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { assessment, isLoading, error, fetchAssessment };
}
