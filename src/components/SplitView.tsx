"use client";
import { mean } from "@/lib/stats";
import { imageSideToUser } from "@/lib/split";
import { CONCERN_LABEL, Concern, Session, Shot, Trial } from "@/lib/types";
import { dayOf } from "@/lib/analysis";

/** Treated vs untreated side for one concern: the latest photo with its mask, and both sides over time. */
export function SplitView({ trial, sessions, concern, asOfDay = Infinity }: { trial: Trial; sessions: Session[]; concern: Concern; asOfDay?: number }) {
  const treated = trial.treatedSide!;
  const rows = sessions
    .map((s) => {
      const sides = s.shots.map((x) => x.sides?.[concern]).filter((v): v is NonNullable<typeof v> => !!v);
      if (!sides.length) return null;
      const t = mean(sides.map((v) => (treated === "image-left" ? v.left : v.right)));
      const u = mean(sides.map((v) => (treated === "image-left" ? v.right : v.left)));
      return { day: s.kind === "baseline" ? 0 : dayOf(trial, s.date), t, u, session: s };
    })
    .filter((r): r is NonNullable<typeof r> => !!r && r.day <= asOfDay);
  if (!rows.length) {
    return <p className="card p-4 text-sm text-muted">No side scores yet for {CONCERN_LABEL[concern].toLowerCase()}.</p>;
  }
  const first = rows[0];
  const last = rows[rows.length - 1];
  const photoShot = [...rows].reverse().map((r) => r.session.shots.find((s) => s.thumb)).find(Boolean);
  const treatedLabel = `Treated (${imageSideToUser(treated)} cheek)`;

  const W = 340;
  const H = 150;
  const pad = { l: 30, r: 10, t: 10, b: 22 };
  const all = rows.flatMap((r) => [r.t, r.u]);
  const lo = Math.floor(Math.min(...all) - 2);
  const hi = Math.ceil(Math.max(...all) + 2);
  const xMax = Math.max(last.day, 7);
  const x = (d: number) => pad.l + (d / xMax) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + ((hi - v) / (hi - lo)) * (H - pad.t - pad.b);

  return (
    <section className="card space-y-3 p-3">
      <div className="flex items-baseline justify-between px-1">
        <span className="text-sm font-semibold">Split-face: {CONCERN_LABEL[concern]}</span>
        <span className="text-xs text-muted">side score, higher = less detected</span>
      </div>
      {photoShot && <MaskPhoto shot={photoShot} concern={concern} treated={treated} />}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Treated and untreated side scores over time">
        {[lo, Math.round((lo + hi) / 2), hi].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="0.6" />
            <text x={pad.l - 5} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--muted)">
              {t}
            </text>
          </g>
        ))}
        <polyline fill="none" stroke="var(--muted)" strokeWidth="1.6" strokeDasharray="4 3" points={rows.map((r) => `${x(r.day)},${y(r.u)}`).join(" ")} />
        <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={rows.map((r) => `${x(r.day)},${y(r.t)}`).join(" ")} />
        {rows.map((r) => (
          <circle key={r.day} cx={x(r.day)} cy={y(r.t)} r="3" fill="var(--accent)" />
        ))}
        {[0, xMax].map((d) => (
          <text key={d} x={x(d)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">
            day {d}
          </text>
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs">
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-0.5 w-5 bg-accent" /> {treatedLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-0 w-5 border-t-2 border-dashed border-muted" /> Untreated
        </span>
      </div>
      <table className="w-full text-center text-xs">
        <thead className="text-muted">
          <tr>
            <th className="text-left font-normal">Day</th>
            <th className="font-normal">Treated</th>
            <th className="font-normal">Untreated</th>
            <th className="font-normal">Gap vs baseline</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {[first, ...(rows.length > 1 ? [last] : [])].map((r) => (
            <tr key={r.day}>
              <td className="text-left">{r.day === 0 ? "baseline" : r.day}</td>
              <td>{r.t.toFixed(1)}</td>
              <td>{r.u.toFixed(1)}</td>
              <td>{r === first ? "—" : `${r.t - r.u - (first.t - first.u) >= 0 ? "+" : ""}${(r.t - r.u - (first.t - first.u)).toFixed(1)}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function MaskPhoto({ shot, concern, treated }: { shot: Shot; concern: Concern; treated: "image-left" | "image-right" }) {
  const overlay = shot.overlays?.[concern];
  const mid = shot.midline;
  return (
    <div className="relative overflow-hidden rounded-xl bg-black/5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shot.thumb} alt="Your latest check-in photo" className="block w-full" />
      {overlay && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={overlay} alt="" className="absolute inset-0 h-full w-full mix-blend-multiply" style={{ filter: "sepia(1) saturate(4) hue-rotate(-30deg)", opacity: 0.85 }} />
      )}
      {mid && (
        <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <polyline points={mid.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#fff" strokeWidth="0.006" strokeDasharray="0.02 0.012" />
        </svg>
      )}
      <span className={`absolute top-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white ${treated === "image-left" ? "left-2" : "right-2"}`}>
        Treated
      </span>
      <span className={`absolute top-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold ${treated === "image-left" ? "right-2" : "left-2"}`}>
        Untreated
      </span>
    </div>
  );
}
