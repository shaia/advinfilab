/**
 * MODEL SPECIFICATION
 *
 * System (osc mode): a function f : ℝ → ℝ, a point a and a radius δ > 0. The oscillation of f on the ball
 *                B(a, δ) = (a − δ, a + δ) is ω(f, a, δ) = sup{|f(y) − f(z)| : y, z ∈ B(a, δ)} = sup f − inf f on the
 *                ball (for f bounded there), and o(f, a) = inf_δ ω(f, a, δ) (lesson 2.7, הגדרה 2.7.8). Every preset
 *                carries ω as an exact formula, derived beside it:
 *                  sgn at 0:              ω = 1 − (−1) = 2 for every δ;
 *                  sin(1/x), f(0) = 5:    ω = 5 − (−1) = 6 for every δ (every interval (−δ, δ) holds a point
 *                                         1/(2πk + 3π/2) where sin(1/x) = −1, and 0 itself, where f = 5);
 *                  Thomae's T:            inf T = 0 on every interval (it has irrationals), sup T = 1/q, where q is the
 *                                         least denominator of a fraction p/q in the open interval; `thomaeQmin`
 *                                         finds it in exact integer arithmetic when a and δ are multiples of 1/1000
 *                                         (a = 3/4), and in floating point for a = 1/√2 (an irrational centre: the
 *                                         endpoints a ± δ are irrational, so no fraction sits on them);
 *                  x·χ_ℚ(x):             on (a − δ, a + δ) the values are the rationals' own values, dense in the
 *                                         interval, and 0: sup = max(a + δ, 0), inf = min(a − δ, 0) (not attained
 *                                         unless 0 is the bound); ω = max(a + δ, 0) − min(a − δ, 0).
 *                  χ_{0} at 0:            ω = 1 for every δ.
 * System (cone mode): the sets Eₙ of הגדרה 2.7.17: g ∈ C[0,1] is in Eₙ when some x ∈ [0, 1 − 1/n] has
 *                |g(x + h) − g(x)| ≤ nh for all 0 < h < 1/n. The figure builds g = p + φ as in the proof of למה 2.7.20:
 *                p the polygonal line through (i/m, f(i/m)), i = 0..m (משפט 1.4.18), with largest slope
 *                M = m · max|f(tᵢ) − f(tᵢ₋₁)|; φ the sawtooth of height H and slope ±L, φ(t) = L · dist(t, Pℤ) with
 *                period P = 2H/L (values in [0, H], linear on every [kP/2, (k+1)P/2]).
 *                `goodPoint(g, x, n)` decides exactly (up to rounding) whether x witnesses g ∈ Eₙ: h ↦ g(x+h) − g(x) is
 *                piecewise linear with breakpoints where p or φ breaks, so F(h) = |g(x+h) − g(x)| − nh is convex on
 *                each piece and F(0) = 0; F ≤ 0 on (0, 1/n) iff F ≤ 0 at every breakpoint inside and at h = 1/n.
 *                `hasGoodPoint` runs it over a grid of x: a probe (Eₙ asks about every x), never a proof.
 * Exact checks:  ‖√x − pₘ‖∞ = 1/(4√m) and M = √m for √x (the first chord is the worst: concavity); the lesson's
 *                witness h* = (end of φ's linear piece through x) − x gives |φ(x + h*) − φ(x)| = Lh*.
 * Ignored:       IEEE rounding (relative ≈ 1e-15) in the floating parts.
 * Valid when:    δ ∈ (0, 1]; 1 ≤ m ≤ 200; 0 ≤ L ≤ 1000; H > 0; 1 ≤ n ≤ 20.
 *
 * Drives the figure of lesson 2.7 (Oscillation). A numerical probe never proves.
 */

import { fmtNum } from './contraction';

export { fmtNum };

/* ================================================================ osc mode */

export type OscId = 'sgn' | 'sin5' | 'thomae-rat' | 'thomae-irr' | 'xchiq-0' | 'xchiq-half' | 'chi0';

