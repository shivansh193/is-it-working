"use client";
import { useEffect, useState } from "react";
import { listAllSessions } from "@/lib/db";
import { estimateNoise } from "@/lib/noise";
import { validateSplit } from "@/lib/split";
import { CONCERNS, CONCERN_LABEL, Session, SideScores } from "@/lib/types";

/**
 * Go/no-go for split-face (build step 4). Uses every stored shot that has side scores. On untreated faces
 * (baseline shots, or any shots taken before applying anything), left − right must be stable across photos.
 */
export default function Validate() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [onlyBaseline, setOnlyBaseline] = useState(true);
  useEffect(() => {
    listAllSessions().then(setSessions);
  }, []);
  if (!sessions) return <p className="text-muted">Loading…</p>;
  const pool = sessions.filter((s) => !onlyBaseline || s.kind === "baseline");
  const shots = pool.flatMap((s) => s.shots).filter((s) => !s.mock);

  return (
    <div className="space-y-4">
      <h1 className="display text-3xl font-semibold">Split-face validation</h1>
      <p className="text-sm text-muted">
        Passes when left − right side scores vary across 5+ untreated photos by no more than 2·σ·√2, where σ is the whole-face raw-score noise from the same
        sessions. If it fails, split-face mode should be turned off and the claim dropped.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={onlyBaseline} onChange={(e) => setOnlyBaseline(e.target.checked)} /> Baseline sessions only (untreated)
      </label>
      <table className="card w-full text-center text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th className="p-2 text-left">Concern</th>
            <th>n</th>
            <th>mean L−R</th>
            <th>SD L−R</th>
            <th>σ raw</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {CONCERNS.map((c) => {
            const pairs = shots.map((s) => s.sides?.[c]).filter((x): x is SideScores => !!x);
            if (!pairs.length) return null;
            const sigma = estimateNoise(pool.map((s) => s.shots.map((x) => x.raw[c] ?? NaN))).sigma;
            const v = validateSplit(pairs, sigma);
            return (
              <tr key={c} className="border-t border-line">
                <td className="p-2 text-left font-sans">{CONCERN_LABEL[c]}</td>
                <td>{v.n}</td>
                <td>{v.meanDiff.toFixed(1)}</td>
                <td>{v.sdDiff.toFixed(1)}</td>
                <td>{sigma.toFixed(1)}</td>
                <td className="font-sans font-semibold" style={{ color: v.pass ? "var(--v-working)" : v.n < 5 ? "var(--v-nodata)" : "var(--v-worse)" }}>
                  {v.pass ? "✓ pass" : v.n < 5 ? "? need 5+" : "✗ fail"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {shots.length === 0 && <p className="text-sm text-muted">No real shots with side scores yet. Take a split-face baseline first.</p>}
    </div>
  );
}
