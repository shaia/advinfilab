/**
 * MODEL SPECIFICATION
 *
 * System:        (a) tail mode: a real sequence (xₙ), n ≥ 1, and its tails T_N = {xₙ : n ≥ N}. The spread of the tail is
 *                D_N = sup{|x_m − xₙ| : m, n ≥ N} = sup T_N − inf T_N (the diameter of T_N on the line; ∞ when T_N is
 *                unbounded). A sequence is Cauchy iff D_N → 0, and then for every ε > 0 there is N with D_N < ε
 *                (D_N non-increasing in N, because T_{N+1} ⊆ T_N).
 *                (b) nested mode: a sequence of subsets F₁ ⊇ F₂ ⊇ … of ℝ, each an interval (open or closed at each
 *                end, possibly a ray), with its diameter diam F_j = sup F_j − inf F_j and the intersection of ALL F_j.
 *                With the space ℚ the sets are F_j ∩ ℚ.
 * Dynamics:      none; n, N, j are indices.
 * Boundary:      every preset carries its exact tail inf / sup / spread (derived in the comment beside it) and says
 *                whether the sup defining D_N is attained; every nest carries its exact diameter and the intersection
 *                of all its sets. The tests compare each closed form with a sampled max − min over a long finite tail,
 *                which is a probe, not a proof.
 * Ignored:       IEEE rounding of the formulas (relative 1e-15). For the Newton iterates D_N is computed from the exact
 *                rational xₙ = p/q through p² − 2q² (no cancellation); the decimal truncations of √2 come from exact
 *                integer arithmetic (BigInt isqrt).
 * Valid when:    n, N, j ≥ 1 are integers. Presets are defined for every such n (a figure shows only n ≤ nMax; the
 *                Newton iterates are frozen at n = 10, where they equal √2 to double precision).
 * Failure modes: a sampled tail sup cannot see a supremum that is approached only in the limit; the tests allow for the
 *                truncation error (relative N/M) and state it. `smallestN` scans n ≤ nMax only: "the smallest N with
 *                D_N < ε" is the true one because D_N is non-increasing, which each preset proves in a comment.
 *
 * Drives the figure of lessons 2.1, 2.5 and 2.6 (CauchyTail).
 */

import { relativeError } from './vec';

export type TailSeqId = 'inv-n' | 'sqrt2-dec' | 'newton' | 'alt-harm' | 'harmonic' | 'sqrt-n' | 'alt-sign' | 'arctan-n';
export type Space = 'R' | 'Q' | 'open01' | 'R-arctan';
export type NestId = 'bisect' | 'half-open' | 'rays' | 'shrink';

/** The ε values the figure offers, descending. */
export const EPS = [0.5, 0.3, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.001];

export const SQRT2 = Math.SQRT2;

// ----------------------------------------------------------------------------------------- exact integer helpers

/** floor(√v) for a BigInt v ≥ 0 (Newton's method on integers). */
export function isqrt(v: bigint): bigint {
  if (v < 0n) throw new RangeError('isqrt of a negative number');
  if (v < 2n) return v;
  let x = BigInt(Math.floor(Math.sqrt(Number(v))));
  // correct the double estimate (v may exceed 2⁵³) and then polish
  for (;;) {
    const y = (x + v / x) >> 1n;
    if (y === x || y === x + 1n || y === x - 1n) {
      x = y;
      break;
    }
    x = y;
  }
  while (x * x > v) x -= 1n;
  while ((x + 1n) * (x + 1n) <= v) x += 1n;
  return x;
}

/** ⌊10^m √2⌋ as a BigInt: the integer behind the truncation to m decimal places. */
export function sqrt2Trunc(m: number): bigint {
  return isqrt(2n * 10n ** BigInt(2 * m));
}

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

