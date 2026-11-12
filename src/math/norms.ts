/**
 * MODEL SPECIFICATION
 *
 * System:        the plane ℝ² with the p-norm ‖x‖_p = (|x₁|^p + |x₂|^p)^{1/p} for 1 ≤ p < ∞ and
 *                ‖x‖_∞ = max(|x₁|, |x₂|) (pNorm in multivar.ts). The p values the figure offers are the fixed list
 *                P_VALUES, which contains 1, 2 and ∞ exactly.
 * Dynamics:      none; closed formulas for the unit sphere and the two sides of the parallelogram law.
 * Boundary:      the unit sphere {‖x‖_p = 1} is drawn from the ray parametrisation u(θ)/‖u(θ)‖_p with
 *                u(θ) = (cos θ, sin θ): every returned point has p-norm 1 up to rounding. For p = 1 and p = ∞ the
 *                sphere is a polygon and `unitSphere` returns its exact vertices instead of samples.
 * Ignored:       IEEE rounding (relative 1e-15); `lawHolds` compares the two sides by relative error 1e-9, so
 *                a failure smaller than that would be reported as "holds". The tests check that the failures the
 *                lesson uses are far larger (at (1,0), (0,1) the smallest, p = 1.5 and p = 3, is about 21 % relative).
 * Valid when:    p ≥ 1 (for p < 1 the formula is not a norm: the triangle inequality fails; pNorm throws).
 * Failure modes: none known for the stated range.
 *
 * The figure of lesson 1.2 (UnitBalls) draws from here. That the law holds for p = 2 and every pair is a theorem
 * (expanding the inner product); the figure checks one pair at a time and is evidence only.
 */

import { pNorm } from './multivar';
import { relativeError } from './vec';

export type V2 = readonly [number, number];

/** The p values on the figure's slider, from 1 to ∞. */
export const P_VALUES: readonly number[] = [1, 1.25, 1.5, 2, 3, 4, 6, 10, Infinity];

export const norm = (v: V2, p: number): number => pNorm(v, p);

/** Points of the unit sphere {‖x‖_p = 1}, closed (first point repeated at the end). */
export function unitSphere(p: number, samples = 720): V2[] {
  if (p === 1) return [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 0]];
  if (p === Infinity) return [[1, 1], [-1, 1], [-1, -1], [1, -1], [1, 1]];
  const out: V2[] = [];
  for (let k = 0; k <= samples; k++) {
    const t = (2 * Math.PI * k) / samples;
    const u: V2 = [Math.cos(t), Math.sin(t)];
    const n = pNorm(u, p);
    out.push([u[0] / n, u[1] / n]);
  }
  return out;
}

/** The two sides of the parallelogram law for ‖·‖_p: lhs = ‖x+y‖² + ‖x−y‖², rhs = 2‖x‖² + 2‖y‖². */
export function parallelogramSides(x: V2, y: V2, p: number): { lhs: number; rhs: number } {
  const s = norm([x[0] + y[0], x[1] + y[1]], p);
  const d = norm([x[0] - y[0], x[1] - y[1]], p);
  return { lhs: s * s + d * d, rhs: 2 * norm(x, p) ** 2 + 2 * norm(y, p) ** 2 };
}

/** Does the parallelogram law hold for this pair (equal up to rounding)? */
export function lawHolds(x: V2, y: V2, p: number): boolean {
  const { lhs, rhs } = parallelogramSides(x, y, p);
  if (rhs === 0) return lhs === 0;
  return relativeError(lhs, rhs) < 1e-9;
}

/* ------------------------------------------------------------------------------------------------------------------
 * Lesson 3.5 (equivalence of norms): a few norms on the plane and the best constants between each of them and ‖·‖₂.
 *
 * MODEL SPECIFICATION (this part)
 *
 * System:        a norm N on ℝ² from the fixed list PLANE_NORMS:
 *                  l1     ‖x‖₁ = |x₁| + |x₂|
 *                  linf   ‖x‖∞ = max(|x₁|, |x₂|)
 *                  hex    N(x) = max(|x₁|, |x₂|, |x₁ − x₂|)      (unit ball: a hexagon)
 *                  linear N(x) = ‖Ax‖₂ with A = [[1, 1], [0, 2]], i.e. N(x, y) = ‖(x + y, 2y)‖₂ (unit ball: an ellipse)
 *                The best constants in m‖x‖₂ ≤ N(x) ≤ M‖x‖₂ are m = min N and M = max N on the Euclidean unit circle S.
 * Dynamics:      none.
 * Computation:   `sphereExtremes` samples N on S at `samples` equally spaced angles (a multiple of 8, so the angles
 *                kπ/4 where the polygon norms take their extremes are sampled exactly), then refines the best sample of
 *                each kind by a ternary search on the neighbouring bracket. This is a probe: the exact values are proved
 *                in the lesson (l1: 1 and √2; linf: 1/√2 and 1, theorem 1.7.3; hex: 1/√2 and √2; linear: the singular
 *                values √(3 ∓ √5) = (√5 ∓ 1)/√2 of A, by the spectral theorem) and stored in `exact`; the tests check
 *                that the probe agrees with them to relative 1e-9.
 * Boundary:      `normSphere` returns the boundary {N = 1} of the unit ball of N: exact vertices for the polygon norms,
 *                otherwise the ray parametrisation u(θ)/N(u(θ)).
 * Ignored:       IEEE rounding (relative 1e-15).
 * Valid when:    always (each N is a norm: proved in the lesson and its examples).
 * Failure modes: a ternary search on a bracket where N∘u is not unimodal would stop at a local extremum; the brackets
 *                are one sampling step wide on each side of the best sample, and for these four norms N∘u is
 *                unimodal there (each is a maximum of finitely many |linear| or the square root of a quadratic form).
 * ---------------------------------------------------------------------------------------------------------------- */

