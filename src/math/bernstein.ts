/**
 * MODEL SPECIFICATION
 *
 * System:        the Bernstein polynomials of lesson 4.5 (הגדרה 4.5.1): for f : [0,1] → ℝ and n ∈ ℕ,
 *                (B_n f)(x) = Σ_{k=0}^{n} f(k/n) b_{n,k}(x),  b_{n,k}(x) = C(n,k) x^k (1 − x)^{n−k}.
 * Exact part:    `bernsteinExact` evaluates B_n f at a rational x in exact rational arithmetic (bigint numerator and
 *                denominator), for f given by its exact rational values f(k/n). The tests check the identities of
 *                למה 4.5.2 (B_n 1 = 1, B_n x = x, B_n x² = x² + x(1−x)/n) and of למה 4.5.3
 *                (Σ (k/n − x)² b_{n,k}(x) = x(1−x)/n) exactly at rational points, and the bank's numbers
 *                (B_3|x − 1/2|(1/2) = 1/4, B_4|x − 1/2|(1/4) = 71/256).
 * Floating part: `weights(n, x)` computes b_{n,k}(x) for k = 0..n in log space,
 *                log b = log C(n,k) + k log x + (n − k) log(1 − x), with log C(n,k) from a table of log k!, so that
 *                no factor over- or underflows for n ≤ 2000; x = 0 and x = 1 are the exact unit vectors.
 *                `bernsteinAt` is Σ f(k/n) b_{n,k}(x) with those weights.
 * Probes:        `supError` samples |B_n f − f| on a uniform grid of [0,1] (with the preset's kinks and x = 1/2 added)
 *                and returns the largest value: a lower estimate of ‖B_n f − f‖∞, exact for x² (the maximum
 *                1/(4n) sits at x = 1/2, a grid point). `farMass(n, x, δ)` is the total weight of the k with
 *                |k/n − x| ≥ δ; the lesson's bound (למה 4.5.3(ב), used in the proof of משפט 4.5.4) is farMass ≤ x(1−x)/(nδ²) ≤ 1/(4nδ²).
 *                The figure shows probes; the theorems are proved in the lesson.
 * Bounds:        `theoremBound(M, eps, δ, n) = eps + M/(2nδ²)` (משפט 4.5.4: δ is a δ of uniform continuity for
 *                eps, M = ‖f‖∞); `lipschitzBound(L, n) = L/(2√n)` (טענה 4.5.4א, for an L-Lipschitz f).
 * Ignored:       IEEE rounding (relative ≈ 1e-13 for the weights at n ≤ 2000).
 * Valid when:    1 ≤ n ≤ 2000, 0 ≤ x ≤ 1, 0 < δ ≤ 1.
 *
 * Drives the figure of lesson 4.5 (BernsteinFit). A numerical probe never proves.
 */

import { fmtNum } from './contraction';

export { fmtNum };

/* ---------------- exact rational arithmetic ---------------- */

export interface Q {
  n: bigint;
  d: bigint;
}

const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};

export function q(n: number | bigint, d: number | bigint = 1): Q {
  let N = BigInt(n);
  let D = BigInt(d);
  if (D === 0n) throw new Error('zero denominator');
  if (D < 0n) [N, D] = [-N, -D];
  const g = gcd(N, D) || 1n;
  return { n: N / g, d: D / g };
}
export const qadd = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
export const qsub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d);
export const qmul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
export const qdiv = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);
export const qabs = (a: Q) => q(a.n < 0n ? -a.n : a.n, a.d);
export const qeq = (a: Q, b: Q) => a.n === b.n && a.d === b.d;
export const qnum = (a: Q) => Number(a.n) / Number(a.d);
const qpow = (a: Q, k: number): Q => {
  let r = q(1);
  for (let i = 0; i < k; i++) r = qmul(r, a);
  return r;
};

/** C(n, k) as a bigint */
export function binom(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n;
  let c = 1n;
  for (let i = 1; i <= k; i++) c = (c * BigInt(n - k + i)) / BigInt(i);
  return c;
}

/** (B_n f)(x) exactly, for f given by its exact values f(k/n) as a function of (k, n). */
export function bernsteinExact(f: (k: number, n: number) => Q, n: number, x: Q): Q {
  const one = q(1);
  let s = q(0);
  for (let k = 0; k <= n; k++) {
    const w = qmul(q(binom(n, k)), qmul(qpow(x, k), qpow(qsub(one, x), n - k)));
    s = qadd(s, qmul(f(k, n), w));
  }
  return s;
}

/* ---------------- floating point ---------------- */

const logFact: number[] = [0];
function logFactorial(m: number): number {
  for (let i = logFact.length; i <= m; i++) logFact[i] = logFact[i - 1] + Math.log(i);
  return logFact[m];
}

/** b_{n,k}(x), k = 0..n, computed in log space */
export function weights(n: number, x: number): number[] {
  const w = new Array<number>(n + 1).fill(0);
  if (x <= 0) {
    w[0] = 1;
    return w;
  }
  if (x >= 1) {
    w[n] = 1;
    return w;
  }
  const lx = Math.log(x);
  const l1x = Math.log1p(-x);
  const ln = logFactorial(n);
  for (let k = 0; k <= n; k++) w[k] = Math.exp(ln - logFactorial(k) - logFactorial(n - k) + k * lx + (n - k) * l1x);
  return w;
}

/** f(k/n), k = 0..n */
export const nodeValues = (f: (x: number) => number, n: number) => Array.from({ length: n + 1 }, (_, k) => f(k / n));

