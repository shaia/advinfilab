/**
 * MODEL SPECIFICATION
 *
 * System:        (1) a set A in the plane ℝ² (the square [0,1]², the disc of radius 1/2 about (1/2,1/2), the thin
 *                strip [0,2]×[0,0.1], a cloud of 12 points) with one of the metrics d₁, d₂, d∞, or the discrete
 *                metric on the cloud; (2) the space (C[0,1], d∞) with the set
 *                L = {f : f(0) = 0, |f(x) − f(y)| ≤ |x − y|} and the zigzags of mesh h = 1/m.
 * Plane:         a region is represented by its grid points of step `step` that lie in it (a finite subset A_s of
 *                A); the cloud is itself. On that finite set the greedy ε-net is computed exactly: start at the
 *                first point, then repeatedly add the point of A_s farthest from the points chosen so far, as long
 *                as that distance is ≥ ε. This is the greedy choice of lemma 3.3.3א(ב) of the course (any uncovered
 *                point may be chosen; the farthest one is a valid choice), so the result is an ε-net of A_s that is
 *                also ε-separated. It is an ε-net of the finite set A_s, not of the region A: between grid points
 *                the figure is a probe and its caption says so. The greedy net of radius 2ε is a 2ε-separated
 *                subset of A itself (its points are points of A), so by lemma 3.3.3א(א) its size is an exact lower
 *                bound for the size of every ε-net of A.
 * Segment:       the smallest ε-net of [0, len] (open balls, centres in the segment) has exactly ⌊len/(2ε)⌋ + 1
 *                points (טענה 3.3.3ב): `minNetSegment` returns the smallest integer m with 2εm > len, computed
 *                without a floor of a rounded quotient, and `segmentNet` the centres (i − 1/2)·len/m.
 * Zigzags:       for m ∈ ℕ and h = 1/m, a zigzag is the continuous g with g(0) = 0 and slope ±1 on each
 *                [jh, (j+1)h]; there are 2^m of them. For f ∈ L the sign rule (slope +1 on [x_j, x_{j+1}] when
 *                f(x_{j+1}) ≥ g(x_j), else −1) keeps |f(x_j) − g(x_j)| ≤ h at every node; on each piece f − g is
 *                monotone (f is 1-Lipschitz, g has slope ±1), so ‖f − g‖∞ ≤ h (טענה 3.3.10(א)). `supDistance`
 *                samples |f − g| on a grid with the nodes and the breakpoints of the presets: a probe, exact for the
 *                piecewise-linear presets (zero, abs, the tent) because the maximum of a piecewise-linear function
 *                is at a breakpoint.
 * Sequences:     ‖x^n − x^m‖∞ on [0,1] for m > n is attained at t* = (n/m)^{1/(m−n)} with value t*^n (1 − n/m)
 *                (calculus, Infi 1); for m = 2n it is 1/4. ‖x^n‖₁ = 1/(n+1).
 * Ignored:       IEEE rounding (relative 1e-15).
 * Valid when:    ε ≥ 0.02 in the plane (the net has at most a few hundred points), 1 ≤ m ≤ 16 for zigzags.
 *
 * Drives the figure of lesson 3.3 (EpsNet). A numerical probe never proves: the tests check the claims of the
 * lesson on these finite sets as evidence; the theorems are proved in the lesson.
 */

import { fmtNum } from './contraction';

export { fmtNum };

export type Pt = readonly [number, number];
export type Metric = 'd1' | 'd2' | 'dinf' | 'discrete';
export type SetId = 'square' | 'disc' | 'strip' | 'cloud' | 'discrete';

export function dist(metric: Metric, p: Pt, q: Pt): number {
  const dx = Math.abs(p[0] - q[0]);
  const dy = Math.abs(p[1] - q[1]);
  if (metric === 'd1') return dx + dy;
  if (metric === 'dinf') return Math.max(dx, dy);
  if (metric === 'discrete') return dx === 0 && dy === 0 ? 0 : 1;
  return Math.hypot(dx, dy);
}

/** the 12 points of the finite cloud (also the discrete space) */
export const CLOUD: Pt[] = [
  [0.1, 0.15],
  [0.35, 0.08],
  [0.7, 0.12],
  [0.92, 0.3],
  [0.15, 0.45],
  [0.5, 0.4],
  [0.8, 0.55],
  [0.3, 0.7],
  [0.6, 0.75],
  [0.9, 0.88],
  [0.12, 0.9],
  [0.45, 0.95],
];

export interface PlaneSet {
  id: SetId;
  /** Hebrew name for the picker */
  label: string;
  /** a region (sampled) or a finite set */
  kind: 'region' | 'finite';
  /** the metric is forced (discrete) or chosen by the student */
  fixedMetric: Metric | null;
  /** grid step of the sample (regions) */
  step: number;
  /** membership (regions) */
  contains: (p: Pt) => boolean;
  /** plot window; the figure keeps equal scales on both axes */
  window: { x: [number, number]; y: [number, number] };
}

