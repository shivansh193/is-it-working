import { describe, expect, it } from "vitest";
import { decide, VerdictSession } from "../verdict";
import { estimateNoise, PRIOR_SIGMA } from "../noise";
import { budgetFixtures } from "./helpers";

const base = (values: number[]): VerdictSession => ({ day: 0, kind: "baseline", values });
const chk = (day: number, ...values: number[]): VerdictSession => ({ day, kind: "checkin", values });

describe("noise estimate", () => {
  it("uses the prior with fewer than 2 repeat pairs", () => {
    const n = estimateNoise([[60, 62]]);
    expect(n).toMatchObject({ source: "prior", sigma: PRIOR_SIGMA, df: 1 });
  });
  it("pools within-session SD and shrinks toward the prior", () => {
    // SS = 2 + 2 = 4 over df = 2+2 = 4 → pooled 1; shrunk: sqrt((3·9 + 4)/(3+4)) = sqrt(31/7)
    const n = estimateNoise([
      [59, 60, 61],
      [69, 70, 71],
    ]);
    expect(n.source).toBe("personal");
    expect(n.pooledSigma).toBeCloseTo(1);
    expect(n.sigma).toBeCloseTo(Math.sqrt(31 / 7));
  });
  it("converges to the user's own noise with many repeats", () => {
    const groups = Array.from({ length: 50 }, (_, i) => [i, i + 1, i + 2]); // within SD = 1
    expect(estimateNoise(groups).sigma).toBeCloseTo(Math.sqrt((3 * 9 + 100) / (3 + 100)), 6);
  });
  it("ignores single-shot sessions and NaN", () => {
    expect(estimateNoise([[60], [NaN, 61]]).df).toBe(0);
  });
});

describe("verdict — whole face", () => {
  const minDays = 28;
  it("not enough data without a baseline", () => {
    expect(decide({ mode: "whole", minDays, sessions: [chk(3, 60)] }).kind).toBe("not_enough_data");
  });
  it("too early with only a baseline", () => {
    expect(decide({ mode: "whole", minDays, sessions: [base([60, 61, 59])] }).kind).toBe("too_early");
  });
  it("too early before the category minimum, even with a big gain", () => {
    const v = decide({ mode: "whole", minDays, sessions: [base([60, 61, 59]), chk(4, 66), chk(8, 70), chk(12, 74), chk(16, 78)] });
    expect(v.kind).toBe("too_early");
  });
  it("not enough data after the minimum with < 4 check-ins", () => {
    const v = decide({ mode: "whole", minDays, sessions: [base([60, 61, 59]), chk(30, 61), chk(35, 60)] });
    expect(v.kind).toBe("not_enough_data");
  });
  it("working when the trend beats 2·SE and 2·σ", () => {
    const v = decide({
      mode: "whole",
      minDays,
      sessions: [base([60, 61, 59]), chk(7, 62), chk(14, 64.5), chk(21, 66), chk(28, 68.2), chk(35, 70)],
    });
    expect(v.kind).toBe("working");
    expect(v.effect).toBeGreaterThan(v.threshold);
    expect(v.checkins).toBe(5);
    expect(v.days).toBe(35);
  });
  it("no effect when change sits inside the noise", () => {
    const v = decide({
      mode: "whole",
      minDays,
      sessions: [base([60, 61, 59]), chk(7, 61), chk(14, 59), chk(21, 60.5), chk(28, 61), chk(35, 59.5)],
    });
    expect(v.kind).toBe("no_effect");
  });
  it("getting worse is mirrored and may fire before the minimum time", () => {
    const v = decide({ mode: "whole", minDays, sessions: [base([60, 61, 59]), chk(4, 55), chk(8, 50), chk(12, 45)] });
    expect(v.kind).toBe("worse");
  });
  it("a noisy big slope with few points doesn't count (SE gate)", () => {
    const v = decide({
      mode: "whole",
      minDays,
      sessions: [base([60, 61, 59]), chk(29, 75), chk(30, 55), chk(31, 76), chk(32, 54)],
    });
    expect(v.kind).toBe("no_effect");
  });
});

describe("verdict — split face", () => {
  const minDays = 28;
  it("working when treated − untreated rises above its baseline difference", () => {
    // baseline d0 ≈ −2 (treated side starts a bit worse); later d ≈ +6
    const v = decide({
      mode: "split",
      minDays,
      sessions: [base([-2, -1.5, -2.5]), chk(7, 4), chk(14, 6), chk(21, 5.5), chk(28, 6.5), chk(35, 7)],
    });
    expect(v.kind).toBe("working");
    expect(v.effect).toBeCloseTo(7.8, 1);
  });
  it("no effect when d_t stays at d0", () => {
    const v = decide({
      mode: "split",
      minDays,
      sessions: [base([3, 3.5, 2.5]), chk(7, 3.4), chk(14, 2.2), chk(21, 3.9), chk(28, 2.8), chk(35, 3.1)],
    });
    expect(v.kind).toBe("no_effect");
  });
  it("SE is floored at σ/√n so a lucky low spread can't fake significance", () => {
    const v = decide({
      mode: "split",
      minDays,
      priorSigma: 3,
      sessions: [base([0]), chk(30, 2), chk(31, 2), chk(32, 2), chk(33, 2)],
    });
    expect(v.se).toBeCloseTo(3 / 2);
    expect(v.kind).toBe("no_effect");
  });
  it("worse on the treated side", () => {
    const v = decide({ mode: "split", minDays, sessions: [base([0, 0.5, -0.5]), chk(3, -8), chk(6, -9), chk(9, -10)] });
    expect(v.kind).toBe("worse");
  });
  it("stores its inputs for the 'why' panel", () => {
    const v = decide({ mode: "split", minDays, sessions: [base([0, 1, -1]), chk(3, 1)] });
    expect(v).toHaveProperty("noise.sigma");
    expect(v).toMatchObject({ minDays, mode: "split", checkins: 1, days: 3 });
    expect(typeof v.reason).toBe("string");
  });
});

describe("budget", () => budgetFixtures());
