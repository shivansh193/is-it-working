"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { exportAll, importAll, listSessions, listTrials } from "@/lib/db";
import { getCategory } from "@/lib/categories";
import { trialVerdict } from "@/lib/analysis";
import { CONCERN_LABEL, Trial } from "@/lib/types";
import { VERDICT_COPY, Verdict } from "@/lib/verdict";
import { verdictTone } from "@/components/VerdictCard";
import { download } from "@/lib/share";

interface Row {
  trial: Trial;
  first?: Verdict;
  sessions: number;
}

export default function Home() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const load = async () => {
    const trials = (await listTrials()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setRows(
      await Promise.all(
        trials.map(async (trial) => {
          const s = await listSessions(trial.id);
          return { trial, sessions: s.length, first: s.length ? trialVerdict(trial, s, trial.concerns[0]) : undefined };
        }),
      ),
    );
  };
  useEffect(() => {
    load().catch(() => setRows([]));
  }, []);

  return (
    <div className="space-y-6">
      <section className="pt-4">
        <h1 className="display text-[2.4rem] leading-[1.05] font-semibold">
          Is that serum
          <br />
          actually doing anything?
        </h1>
        <p className="mt-3 text-[1.05rem] leading-relaxed text-muted">
          Test it like a dermatologist would: put it on <b className="text-ink">one side of your face</b>, and compare both sides in the same photo. Lighting,
          sleep and your camera cancel out. You get real numbers and an honest answer, including <i>“not yet”</i>.
        </p>
        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          <Link href="/new" className="btn btn-primary flex-1">
            Start a trial
          </Link>
          <Link href="/demo" className="btn btn-ghost flex-1">
            See a demo trial <span className="text-xs text-[var(--sim)]">(simulated)</span>
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2 text-center text-xs">
        {[
          ["Split-face", "Treated vs untreated side, same photo"],
          ["Your noise", "We measure how much your scans wobble"],
          ["Raw scores", "Not the score boosted to feel good"],
        ].map(([a, b]) => (
          <div key={a} className="card p-3">
            <div className="text-sm font-semibold">{a}</div>
            <div className="mt-1 leading-snug text-muted">{b}</div>
          </div>
        ))}
      </section>

      {rows && rows.length > 0 && (
        <section className="space-y-2">
          <h2 className="label">Your trials</h2>
          {rows.map(({ trial, first, sessions }) => {
            const tone = first ? verdictTone(first.kind) : null;
            return (
              <Link key={trial.id} href={`/trial?id=${trial.id}`} className="card flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{trial.name}</div>
                  <div className="text-xs text-muted">
                    {getCategory(trial.category).label} · {trial.concerns.map((c) => CONCERN_LABEL[c]).join(", ")} · {sessions ? `${sessions} sessions` : "no baseline yet"}
                  </div>
                </div>
                {first && tone && (
                  <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: tone.bg, color: tone.fg }}>
                    {VERDICT_COPY[first.kind].icon} {VERDICT_COPY[first.kind].title.split(" —")[0]}
                  </span>
                )}
              </Link>
            );
          })}
        </section>
      )}

      <section className="flex flex-wrap gap-3 text-sm">
        <button
          className="text-accent underline"
          onClick={async () => download("is-it-working-export.json", URL.createObjectURL(new Blob([JSON.stringify(await exportAll())], { type: "application/json" })))}
        >
          Export my data
        </button>
        <button className="text-accent underline" onClick={() => file.current?.click()}>
          Import
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              setMsg(`Imported ${await importAll(JSON.parse(await f.text()))} trial(s).`);
              load();
            } catch (err) {
              setMsg((err as Error).message);
            }
          }}
        />
        {msg && <span className="text-muted">{msg}</span>}
      </section>
    </div>
  );
}
