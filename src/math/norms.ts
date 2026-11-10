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