export interface OscPreset {
  /** the formula, LTR, for buttons and readouts */
  formula: string;
  /** the point a */
  a: number;
  /** the point, LTR, for readouts */
  aText: string;
  /** f(a) */
  value: number;
  /** ω(f, a, δ), exact */
  omega: (delta: number) => number;
  /** o(f, a) = lim ω as δ → 0⁺, exact */
  osc: number;
  /** the y-range drawn */
  y: [number, number];
  /** the x-window drawn, around a */
  halfWidth: number;
}

/** δ values offered by the slider (index 0 = widest); all are multiples of 1/1000 */
export const DELTAS = [0.5, 0.3, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001] as const;

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

/**
 * The least q ≥ 1 with a fraction p/q in the open interval (lo, hi), lo < hi, given as lo = loN/D, hi = hiN/D with
 * integers (exact). p/q ∈ (lo, hi) iff loN·q < D·p < hiN·q; the least such p is floor(loN·q / D) + 1.
 */
export function qminExact(loN: number, hiN: number, D: number): number {
  for (let q = 1; ; q++) {
    const p = Math.floor((loN * q) / D) + 1;
    if (D * p < hiN * q) return q;
  }
}

/** The same in floating point, for an interval whose endpoints are irrational. */
export function qminFloat(lo: number, hi: number): number {
  for (let q = 1; ; q++) {
    const p = Math.floor(lo * q) + 1;
    if (p / q < hi) return q;
  }
}

/** δ as a whole number of thousandths (every slider value is one) */
const milli = (delta: number) => Math.round(delta * 1000);

/** sup T on (3/4 − δ, 3/4 + δ): 1/q for the least denominator q there (3/4 itself gives q ≤ 4) */
export const thomaeOmegaRat = (delta: number) => {
  const k = milli(delta);
  return 1 / qminExact(750 - k, 750 + k, 1000);
};

export const SQRT_HALF = Math.SQRT1_2;
export const thomaeOmegaIrr = (delta: number) => 1 / qminFloat(SQRT_HALF - delta, SQRT_HALF + delta);

export const OSC: Record<OscId, OscPreset> = {
  sgn: { formula: 'sgn x', a: 0, aText: '0', value: 0, omega: () => 2, osc: 2, y: [-1.5, 1.5], halfWidth: 0.6 },
  sin5: { formula: 'sin(1/x), f(0) = 5', a: 0, aText: '0', value: 5, omega: () => 6, osc: 6, y: [-1.6, 5.8], halfWidth: 0.6 },
  'thomae-rat': { formula: 'T, a = 3/4', a: 0.75, aText: '3/4', value: 0.25, omega: thomaeOmegaRat, osc: 0.25, y: [-0.08, 1.08], halfWidth: 0.55 },
  'thomae-irr': { formula: 'T, a = 1/√2', a: SQRT_HALF, aText: '1/√2', value: 0, omega: thomaeOmegaIrr, osc: 0, y: [-0.08, 1.08], halfWidth: 0.55 },
  'xchiq-0': {
    formula: 'x·χ_ℚ(x), a = 0',
    a: 0,
    aText: '0',
    value: 0,
    omega: (d) => Math.max(d, 0) - Math.min(-d, 0),
    osc: 0,
    y: [-0.65, 0.65],
    halfWidth: 0.6,
  },
  'xchiq-half': {
    formula: 'x·χ_ℚ(x), a = 1/2',
    a: 0.5,
    aText: '1/2',
    value: 0.5,
    omega: (d) => Math.max(0.5 + d, 0) - Math.min(0.5 - d, 0),
    osc: 0.5,
    y: [-0.15, 1.1],
    halfWidth: 0.6,
  },
  chi0: { formula: 'χ_{0}', a: 0, aText: '0', value: 1, omega: () => 1, osc: 1, y: [-0.3, 1.3], halfWidth: 0.6 },
};
export const OSC_IDS = Object.keys(OSC) as OscId[];