/** The Newton iterate xₙ as an exact fraction [p, q]: x₁ = 2/1, x_{n+1} = x/2 + 1/x = (p² + 2q²)/(2pq). n ≤ 10. */
export function newtonRational(n: number): [bigint, bigint] {
  let p = 2n;
  let q = 1n;
  for (let i = 1; i < Math.min(n, 10); i++) {
    [p, q] = [p * p + 2n * q * q, 2n * p * q];
    const g = gcd(p, q);
    [p, q] = [p / g, q / g];
  }
  return [p, q];
}

// ------------------------------------------------------------------------------------------------- tail presets

export interface TailSeq {
  /** Hebrew name for the picker */
  name: string;
  /** the term, LTR, for readouts */
  formula: string;
  nMax: number;
  /** xₙ as plotted */
  x: (n: number) => number;
  /** the limit as a real number (or the "limit level" for arctan-n), null when there is none */
  limit: number | null;
  /** short LTR label of the limit */
  limitLabel: string;
  /** the limit is a rational number */
  limitRational: boolean;
  /** the limit level is not a point of the space for any choice of the space (arctan-n: no real has arctan = π/2) */
  limitNever: boolean;
  /** inf T_N (exact) */
  tailInf: (N: number) => number;
  /** sup T_N (exact), Infinity when unbounded */
  tailSup: (N: number) => number;
  /** D_N (exact), Infinity when unbounded */
  spread: (N: number) => number;
  /** whether the sup defining D_N is a maximum, i.e. some pair m, n ≥ N has |x_m − xₙ| = D_N */
  attained: (N: number) => boolean;
  /** the y-window of the plot */
  y: [number, number];
  yLabel: string;
}

const LN2 = Math.LN2;

/** partial sum of the alternating harmonic series */
const altHarm = (n: number) => {
  let s = 0;
  for (let k = 1; k <= n; k++) s += (k % 2 ? 1 : -1) / k;
  return s;
};

const harm = (n: number) => {
  let s = 0;
  for (let k = 1; k <= n; k++) s += 1 / k;
  return s;
};

