import { z } from "zod";

/**
 * Compatibility score weights (percent). Configurable at deploy time via the
 * DEALHOI_SCORING_WEIGHTS environment variable, e.g.
 *   {"categoryAlignment":40,"spendingConditions":25,"rewardAlignment":20,"annualFee":15}
 */
export const DEFAULT_SCORING_WEIGHTS = {
  categoryAlignment: 40,
  spendingConditions: 25,
  rewardAlignment: 20,
  annualFee: 15,
} as const;

export const ScoringWeightsSchema = z
  .object({
    categoryAlignment: z.number().min(0).max(100),
    spendingConditions: z.number().min(0).max(100),
    rewardAlignment: z.number().min(0).max(100),
    annualFee: z.number().min(0).max(100),
  })
  .refine((w) => Object.values(w).reduce((a, b) => a + b, 0) > 0, "At least one weight must be positive");

export type ScoringWeights = z.infer<typeof ScoringWeightsSchema>;

export function resolveScoringWeights(json: string | undefined): ScoringWeights {
  if (!json) return { ...DEFAULT_SCORING_WEIGHTS };
  try {
    return ScoringWeightsSchema.parse(JSON.parse(json));
  } catch {
    console.warn("DEALHOI_SCORING_WEIGHTS is invalid; using default weights");
    return { ...DEFAULT_SCORING_WEIGHTS };
  }
}
