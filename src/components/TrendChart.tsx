"use client";
import { mean } from "@/lib/stats";

export interface ChartPoint {
  day: number;
  values: number[];
  kind: "baseline" | "checkin";
}

/**
 * Change since baseline per check-in, with the shaded noise band (±bar). Points outside the band are real changes;
 * points inside it are indistinguishable from re-taking the photo.
 */
export function TrendChart({
  points,
  bar,
  maxDay,
  minDays,
  title,
  unit = "points vs baseline",
}: {
  points: ChartPoint[];
  bar: number;
  maxDay: number;
  minDays: number;
  title: string;
  unit?: string;
}) {
  const W = 340;
  const H = 190;
  const pad = { l: 34, r: 10, t: 12, b: 26 };
  const base = points.find((p) => p.kind === "baseline");
  if (!base) return null;
  const b0 = mean(base.values);
  const pts = points.map((p) => ({ day: p.day, y: mean(p.values) - b0, shots: p.values.map((v) => v - b0), kind: p.kind }));
  // No check-ins yet → no noise bar; draw the axes without a band.
  const band = Number.isFinite(bar) ? bar : 0;
  const ext = Math.max(band * 1.6, 4, ...pts.flatMap((p) => p.shots.map(Math.abs))) * 1.1;
  const xMax = Math.max(maxDay, 7);
  const x = (d: number) => pad.l + (d / xMax) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + ((ext - v) / (2 * ext)) * (H - pad.t - pad.b);
  const step = ext > 12 ? 5 : ext > 6 ? 2 : 1;
  const ticks: number[] = [];
  for (let t = -Math.floor(ext / step) * step; t <= ext; t += step) ticks.push(t);

  return (
    <figure className="card p-3">
      <figcaption className="mb-1 flex items-baseline justify-between px-1">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted">{unit}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title}: change since baseline over ${maxDay} days, noise band ±${bar.toFixed(1)}`}>
        {band > 0 && (
          <rect x={pad.l} y={y(bar)} width={W - pad.l - pad.r} height={y(-bar) - y(bar)} fill="var(--v-noeffect-bg)" />
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={t === 0 ? 1.2 : 0.6} />
            <text x={pad.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--muted)">
              {t > 0 ? `+${t}` : t}
            </text>
          </g>
        ))}
        {minDays <= xMax && (
          <g>
            <line x1={x(minDays)} x2={x(minDays)} y1={pad.t} y2={H - pad.b} stroke="var(--v-early)" strokeDasharray="3 3" />
            <text x={x(minDays) + 4} y={pad.t + 9} fontSize="9.5" fill="var(--v-early)">
              earliest effect
            </text>
          </g>
        )}
        <polyline fill="none" stroke="var(--accent)" strokeWidth="1.8" points={pts.map((p) => `${x(p.day)},${y(p.y)}`).join(" ")} />
        {pts.flatMap((p) =>
          p.shots.length > 1 ? p.shots.map((s, i) => <circle key={`${p.day}-${i}`} cx={x(p.day)} cy={y(s)} r="1.8" fill="var(--muted)" opacity="0.6" />) : [],
        )}
        {pts.map((p) => (
          <circle key={p.day} cx={x(p.day)} cy={y(p.y)} r={p.kind === "baseline" ? 4 : 3.4} fill={band > 0 && Math.abs(p.y) > band ? "var(--accent)" : "#fff"} stroke="var(--accent)" strokeWidth="1.6" />
        ))}
        {[0, Math.round(xMax / 2), xMax].map((d) => (
          <text key={d} x={x(d)} y={H - 8} textAnchor={d === 0 ? "start" : d === xMax ? "end" : "middle"} fontSize="10" fill="var(--muted)">
            day {d}
          </text>
        ))}
      </svg>
      <p className="px-1 text-xs text-muted">
        Grey band = ±{Number.isFinite(bar) ? bar.toFixed(1) : "—"}: changes inside it are no bigger than re-taking the photo. Filled dots are outside it.
      </p>
    </figure>
  );
}