const inSquare = (p: Pt) => p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1;
const EPS_IN = 1e-12;

export const SETS: Record<SetId, PlaneSet> = {
  square: {
    id: 'square',
    label: 'ריבוע',
    kind: 'region',
    fixedMetric: null,
    step: 0.02,
    contains: inSquare,
    window: { x: [-0.35, 1.35], y: [-0.2, 1.2] },
  },
  disc: {
    id: 'disc',
    label: 'עיגול',
    kind: 'region',
    fixedMetric: null,
    step: 0.02,
    contains: (p) => (p[0] - 0.5) ** 2 + (p[1] - 0.5) ** 2 <= 0.25 + EPS_IN,
    window: { x: [-0.35, 1.35], y: [-0.2, 1.2] },
  },
  strip: {
    id: 'strip',
    label: 'מלבן דק',
    kind: 'region',
    fixedMetric: null,
    step: 0.02,
    contains: (p) => p[0] >= -EPS_IN && p[0] <= 2 + EPS_IN && p[1] >= -EPS_IN && p[1] <= 0.1 + EPS_IN,
    window: { x: [-0.25, 2.25], y: [-0.9, 1.0] },
  },
  cloud: {
    id: 'cloud',
    label: '12 נקודות',
    kind: 'finite',
    fixedMetric: null,
    step: 0,
    contains: (p) => CLOUD.some((q) => q[0] === p[0] && q[1] === p[1]),
    window: { x: [-0.35, 1.35], y: [-0.2, 1.2] },
  },
  discrete: {
    id: 'discrete',
    label: 'מטריקה בדידה',
    kind: 'finite',
    fixedMetric: 'discrete',
    step: 0,
    contains: (p) => CLOUD.some((q) => q[0] === p[0] && q[1] === p[1]),
    window: { x: [-0.35, 1.35], y: [-0.2, 1.2] },
  },
};

const sampleCache = new Map<SetId, Pt[]>();

/** The finite set the figure works on: the cloud itself, or the grid points of step `step` in the region. */
export function samplePoints(id: SetId): Pt[] {
  const hit = sampleCache.get(id);
  if (hit) return hit;
  const s = SETS[id];
  let pts: Pt[];
  if (s.kind === 'finite') pts = CLOUD.slice();
  else {
    pts = [];
    const [x0, x1] = id === 'strip' ? [0, 2] : [0, 1];
    const [y0, y1] = id === 'strip' ? [0, 0.1] : [0, 1];
    const nx = Math.round((x1 - x0) / s.step);
    const ny = Math.round((y1 - y0) / s.step);
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i <= nx; i++) {
        const p: Pt = [x0 + i * s.step, y0 + j * s.step];
        if (s.contains(p)) pts.push(p);
      }
  }
  sampleCache.set(id, pts);
  return pts;
}

/** the metric a set uses: forced (discrete) or the chosen one */
export const metricOf = (id: SetId, chosen: Metric): Metric => SETS[id].fixedMetric ?? chosen;

/**
 * The greedy ε-net of a finite set (farthest-point rule, starting at index 0): indices into `pts`, in the order
 * chosen. Every point of `pts` is at distance < ε from a chosen point, and chosen points are pairwise ≥ ε apart.
 */
export function greedyNet(pts: readonly Pt[], eps: number, metric: Metric): number[] {
  if (pts.length === 0) return [];
  const net = [0];
  const dmin = pts.map((p) => dist(metric, p, pts[0]));
  for (;;) {
    let far = -1;
    let best = -1;
    for (let i = 0; i < pts.length; i++)
      if (dmin[i] > best) {
        best = dmin[i];
        far = i;
      }
    if (best < eps) return net;
    net.push(far);
    const c = pts[far];
    for (let i = 0; i < pts.length; i++) {
      const d = dist(metric, pts[i], c);
      if (d < dmin[i]) dmin[i] = d;
    }
  }
}

/** every point of `pts` lies in some open ball B(c, ε), c among `centres` */
export function coversAll(pts: readonly Pt[], centres: readonly Pt[], eps: number, metric: Metric): boolean {
  return pts.every((p) => centres.some((c) => dist(metric, p, c) < eps));
}

/** the points are pairwise at distance ≥ r */
export function isSeparated(pts: readonly Pt[], r: number, metric: Metric): boolean {
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (dist(metric, pts[i], pts[j]) < r) return false;
  return true;
}

export interface NetResult {
  /** the greedy ε-net (points) */
  net: Pt[];
  /** the greedy 2ε-net: a 2ε-separated subset of A, so every ε-net of A has at least this many points */
  separated: Pt[];
}

