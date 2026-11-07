"use server";

import { evaluateLandingSite, HorizonsError } from "@/lib/jpl-horizons";
import type { EvaluationRequest, EvaluationResult } from "@/lib/types";

export async function evaluateSiteAction(
  request: EvaluationRequest,
): Promise<{ ok: true; data: EvaluationResult } | { ok: false; error: string }> {
  try {
    const data = await evaluateLandingSite(request);
    return { ok: true, data };
  } catch (error) {
    const message =
      error instanceof HorizonsError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Evaluation failed";
    return { ok: false, error: message };
  }
}
