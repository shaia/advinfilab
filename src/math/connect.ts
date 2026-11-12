/**
 * MODEL SPECIFICATION
 *
 * System:        two pictures of lesson 3.6 (connectedness), each a pure model with no DOM.
 *
 *  (1) Polygonal paths in a planar set U (the figure's "poly" mode). U is one of four presets:
 *        annulus     U = {x ∈ ℝ² : 1 < ‖x‖₂ < 2}                    (open, connected)
 *        punctured   U = ℝ² ∖ {0}                                    (open, connected; the figure shows a window)
 *        two-discs   U = B((−1.2, 0), 1) ∪ B((1.2, 0), 1), d₂ balls  (open, not connected)
 *        line        U = ℝ ∖ {0}, drawn on the x-axis                (open in ℝ, not connected)
 *      Points live on the grid (1/GRID)ℤ²: a vertex is a pair of integers (i, j) for the point (i/GRID, j/GRID).
 *      A polygonal path is a list of vertices z₀ = p, z₁, …, z_m; it lies in U iff every closed segment
 *      [z_{k−1}, z_k] = {(1 − t)z_{k−1} + t z_k : t ∈ [0, 1]} lies in U. Every test below is EXACT: it uses integer
 *      arithmetic on grid coordinates (all values stay far below 2⁵³), no floating point and no sampling.
 *        annulus     [a, b] ⊆ U ⇔ max(‖a‖², ‖b‖²) < R₂² and dist(0, [a, b])² > R₁².
 *                    ‖·‖² is convex along a segment, so its maximum is at an endpoint. The squared distance from 0
 *                    to the segment is ‖a‖² if a·(b−a) ≥ 0, ‖b‖² if b·(b−a) ≤ 0, and otherwise
 *                    cross(a, b−a)² / ‖b−a‖² (the foot of the perpendicular lies inside); the comparison
 *                    cross² > R₁²‖b−a‖² is done in integers.
 *        punctured   [a, b] ⊆ U ⇔ 0 ∉ [a, b] ⇔ not (cross(a, b) = 0 and a·b ≤ 0)  (for a, b ≠ 0, and a ≠ b or a = b ≠ 0).
 *        two-discs   [a, b] ⊆ U ⇔ a and b lie in the same disc. (⇐ a disc is convex. ⇒ the segment is connected,
 *                    and its traces on the two disjoint open discs would separate it: the lesson's argument,
 *                    טענה 3.6.11(א) and למה 3.6.2א; the test file checks it against a fine sampling as evidence.)
 *        line        [a, b] ⊆ U ⇔ a, b on the x-axis, both nonzero and of the same sign.
 *      `exitParam` returns, for a segment that leaves U, the first t ∈ [0, 1] at which it is outside U; it is used
 *      ONLY to place a marker on the canvas, and is computed in floating point (a quadratic root for the circles).
 *
 *  (2) The topologist's sine curve (the figure's "sine" mode): S = G ∪ J, G = {(x, sin(1/x)) : 0 < x ≤ 1},
 *      J = {0} × [−1, 1], in ℝ² with d₂.
 *        peaks(x₀)          the points of [x₀, 1] where sin(1/x) = ±1: x = 1/(π/2 + πk), k = 0, 1, …; their number is
 *                           ⌊(1/x₀ − π/2)/π⌋ + 1 when 1/x₀ ≥ π/2, else 0. Exact formula; floating evaluation.
 *        approach(y, k)     x_k = 1/(arcsin y + 2πk), k ≥ 1, for y ∈ [−1, 1]: a point of G with sin(1/x_k) = y
 *                           (sin is 2π-periodic), at d₂-distance x_k from (0, y) ∈ J. x_k → 0, which is why J ⊆ Ḡ
 *                           (טענה 3.6.13, step of the proof).
 *        distToJ(x, y)      the d₂-distance from (x, y), x ≥ 0, |y| ≤ 1, to J: exactly x.
 *        firstK(y, tol)     the least k ≥ 1 with x_k < tol.
 *      Floating point, relative error ~1e-15. The figure that draws G near x = 0 cannot resolve the oscillations
 *      below one pixel; it fills that strip, and the caption says so.
 *
 * Ignored:       nothing in (1); IEEE rounding in (2).
 * Valid when:    grid coordinates |i|, |j| ≤ 10⁶; 10⁻⁶ ≤ x₀ ≤ 1; y ∈ [−1, 1].
 * Not a proof:   the tests compare the exact segment tests with a fine sampling, and the sine-curve formulas with
 *                direct evaluation. The theorems (3.6.11, 3.6.12, 3.6.13) are proved in the lesson; the figure is a probe.
 *
 * Drives the figure of lesson 3.6 (Connect).
 */

