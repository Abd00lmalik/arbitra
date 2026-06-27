/*
 * @file pipeline-timing.ts
 * @description Records bounded upload pipeline timings for logs and API responses.
 */

import type { IngestionStage, IngestionTiming, StageTiming } from "./types";

export class PipelineTimeoutError extends Error {
  readonly code = "PIPELINE_TIMEOUT";

  readonly stage: IngestionStage;

  readonly timeoutMs: number;

  constructor(stage: IngestionStage, timeoutMs: number) {
    super(`${stage} exceeded ${timeoutMs}ms.`);
    this.name = "PipelineTimeoutError";
    this.stage = stage;
    this.timeoutMs = timeoutMs;
  }
}

export class PipelineLimitError extends Error {
  readonly code = "PIPELINE_LIMIT_EXCEEDED";

  readonly stage: IngestionStage;

  constructor(stage: IngestionStage, message: string) {
    super(message);
    this.name = "PipelineLimitError";
    this.stage = stage;
  }
}

export class PipelineTimer {
  private readonly startedAt = performance.now();

  private readonly stages: StageTiming[] = [];

  constructor(readonly requestId: string) {}

  async measure<T>(
    stage: IngestionStage,
    action: () => Promise<T> | T,
    detail?: (value: T) => string | undefined,
  ): Promise<T> {
    const stageStartedAt = performance.now();

    try {
      const value = await action();
      this.record(stage, performance.now() - stageStartedAt, "ok", detail?.(value));
      return value;
    } catch (error) {
      this.record(stage, performance.now() - stageStartedAt, "failed", describeError(error));
      throw error;
    }
  }

  skip(stage: IngestionStage, detail: string): void {
    this.record(stage, 0, "skipped", detail);
  }

  snapshot(): IngestionTiming {
    return {
      requestId: this.requestId,
      totalMs: roundMs(performance.now() - this.startedAt),
      stages: [...this.stages],
    };
  }

  log(status: "ok" | "failed", detail?: string): void {
    const timing = this.snapshot();
    console.log(
      `[parse-invoice:${this.requestId}] ${status} total=${timing.totalMs}ms stages=${formatStages(timing.stages)}${
        detail ? ` detail=${detail}` : ""
      }`,
    );
  }

  private record(stage: IngestionStage, durationMs: number, status: StageTiming["status"], detail?: string): void {
    const timing = {
      stage,
      durationMs: roundMs(durationMs),
      status,
      ...(detail ? { detail } : {}),
    };

    this.stages.push(timing);
    console.log(
      `[parse-invoice:${this.requestId}] stage="${stage}" status=${status} duration=${timing.durationMs}ms${
        detail ? ` detail=${detail}` : ""
      }`,
    );
  }
}

/**
 * Reject a promise if it exceeds the configured stage budget.
 *
 * @param stage Pipeline stage protected by the timeout.
 * @param timeoutMs Maximum duration in milliseconds.
 * @param action Promise to bound.
 * @returns The action result when it completes in time.
 */
export async function withTimeout<T>(stage: IngestionStage, timeoutMs: number, action: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      action,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new PipelineTimeoutError(stage, timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function roundMs(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatStages(stages: StageTiming[]): string {
  return stages.map((stage) => `${stage.stage}:${stage.durationMs}ms:${stage.status}`).join(",");
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
