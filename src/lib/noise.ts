import { mean } from "./stats";

/**
 * Population prior for scan-to-scan noise, in raw-score points (single shot SD).
 * [NEEDS INPUT] 3 is a placeholder until calibrated on real repeat scans.
 */
export const PRIOR_SIGMA = 3;
/** How many degrees of freedom the prior is worth. Small, so the user's own repeats dominate quickly. */
export const PRIOR_DF = 3;

export interface NoiseEstimate {
  sigma: number;
  /** Degrees of freedom from the user's own repeats (Σ(k−1) over sessions). */
  df: number;
  /** Number of repeat pairs available (Σ(k−1) — each extra shot in a session adds one). */
  repeatPairs: number;
  source: "prior" | "personal";
  /** The user-only pooled SD, before shrinkage (NaN if none). */
  pooledSigma: number;
}

/**
 * Pooled within-session SD across sessions, shrunk toward the prior:
 *   σ² = (ν₀·σ₀² + Σ SS) / (ν₀ + Σ df)
 * Each `group` is the values from one session (same day, minutes apart).
 * Below 2 repeat pairs the prior alone is used.
 */
export function estimateNoise(groups: number[][], prior = PRIOR_SIGMA, priorDf = PRIOR_DF): NoiseEstimate {
  let ss = 0;
  let df = 0;
  for (const g of groups) {
    const xs = g.filter((x) => Number.isFinite(x));
    if (xs.length < 2) continue;
    const m = mean(xs);
    ss += xs.reduce((a, x) => a + (x - m) ** 2, 0);
    df += xs.length - 1;
  }
  const pooledSigma = df > 0 ? Math.sqrt(ss / df) : NaN;
  if (df < 2) return { sigma: prior, df, repeatPairs: df, source: "prior", pooledSigma };
  const sigma = Math.sqrt((priorDf * prior * prior + ss) / (priorDf + df));
  return { sigma, df, repeatPairs: df, source: "personal", pooledSigma };
}