/** grid points per unit: a vertex (i, j) is the point (i/GRID, j/GRID) */
export const GRID = 10;

export type RegionId = 'annulus' | 'punctured' | 'two-discs' | 'line';

/** a grid vertex: integer coordinates */
export type V = readonly [number, number];

export interface Region {
  id: RegionId;
  /** Hebrew name with the formula, for the picker and readouts */
  label: string;
  /** the set as text, for the readouts (LTR) */
  text: string;
  /** exact: is the grid point in U */
  contains: (v: V) => boolean;
  /** exact: does the closed segment [a, b] lie in U (a, b ∈ U assumed by callers; checked anyway) */
  segmentInside: (a: V, b: V) => boolean;
  /** the start p and the target q of the path task */
  start: V;
  target: V;
  /** is U connected (proved in the lesson; a label for the readout) */
  connected: boolean;
  /** the plot window, in units */
  window: { x: [number, number]; y: [number, number] };
  /** only points on the x-axis may be chosen */
  onAxis: boolean;
}

const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1];
const cross = (a: V, b: V) => a[0] * b[1] - a[1] * b[0];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const n2 = (a: V) => dot(a, a);

/** squared d₂-distance from the origin to the segment [a, b], as a fraction num/den of integers (den > 0) */
export function distSqToOrigin(a: V, b: V): { num: number; den: number } {
  const d = sub(b, a);
  if (d[0] === 0 && d[1] === 0) return { num: n2(a), den: 1 };
  if (dot(a, d) >= 0) return { num: n2(a), den: 1 };
  if (dot(b, d) <= 0) return { num: n2(b), den: 1 };
  const c = cross(a, d);
  return { num: c * c, den: n2(d) };
}

const R1 = 1 * GRID;
const R2 = 2 * GRID;

const annulus: Region = {
  id: 'annulus',
  label: 'טבעת',
  text: '1 < ‖x‖₂ < 2',
  contains: (v) => n2(v) > R1 * R1 && n2(v) < R2 * R2,
  segmentInside: (a, b) => {
    if (Math.max(n2(a), n2(b)) >= R2 * R2) return false;
    const { num, den } = distSqToOrigin(a, b);
    return num > R1 * R1 * den;
  },
  start: [15, 0],
  target: [-15, 0],
  connected: true,
  window: { x: [-2.3, 2.3], y: [-2.3, 2.3] },
  onAxis: false,
};

/** is the origin on the closed segment [a, b] */
export function originOnSegment(a: V, b: V): boolean {
  return cross(a, b) === 0 && dot(a, b) <= 0;
}

const punctured: Region = {
  id: 'punctured',
  label: 'המישור בלי הראשית',
  text: 'ℝ² ∖ {0}',
  contains: (v) => v[0] !== 0 || v[1] !== 0,
  segmentInside: (a, b) => punctured.contains(a) && punctured.contains(b) && !originOnSegment(a, b),
  start: [10, 0],
  target: [-10, 0],
  connected: true,
  window: { x: [-2.3, 2.3], y: [-2.3, 2.3] },
  onAxis: false,
};

/** the two centres (grid units) and the radius of the discs of `two-discs` */
export const DISC_CENTRES: readonly V[] = [
  [-12, 0],
  [12, 0],
];
const DISC_R = 1 * GRID;
/** which disc holds v: 0, 1, or -1 for neither (open discs, exact) */
export function discOf(v: V): number {
  for (let k = 0; k < DISC_CENTRES.length; k++) if (n2(sub(v, DISC_CENTRES[k])) < DISC_R * DISC_R) return k;
  return -1;
}