/** Thomae's function at a fraction p/q (any sign), or 0 elsewhere: used to draw its points */
export function thomaeAt(p: number, q: number): number {
  const g = gcd(Math.abs(p), q);
  return 1 / (q / g);
}

/** The reduced fractions p/q in [lo, hi] with q ≤ qMax, as [x, T(x)] pairs (each fraction once). */
export function thomaePoints(lo: number, hi: number, qMax: number): [number, number][] {
  const out: [number, number][] = [];
  for (let q = 1; q <= qMax; q++) {
    for (let p = Math.ceil(lo * q); p <= Math.floor(hi * q); p++) if (gcd(Math.abs(p), q) === 1) out.push([p / q, 1 / q]);
  }
  return out;
}

/** sup f on the ball B(a, δ), exact per preset (inf = sup − ω); used to draw the band of values */
export function oscSup(id: OscId, delta: number): number {
  const P = OSC[id];
  switch (id) {
    case 'sgn':
    case 'chi0':
      return 1;
    case 'sin5':
      return 5;
    case 'thomae-rat':
    case 'thomae-irr':
      return P.omega(delta);
    default:
      return Math.max(P.a + delta, 0);
  }
}

export function describeOsc(id: OscId, delta: number): string {
  const P = OSC[id];
  return `הפונקציה ${P.formula}, הנקודה ${P.aText}, δ = ${fmtNum(delta)}. התנודה על הכדור ω = ${fmtNum(Number(P.omega(delta).toPrecision(4)))}.`;
}

/* ================================================================ cone mode */

export type BaseId = 'sqrt' | 'wave';
export const BASES: Record<BaseId, { formula: string; f: (x: number) => number }> = {
  sqrt: { formula: '√x', f: (x) => Math.sqrt(Math.max(0, x)) },
  wave: { formula: '0.5 + 0.3 sin 2πx', f: (x) => 0.5 + 0.3 * Math.sin(2 * Math.PI * x) },
};
export const BASE_IDS = Object.keys(BASES) as BaseId[];

/** The polygonal line through (i/m, f(i/m)), i = 0..m: its node values. */
export const nodes = (f: (x: number) => number, m: number) => Array.from({ length: m + 1 }, (_, i) => f(i / m));

/** p(t) for the polygonal line with node values v on the uniform partition of [0, 1] (t clamped to [0, 1]). */
export function polyAt(v: number[], t: number): number {
  const m = v.length - 1;
  const s = Math.min(1, Math.max(0, t)) * m;
  const i = Math.min(m - 1, Math.floor(s));
  const lam = s - i;
  return (1 - lam) * v[i] + lam * v[i + 1];
}

/** M: the largest |slope| of the polygonal line, m · max |vᵢ − vᵢ₋₁|. */
export function maxSlope(v: number[]): number {
  const m = v.length - 1;
  let best = 0;
  for (let i = 1; i <= m; i++) best = Math.max(best, Math.abs(v[i] - v[i - 1]) * m);
  return best;
}

/** The sawtooth of height H and slope ±L: L · dist(t, Pℤ), P = 2H/L; the zero function when L = 0. */
export function saw(t: number, H: number, L: number): number {
  if (L <= 0) return 0;
  const P = (2 * H) / L;
  const r = t - P * Math.floor(t / P);
  // r ∈ [0, P) in exact arithmetic; rounding can push it a hair outside, so clamp to the true range [0, H]
  return Math.min(H, Math.max(0, L * Math.min(r, P - r)));
}

/** The half period P/2 = H/L: the length of every linear piece of the sawtooth. */
export const halfPeriod = (H: number, L: number) => (L > 0 ? H / L : Infinity);

/** The lesson's witness at x: the end of the linear piece of φ through x (the piece [kP/2, (k+1)P/2) holding x), minus x. */
export function witness(x: number, H: number, L: number): number {
  const w = halfPeriod(H, L);
  // a point that sits on a corner kP/2 (up to rounding) starts the piece [kP/2, (k+1)P/2)
  return (Math.floor(x / w + 1e-9) + 1) * w - x;
}

