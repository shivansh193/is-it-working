"use client";
import { useState } from "react";
import { Verdict, VerdictKind, VERDICT_COPY, K, MIN_CHECKINS } from "@/lib/verdict";
import { CONCERN_LABEL, Concern } from "@/lib/types";
import type { Measurement } from "@/lib/analysis";

const TONE: Record<VerdictKind, { fg: string; bg: string }> = {
  working: { fg: "var(--v-working)", bg: "var(--v-working-bg)" },
  no_effect: { fg: "var(--v-noeffect)", bg: "var(--v-noeffect-bg)" },
  too_early: { fg: "var(--v-early)", bg: "var(--v-early-bg)" },
  worse: { fg: "var(--v-worse)", bg: "var(--v-worse-bg)" },
  not_enough_data: { fg: "var(--v-nodata)", bg: "var(--v-nodata-bg)" },
};
export const verdictTone = (k: VerdictKind) => TONE[k];

const fmt = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : "—");
const signed = (x: number) => (Number.isFinite(x) ? (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(1) : "—");

export function VerdictCard({ concern, v }: { concern: Concern; v: Verdict & Partial<Measurement> }) {
  const [open, setOpen] = useState(false);
  const tone = TONE[v.kind];
  const copy = VERDICT_COPY[v.kind];
  return (
    <section className="card overflow-hidden">
      <div className="flex items-start gap-3 p-4" style={{ background: tone.bg }}>
        <span
          aria-hidden
          className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg font-bold text-white"
          style={{ background: tone.fg }}
        >
          {copy.icon}
        </span>
        <div className="min-w-0">
          <div className="label" style={{ color: tone.fg }}>
            {CONCERN_LABEL[concern]}
          </div>
          <h3 className="display text-[1.6rem] leading-tight font-semibold" style={{ color: tone.fg }}>
            {copy.title}
          </h3>
          <p className="mt-1 text-sm text-ink/80">{v.reason}</p>
          {v.fallback && (
            <p className="mt-1.5 text-xs text-ink/70">
              Measured whole-face: on your repeat shots the left/right gap varied ±{fmt(v.fallback.splitSigma)}, more than twice the whole-face
              score (±{fmt(v.fallback.wholeSigma)}).
            </p>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-4 gap-2 border-t border-line px-4 py-3 text-center text-xs">
        <Stat k="Change" v={signed(v.effect)} />
        <Stat k="Noise bar" v={Number.isFinite(v.threshold) ? `±${fmt(v.threshold)}` : "—"} />
        <Stat k="Check-ins" v={String(v.checkins)} />
        <Stat k="Days" v={`${v.days}`} />
      </dl>
      <button onClick={() => setOpen(!open)} className="w-full border-t border-line px-4 py-2.5 text-left text-sm text-accent" aria-expanded={open}>
        {open ? "Hide" : "Why this verdict?"}
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-line px-4 py-3 text-sm text-muted">
          <p>
            Design: <b className="text-ink">{v.mode === "split" ? "split-face" : "whole-face"}</b>.{" "}
            {v.mode === "split"
              ? "Each check compares the treated side with the untreated side in the same photo, minus how they differed at baseline. Light, sleep and the camera affect both sides equally and cancel out."
              : "A straight-line trend over your check-ins. Lighting and daily changes are not controlled for, so it needs a bigger change to count."}
          </p>
          <p>
            Your scan-to-scan noise: σ = {fmt(v.noise.sigma)} points (
            {v.noise.source === "personal" ? `from ${v.noise.repeatPairs} repeat shots of you` : "population prior, until you have repeat shots"}).
          </p>
          <p>
            Rule: change must beat both {K}× its standard error (±{fmt(K * v.se)}) and {K}× your noise (±{fmt(K * v.noise.sigma)}), after at least{" "}
            {MIN_CHECKINS} check-ins and day {v.minDays}.
          </p>
          <p>Scores are YouCam raw scores (not the boosted “UI” score).</p>
        </div>
      )}
    </section>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-muted">{k}</dt>
      <dd className="mt-0.5 font-mono text-[0.95rem] text-ink">{v}</dd>
    </div>
  );
}