const twoDiscs: Region = {
  id: 'two-discs',
  label: 'שני עיגולים זרים',
  text: 'B((−1.2,0),1) ∪ B((1.2,0),1)',
  contains: (v) => discOf(v) >= 0,
  segmentInside: (a, b) => discOf(a) >= 0 && discOf(a) === discOf(b),
  start: [12, 0],
  target: [-12, 0],
  connected: false,
  window: { x: [-2.3, 2.3], y: [-2.3, 2.3] },
  onAxis: false,
};

const line: Region = {
  id: 'line',
  label: 'הישר בלי 0',
  text: 'ℝ ∖ {0}',
  contains: (v) => v[1] === 0 && v[0] !== 0,
  segmentInside: (a, b) => a[1] === 0 && b[1] === 0 && a[0] !== 0 && b[0] !== 0 && Math.sign(a[0]) === Math.sign(b[0]),
  start: [10, 0],
  target: [-10, 0],
  connected: false,
  window: { x: [-2.3, 2.3], y: [-0.6, 0.6] },
  onAxis: true,
};

export const REGIONS: Record<RegionId, Region> = { annulus, punctured, 'two-discs': twoDiscs, line };

export const isRegion = (s: unknown): s is RegionId => typeof s === 'string' && s in REGIONS;

/** the point of a grid vertex */
export const pt = (v: V): [number, number] => [v[0] / GRID, v[1] / GRID];

/** the nearest grid vertex to a point (x, y), clamped to the window; on the axis when the region asks for it */
export function snap(r: Region, x: number, y: number): V {
  const cx = Math.max(r.window.x[0], Math.min(r.window.x[1], x));
  const cy = r.onAxis ? 0 : Math.max(r.window.y[0], Math.min(r.window.y[1], y));
  // Math.round(-0.4) is -0: normalise so that equal vertices compare equal with ===
  return [Math.round(cx * GRID) + 0, Math.round(cy * GRID) + 0];
}

export const sameV = (a: V, b: V) => a[0] === b[0] && a[1] === b[1];

export interface PathReport {
  /** index k of the first segment [z_{k−1}, z_k] that leaves U (k ≥ 1), or null when every segment is in U */
  badSegment: number | null;
  /** index of the first vertex outside U, or null */
  badVertex: number | null;
  /** every vertex and every segment lies in U */
  inside: boolean;
  /** the last vertex is the target */
  reached: boolean;
  /** the path is a polygonal path in U from the start to the target */
  done: boolean;
}

/** Check a polygonal path z₀, …, z_m (z₀ is the start) against U. Exact. */
export function checkPath(r: Region, path: readonly V[]): PathReport {
  let badVertex: number | null = null;
  let badSegment: number | null = null;
  path.forEach((v, k) => {
    if (badVertex === null && !r.contains(v)) badVertex = k;
  });
  for (let k = 1; k < path.length; k++) {
    if (!r.segmentInside(path[k - 1], path[k])) {
      badSegment = k;
      break;
    }
  }
  const inside = badVertex === null && badSegment === null;
  const reached = path.length > 0 && sameV(path[path.length - 1], r.target);
  return { badSegment, badVertex, inside, reached, done: inside && reached && path.length >= 1 };
}

/**
 * The first t ∈ [0, 1] at which (1 − t)a + t b is outside U, for drawing a marker only (floating point).
 * Returns null when the segment lies in U.
 */
