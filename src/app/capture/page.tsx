"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Capture } from "@/components/Capture";
import { getTrial, listSessions, putSession, uid } from "@/lib/db";
import { nextCheckinShots } from "@/lib/analysis";
import { shotConcerns, hdUnits } from "@/lib/budget";
import { FaceGeom } from "@/lib/facemesh";
import { AccessCodeError, analyzeShot, getAccessCode, setAccessCode, Stage } from "@/lib/pipeline";
import { Session, Trial } from "@/lib/types";
import { estimateNoise } from "@/lib/noise";
import { CONCERN_LABEL } from "@/lib/types";

/** Controls measured alongside the targets in every shot (cap 4 concerns = cheapest HD tier, 12 units). */
const CONTROLS = ["redness", "texture"] as const;
const GAP_SECONDS = 60;

function CapturePage() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id") ?? "";
  const kind = (params.get("kind") === "baseline" ? "baseline" : "checkin") as Session["kind"];
  const [trial, setTrial] = useState<Trial | null>(null);
  const [total, setTotal] = useState(kind === "baseline" ? 3 : 1);
  const [session, setSession] = useState<Session | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = stage !== null && stage !== "done";
  const sessionRef = useRef<Session | null>(null);
  const lastShot = useRef<{ canvas: HTMLCanvasElement; face: FaceGeom | null } | null>(null);
  const [needCode, setNeedCode] = useState(false);
  const [code, setCode] = useState("");

  useEffect(() => {
    (async () => {
      const t = await getTrial(id);
      if (!t) return;
      setTrial(t);
      if (kind === "checkin") setTotal(nextCheckinShots(await listSessions(id)));
    })();
  }, [id, kind]);

  if (!trial) return <p className="text-muted">Loading…</p>;
  const concerns = shotConcerns(trial.concerns, [...CONTROLS]);
  const done = session?.shots.length ?? 0;

  const onShot = async (canvas: HTMLCanvasElement, face: FaceGeom | null) => {
    setError(null);
    lastShot.current = { canvas, face };
    if (!face) return setError("No face found in that photo. Centre your face in the outline and try again.");
    if (face.widthFrac < 0.6) return setError("Your face needs to fill more of the photo (YouCam needs over 60% of the width). Move closer.");
    try {
      const shot = await analyzeShot(canvas, concerns, face, trial.mode === "split", setStage);
      if (trial.mode === "split" && !Object.keys(shot.sides ?? {}).length && !shot.mock) {
        setError("Couldn’t compute side scores from the masks for this photo. It’s saved for whole-face results.");
      }
      const s: Session = sessionRef.current
        ? { ...sessionRef.current, shots: [...sessionRef.current.shots, shot] }
        : { id: uid(), trialId: trial.id, date: new Date().toISOString(), kind, shots: [shot] };
      sessionRef.current = s;
      setSession(s);
      await putSession(s);
      setStage(null);
      if (s.shots.length >= total) router.push(`/trial?id=${trial.id}&fresh=1`);
    } catch (e) {
      setStage(null);
      if (e instanceof AccessCodeError) {
        setCode(getAccessCode());
        setNeedCode(true);
      } else setError((e as Error).message);
    }
  };

  const retryWithCode = () => {
    setAccessCode(code);
    setNeedCode(false);
    if (lastShot.current) onShot(lastShot.current.canvas, lastShot.current.face);
  };

  const noise = session && session.shots.length >= 2 ? concerns.map((c) => [c, estimateNoise([session.shots.map((s) => s.raw[c] ?? NaN)])] as const) : null;

  return (
    <div className="space-y-4">
      <div>
        <div className="label">{trial.name}</div>
        <h1 className="display text-3xl font-semibold">{kind === "baseline" ? "Baseline" : "Check-in"}</h1>
        <p className="mt-1 text-sm text-muted">
          {total === 1
            ? "One photo."
            : `${total} photos, a minute apart. ${kind === "baseline" ? "The differences between them are your personal noise level." : "The extra photo refreshes your noise estimate."}`}{" "}
          Measuring {concerns.map((c) => CONCERN_LABEL[c].toLowerCase()).join(", ")} ({hdUnits(concerns.length)} units per photo).
        </p>
        {trial.mode === "split" && kind === "baseline" && (
          <p className="mt-2 rounded-xl bg-accent-soft p-3 text-sm">Take the baseline <b>before</b> your first split-face application.</p>
        )}
      </div>

      <Capture total={total} done={done} gapSeconds={GAP_SECONDS} treatedSide={trial.treatedSide} busy={busy} onShot={onShot} />

      {stage && stage !== "done" && (
        <p className="text-center text-sm text-muted" aria-live="polite">
          {{ uploading: "Uploading photo…", analyzing: "YouCam is analysing your skin…", masks: "Measuring each side of your face…" }[stage]}
        </p>
      )}
      {error && <p className="rounded-xl bg-[var(--v-worse-bg)] p-3 text-sm text-[var(--v-worse)]">{error}</p>}
      {needCode && (
        <form
          className="card space-y-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            retryWithCode();
          }}
        >
          <label className="block space-y-1.5">
            <span className="label block">Access code</span>
            <span className="block text-sm text-muted">
              Each analysis spends paid YouCam API units, so this public demo asks for a code. Your photo is kept and will be analysed as soon as the code is right.
            </span>
            <input className="field" autoFocus autoCapitalize="none" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <button className="btn btn-primary w-full" disabled={!code.trim()}>
            Analyse photo
          </button>
          <p className="text-xs text-muted">No code? The simulated demo trial works without one.</p>
        </form>
      )}
      {session?.shots.some((s) => s.mock) && (
        <p className="rounded-xl border border-dashed border-line p-3 text-xs text-muted">Mock mode: no API key is set, so scores are made up and no units are spent.</p>
      )}
      {noise && (
        <div className="card p-4 text-sm">
          <div className="label">Your scans so far</div>
          <ul className="mt-1 space-y-0.5">
            {noise.map(([c, n]) => (
              <li key={c}>
                {CONCERN_LABEL[c]}: {session!.shots.map((s) => s.raw[c]?.toFixed(1) ?? "—").join(" · ")}{" "}
                <span className="text-muted">(spread {Number.isFinite(n.pooledSigma) ? `±${n.pooledSigma.toFixed(1)}` : "—"})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <CapturePage />
    </Suspense>
  );
}
