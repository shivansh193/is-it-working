import { linearFit, mean, sampleSd } from "./stats";
import { NoiseEstimate, estimateNoise } from "./noise";
import { TrialMode } from "./types";

export type VerdictKind = "working" | "no_effect" | "too_early" | "worse" | "not_enough_data";

/** Check-ins (after baseline) needed before "working" or "no effect" can be called. */
export const MIN_CHECKINS = 4;
/** "Getting worse" can be called a little earlier, and before the time-to-effect, because stopping early is the safe side. */
export const MIN_CHECKINS_WORSE = 3;
/** Effect must beat both K·SE and K·σ. */
export const K = 2;

export interface VerdictSession {
  day: number; // days since trial start
  kind: "baseline" | "checkin";
  /** Whole-face: raw scores per shot. Split-face: treated − untreated side score per shot. */
  values: number[];
}

export interface VerdictInput {
  mode: TrialMode;
  minDays: number;
  sessions: VerdictSession[];
  /** Prior σ override (raw points). */
  priorSigma?: number;
}

export interface Verdict {
  kind: VerdictKind;
  /** Estimated change since baseline, in score points (positive = better). */
  effect: number;
  se: number;
  noise: NoiseEstimate;
  /** The effect needed to call it: max(K·SE, K·σ). */
  threshold: number;
  checkins: number;
  days: number;
  minDays: number;
  mode: TrialMode;
  reason: string;
}

export function decide(input: VerdictInput): Verdict {
  const sessions = [...input.sessions].sort((a, b) => a.day - b.day).filter((s) => s.values.length > 0);
  const noise = estimateNoise(sessions.map((s) => s.values), input.priorSigma);
  const sigma = noise.sigma;
  const base = sessions.find((s) => s.kind === "baseline");
  const checks = sessions.filter((s) => s.kind === "checkin" && (!base || s.day >= base.day));
  const days = checks.length ? checks[checks.length - 1].day : base?.day ?? 0;
  const common = { noise, checkins: checks.length, days, minDays: input.minDays, mode: input.mode };

  if (!base) {
    return { ...common, kind: "not_enough_data", effect: NaN, se: NaN, threshold: NaN, reason: "No baseline yet." };
  }
  if (checks.length === 0) {
    return {
      ...common,
      kind: input.minDays > 0 ? "too_early" : "not_enough_data",
      effect: NaN,
      se: NaN,
      threshold: NaN,
      reason: "Baseline recorded. Nothing to compare it with yet.",
    };
  }

  let effect: number;
  let se: number;
  if (input.mode === "whole") {
    const pts = [base, ...checks];
    const fit = linearFit(
      pts.map((s) => s.day),
      pts.map((s) => mean(s.values)),
    );
    effect = fit.slope * days;
    se = fit.slopeSe * days;
  } else {
    const d0 = mean(base.values);
    const diffs = checks.map((s) => mean(s.values) - d0);
    effect = mean(diffs);
    const sd = diffs.length >= 2 ? sampleSd(diffs) : NaN;
    // Never trust a spread smaller than the measured noise would allow.
    se = Math.max(Number.isFinite(sd) ? sd : 0, sigma) / Math.sqrt(diffs.length);
  }
  if (!Number.isFinite(se)) se = Infinity;
  const threshold = Math.max(K * se, K * sigma);
  const r = { ...common, effect, se, threshold };
  const f = (x: number) => (Math.abs(x) >= 10 ? x.toFixed(0) : x.toFixed(1));

  if (checks.length >= MIN_CHECKINS_WORSE && effect < -threshold) {
    return { ...r, kind: "worse", reason: `Down ${f(-effect)} points, more than the ${f(threshold)}-point bar set by your noise.` };
  }
  if (days < input.minDays) {
    return {
      ...r,
      kind: "too_early",
      reason: `Day ${days} of ${input.minDays}. Products like this rarely show an effect before day ${input.minDays}.`,
    };
  }
  if (checks.length < MIN_CHECKINS) {
    return { ...r, kind: "not_enough_data", reason: `${checks.length} of ${MIN_CHECKINS} check-ins needed to judge.` };
  }
  if (effect > threshold) {
    return { ...r, kind: "working", reason: `Up ${f(effect)} points, more than the ${f(threshold)}-point bar set by your noise.` };
  }
  return {
    ...r,
    kind: "no_effect",
    reason: `Change of ${effect >= 0 ? "+" : ""}${f(effect)} points is inside the ±${f(threshold)}-point noise bar.`,
  };
}

export const VERDICT_COPY: Record<VerdictKind, { title: string; icon: string }> = {
  working: { title: "Working", icon: "✓" },
  no_effect: { title: "No effect beyond noise", icon: "=" },
  too_early: { title: "Too early to tell", icon: "◔" },
  worse: { title: "Getting worse — consider stopping", icon: "↓" },
  not_enough_data: { title: "Not enough data", icon: "?" },
};