/** Σ values[k] b_{n,k}(x) with n = values.length − 1 */
export function bernsteinAt(values: number[], x: number): number {
  const w = weights(values.length - 1, x);
  let s = 0;
  for (let k = 0; k < w.length; k++) s += values[k] * w[k];
  return s;
}

/** (B_n f)(x) */
export const bernsteinFn = (f: (x: number) => number, n: number, x: number) => bernsteinAt(nodeValues(f, n), x);

/** the sampled sup error max |B_n f − f| on a grid of [0,1] plus the given extra points (a probe) */
export function supError(f: (x: number) => number, n: number, samples = 1000, extra: number[] = []): { err: number; at: number } {
  const vals = nodeValues(f, n);
  const xs = Array.from({ length: samples + 1 }, (_, i) => i / samples).concat(extra, [0.5]);
  let err = 0;
  let at = 0;
  for (const x of xs) {
    const e = Math.abs(bernsteinAt(vals, x) - f(x));
    if (e > err) {
      err = e;
      at = x;
    }
  }
  return { err, at };
}

/** total weight of the k with |k/n − x| ≥ δ (the "far" terms in the proof of משפט 4.5.4) */
export function farMass(n: number, x: number, delta: number): number {
  const w = weights(n, x);
  let s = 0;
  for (let k = 0; k <= n; k++) if (Math.abs(k / n - x) >= delta - 1e-12) s += w[k];
  return s;
}

/** the bound of the proof: farMass ≤ Σ (k/n − x)²/δ² · b_{n,k}(x) = x(1−x)/(nδ²) */
export const chebyshevBound = (n: number, x: number, delta: number) => (x * (1 - x)) / (n * delta * delta);

/** Σ (k/n − x)² b_{n,k}(x), which למה 4.5.3 says is x(1−x)/n */
export function secondMoment(n: number, x: number): number {
  const w = weights(n, x);
  let s = 0;
  for (let k = 0; k <= n; k++) s += (k / n - x) ** 2 * w[k];
  return s;
}

/** משפט 4.5.4: ‖B_n f − f‖∞ ≤ eps + M/(2nδ²) */
export const theoremBound = (M: number, eps: number, delta: number, n: number) => eps + M / (2 * n * delta * delta);

/** טענה 4.5.4א: for an L-Lipschitz f, ‖B_n f − f‖∞ ≤ L/(2√n) */
export const lipschitzBound = (L: number, n: number) => L / (2 * Math.sqrt(n));

/* ---------------- the figure's presets ---------------- */

export type FnId = 'square' | 'abs' | 'zigzag' | 'osc';

/** a continuous piecewise-linear zigzag through these nodes (not differentiable at the inner ones) */
const ZIG: [number, number][] = [
  [0, 0.2],
  [0.25, 0.8],
  [0.5, 0.3],
  [0.75, 0.9],
  [1, 0.4],
];
export function zigzag(x: number): number {
  for (let i = 1; i < ZIG.length; i++) {
    const [x0, y0] = ZIG[i - 1];
    const [x1, y1] = ZIG[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return ZIG[ZIG.length - 1][1];
}

export interface Preset {
  f: (x: number) => number;
  /** the formula, LTR, for the legend and the toggle */
  formula: string;
  /** points where f is not differentiable (added to the error grid) */
  kinks: number[];
  /** a Lipschitz constant of f on [0,1] */
  lip: number;
  /** y-window of the graph */
  y: [number, number];
}

export const PRESETS: Record<FnId, Preset> = {
  square: { f: (x) => x * x, formula: 'x²', kinks: [], lip: 2, y: [-0.1, 1.1] },
  abs: { f: (x) => Math.abs(x - 0.5), formula: '|x − 1/2|', kinks: [0.5], lip: 1, y: [-0.1, 0.6] },
  zigzag: { f: zigzag, formula: 'zigzag', kinks: [0.25, 0.5, 0.75], lip: 2.4, y: [-0.05, 1.05] },
  // |f′(x)| = |cos(1/(x+0.1))|/(x+0.1)² ≤ 100 on [0,1]
  osc: { f: (x) => Math.sin(1 / (x + 0.1)), formula: 'sin(1/(x + 0.1))', kinks: [], lip: 100, y: [-1.15, 1.15] },
};

export const FN_IDS = Object.keys(PRESETS) as FnId[];

/** the sampled sup error of a preset (cached: the figure asks for the same (f, n) on every redraw) */
const errCache = new Map<string, { err: number; at: number }>();
export function presetError(id: FnId, n: number): { err: number; at: number } {
  const key = `${id}|${n}`;
  let r = errCache.get(key);
  if (!r) {
    r = supError(PRESETS[id].f, n, 1000, PRESETS[id].kinks);
    errCache.set(key, r);
  }
  return r;
}

/** the screen-reader line of the figure */
export function describe(s: { fn: FnId; n: number; x: number; delta: number }): string {
  const P = PRESETS[s.fn];
  const e = presetError(s.fn, s.n).err;
  const fm = farMass(s.n, s.x, s.delta);
  return (
    `הפונקציה ${P.formula}, n = ${s.n}. השגיאה המרבית בדגימה בערך ${fmtNum(Number(e.toPrecision(3)))}. ` +
    `בנקודה x = ${fmtNum(s.x)}, המשקל של האיברים הרחוקים מ-x לפחות δ = ${fmtNum(s.delta)} הוא ${fmtNum(Number(fm.toPrecision(3)))}.`
  );
}