export function exitParam(r: Region, a: V, b: V): number | null {
  if (r.segmentInside(a, b)) return null;
  const A = pt(a);
  const B = pt(b);
  const D: [number, number] = [B[0] - A[0], B[1] - A[1]];
  const dd = D[0] * D[0] + D[1] * D[1];
  /** roots t of ‖A + tD − c‖ = ρ, sorted */
  const circle = (c: [number, number], rho: number): number[] => {
    if (dd === 0) return [];
    const ax = A[0] - c[0];
    const ay = A[1] - c[1];
    const bq = 2 * (ax * D[0] + ay * D[1]);
    const cq = ax * ax + ay * ay - rho * rho;
    const disc = bq * bq - 4 * dd * cq;
    if (disc < 0) return [];
    const s = Math.sqrt(disc);
    return [(-bq - s) / (2 * dd), (-bq + s) / (2 * dd)];
  };
  const inT = (t: number) => t >= 0 && t <= 1;
  if (!r.contains(a)) return 0;
  switch (r.id) {
    case 'annulus': {
      const ts = [...circle([0, 0], 1), ...circle([0, 0], 2)].filter((t) => inT(t) && t > 0).sort((x, y) => x - y);
      return ts.length ? ts[0] : 1;
    }
    case 'punctured': {
      // the origin: A + tD = 0
      const t = dd === 0 ? 0 : -(A[0] * D[0] + A[1] * D[1]) / dd;
      return inT(t) ? t : 1;
    }
    case 'two-discs': {
      const k = discOf(a);
      const c = pt(DISC_CENTRES[k]);
      const ts = circle(c, 1).filter((t) => inT(t) && t > 0);
      return ts.length ? Math.max(...ts) : 1;
    }
    case 'line': {
      if (a[1] !== 0 || b[1] !== 0) return 0;
      const t = -A[0] / (B[0] - A[0]);
      return inT(t) ? t : 1;
    }
  }
  return 1;
}

/* ------------------------------------------------------------------ the topologist's sine curve */

/** the graph part: y = sin(1/x), 0 < x ≤ 1 */
export const sineG = (x: number) => Math.sin(1 / x);

/** the points x ∈ [x₀, 1] where sin(1/x) = ±1, largest first: x = 1/(π/2 + πk) */
export function peaks(x0: number): number[] {
  const out: number[] = [];
  for (let k = 0; ; k++) {
    const x = 1 / (Math.PI / 2 + Math.PI * k);
    if (x < x0) break;
    out.push(x);
  }
  return out;
}

/** the number of such points, by the closed formula ⌊(1/x₀ − π/2)/π⌋ + 1 (0 when 1/x₀ < π/2) */
export function peakCount(x0: number): number {
  const u = 1 / x0 - Math.PI / 2;
  return u < 0 ? 0 : Math.floor(u / Math.PI) + 1;
}

/** x_k = 1/(arcsin y + 2πk), k ≥ 1: a point of G at height y */
export function approach(y: number, k: number): number {
  return 1 / (Math.asin(y) + 2 * Math.PI * k);
}

/** the d₂-distance from (x, y), x ≥ 0 and |y| ≤ 1, to J = {0} × [−1, 1] */
export const distToJ = (x: number, y: number) => {
  if (Math.abs(y) <= 1) return Math.abs(x);
  return Math.hypot(x, Math.abs(y) - 1);
};

/** the least k ≥ 1 with approach(y, k) < tol */
export function firstK(y: number, tol: number): number {
  // approach(y, k) < tol ⇔ asin y + 2πk > 1/tol ⇔ k > (1/tol − asin y)/(2π)
  const k = Math.floor((1 / tol - Math.asin(y)) / (2 * Math.PI)) + 1;
  return Math.max(1, k);
}

/** the walker's slider runs over u = log₁₀ x ∈ [U_MIN, 0] */
export const U_MIN = -3;
export const U_STEP = 0.01;
export const xOfU = (u: number) => 10 ** u;
export const snapU = (u: number) => Math.max(U_MIN, Math.min(0, Math.round(u / U_STEP) * U_STEP));

/** the task "walk-close": the walker within this distance of J */
export const WALK_TOL = 0.01;
/** the task "approach": a graph point within this distance of the chosen point of J */
export const APPROACH_TOL = 0.01;
export const K_MAX = 40;
export const Y_STEP = 0.05;
export const snapY = (y: number) => Math.max(-1, Math.min(1, Math.round(y / Y_STEP) * Y_STEP)) + 0;

/** a number for a readout: 3 significant digits for small values, else up to 4 decimals */
export function fmt(v: number): string {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a < 1e-3) return v.toExponential(2).replace('e-', '·10⁻').replace(/\d+$/, (d) => sup(d));
  if (a < 0.1) return String(Number(v.toPrecision(3)));
  return String(Number(v.toFixed(4)));
}

const SUPS: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const sup = (s: string) => s.replace(/\d/g, (c) => SUPS[c]);
