export const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function sampleSd(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

export interface LinFit {
  slope: number;
  intercept: number;
  slopeSe: number;
  n: number;
}

/** Ordinary least squares y = a + b·x with the standard error of b. */
export function linearFit(xs: number[], ys: number[]): LinFit {
  const n = xs.length;
  if (n < 2 || n !== ys.length) return { slope: NaN, intercept: NaN, slopeSe: NaN, n };
  const mx = mean(xs);
  const my = mean(ys);
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - mx) ** 2;
    sxy += (xs[i] - mx) * (ys[i] - my);
  }
  if (sxx === 0) return { slope: NaN, intercept: NaN, slopeSe: NaN, n };
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  let sse = 0;
  for (let i = 0; i < n; i++) sse += (ys[i] - intercept - slope * xs[i]) ** 2;
  const slopeSe = n > 2 ? Math.sqrt(sse / (n - 2) / sxx) : Infinity;
  return { slope, intercept, slopeSe, n };
}

/** Deterministic PRNG (mulberry32) + Box–Muller, for the simulated demo and tests. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const u = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u());
  return { u, normal };
}
