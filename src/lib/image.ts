"use client";

export interface LightCheck {
  mean: number; // 0–255 luma
  clipped: number; // fraction of near-white pixels
  /** (left − right) / mean over the central band. Uneven side lighting would bias a split-face comparison. */
  balance: number;
  ok: boolean;
  hint?: string;
}

/** Lighting check on a downscaled frame: overall brightness, blown highlights and left/right balance. */
export function checkLight(img: ImageData): LightCheck {
  const { width: w, height: h, data } = img;
  let sum = 0;
  let clip = 0;
  let n = 0;
  let l = 0;
  let r = 0;
  let ln = 0;
  let rn = 0;
  for (let y = Math.floor(h * 0.2); y < h * 0.8; y++) {
    for (let x = Math.floor(w * 0.2); x < w * 0.8; x++) {
      const i = (y * w + x) * 4;
      const v = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      sum += v;
      n++;
      if (v > 245) clip++;
      if (x < w / 2) {
        l += v;
        ln++;
      } else {
        r += v;
        rn++;
      }
    }
  }
  const mean = sum / n;
  const balance = (l / ln - r / rn) / Math.max(1, mean);
  const clipped = clip / n;
  let hint: string | undefined;
  if (mean < 80) hint = "Too dark — face a window or a lamp";
  else if (mean > 210 || clipped > 0.08) hint = "Too bright — step back from the light";
  // The band includes hair and background, so even light reads ~0.2 on a real face; 0.3 still catches side light.
  else if (Math.abs(balance) > 0.3) hint = "Light is uneven — turn so both cheeks are lit the same";
  return { mean, clipped, balance, ok: !hint, hint };
}

/** Mean absolute frame difference (0–255) on small greyscale frames. */
export function motion(a: ImageData, b: ImageData): number {
  let d = 0;
  for (let i = 0; i < a.data.length; i += 16) d += Math.abs(a.data[i + 1] - b.data[i + 1]);
  return d / (a.data.length / 16);
}

/**
 * Size a capture for YouCam HD: short side ≥ 1080 (upscaled if the camera gives less — noted, since that adds
 * no real detail), long side ≤ 2560. Not mirrored: image-left is the user's right cheek.
 */
export function fitForHD(w: number, h: number): { w: number; h: number; upscaled: boolean } {
  const short = Math.min(w, h);
  const long = Math.max(w, h);
  let s = 1;
  if (short < 1080) s = 1080 / short;
  if (long * s > 2560) s = 2560 / long;
  return { w: Math.round(w * s), h: Math.round(h * s), upscaled: s > 1 };
}

export function drawToCanvas(src: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  return c;
}

export const toBlob = (c: HTMLCanvasElement, type = "image/jpeg", q = 0.92) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), type, q));

export function thumb(src: HTMLCanvasElement, width = 360): string {
  const h = Math.round((src.height / src.width) * width);
  return drawToCanvas(src, width, h).toDataURL("image/jpeg", 0.8);
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => rej(new Error(`Could not load ${url}`));
    img.src = url;
  });
}
