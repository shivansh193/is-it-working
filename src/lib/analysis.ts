import { getCategory } from "./categories";
import { sideDiff } from "./split";
import { Concern, Session, Trial, TrialMode } from "./types";
import { estimateNoise } from "./noise";
import { Verdict, VerdictSession, decide } from "./verdict";

const DAY = 86_400_000;

/** YYYY-MM-DD in the user's own timezone (toISOString would give the UTC date). */
export function localDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function dayOf(trial: Trial, iso: string): number {
  const start = new Date(trial.startDate + "T00:00:00").getTime();
  // Whole days since the start date (late evening on day 0 is still day 0).
  return Math.max(0, Math.floor((new Date(iso).getTime() - start) / DAY));
}

/** Per-shot values the verdict runs on: raw score (whole face) or treated − untreated side score (split face). */
export function verdictSessions(trial: Trial, sessions: Session[], concern: Concern, asOfDay = Infinity): VerdictSession[] {
  const out: VerdictSession[] = [];
  for (const s of sessions) {
    const day = s.kind === "baseline" ? 0 : dayOf(trial, s.date);
    if (day > asOfDay) continue;
    const values: number[] = [];
    for (const shot of s.shots) {
      if (trial.mode === "split") {
        const sides = shot.sides?.[concern];
        if (sides && trial.treatedSide) {
          const d = sideDiff(sides, trial.treatedSide);
          if (Number.isFinite(d)) values.push(d);
        }
      } else {
        const r = shot.raw[concern];
        if (typeof r === "number") values.push(r);
      }
    }
    out.push({ day, kind: s.kind, values });
  }
  return out;
}

/** Split-face is used for a concern unless its gap is this many times noisier than the whole-face score. */
export const SPLIT_FALLBACK_RATIO = 2;

export interface Measurement {
  mode: TrialMode;
  /** Set when a split-face trial measures this concern whole-face instead. */
  fallback?: { splitSigma: number; wholeSigma: number };
}

/**
 * Which design to judge a concern with. In a split-face trial, the treated − untreated gap is used unless the
 * user's own repeat shots show it is more than SPLIT_FALLBACK_RATIO× noisier than the whole-face raw score.
 * Measured 2026-11-02 on real YouCam calls: redness gap ±1.4 vs raw ±2.2 (split), texture ±5.1 vs ±9.7 (split),
 * pores ±13.0 vs ±2.0 (whole face).
 */
export function measurementFor(trial: Trial, sessions: Session[], concern: Concern, asOfDay = Infinity): Measurement {
  if (trial.mode !== "split") return { mode: "whole" };
  const split = estimateNoise(verdictSessions(trial, sessions, concern, asOfDay).map((s) => s.values));
  const whole = estimateNoise(verdictSessions({ ...trial, mode: "whole" }, sessions, concern, asOfDay).map((s) => s.values));
  if (split.source === "personal" && whole.source === "personal" && split.sigma > SPLIT_FALLBACK_RATIO * whole.sigma) {
    return { mode: "whole", fallback: { splitSigma: split.sigma, wholeSigma: whole.sigma } };
  }
  return { mode: "split" };
}

export function trialVerdict(trial: Trial, sessions: Session[], concern: Concern, asOfDay = Infinity): Verdict & Measurement {
  const m = measurementFor(trial, sessions, concern, asOfDay);
  const t = { ...trial, mode: m.mode };
  return { ...decide({ mode: m.mode, minDays: getCategory(trial.category).minDays, sessions: verdictSessions(t, sessions, concern, asOfDay) }), ...m };
}

/** Whole-face raw-score points per session (mean of shots), for the trend chart in either mode. */
export function rawSeries(trial: Trial, sessions: Session[], concern: Concern, asOfDay = Infinity) {
  return sessions
    .map((s) => {
      const vals = s.shots.map((x) => x.raw[concern]).filter((v): v is number => typeof v === "number");
      return { day: s.kind === "baseline" ? 0 : dayOf(trial, s.date), kind: s.kind, values: vals };
    })
    .filter((p) => p.values.length && p.day <= asOfDay);
}

export function costSoFar(trial: Trial, days: number): number | undefined {
  if (!trial.price || !trial.supplyDays) return undefined;
  return (trial.price / trial.supplyDays) * Math.min(days, trial.supplyDays);
}

export function nextCheckinShots(sessions: Session[]): number {
  const checkins = sessions.filter((s) => s.kind === "checkin").length;
  // Every 3rd check-in takes 2 shots to keep the noise estimate fresh.
  return (checkins + 1) % 3 === 0 ? 2 : 1;
}
