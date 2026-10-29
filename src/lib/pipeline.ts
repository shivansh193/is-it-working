"use client";
import { FaceGeom } from "./facemesh";
import { drawToCanvas, loadImage, thumb, toBlob } from "./image";
import { pixelSeverity, sideDensity, sidesInRawUnits } from "./split";
import { Concern, Shot } from "./types";
import { uid } from "./db";

export type Stage = "uploading" | "analyzing" | "masks" | "done";

interface TaskResult {
  status: "running" | "success" | "error";
  error?: string;
  concerns: Partial<Record<Concern, { raw: number; ui?: number }>>;
  masks: Record<string, string[]>;
  mock: boolean;
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  return body as T;
}

/**
 * One shot end to end: upload → task → poll → (split mode) side scores from masks.
 * Units are charged by YouCam only when the task succeeds.
 */
export async function analyzeShot(
  canvas: HTMLCanvasElement,
  concerns: Concern[],
  face: FaceGeom | null,
  wantSides: boolean,
  onStage: (s: Stage) => void,
): Promise<Shot> {
  onStage("uploading");
  const blob = await toBlob(canvas);
  const { fileId } = await json<{ fileId: string }>(await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob }));

  onStage("analyzing");
  const { taskId, units } = await json<{ taskId: string; units: number }>(
    await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId, concerns }) }),
  );

  let result: TaskResult | null = null;
  const started = Date.now();
  for (let delay = 1200; Date.now() - started < 120_000; delay = Math.min(delay * 1.4, 4000)) {
    await new Promise((r) => setTimeout(r, delay));
    const r = await json<TaskResult>(await fetch(`/api/task/${encodeURIComponent(taskId)}`, { cache: "no-store" }));
    if (r.status === "success") {
      result = r;
      break;
    }
    if (r.status === "error") throw new Error(friendlyError(r.error));
  }
  if (!result) throw new Error("Analysis timed out. No units are charged for unfinished tasks.");
  if (!result.mock) addSpent(units);

  const raw: Shot["raw"] = {};
  for (const [c, r] of Object.entries(result.concerns)) if (r) raw[c as Concern] = r.raw;

  const shot: Shot = { id: uid(), takenAt: new Date().toISOString(), taskId, raw, units: result.mock ? 0 : units, mock: result.mock, thumb: thumb(canvas) };
  if (face) shot.midline = face.midline;

  if (wantSides && face) {
    onStage("masks");
    shot.sides = {};
    shot.overlays = {};
    for (const c of concerns) {
      const urls = result.masks[c] ?? [];
      if (!urls.length) continue;
      const m = await combinedMask(urls);
      // Side scores assume the mask covers the whole photo. If the aspect differs, we can't place the midline: skip, don't guess.
      if (Math.abs(m.data.width / m.data.height - canvas.width / canvas.height) > 0.02) {
        console.warn(`[split] ${c} mask ${m.data.width}×${m.data.height} doesn't match photo ${canvas.width}×${canvas.height}; side scores skipped`);
        continue;
      }
      const raw = shot.raw[c];
      if (raw === undefined) continue;
      shot.sides[c] = sidesInRawUnits(sideDensity(m.data, face.oval, face.midline, Math.max(1, Math.round(m.data.width / 600))), raw);
      shot.overlays[c] = m.preview;
    }
  }
  onStage("done");
  return shot;
}

/** Merge a concern's masks by max alpha (normally there is one: the "whole" region). */
async function combinedMask(urls: string[]) {
  const imgs = await Promise.all(urls.map(loadImage));
  const w = imgs[0].naturalWidth;
  const h = imgs[0].naturalHeight;
  const c = drawToCanvas(imgs[0], w, h);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const data = ctx.getImageData(0, 0, w, h);
  for (const img of imgs.slice(1)) {
    const o = drawToCanvas(img, w, h).getContext("2d")!.getImageData(0, 0, w, h);
    for (let i = 3; i < data.data.length; i += 4) data.data[i] = Math.max(data.data[i], o.data[i]);
  }
  // Preview shows detections only: drop the grey background layer and the outlines.
  const view = new ImageData(new Uint8ClampedArray(data.data), w, h);
  for (let i = 0; i < view.data.length; i += 4) {
    if (pixelSeverity(view.data[i], view.data[i + 1], view.data[i + 2], view.data[i + 3]) === 0) view.data[i + 3] = 0;
  }
  ctx.putImageData(view, 0, 0);
  const pw = 360;
  const preview = drawToCanvas(c, pw, Math.round((h / w) * pw)).toDataURL("image/png");
  return { data, preview };
}

function friendlyError(code?: string): string {
  switch (code) {
    case "error_src_face_too_small":
      return "Face too small in the photo. Move closer so your face fills most of the frame.";
    case "error_src_face_out_of_bound":
      return "Part of your face is out of frame. Centre it in the outline.";
    case "error_lighting_dark":
      return "Too dark to analyse. Move to even, brighter light.";
    case "error_below_min_image_size":
      return "Photo resolution too low for HD analysis.";
    default:
      return `Analysis failed (${code ?? "unknown"}). No units are charged for failed tasks.`;
  }
}

// ── dev-only unit counter (this browser only) ──
const SPENT = "iiw-units-spent";
export function getSpent(): number {
  try {
    return Number(localStorage.getItem(SPENT)) || 0;
  } catch {
    return 0;
  }
}
function addSpent(n: number) {
  try {
    localStorage.setItem(SPENT, String(getSpent() + n));
    window.dispatchEvent(new Event("iiw-units"));
  } catch {}
}
