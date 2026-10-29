import { describe, expect, it } from "vitest";
import { MaskLike, Pt, imageSideToUser, insidePolygon, midlineX, sideDiff, sideScores, userSideToImage, validateSplit } from "../split";

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

function mask(w: number, h: number, alpha: (x: number, y: number) => number): MaskLike {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[(y * w + x) * 4 + 3] = alpha((x + 0.5) / w, (y + 0.5) / h);
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
  it("equal masks give equal sides", () => {
    const s = sideScores(mask(100, 100, () => 51), oval, mid);
    expect(s.left).toBeCloseTo(80);
    expect(s.right).toBeCloseTo(80);
    expect(s.leftPx).toBe(s.rightPx);
  });
  it("detections on one side lower that side's score; outside-face pixels are ignored", () => {
    const m = mask(100, 100, (x, y) => (x < 0.2 || y < 0.2 ? 255 : x < 0.5 ? 255 : 0));
    const s = sideScores(m, oval, mid);
    expect(s.left).toBeCloseTo(0);
    expect(s.right).toBeCloseTo(100);
  });
  it("is resolution-independent", () => {
    const a = sideScores(mask(60, 60, (x) => (x < 0.5 ? 128 : 0)), oval, mid);
    const b = sideScores(mask(240, 240, (x) => (x < 0.5 ? 128 : 0)), oval, mid);
    expect(a.left).toBeCloseTo(b.left, 0);
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
