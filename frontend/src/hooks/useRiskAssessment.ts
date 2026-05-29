"use client";

import { useState, useCallback } from "react";
import type { RiskAssessmentResult, RiskAssessmentInput } from "@/lib/gemini";

interface UseRiskAssessmentResult {
  assessment: RiskAssessmentResult | null;
  isLoading: boolean;
  error: string | null;
  fetchAssessment: (input: RiskAssessmentInput) => Promise<void>;
}

/**
 * Hook to fetch AI risk assessment from the /api/risk-assessment endpoint.
 * Calls Gemini Flash via the Next.js API route (server-side, key never exposed).
 */
export function useRiskAssessment(): UseRiskAssessmentResult {
  const [assessment, setAssessment] = useState<RiskAssessmentResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssessment = useCallback(async (input: RiskAssessmentInput) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/risk-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data: RiskAssessmentResult = await response.json();
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
