/**
 * HD unit cost per skin-analysis task, from the docs' "Unit Consumption" table
 * (docs.perfectcorp.com/reference/ai_skin_analysis, checked 2026-10-30). Units are charged only on success.
 */
const HD_TABLE: Array<[maxConcerns: number, units: number]> = [
  [4, 12],
  [8, 16],
  [12, 20],
  [16, 22],
];

export function hdUnits(concernCount: number): number {
  if (concernCount < 1) return 0;
  for (const [max, units] of HD_TABLE) if (concernCount <= max) return units;
  throw new Error(`At most 16 HD concerns per task (got ${concernCount})`);
}

/** Pick concerns for a shot: the trial's targets plus controls, capped at 4 so the shot stays in the cheapest tier. */
export function shotConcerns<T extends string>(targets: T[], controls: T[], cap = 4): T[] {
  const out: T[] = [];
  for (const c of [...targets, ...controls]) if (!out.includes(c) && out.length < cap) out.push(c);
  return out;
}

export function shotsAffordable(units: number, concernCount: number): number {
  const per = hdUnits(concernCount);
  return per === 0 ? Infinity : Math.floor(units / per);
}
