import { ImageSide, SideScores } from "./types";

export interface Pt {
  x: number; // normalised 0–1 in image coordinates
  y: number;
}

/** MediaPipe Face Mesh: forehead centre → nose bridge → nose tip → chin. */
export const MIDLINE_IDX = [10, 168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 164, 0, 17, 18, 200, 199, 175, 152];
/** MediaPipe FACEMESH_FACE_OVAL, in order around the face. */
export const FACE_OVAL_IDX = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

export function pickPts(landmarks: Pt[], idx: number[]): Pt[] {
  return idx.map((i) => landmarks[i]).filter(Boolean);
}

/** x of the midline polyline at height y (clamped to its ends). Points must be sorted by y. */
export function midlineX(mid: Pt[], y: number): number {
  if (y <= mid[0].y) return mid[0].x;
  for (let i = 1; i < mid.length; i++) {
    const a = mid[i - 1];
    const b = mid[i];
    if (y <= b.y) {
      const t = b.y === a.y ? 0 : (y - a.y) / (b.y - a.y);
      return a.x + t * (b.x - a.x);
    }
  }
  return mid[mid.length - 1].x;
}

export function insidePolygon(poly: Pt[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export interface MaskLike {
  width: number;
  height: number;
  /** RGBA bytes, row-major. Only alpha is read. */
  data: Uint8ClampedArray | Uint8Array;
}

export interface SideDensity {
  /** Mean detection severity (0–1) on the image-left / image-right side of the midline, inside the face oval. */
  left: number;
  right: number;
  leftPx: number;
  rightPx: number;
}

/**
 * How much a mask pixel counts as a detection (0–1). YouCam's HD masks are drawn overlays, checked on real
 * responses (2026-10-30): a grey (61,61,61) dimming layer at fixed opacity over everything not detected,
 * white outlines of the analysed area, and coloured detection pixels whose opacity carries intensity.
 * Only the coloured pixels count.
 */
export function pixelSeverity(r: number, g: number, b: number, a: number): number {
  if (a === 0) return 0;
  if (Math.abs(r - 61) <= 3 && Math.abs(g - 61) <= 3 && Math.abs(b - 61) <= 3) return 0; // background layer
  if (r >= 250 && g >= 250 && b >= 250) return 0; // area outline
  return a / 255;
}

/**
 * Detection density on each side of the face midline, inside the face oval.
 * The mask must cover the whole photo (true for real responses: masks match the uploaded image size);
 * landmarks are normalised, so mask resolution doesn't matter.
 */
export function sideDensity(mask: MaskLike, oval: Pt[], midline: Pt[], step = 1): SideDensity {
  const mid = [...midline].sort((a, b) => a.y - b.y);
  let ys = Infinity;
  let ye = -Infinity;
  let xs = Infinity;
  let xe = -Infinity;
  for (const p of oval) {
    ys = Math.min(ys, p.y);
    ye = Math.max(ye, p.y);
    xs = Math.min(xs, p.x);
    xe = Math.max(xe, p.x);
  }
  const { width: w, height: h, data } = mask;
  let lSum = 0;
  let lN = 0;
  let rSum = 0;
  let rN = 0;
  const py0 = Math.max(0, Math.floor(ys * h));
  const py1 = Math.min(h - 1, Math.ceil(ye * h));
  const px0 = Math.max(0, Math.floor(xs * w));
  const px1 = Math.min(w - 1, Math.ceil(xe * w));
  for (let py = py0; py <= py1; py += step) {
    const y = (py + 0.5) / h;
    const mx = midlineX(mid, y);
    for (let px = px0; px <= px1; px += step) {
      const x = (px + 0.5) / w;
      if (!insidePolygon(oval, x, y)) continue;
      const i = (py * w + px) * 4;
      const a = pixelSeverity(data[i], data[i + 1], data[i + 2], data[i + 3]);
      if (x < mx) {
        lSum += a;
        lN++;
      } else {
        rSum += a;
        rN++;
      }
    }
  }
  return { left: lN ? lSum / lN : NaN, right: rN ? rSum / rN : NaN, leftPx: lN, rightPx: rN };
}

/**
 * Put side densities on YouCam's raw-score scale: split the whole-face deficit (100 − raw) between the sides in
 * proportion to where the detections are. The two sides then average to the real raw score, and the noise prior
 * means the same thing in split and whole-face mode. Detections cover well under 1% of the face for pores and
 * acne, so a plain "100 − coverage" score would barely move.
 */
export function sidesInRawUnits(d: Pick<SideDensity, "left" | "right">, raw: number): SideScores {
  const m = (d.left + d.right) / 2;
  if (!Number.isFinite(m)) return { left: NaN, right: NaN };
  if (m <= 0) return { left: raw, right: raw };
  const deficit = 100 - raw;
  return { left: 100 - (deficit * d.left) / m, right: 100 - (deficit * d.right) / m };
}

/** Treated − untreated side score. Positive = treated side looks better. */
export function sideDiff(s: SideScores, treated: ImageSide): number {
  return treated === "image-left" ? s.left - s.right : s.right - s.left;
}

/** The user faces the camera, so their own left cheek is on the image's right. */
export function userSideToImage(userSide: "my-left" | "my-right"): ImageSide {
  return userSide === "my-left" ? "image-right" : "image-left";
}
export function imageSideToUser(side: ImageSide): "your left" | "your right" {
  return side === "image-right" ? "your left" : "your right";
}

export interface SplitValidation {
  n: number;
  meanAbsDiff: number;
  sdDiff: number;
  meanDiff: number;
  /**
   * Left − right is stable across photos: its SD ≤ 2·σ_single·√2.
   * A constant offset is fine (the baseline difference d₀ is subtracted); a wobbling one is not.
   */
  pass: boolean;
}

/** Go/no-go for split-face on 5+ untreated photos. meanDiff is reported but doesn't gate (it's removed by d₀). */
export function validateSplit(pairs: SideScores[], sigmaSingle: number): SplitValidation {
  const d = pairs.map((p) => p.left - p.right).filter(Number.isFinite);
  const n = d.length;
  if (n < 2) return { n, meanAbsDiff: NaN, sdDiff: NaN, meanDiff: NaN, pass: false };
  const m = d.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(d.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1));
  const mad = d.reduce((a, x) => a + Math.abs(x), 0) / n;
  const pass = n >= 5 && sd <= 2 * sigmaSingle * Math.SQRT2;
  return { n, meanAbsDiff: mad, sdDiff: sd, meanDiff: m, pass };
}
