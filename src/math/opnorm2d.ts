/**
 * MODEL SPECIFICATION
 *
 * System:        a linear map A: ℝ² → ℝ² (a 2×2 matrix), with the same p-norm, p ∈ {1, 2, ∞}, on the domain
 *                and on the target. The unit sphere S_p = {x : ‖x‖_p = 1} is a diamond (p = 1), a circle (p = 2)
 *                or a square (p = ∞).
 * Dynamics:      none; closed formulas for the operator norm ‖A‖_op = sup_{‖x‖_p ≤ 1} ‖Ax‖_p and a unit vector
 *                where the supremum is attained.
 * Boundary:      p = 1 and p = ∞: x ↦ ‖Ax‖_p is convex, so its maximum over the unit ball (a polygon) is at a
 *                vertex: ±e₁, ±e₂ for p = 1 (the largest column sum), (±1, ±1) for p = ∞ (the largest row sum).
 *                p = 2: ‖Ax‖₂² = xᵀ(AᵀA)x ≤ λ_max‖x‖₂² by the spectral theorem, with equality at a unit
 *                eigenvector of λ_max, found here in closed form for the symmetric 2×2 matrix AᵀA.
 * Ignored:       other norms, other dimensions; IEEE rounding (results agree with multivar.opNorm to ~1e-15).
 * Valid when:    the entries are finite. For A = 0 every unit vector is a maximiser; e₁ is returned.
 * Failure modes: none known; when AᵀA is a multiple of the identity (a rotation, say) every direction is a
 *                maximiser and the returned one is e₁.
 *
 * The figure of lesson 1.7 (OperatorNorm) draws from here. The figure shows one direction at a time: the lesson
 * proves the formulas, and tests/math/opnorm2d.test.ts checks them against sampling of the sphere.
 */

import { opNorm, pNorm, type Mat } from './multivar';

export type P = 1 | 2 | typeof Infinity;
export type V2 = [number, number];

export const apply = (A: Mat, x: readonly number[]): V2 => [A[0][0] * x[0] + A[0][1] * x[1], A[1][0] * x[0] + A[1][1] * x[1]];

/** The point of the unit p-sphere on the ray at angle θ from the origin. */
export function spherePoint(p: P, theta: number): V2 {
  const u: V2 = [Math.cos(theta), Math.sin(theta)];
  const n = pNorm(u, p);
  return [u[0] / n, u[1] / n];
}

/** ‖Ax‖_p / ‖x‖_p for x ≠ 0: how much A stretches x, measured in the p-norm. */
export const stretch = (A: Mat, x: readonly number[], p: P): number => pNorm(apply(A, x), p) / pNorm(x, p);

/** A unit vector (in the p-norm) where ‖Ax‖_p = ‖A‖_op. */
export function maximiser(A: Mat, p: P): V2 {
  const cands: V2[] =
    p === 1
      ? [[1, 0], [0, 1]]
      : p === Infinity
        ? [[1, 1], [1, -1]]
        : [eigTop(A)];
  // ±x give the same value: keep the first candidate with the largest image norm
  let best = cands[0];
  for (const c of cands) if (pNorm(apply(A, c), p) > pNorm(apply(A, best), p)) best = c;
  return best;
}

/** A unit eigenvector of the largest eigenvalue of the symmetric matrix AᵀA. */
function eigTop(A: Mat): V2 {
  const a = A[0][0] ** 2 + A[1][0] ** 2;
  const b = A[0][0] * A[0][1] + A[1][0] * A[1][1];
  const c = A[0][1] ** 2 + A[1][1] ** 2;
  const lam = (a + c) / 2 + Math.hypot((a - c) / 2, b);
  let v: V2;
  if (Math.abs(b) > 1e-14 * Math.max(1, lam)) v = [b, lam - a];
  else v = a >= c ? [1, 0] : [0, 1];
  const n = Math.hypot(v[0], v[1]);
  return [v[0] / n, v[1] / n];
}

/** The three operator norms of A, from multivar.opNorm (the closed formulas). */
export const norms = (A: Mat) => ({ one: opNorm(A, 1), two: opNorm(A, 2), inf: opNorm(A, Infinity) });

/**
 * The image A(S_p) of the unit sphere as a closed polygon. For p = 1 and ∞ the sphere is a polygon and its image
 * is exactly the polygon of the vertices' images; for p = 2 the ellipse is sampled at n points.
 */
export function imageOutline(A: Mat, p: P, n = 240): V2[] {
  if (p === 1) return ([[1, 0], [0, 1], [-1, 0], [0, -1]] as V2[]).map((v) => apply(A, v));
  if (p === Infinity) return ([[1, 1], [-1, 1], [-1, -1], [1, -1]] as V2[]).map((v) => apply(A, v));
  return Array.from({ length: n }, (_, k) => apply(A, spherePoint(2, (2 * Math.PI * k) / n)));
}

/** The vertices of the unit p-sphere (a closed polygon for p = 1, ∞; sampled circle for p = 2), scaled by r. */
export function sphereOutline(p: P, r = 1, n = 240): V2[] {
  if (p === 1) return [[r, 0], [0, r], [-r, 0], [0, -r]];
  if (p === Infinity) return [[r, r], [-r, r], [-r, -r], [r, -r]];
  return Array.from({ length: n }, (_, k) => [r * Math.cos((2 * Math.PI * k) / n), r * Math.sin((2 * Math.PI * k) / n)] as V2);
}

/** The matrices the figure offers. */
export const MATRICES = {
  /** upper triangular: every eigenvalue is 1, yet ‖A‖₂ = (1 + √5)/2 */
  tri: [[1, 1], [0, 1]],
  /** diagonal: stretches e₁ by 2, shrinks e₂ by ½ */
  diag: [[2, 0], [0, 0.5]],
  /** a rotation by 90°: ‖Ax‖₂ = ‖x‖₂, every direction is a maximiser in the 2-norm */
  rot: [[0, -1], [1, 0]],
  /** the bank's example: ‖A‖₁ = 6, ‖A‖∞ = 7, ‖A‖₂ ≈ 5.465 */
  gen: [[1, 2], [3, 4]],
} as const satisfies Record<string, Mat>;
export type MatrixId = keyof typeof MATRICES;
