"use client";
import { useMemo, useState } from "react";
import { Results } from "@/components/Results";
import { buildDemo, DEMO_DAYS } from "@/lib/demo";
import { getCategory } from "@/lib/categories";
import { imageSideToUser } from "@/lib/split";

/** Replays a SIMULATED 6-week split-face trial so the verdict states can be seen changing. Nothing here is real data. */
export default function Demo() {
  const { trial, sessions } = useMemo(() => buildDemo(), []);
  const [day, setDay] = useState(12);
  const cat = getCategory(trial.category);
  return (
    <div className="space-y-4">
      <div className="sim-banner rounded-2xl px-4 py-3 text-sm">
        <b>Simulated data.</b> A made-up 6-week trial built from a baseline plus a documented synthetic drift. It shows how the verdict changes; it is not a result
        from a real person.
      </div>
      <div>
        <div className="label">
          {cat.label} · split-face, treating {imageSideToUser(trial.treatedSide!)} cheek
        </div>
        <h1 className="display text-3xl font-semibold">{trial.name}</h1>
      </div>
      <div className="card p-4">
        <label className="flex items-baseline justify-between">
          <span className="label">Replay to day</span>
          <span className="display text-2xl font-semibold">{day}</span>
        </label>
        <input type="range" min={4} max={DEMO_DAYS} step={4} value={day} onChange={(e) => setDay(+e.target.value)} className="mt-2 w-full accent-[var(--accent)]" aria-label="Replay day" />
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>day 4</span>
          <span>earliest effect: day {cat.minDays}</span>
          <span>day {DEMO_DAYS}</span>
        </div>
      </div>
      <Results trial={trial} sessions={sessions} asOfDay={day} simulated />
      <div className="sim-banner pointer-events-none fixed bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold shadow-sm">
        Simulated data
      </div>
    </div>
  );
}
