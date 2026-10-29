import { describe, expect, it } from "vitest";
import {
  MaskLike,
  Pt,
  imageSideToUser,
  insidePolygon,
  midlineX,
  pixelSeverity,
  sideDensity,
  sideDiff,
  sidesInRawUnits,
  userSideToImage,
  validateSplit,
} from "../split";

/** Square "face" covering 0.2–0.8, vertical midline at x = 0.5. */
const oval: Pt[] = [
  { x: 0.2, y: 0.2 },
  { x: 0.8, y: 0.2 },
  { x: 0.8, y: 0.8 },
  { x: 0.2, y: 0.8 },
];
const mid: Pt[] = [
  { x: 0.5, y: 0.2 },
  { x: 0.5, y: 0.8 },
];

type RGBA = [number, number, number, number];
const BG: RGBA = [61, 61, 61, 102]; // YouCam's grey background layer
const RED = (a: number): RGBA => [255, 46, 0, a];

function mask(w: number, h: number, px: (x: number, y: number) => RGBA): MaskLike {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) data.set(px((x + 0.5) / w, (y + 0.5) / h), (y * w + x) * 4);
  return { width: w, height: h, data };
}

describe("split-face maths", () => {
  it("midline interpolation", () => {
    const tilted = [
      { x: 0.4, y: 0 },
      { x: 0.6, y: 1 },
    ];
    expect(midlineX(tilted, 0.5)).toBeCloseTo(0.5);
    expect(midlineX(tilted, -1)).toBe(0.4);
    expect(midlineX(tilted, 2)).toBe(0.6);
  });
  it("point in polygon", () => {
    expect(insidePolygon(oval, 0.5, 0.5)).toBe(true);
    expect(insidePolygon(oval, 0.1, 0.5)).toBe(false);
  });
  it("pixel severity ignores the grey background layer, outlines and transparency", () => {
    expect(pixelSeverity(...BG)).toBe(0);
    expect(pixelSeverity(62, 60, 61, 255)).toBe(0);
    expect(pixelSeverity(255, 255, 255, 255)).toBe(0);
    expect(pixelSeverity(0, 0, 0, 0)).toBe(0);
    expect(pixelSeverity(...RED(51))).toBeCloseTo(0.2);
    expect(pixelSeverity(29, 0, 136, 255)).toBe(1);
  });
  it("a background-only mask has zero density on both sides", () => {
    const d = sideDensity(mask(100, 100, () => BG), oval, mid);
    expect(d.left).toBe(0);
    expect(d.right).toBe(0);
    expect(d.leftPx).toBe(d.rightPx);
  });
  it("detections on one side raise that side's density; outside-face pixels are ignored", () => {
    const m = mask(100, 100, (x, y) => (x < 0.2 || y < 0.2 ? RED(255) : x < 0.5 ? RED(255) : BG));
    const d = sideDensity(m, oval, mid);
    expect(d.left).toBeCloseTo(1);
    expect(d.right).toBe(0);
  });
  it("is resolution-independent", () => {
    const a = sideDensity(mask(60, 60, (x) => (x < 0.5 ? RED(128) : BG)), oval, mid);
    const b = sideDensity(mask(240, 240, (x) => (x < 0.5 ? RED(128) : BG)), oval, mid);
    expect(a.left).toBeCloseTo(b.left, 2);
  });
  it("side scores in raw units average to the raw score", () => {
    const s = sidesInRawUnits({ left: 0.03, right: 0.01 }, 80);
    expect((s.left + s.right) / 2).toBeCloseTo(80);
    expect(s.left).toBeCloseTo(70); // 3× the detections of the right side → 1.5× the mean deficit
    expect(s.right).toBeCloseTo(90);
    expect(sidesInRawUnits({ left: 0, right: 0 }, 77)).toEqual({ left: 77, right: 77 });
    expect(Number.isNaN(sidesInRawUnits({ left: NaN, right: 0.1 }, 70).left)).toBe(true);
  });
  it("treated − untreated sign and side mapping", () => {
    expect(sideDiff({ left: 70, right: 60 }, "image-left")).toBe(10);
    expect(sideDiff({ left: 70, right: 60 }, "image-right")).toBe(-10);
    expect(userSideToImage("my-left")).toBe("image-right");
    expect(imageSideToUser("image-left")).toBe("your right");
  });
  it("split validation passes for stable sides and fails for wobbly ones", () => {
    const stable = [0, 1, -1, 0.5, -0.5, 0.2].map((d) => ({ left: 60 + d, right: 60 }));
    expect(validateSplit(stable, 3).pass).toBe(true);
    const wobbly = [-15, 12, -9, 14, -11].map((d) => ({ left: 60 + d, right: 60 }));
    expect(validateSplit(wobbly, 3).pass).toBe(false);
    expect(validateSplit(stable.slice(0, 4), 3).pass).toBe(false); // needs 5+
  });
});