const netCache = new Map<string, NetResult>();

export function netFor(id: SetId, chosen: Metric, eps: number): NetResult {
  const metric = metricOf(id, chosen);
  const key = `${id}|${metric}|${eps.toFixed(4)}`;
  const hit = netCache.get(key);
  if (hit) return hit;
  const pts = samplePoints(id);
  const res: NetResult = {
    net: greedyNet(pts, eps, metric).map((i) => pts[i]),
    separated: greedyNet(pts, 2 * eps, metric).map((i) => pts[i]),
  };
  if (netCache.size > 400) netCache.clear();
  netCache.set(key, res);
  return res;
}

// ---------------------------------------------------------------------------------------------------------------
// the segment [0, len]

/** The smallest number of points of an ε-net of [0, len] (open balls, centres in the segment): min m with 2εm > len. */
export function minNetSegment(len: number, eps: number): number {
  let m = Math.max(1, Math.floor(len / (2 * eps)) - 1);
  while (!(2 * eps * m > len)) m++;
  return m;
}

/**
 * The smallest number of points of an ε-net of the open interval (0, len) (centres in it): 1 when len ≤ 2ε, else the
 * least m with 2εm > len. Upper bound: the centres (i − 1/2)·len/m are within len/(2m) < ε of their pieces. Lower
 * bound, for m ≥ 2 sorted centres y₁ < … < y_m: y₁ ≤ ε and y_m ≥ len − ε (else points near the ends are missed), and
 * consecutive gaps are < 2ε (else their midpoint is missed), so len < 2εm. Used for (ℝ, ρ), which arctan maps
 * isometrically onto (−π/2, π/2).
 */
export function minNetOpenSegment(len: number, eps: number): number {
  if (len <= 2 * eps) return 1;
  return minNetSegment(len, eps);
}

/** centres (i − 1/2)·len/m, i = 1 … m, of an ε-net of [0, len] with m = minNetSegment(len, ε) points */
export function segmentNet(len: number, eps: number): number[] {
  const m = minNetSegment(len, eps);
  return Array.from({ length: m }, (_, i) => ((i + 0.5) * len) / m);
}

// ---------------------------------------------------------------------------------------------------------------
// zigzags in (C[0,1], d∞)

export type FnId = 'wave' | 'abs' | 'zero' | 'tent';

export interface FnDef {
  id: FnId;
  /** the formula, LTR, for the picker and readouts */
  formula: string;
  f: (x: number) => number;
  /** f ∈ L: f(0) = 0 and 1-Lipschitz (proved beside the preset) */
  inL: boolean;
  /** the best Lipschitz constant on [0,1] */
  lip: number;
  /** x-values where f is not smooth (sampled exactly by supDistance) */
  kinks: number[];
}

/** the tent t_n of the course (spine): 0 off [2^{-n}, 2^{-n+1}], 1 at the midpoint 3·2^{-n-1}, linear on each half */
export function tent(n: number, x: number): number {
  const a = 2 ** -n;
  const b = 2 ** (-n + 1);
  const mid = 3 * 2 ** (-n - 1);
  if (x <= a || x >= b) return 0;
  return x <= mid ? (x - a) / (mid - a) : (b - x) / (b - mid);
}

export const FNS: Record<FnId, FnDef> = {
  // f′(x) = cos 5x, |f′| ≤ 1, so 1-Lipschitz by the mean value theorem; f(0) = 0
  wave: { id: 'wave', formula: '0.2·sin 5x', f: (x) => 0.2 * Math.sin(5 * x), inL: true, lip: 1, kinks: [] },
  // |(|x−½|) − (|y−½|)| ≤ |x − y| (reverse triangle inequality); f(0) = 0
  abs: { id: 'abs', formula: '|x − ½| − ½', f: (x) => Math.abs(x - 0.5) - 0.5, inL: true, lip: 1, kinks: [0.5] },
  zero: { id: 'zero', formula: '0', f: () => 0, inL: true, lip: 0, kinks: [] },
  // t₁: slope ±1/(1/4) = ±4 on [1/2, 3/4] and [3/4, 1]: not in L
  tent: { id: 'tent', formula: 't₁', f: (x) => tent(1, x), inL: false, lip: 4, kinks: [0.5, 0.75, 1] },
};

/** The sign rule: s_j ∈ {+1, −1} on [jh, (j+1)h], j = 0 … m−1, chosen so that |f(x_j) − g(x_j)| ≤ h when f ∈ L. */
export function zigzagSigns(f: (x: number) => number, m: number): number[] {
  const h = 1 / m;
  const signs: number[] = [];
  let g = 0;
  for (let j = 0; j < m; j++) {
    const s = f((j + 1) * h) >= g ? 1 : -1;
    signs.push(s);
    g += s * h;
  }
  return signs;
}

