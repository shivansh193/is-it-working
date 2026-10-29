"use client";
import { getCategory } from "./categories";
import { CONCERN_LABEL, Concern, Trial } from "./types";
import { VERDICT_COPY, Verdict } from "./verdict";

const COLORS: Record<string, string> = {
  working: "#2b7a4b",
  no_effect: "#4f5e66",
  too_early: "#976100",
  worse: "#b23a35",
  not_enough_data: "#6b6560",
};

/** A no-face summary image for the user's records or a dermatologist. */
export function renderShareCard(trial: Trial, verdicts: Array<[Concern, Verdict]>, simulated: boolean): string {
  const W = 1080;
  const rowH = 190;
  const H = 420 + verdicts.length * rowH + 140;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f6f2ec";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#1d2a2e";
  g.font = "600 34px Georgia, serif";
  g.fillText("Is it working?", 72, 100);
  g.font = "600 58px Georgia, serif";
  wrap(g, trial.name, 72, 190, W - 144, 66);
  g.font = "28px system-ui, sans-serif";
  g.fillStyle = "#5d6a6e";
  const days = verdicts[0]?.[1].days ?? 0;
  g.fillText(
    `${getCategory(trial.category).label} · ${trial.mode === "split" ? "split-face trial" : "whole-face trial"} · day ${days}`,
    72,
    320,
  );
  if (simulated) {
    g.fillStyle = "#7a3fa0";
    g.font = "600 28px system-ui, sans-serif";
    g.fillText("SIMULATED DATA — demo only", 72, 365);
  }
  let y = 420;
  for (const [concern, v] of verdicts) {
    g.fillStyle = "#fffdf9";
    roundRect(g, 60, y, W - 120, rowH - 24, 24);
    g.fill();
    g.fillStyle = COLORS[v.kind];
    g.fillRect(60, y, 14, rowH - 24);
    g.font = "600 26px system-ui, sans-serif";
    g.fillText(CONCERN_LABEL[concern].toUpperCase(), 100, y + 50);
    g.font = "600 46px Georgia, serif";
    g.fillText(`${VERDICT_COPY[v.kind].icon}  ${VERDICT_COPY[v.kind].title}`, 100, y + 108);
    g.fillStyle = "#5d6a6e";
    g.font = "26px system-ui, sans-serif";
    const eff = Number.isFinite(v.effect) ? `${v.effect >= 0 ? "+" : ""}${v.effect.toFixed(1)}` : "—";
    const bar = Number.isFinite(v.threshold) ? `±${v.threshold.toFixed(1)}` : "—";
    g.fillText(`change ${eff} · noise bar ${bar} · ${v.checkins} check-ins · σ ${v.noise.sigma.toFixed(1)}`, 100, y + 148);
    y += rowH;
  }
  g.fillStyle = "#5d6a6e";
  g.font = "22px system-ui, sans-serif";
  g.fillText("YouCam raw scores. A change counts only if it beats 2× the user's own scan noise.", 72, H - 80);
  g.fillText("Not medical advice.", 72, H - 46);
  return c.toDataURL("image/png");
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  let line = "";
  for (const w of text.split(" ")) {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width > max && line) {
      g.fillText(line, x, y);
      line = w;
      y += lh;
    } else line = t;
  }
  g.fillText(line, x, y);
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Calendar file with check-in reminders every `every` days for `count` check-ins. */
export function reminderIcs(trial: Trial, every: number, count = 12): string {
  const start = new Date(trial.startDate + "T09:00:00");
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//is-it-working//EN"];
  for (let i = 1; i <= count; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * every);
    const e = new Date(d.getTime() + 10 * 60_000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${trial.id}-${i}@is-it-working`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(d)}`,
      `DTEND:${fmt(e)}`,
      `SUMMARY:Skin check-in: ${trial.name.replace(/[,;\n]/g, " ")}`,
      "DESCRIPTION:Same spot\\, same light. Open Is it working? and take your check-in photo.",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function download(name: string, href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
}