export const TAILS: Record<TailSeqId, TailSeq> = {
  // xₙ = 1/n is strictly decreasing, so T_N has max x_N = 1/N (attained, at n = N) and inf 0 (n → ∞, never attained).
  // D_N = 1/N − 0 = 1/N; the sup over pairs is not attained: |1/m − 1/n| < 1/N for m, n ≥ N. Decreasing in N.
  'inv-n': {
    name: '1/n',
    formula: 'xₙ = 1/n',
    nMax: 60,
    x: (n) => 1 / n,
    limit: 0,
    limitLabel: '0',
    limitRational: true,
    limitNever: false,
    tailInf: () => 0,
    tailSup: (N) => 1 / N,
    spread: (N) => 1 / N,
    attained: () => false,
    y: [-0.1, 1.1],
    yLabel: 'xₙ',
  },
  // xₙ = ⌊10^{n−1}√2⌋/10^{n−1} is non-decreasing (truncating to more places never lowers the value) and < √2 (√2 is
  // irrational), with xₙ → √2 (√2 − xₙ < 10^{−(n−1)}). So inf T_N = x_N (attained), sup T_N = √2 (not attained).
  // D_N = √2 − x_N, computed from 20 extra exact digits so that it keeps its relative accuracy.
  'sqrt2-dec': {
    name: 'קטיעות עשרוניות של √2',
    formula: 'xₙ = ⌊10ⁿ⁻¹√2⌋/10ⁿ⁻¹',
    nMax: 12,
    x: (n) => Number(sqrt2Trunc(n - 1)) / 10 ** (n - 1),
    limit: SQRT2,
    limitLabel: '√2',
    limitRational: false,
    limitNever: false,
    tailInf: (N) => Number(sqrt2Trunc(N - 1)) / 10 ** (N - 1),
    tailSup: () => SQRT2,
    spread: (N) => {
      const m = N - 1;
      const fine = sqrt2Trunc(m + 20) - sqrt2Trunc(m) * 10n ** 20n;
      return Number(fine) / 10 ** (m + 20);
    },
    attained: () => false,
    y: [0.9, 1.5],
    yLabel: 'xₙ',
  },
  // x₁ = 2, x_{n+1} = x/2 + 1/x. Exactly rational (p/q). x_{n+1} − √2 = (xₙ − √2)²/(2xₙ) ≥ 0 and
  // x_{n+1} − xₙ = (2 − xₙ²)/(2xₙ) ≤ 0 once xₙ ≥ √2, so the iterates decrease to √2 and stay above it (strictly:
  // √2 is irrational). inf T_N = √2 (not attained), sup T_N = x_N (attained). D_N = x_N − √2 = (p² − 2q²)/(q(p + √2 q)).
  newton: {
    name: 'ניוטון ל-√2',
    formula: 'x₁ = 2, xₙ₊₁ = xₙ/2 + 1/xₙ',
    nMax: 6,
    x: (n) => {
      const [p, q] = newtonRational(n);
      return Number(p) / Number(q);
    },
    limit: SQRT2,
    limitLabel: '√2',
    limitRational: false,
    limitNever: false,
    tailInf: () => SQRT2,
    tailSup: (N) => TAILS.newton.x(N),
    spread: (N) => {
      const [p, q] = newtonRational(N);
      return Number(p * p - 2n * q * q) / (Number(q) * (Number(p) + SQRT2 * Number(q)));
    },
    attained: () => false,
    y: [1.3, 2.1],
    yLabel: 'xₙ',
  },
  // sₙ = Σ_{k≤n} (−1)^{k+1}/k. Even sums increase and odd sums decrease, both to ln 2, so ln 2 lies between s_N and
  // s_{N+1} and every sₙ with n ≥ N lies between them (even N: the odd sums s_{N+1}, s_{N+3}, … decrease from s_{N+1};
  // the even sums s_N, s_{N+2}, … increase from s_N. Odd N: the same with the roles swapped). Both s_N and s_{N+1}
  // are in the tail, so D_N = |s_{N+1} − s_N| = 1/(N+1), attained at (m, n) = (N, N+1). Decreasing in N.
  'alt-harm': {
    name: 'הטור ההרמוני המתחלף',
    formula: 'xₙ = 1 − 1/2 + 1/3 − … ± 1/n',
    nMax: 60,
    x: altHarm,
    limit: LN2,
    limitLabel: 'ln 2',
    limitRational: false,
    limitNever: false,
    tailInf: (N) => Math.min(altHarm(N), altHarm(N + 1)),
    tailSup: (N) => Math.max(altHarm(N), altHarm(N + 1)),
    spread: (N) => 1 / (N + 1),
    attained: () => true,
    y: [0.4, 1.1],
    yLabel: 'xₙ',
  },
  // Hₙ = Σ_{k≤n} 1/k is increasing and unbounded (H_{2n} − Hₙ ≥ 1/2), so inf T_N = H_N (attained), sup T_N = ∞ and
  // D_N = ∞ for every N.
  harmonic: {
    name: 'הטור ההרמוני',
    formula: 'xₙ = 1 + 1/2 + … + 1/n',
    nMax: 60,
    x: harm,
    limit: null,
    limitLabel: '',
    limitRational: false,
    limitNever: false,
    tailInf: harm,
    tailSup: () => Infinity,
    spread: () => Infinity,
    attained: () => false,
    y: [0, 5],
    yLabel: 'xₙ',
  },
  // √n is increasing and unbounded: inf T_N = √N (attained), sup = ∞, D_N = ∞.
  'sqrt-n': {
    name: '√n',
    formula: 'xₙ = √n',
    nMax: 60,
    x: Math.sqrt,
    limit: null,
    limitLabel: '',
    limitRational: false,
    limitNever: false,
    tailInf: Math.sqrt,
    tailSup: () => Infinity,
    spread: () => Infinity,
    attained: () => false,
    y: [0, 8],
    yLabel: 'xₙ',
  },
  // (−1)ⁿ takes both values −1 and 1 in every tail, so inf = −1, sup = 1, D_N = 2, attained (at two consecutive terms).
  'alt-sign': {
    name: '(−1)ⁿ',
    formula: 'xₙ = (−1)ⁿ',
    nMax: 60,
    x: (n) => (n % 2 ? -1 : 1),
    limit: null,
    limitLabel: '',
    limitRational: false,
    limitNever: false,
    tailInf: () => -1,
    tailSup: () => 1,
    spread: () => 2,
    attained: () => true,
    y: [-1.6, 1.6],
    yLabel: 'xₙ',
  },
  // The sequence xₙ = n in (ℝ, ρ), ρ(x, y) = |arctan x − arctan y|, is plotted at height arctan n. ρ(x_m, xₙ) =
  // |arctan m − arctan n|, arctan increasing, so T_N has inf arctan N (attained) and sup π/2 (not attained):
  // D_N = π/2 − arctan N → 0, so the sequence is ρ-Cauchy. The "limit level" π/2 is the height of no real number
  // (arctan x < π/2 for every real x), so no point of the space is the limit: limitNever, always drawn hollow.
  'arctan-n': {
    name: 'n במטריקה ρ',
    formula: 'xₙ = n, ρ(x, y) = |arctan x − arctan y|',
    nMax: 60,
    x: Math.atan,
    limit: Math.PI / 2,
    limitLabel: 'π/2',
    limitRational: false,
    limitNever: true,
    tailInf: Math.atan,
    tailSup: () => Math.PI / 2,
    spread: (N) => Math.PI / 2 - Math.atan(N),
    attained: () => false,
    y: [0, 1.8],
    yLabel: 'arctan xₙ',
  },
};