/** g(x_j), j = 0 … m */
export function zigzagNodes(signs: readonly number[]): number[] {
  const m = signs.length;
  const out = [0];
  for (let j = 0; j < m; j++) out.push(out[j] + signs[j] / m);
  return out;
}

/** the zigzag with these signs at x ∈ [0, 1] */
export function zigzagValue(signs: readonly number[], x: number): number {
  const m = signs.length;
  const h = 1 / m;
  let g = 0;
  for (let j = 0; j < m; j++) {
    const a = j * h;
    if (x <= a + h || j === m - 1) return g + signs[j] * Math.max(0, Math.min(h, x - a));
    g += signs[j] * h;
  }
  return g;
}

/** max_j |f(x_j) − g(x_j)| over the nodes */
export function nodeError(f: (x: number) => number, signs: readonly number[]): number {
  const m = signs.length;
  const g = zigzagNodes(signs);
  let e = 0;
  for (let j = 0; j <= m; j++) e = Math.max(e, Math.abs(f(j / m) - g[j]));
  return e;
}

/** sup |f − g| on [0,1], sampled at `n` grid points, the nodes and the given kinks (a probe; exact for piecewise-linear f) */
export function supDistance(f: (x: number) => number, signs: readonly number[], kinks: readonly number[] = [], n = 4000): number {
  const m = signs.length;
  const xs: number[] = [...kinks];
  for (let i = 0; i <= n; i++) xs.push(i / n);
  for (let j = 0; j <= m; j++) xs.push(j / m);
  let e = 0;
  for (const x of xs) if (x >= 0 && x <= 1) e = Math.max(e, Math.abs(f(x) - zigzagValue(signs, x)));
  return e;
}

/** all 2^m sign vectors (m ≤ 16) */
export function allSigns(m: number): number[][] {
  const out: number[][] = [];
  for (let k = 0; k < 2 ** m; k++) out.push(Array.from({ length: m }, (_, j) => ((k >> j) & 1 ? 1 : -1)));
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// powers x^n in (C[0,1], d∞) and d₁

/** ‖x^n − x^m‖∞ on [0,1] for m > n ≥ 1: the value at t* = (n/m)^{1/(m−n)} */
export function xPowSupDistance(n: number, m: number): number {
  if (m === n) return 0;
  const [a, b] = m > n ? [n, m] : [m, n];
  const t = (a / b) ** (1 / (b - a));
  return t ** a - t ** b;
}

/** ‖x^n‖₁ = ∫₀¹ x^n dx */
export const xPowL1 = (n: number) => 1 / (n + 1);

// ---------------------------------------------------------------------------------------------------------------
// (ℝ, ρ) with ρ(x, y) = |arctan x − arctan y|

/** points x_j = tan(−π/2 + jπ/m), j = 1 … m−1, with m the least integer ≥ max(2, π/ε): every real is within ρ < ε */
export function arctanNet(eps: number): number[] {
  const m = Math.max(2, Math.ceil(Math.PI / eps));
  return Array.from({ length: m - 1 }, (_, i) => Math.tan(-Math.PI / 2 + ((i + 1) * Math.PI) / m));
}

// ---------------------------------------------------------------------------------------------------------------
// figure state and its accessible description

export interface PlaneState {
  set: SetId;
  metric: Metric;
  eps: number;
  showSep: boolean;
}

const METRIC_NAME: Record<Metric, string> = { d1: 'd₁', d2: 'd₂', dinf: 'd∞', discrete: 'המטריקה הבדידה' };
export const metricName = (m: Metric) => METRIC_NAME[m];

export function describePlane(s: PlaneState): string {
  const set = SETS[s.set];
  const metric = metricOf(s.set, s.metric);
  const r = netFor(s.set, s.metric, s.eps);
  let t = `הקבוצה: ${set.label}, עם ${METRIC_NAME[metric]}, ε = ${fmtNum(s.eps)}. ברשת החמדנית ${r.net.length} נקודות.`;
  if (s.showSep) t += ` קבוצה ${fmtNum(2 * s.eps)}-מופרדת בגודל ${r.separated.length}: כל ε-רשת צריכה לפחות ${r.separated.length} נקודות.`;
  return t;
}

export interface ZigState {
  fn: FnId;
  m: number;
}

export function describeZig(s: ZigState): string {
  const F = FNS[s.fn];
  const signs = zigzagSigns(F.f, s.m);
  const e = supDistance(F.f, signs, F.kinks);
  return `הפונקציה f = ${F.formula}${F.inL ? '' : ' (אינה ב-L)'}, m = ${s.m}, h = ${fmtNum(1 / s.m)}. המרחק מהזיגזג שנבחר: ${fmtNum(e)}.`;
}
