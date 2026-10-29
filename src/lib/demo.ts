import { rng } from "./stats";
import { localDate } from "./analysis";
import { Concern, Session, Shot, Trial } from "./types";

/**
 * SIMULATED demo trial. Not real data, and labelled "Simulated data" everywhere it appears.
 *
 * Starting point: DEMO_BASELINE — [NEEDS INPUT] replace with the mean raw scores and side scores of
 * Shivansh's real baseline scans once recorded (fixtures/real/). Until then these are placeholders.
 *
 * Synthetic drift (documented in the README):
 *  - redness, treated side: no change until day 10, then +0.22 points/day, capped at +7.
 *  - texture: no change on either side (a product that doesn't do what it claims for this concern).
 *  - noise per shot: σ = DEMO_SIGMA_RAW for whole-face raw scores, DEMO_SIGMA_SIDE for each side score.
 */
export const DEMO_BASELINE: Record<"redness" | "texture", { raw: number; left: number; right: number }> = {
  redness: { raw: 63.5, left: 71.0, right: 69.5 },
  texture: { raw: 58.0, left: 64.0, right: 64.5 },
};
export const DEMO_SIGMA_RAW = 2.2;
export const DEMO_SIGMA_SIDE = 1.3;
export const DEMO_DAYS = 44;

export function drift(concern: "redness" | "texture", day: number): number {
  if (concern !== "redness") return 0;
  return Math.min(7, Math.max(0, (day - 10) * 0.22));
}

export function buildDemo(seed = 7): { trial: Trial; sessions: Session[] } {
  const r = rng(seed);
  const start = new Date();
  start.setDate(start.getDate() - DEMO_DAYS);
  const startDate = localDate(start);
  const trial: Trial = {
    id: "demo",
    name: "Niacinamide 10% serum (demo)",
    category: "niacinamide",
    concerns: ["redness", "texture"],
    startDate,
    price: 2500,
    supplyDays: 60,
    mode: "split",
    treatedSide: "image-right", // the user's left cheek
    createdAt: start.toISOString(),
    demo: true,
  };
  const shot = (day: number, i: number): Shot => {
    const raw: Shot["raw"] = {};
    const sides: Shot["sides"] = {};
    for (const c of trial.concerns as ("redness" | "texture")[]) {
      const b = DEMO_BASELINE[c];
      const eff = drift(c, day);
      raw[c] = +(b.raw + eff / 2 + DEMO_SIGMA_RAW * r.normal()).toFixed(2); // whole face sees half the effect
      sides[c] = {
        left: +(b.left + DEMO_SIGMA_SIDE * r.normal()).toFixed(2),
        right: +(b.right + eff + DEMO_SIGMA_SIDE * r.normal()).toFixed(2),
      };
    }
    return { id: `demo-${day}-${i}`, takenAt: dateAt(startDate, day, i), raw, sides, units: 0 };
  };
  const sessions: Session[] = [{ id: "demo-s0", trialId: "demo", date: dateAt(startDate, 0, 0), kind: "baseline", shots: [0, 1, 2].map((i) => shot(0, i)) }];
  let n = 0;
  for (let day = 4; day <= DEMO_DAYS; day += 4) {
    n++;
    const shots = n % 3 === 0 ? 2 : 1;
    sessions.push({
      id: `demo-s${day}`,
      trialId: "demo",
      date: dateAt(startDate, day, 0),
      kind: "checkin",
      shots: Array.from({ length: shots }, (_, i) => shot(day, i)),
    });
  }
  return { trial, sessions };
}

function dateAt(startDate: string, day: number, minute: number): string {
  const d = new Date(startDate + "T08:00:00");
  d.setDate(d.getDate() + day);
  d.setMinutes(d.getMinutes() + minute);
  return d.toISOString();
}

export const DEMO_CONCERNS: Concern[] = ["redness", "texture"];