export interface Built {
  v: number[];
  H: number;
  L: number;
  g: (t: number) => number;
  /** the breakpoints of g in [0, 1]: the nodes i/m and the sawtooth corners kP/2 */
  breaks: (from: number, to: number) => number[];
}

export function build(f: (x: number) => number, m: number, H: number, L: number): Built {
  const v = nodes(f, m);
  const w = halfPeriod(H, L);
  return {
    v,
    H,
    L,
    g: (t) => polyAt(v, t) + saw(t, H, L),
    breaks: (from, to) => {
      const out: number[] = [];
      for (let i = Math.ceil(from * m); i <= Math.floor(to * m); i++) out.push(i / m);
      if (Number.isFinite(w)) for (let k = Math.ceil(from / w); k * w <= to; k++) out.push(k * w);
      return out.sort((a, b) => a - b);
    },
  };
}

/**
 * Does x ∈ [0, 1 − 1/n] witness g ∈ Eₙ, i.e. |g(x + h) − g(x)| ≤ nh for all 0 < h < 1/n? Exact up to rounding (see the
 * specification). Returns the worst h found (largest F(h) = |Δg| − nh), and F there.
 */
export function goodPoint(b: Built, x: number, n: number): { good: boolean; worstH: number; worstF: number } {
  const gx = b.g(x);
  const end = x + 1 / n;
  const hs = b
    .breaks(x, end)
    .filter((t) => t > x + 1e-12 && t < end - 1e-12)
    .map((t) => t - x);
  hs.push(1 / n);
  let worstH = hs[0];
  let worstF = -Infinity;
  for (const h of hs) {
    const F = Math.abs(b.g(x + h) - gx) - n * h;
    if (F > worstF) {
      worstF = F;
      worstH = h;
    }
  }
  return { good: worstF <= 1e-12, worstH, worstF };
}

/** A grid probe of Eₙ: the first grid point x_j = j(1 − 1/n)/K that is good, or null. Evidence, not proof. */
export function hasGoodPoint(b: Built, n: number, K = 200): number | null {
  const top = 1 - 1 / n;
  for (let j = 0; j <= K; j++) {
    const x = (j * top) / K;
    if (goodPoint(b, x, n).good) return x;
  }
  return null;
}

/** sampled ‖f − p‖∞ on a grid with the nodes' midpoints and quarter points: a lower estimate (a probe) */
export function sampledPolyError(f: (x: number) => number, v: number[], K = 4000): number {
  let e = 0;
  for (let j = 0; j <= K; j++) {
    const t = j / K;
    e = Math.max(e, Math.abs(f(t) - polyAt(v, t)));
  }
  const m = v.length - 1;
  for (let i = 0; i < m; i++)
    for (const s of [0.25, 0.5]) {
      const t = (i + s) / m;
      e = Math.max(e, Math.abs(f(t) - polyAt(v, t)));
    }
  return e;
}

/** ‖√x − pₘ‖∞ = 1/(4√m), exact (the first chord, at t = 1/(4m)); the later chords of the concave √x are closer. */
export const sqrtPolyError = (m: number) => 1 / (4 * Math.sqrt(m));

export function describeCone(s: { base: BaseId; m: number; L: number; n: number; x: number; H: number }): string {
  const b = build(BASES[s.base].f, s.m, s.H, s.L);
  const M = maxSlope(b.v);
  const gp = goodPoint(b, s.x, s.n);
  return (
    `הפונקציה ${BASES[s.base].formula}, קו שבור עם ${s.m} קטעים ושיפוע מרבי ${fmtNum(Number(M.toPrecision(4)))}, מסור בשיפוע ${s.L}, n = ${s.n}. ` +
    `בנקודה x = ${fmtNum(s.x)} ${gp.good ? 'הגרף נשאר בתוך החרוט' : 'הגרף יוצא מהחרוט'}.`
  );
}
