import { getCategory } from "./categories";
import { sideDiff } from "./split";
import { Concern, Session, Trial } from "./types";
import { Verdict, VerdictSession, decide } from "./verdict";

const DAY = 86_400_000;

/** YYYY-MM-DD in the user's own timezone (toISOString would give the UTC date). */
export function localDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function dayOf(trial: Trial, iso: string): number {
  const start = new Date(trial.startDate + "T00:00:00").getTime();
  return Math.max(0, Math.round((new Date(iso).getTime() - start) / DAY));
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

export function trialVerdict(trial: Trial, sessions: Session[], concern: Concern, asOfDay = Infinity): Verdict {
  return decide({ mode: trial.mode, minDays: getCategory(trial.category).minDays, sessions: verdictSessions(trial, sessions, concern, asOfDay) });
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
