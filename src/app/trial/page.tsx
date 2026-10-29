"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Results } from "@/components/Results";
import { deleteTrial, getTrial, listSessions } from "@/lib/db";
import { getCategory } from "@/lib/categories";
import { dayOf, nextCheckinShots, verdictSessions } from "@/lib/analysis";
import { estimateNoise } from "@/lib/noise";
import { imageSideToUser } from "@/lib/split";
import { download, reminderIcs } from "@/lib/share";
import { CONCERN_LABEL, Session, Trial } from "@/lib/types";

function TrialPage() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id") ?? "";
  const fresh = params.get("fresh") === "1";
  const [trial, setTrial] = useState<Trial | null | undefined>(undefined);
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    (async () => {
      setTrial((await getTrial(id)) ?? null);
      setSessions(await listSessions(id));
    })();
  }, [id]);

  if (trial === undefined) return <p className="text-muted">Loading…</p>;
  if (trial === null) return <p>Trial not found on this device.</p>;

  const cat = getCategory(trial.category);
  const hasBaseline = sessions.some((s) => s.kind === "baseline" && s.shots.length > 0);
  const last = sessions[sessions.length - 1];
  const daysNow = dayOf(trial, new Date().toISOString());
  const sinceLast = last ? dayOf(trial, new Date().toISOString()) - (last.kind === "baseline" ? 0 : dayOf(trial, last.date)) : 0;
  const baselineOnly = sessions.length === 1 && hasBaseline;

  return (
    <div className="space-y-4">
      <div>
        <div className="label">
          {cat.label} · day {daysNow} · {trial.mode === "split" ? `split-face, treating ${imageSideToUser(trial.treatedSide!)} cheek` : "whole face"}
        </div>
        <h1 className="display text-3xl leading-tight font-semibold">{trial.name}</h1>
      </div>

      {!hasBaseline ? (
        <Link href={`/capture?id=${trial.id}&kind=baseline`} className="btn btn-primary w-full py-4">
          Take baseline photos
        </Link>
      ) : (
        <div className="flex gap-2">
          <Link href={`/capture?id=${trial.id}&kind=checkin`} className="btn btn-primary flex-1">
            Check in now{nextCheckinShots(sessions) > 1 ? " (2 photos)" : ""}
          </Link>
          <button className="btn btn-ghost" onClick={() => download("skin-checkins.ics", "data:text/calendar;charset=utf-8," + encodeURIComponent(reminderIcs(trial, 4)))}>
            Remind me
          </button>
        </div>
      )}
      {hasBaseline && sinceLast > 0 && sinceLast < 3 && <p className="text-sm text-muted">Last check-in was {sinceLast} day(s) ago. Every 3–7 days is plenty.</p>}

      {baselineOnly && <BaselineSummary trial={trial} sessions={sessions} fresh={fresh} />}

      {hasBaseline && <Results trial={trial} sessions={sessions} />}

      <p className="text-xs text-muted">
        Timing for this product type: we judge from day {cat.minDays}; published trials ran about {cat.typicalDays} days. Source: {cat.source}
        {cat.verified ? " (checked against the published abstract)" : " (reference not yet checked)"}
      </p>

      <button
        className="text-sm text-[var(--v-worse)] underline"
        onClick={async () => {
          if (confirm("Delete this trial and its photos from this device?")) {
            await deleteTrial(trial.id);
            router.push("/");
          }
        }}
      >
        Delete trial
      </button>
    </div>
  );
}

/** Right after the baseline: show the user their own noise. "Your scans vary by ±X; we only trust changes bigger than this." */
function BaselineSummary({ trial, sessions, fresh }: { trial: Trial; sessions: Session[]; fresh: boolean }) {
  const base = sessions.find((s) => s.kind === "baseline")!;
  const rows = trial.concerns.map((c) => {
    const values = trial.mode === "split" ? verdictSessions(trial, [base], c)[0]?.values ?? [] : base.shots.map((s) => s.raw[c]).filter((v): v is number => typeof v === "number");
    return { c, values, n: estimateNoise([values]) };
  });
  return (
    <section className="card p-4" style={fresh ? { borderColor: "var(--accent)" } : undefined}>
      <div className="label">Baseline done · your noise level</div>
      <ul className="mt-2 space-y-2">
        {rows.map(({ c, values, n }) => (
          <li key={c}>
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">{CONCERN_LABEL[c]}</span>
              <span className="font-mono text-sm">{Number.isFinite(n.pooledSigma) ? `±${n.pooledSigma.toFixed(1)}` : "—"}</span>
            </div>
            <div className="text-xs text-muted">
              {trial.mode === "split" ? "treated − untreated: " : "raw scores: "}
              {values.map((v) => v.toFixed(1)).join(" · ") || "no values"}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm">
        Three photos of the same face, minutes apart, gave these different numbers. We only call a change real when it’s bigger than about twice this wobble.
      </p>
    </section>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <TrialPage />
    </Suspense>
  );
}