export type PlaneNormId = 'l1' | 'linf' | 'hex' | 'linear';

export interface PlaneNorm {
  id: PlaneNormId;
  /** the formula as plain text (LTR), for the figure's buttons and readouts */
  formula: string;
  value: (v: V2) => number;
  /** exact best constants m = min_S N, M = max_S N (proved in lesson 3.5) */
  exact: { m: number; M: number };
  /** the vertices of the unit ball, closed, for a polygon norm */
  vertices?: V2[];
}

const SQ5 = Math.sqrt(5);

export const PLANE_NORMS: Record<PlaneNormId, PlaneNorm> = {
  l1: {
    id: 'l1',
    formula: '‖x‖₁',
    value: (v) => Math.abs(v[0]) + Math.abs(v[1]),
    exact: { m: 1, M: Math.SQRT2 },
    vertices: [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 0]],
  },
  linf: {
    id: 'linf',
    formula: '‖x‖∞',
    value: (v) => Math.max(Math.abs(v[0]), Math.abs(v[1])),
    exact: { m: Math.SQRT1_2, M: 1 },
    vertices: [[1, 1], [-1, 1], [-1, -1], [1, -1], [1, 1]],
  },
  hex: {
    id: 'hex',
    formula: 'max(|x₁|, |x₂|, |x₁ − x₂|)',
    value: (v) => Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[0] - v[1])),
    exact: { m: Math.SQRT1_2, M: Math.SQRT2 },
    vertices: [[1, 0], [1, 1], [0, 1], [-1, 0], [-1, -1], [0, -1], [1, 0]],
  },
  linear: {
    id: 'linear',
    formula: '‖(x₁ + x₂, 2x₂)‖₂',
    value: (v) => Math.hypot(v[0] + v[1], 2 * v[1]),
    exact: { m: (SQ5 - 1) / Math.SQRT2, M: (SQ5 + 1) / Math.SQRT2 },
  },
};

export const PLANE_NORM_IDS: readonly PlaneNormId[] = ['l1', 'linf', 'hex', 'linear'];

/** The boundary {N = 1} of the unit ball of N, closed (first point repeated at the end). */
export function normSphere(id: PlaneNormId, samples = 720): V2[] {
  const N = PLANE_NORMS[id];
  if (N.vertices) return N.vertices.map((q) => [q[0], q[1]] as V2);
  const out: V2[] = [];
  for (let k = 0; k <= samples; k++) {
    const t = (2 * Math.PI * k) / samples;
    const u: V2 = [Math.cos(t), Math.sin(t)];
    const n = N.value(u);
    out.push([u[0] / n, u[1] / n]);
  }
  return out;
}

const onCircle = (t: number): V2 => [Math.cos(t), Math.sin(t)];

/** ternary search for the extremum of g on [a, b] (g unimodal there); kind 1 = maximum, −1 = minimum */
function refine(g: (t: number) => number, a: number, b: number, kind: 1 | -1): number {
  for (let i = 0; i < 200 && b - a > 1e-15; i++) {
    const t1 = a + (b - a) / 3;
    const t2 = b - (b - a) / 3;
    if (kind * g(t1) < kind * g(t2)) a = t1;
    else b = t2;
  }
  return (a + b) / 2;
}

export interface Extremes {
  /** min of N on the Euclidean unit circle, and a point of the circle where it is attained */
  m: number;
  argMin: V2;
  /** max of N on the Euclidean unit circle, and a point where it is attained */
  M: number;
  argMax: V2;
}

/** A probe of m = min_S N and M = max_S N: sample, then refine (see the model specification). */
export function sphereExtremes(id: PlaneNormId, samples = 3600): Extremes {
  if (samples % 8 !== 0) throw new Error('sphereExtremes: samples must be a multiple of 8');
  const N = PLANE_NORMS[id];
  const g = (t: number) => N.value(onCircle(t));
  const h = (2 * Math.PI) / samples;
  let kMin = 0;
  let kMax = 0;
  for (let k = 1; k < samples; k++) {
    if (g(k * h) < g(kMin * h)) kMin = k;
    if (g(k * h) > g(kMax * h)) kMax = k;
  }
  const tMin = refine(g, (kMin - 1) * h, (kMin + 1) * h, -1);
  const tMax = refine(g, (kMax - 1) * h, (kMax + 1) * h, 1);
  // keep the sampled point if the refinement did not improve it (a kink exactly at a sample)
  const [m, aMin] = g(tMin) <= g(kMin * h) ? [g(tMin), tMin] : [g(kMin * h), kMin * h];
  const [M, aMax] = g(tMax) >= g(kMax * h) ? [g(tMax), tMax] : [g(kMax * h), kMax * h];
  return { m, argMin: onCircle(aMin), M, argMax: onCircle(aMax) };
}

/** Is the closed Euclidean disc of radius r inside the closed unit ball of N? Exactly when r·M ≤ 1. */
export const discInsideBall = (r: number, M: number): boolean => r * M <= 1 + 1e-12;

/** Does the closed Euclidean disc of radius r contain the closed unit ball of N? Exactly when r·m ≥ 1. */
export const discContainsBall = (r: number, m: number): boolean => r * m >= 1 - 1e-12;