export const TAIL_IDS = Object.keys(TAILS) as TailSeqId[];

/** Is the limit of the sequence a point of the space? (ℝ: whenever there is one; ℚ: when rational; (0,1): when inside.) */
export function limitInSpace(seq: TailSeq, space: Space): boolean {
  if (seq.limit === null || seq.limitNever) return false;
  if (space === 'Q') return seq.limitRational;
  if (space === 'open01') return seq.limit > 0 && seq.limit < 1;
  return true;
}

/** D_N < ε */
export const isWithin = (seq: TailSeq, N: number, eps: number) => seq.spread(N) < eps;

/** The smallest N ≤ nMax with D_N < ε, or null. D_N is non-increasing in N, so "from N on" is the same as "at N". */
export function smallestN(seq: TailSeq, eps: number): number | null {
  for (let N = 1; N <= seq.nMax; N++) if (isWithin(seq, N, eps)) return N;
  return null;
}

/** |x_N − y_N| for two presets */
export const gap = (a: TailSeq, b: TailSeq, N: number) => Math.abs(a.x(N) - b.x(N));

/** The y-window covering a sequence and, optionally, a second one drawn with it. */
export function yWindow(a: TailSeq, b?: TailSeq | null): [number, number] {
  return b ? [Math.min(a.y[0], b.y[0]), Math.max(a.y[1], b.y[1])] : a.y;
}

/** Sampled max − min of xₙ over N ≤ n ≤ M: a probe of D_N (it cannot see a sup approached only as n → ∞). */
export function sampledSpread(x: (n: number) => number, N: number, M: number): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (let n = N; n <= M; n++) {
    const v = x(n);
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return hi - lo;
}

// ------------------------------------------------------------------------------------------------- nested presets

export interface NestSet {
  lo: number;
  hi: number;
  loClosed: boolean;
  hiClosed: boolean;
  /** hi = ∞: drawn to the edge with an arrow */
  ray: boolean;
}

export interface Nest {
  name: string;
  /** F_j, LTR */
  formula: string;
  /** F_j (j ≥ 1) */
  set: (j: number) => NestSet;
  /** exact diam F_j = sup − inf (Infinity for a ray); the same for F_j ∩ ℚ, since ℚ is dense */
  diam: (j: number) => number;
  /** the single point of ⋂ F_j taken in ℝ, or null when ⋂ F_j = ∅ in ℝ */
  point: number | null;
  pointLabel: string;
  pointRational: boolean;
  /** the x-window of the plot */
  window: [number, number];
}

/**
 * Bisection for √2 from [1, 2]: F_j = [p/2^{j−1}, (p+1)/2^{j−1}] with p = p_j, p₁ = 1, and p_{j+1} = 2p_j + 1 when the
 * midpoint (2p_j + 1)/2^j is below √2, i.e. (2p_j + 1)² < 2·4^j, else 2p_j. (Never equal: √2 is irrational.) Then
 * F_{j+1} ⊆ F_j, √2 ∈ F_j (p²/4^{j−1} < 2 < (p+1)²/4^{j−1} by induction), diam F_j = 2^{−(j−1)}, and ⋂ F_j = {√2} in ℝ
 * (nested closed intervals with diameters → 0), while ⋂ (F_j ∩ ℚ) = ∅ since √2 ∉ ℚ.
 */
export function bisectP(j: number): number {
  let p = 1;
  for (let i = 1; i < j; i++) p = (2 * p + 1) ** 2 < 2 * 4 ** i ? 2 * p + 1 : 2 * p;
  return p;
}

const closed = (lo: number, hi: number): NestSet => ({ lo, hi, loClosed: true, hiClosed: true, ray: false });

export const NESTS: Record<NestId, Nest> = {
  bisect: {
    name: 'חציית קטעים ל-√2',
    formula: 'F₁ = [1, 2], F_{j+1} = החצי של F_j שמכיל את √2',
    set: (j) => {
      const d = 2 ** (j - 1);
      const p = bisectP(j);
      return closed(p / d, (p + 1) / d);
    },
    diam: (j) => 2 ** -(j - 1),
    point: SQRT2,
    pointLabel: '√2',
    pointRational: false,
    window: [0.9, 2.1],
  },
  // F_j = (0, 1/j]: decreasing in j; sup − inf = 1/j (the sup of |x − y| is not attained: 0 ∉ F_j). ⋂ F_j = ∅ (a point
  // x > 0 leaves F_j once 1/j < x), in ℝ and in ℚ.
  'half-open': {
    name: '(0, 1/j]',
    formula: 'F_j = (0, 1/j]',
    set: (j) => ({ lo: 0, hi: 1 / j, loClosed: false, hiClosed: true, ray: false }),
    diam: (j) => 1 / j,
    point: null,
    pointLabel: '',
    pointRational: false,
    window: [-0.1, 1.1],
  },
  // F_j = [j, ∞): decreasing in j, unbounded so diam = ∞, ⋂ F_j = ∅ (Archimedes: no real x ≥ j for every j).
  rays: {
    name: '[j, ∞)',
    formula: 'F_j = [j, ∞)',
    set: (j) => ({ lo: j, hi: Infinity, loClosed: true, hiClosed: false, ray: true }),
    diam: () => Infinity,
    point: null,
    pointLabel: '',
    pointRational: false,
    window: [0, 14],
  },
  // F_j = [0, 1/j]: closed, nested, diam 1/j → 0, ⋂ F_j = {0}, and 0 ∈ ℚ.
  shrink: {
    name: '[0, 1/j]',
    formula: 'F_j = [0, 1/j]',
    set: (j) => closed(0, 1 / j),
    diam: (j) => 1 / j,
    point: 0,
    pointLabel: '0',
    pointRational: true,
    window: [-0.1, 1.1],
  },
};

export const NEST_IDS = Object.keys(NESTS) as NestId[];
export const K_MAX = 12;

/** The point of ⋂ F_j in the chosen space ('R' or 'Q'), or null when that intersection is empty. */
export function intersectionPoint(nest: Nest, space: 'R' | 'Q'): number | null {
  if (nest.point === null) return null;
  return space === 'Q' && !nest.pointRational ? null : nest.point;
}

/** The point the intersection would be in ℝ but which the space ℚ lacks (bisect in ℚ: √2), else null. */
export function missingPoint(nest: Nest, space: 'R' | 'Q'): number | null {
  return nest.point !== null && space === 'Q' && !nest.pointRational ? nest.point : null;
}

export { relativeError };
