/**
 * MODEL SPECIFICATION
 *
 * System:        a real C¹ function f on ℝ² (a preset), a point a = (a₁, a₂) and a unit vector
 *                v = (cos θ, sin θ), θ in degrees. The presets, each with its gradient in closed form:
 *                  xy      f = xy,          ∇f = (y, x)                 (משפט 5.4.6: at (4,3) the maximal rate is 5)
 *                  ellipse f = x² + 4y²,    ∇f = (2x, 8y)               (משפט 5.4.8: at (2,1) ∇f = (4,8) ⊥ (2,−1))
 *                  saddle  f = x² − y²,     ∇f = (2x, −2y)              (∇f(0) = 0: every D_v f(0) = 0)
 *                  wave    f = y − sin x,   ∇f = (−cos x, 1)            (curved level curves y = sin x + c; ∇f ≠ 0)
 *                All four are polynomials or compositions of C^∞ functions, so they are C¹ on ℝ² (מסקנה 5.4.3) and
 *                differentiable at every point: D_v f(a) = ∇f(a)·v (משפט 5.4.6), which as a function of θ is
 *                ‖∇f(a)‖₂·cos(θ − φ), φ the direction of ∇f(a).
 *                Lesson 5.4's other closed forms: the counterexample of טענה 5.4.4,
 *                  g(x, y) = (x² + y²)·sin(1/√(x² + y²)), g(0) = 0,
 *                  ∂ₓg(x, 0) = 2x·sin(1/|x|) − sgn(x)·cos(1/|x|)  (x ≠ 0),
 *                and the three velocities of the cone of טענה 5.4.11.
 * Numbers:       everything the figure prints is evaluated from the closed forms above (no finite differences); the
 *                angles are in degrees, the steepest direction is atan2 of the gradient.
 * Ignored:       IEEE rounding (relative 1e-15 in the closed forms).
 * Valid when:    a in the preset's window; the gradient direction is undefined where ∇f(a) = 0, and the functions
 *                return null there.
 *
 * Drives the figure of lesson 5.4 (GradientField). A numerical probe never proves: the theorems are proved in the
 * lesson, and tests/math/gradient2d.test.ts checks the closed forms against finite differences and the identities the
 * lesson states.
 */

import { fmtNum } from './contraction';

export { fmtNum };

export type V2 = readonly [number, number];
export type PresetId = 'xy' | 'ellipse' | 'saddle' | 'wave';

export interface Preset {
  id: PresetId;
  /** the formula as the figure prints it (LTR) */
  formula: string;
  f: (x: number, y: number) => number;
  grad: (x: number, y: number) => V2;
  /** the window [−w, w]² drawn */
  half: number;
  /** spacing of the drawn level curves */
  step: number;
  /** the gradient arrow is drawn as ∇f(a)·scale, so that it fits the window */
  scale: number;
}

export const PRESETS: Record<PresetId, Preset> = {
  xy: { id: 'xy', formula: 'f = xy', f: (x, y) => x * y, grad: (x, y) => [y, x], half: 5, step: 3, scale: 0.4 },
  ellipse: { id: 'ellipse', formula: 'f = x² + 4y²', f: (x, y) => x * x + 4 * y * y, grad: (x, y) => [2 * x, 8 * y], half: 3.5, step: 2, scale: 0.15 },
  saddle: { id: 'saddle', formula: 'f = x² − y²', f: (x, y) => x * x - y * y, grad: (x, y) => [2 * x, -2 * y], half: 3, step: 1, scale: 0.3 },
  wave: { id: 'wave', formula: 'f = y − sin x', f: (x, y) => y - Math.sin(x), grad: (x) => [-Math.cos(x), 1], half: 4, step: 0.5, scale: 1 },
};

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];

/** a point of the window is snapped to this grid, so that (4, 3) and (2, 1) are reached exactly */
export const GRID = 0.1;
export const snap = (v: number, half: number) => Math.min(half, Math.max(-half, Math.round(v / GRID) / Math.round(1 / GRID)));

const DEG = Math.PI / 180;
export const unit = (deg: number): V2 => [Math.cos(deg * DEG), Math.sin(deg * DEG)];
export const dot = (a: V2, b: V2) => a[0] * b[0] + a[1] * b[1];
export const norm2 = (a: V2) => Math.hypot(a[0], a[1]);

/** D_v f(a) = ∇f(a)·v for v = (cos θ, sin θ) (משפט 5.4.6; f is differentiable) */
export const rate = (p: Preset, a: V2, deg: number) => dot(p.grad(a[0], a[1]), unit(deg));

/** below this ‖∇f(a)‖₂ the figure treats the gradient as 0 (the presets vanish exactly, on the grid) */
export const ZERO = 1e-12;

/** the direction of ∇f(a), in degrees in [0, 360); null where ∇f(a) = 0 */
export function steepestDeg(g: V2): number | null {
  if (norm2(g) < ZERO) return null;
  return ((Math.atan2(g[1], g[0]) / DEG) % 360 + 360) % 360;
}

/** the angle between two directions, in degrees in [0, 180] */
export function gapDeg(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(d, 360 - d);
}

/** the unit tangent of the level curve through a: ∇f(a) turned by +90°, normalised; null where ∇f(a) = 0 */
export function tangentDir(g: V2): V2 | null {
  const n = norm2(g);
  return n < ZERO ? null : [-g[1] / n, g[0] / n];
}

/** the readout's verdict for the direction θ at a */
export type Verdict = 'zero' | 'steepest' | 'descent' | 'level' | 'other';
export const TOL_DEG = 3;
export function verdict(g: V2, deg: number, tol = TOL_DEG): Verdict {
  const phi = steepestDeg(g);
  if (phi === null) return 'zero';
  const gap = gapDeg(deg, phi);
  if (gap <= tol) return 'steepest';
  if (gap >= 180 - tol) return 'descent';
  if (Math.abs(gap - 90) <= tol) return 'level';
  return 'other';
}

/* ---------------- טענה 5.4.4: differentiable and not C¹ */

/** g(x, y) = (x² + y²)·sin(1/√(x² + y²)), g(0, 0) = 0 */
export function rSin(x: number, y: number): number {
  const r2 = x * x + y * y;
  return r2 === 0 ? 0 : r2 * Math.sin(1 / Math.sqrt(r2));
}

/** ∂ₓg at (x, y) ≠ 0: 2x·sin(1/ρ) − (x/ρ)·cos(1/ρ), ρ = √(x² + y²); 0 at the origin (computed from the definition) */
export function rSinDx(x: number, y: number): number {
  const r = Math.hypot(x, y);
  if (r === 0) return 0;
  return 2 * x * Math.sin(1 / r) - (x / r) * Math.cos(1 / r);
}

/* ---------------- טענה 5.4.11: the cone x² + y² − z² = 0 */

/** the velocity at t = 0 of t ↦ t(cos φ, sin φ, 1), a curve in the cone through 0 */
export const coneVelocity = (phi: number): [number, number, number] => [Math.cos(phi), Math.sin(phi), 1];

/** a 3×3 determinant by the rule of Sarrus */
export function det3(u: readonly number[], v: readonly number[], w: readonly number[]): number {
  return u[0] * (v[1] * w[2] - v[2] * w[1]) - u[1] * (v[0] * w[2] - v[2] * w[0]) + u[2] * (v[0] * w[1] - v[1] * w[0]);
}

/** the figure's accessible description */
export function describe(p: Preset, a: V2, deg: number): string {
  const g = p.grad(a[0], a[1]);
  const v = unit(deg);
  const n = norm2(g);
  const r = (t: number) => fmtNum(Number(t.toPrecision(4)));
  const base = `${p.formula}, a = (${r(a[0])}, ${r(a[1])}), f(a) = ${r(p.f(a[0], a[1]))}, ∇f(a) = (${r(g[0])}, ${r(g[1])}), ‖∇f(a)‖ = ${r(n)}. v בזווית ${Math.round(deg)}°, D_v f(a) = ${r(dot(g, v))}.`;
  const vd = verdict(g, deg);
  const tail =
    vd === 'zero'
      ? ' הגרדיאנט מתאפס: כל הנגזרות הכיווניות 0.'
      : vd === 'steepest'
        ? ' v בכיוון הגרדיאנט: העלייה המהירה ביותר.'
        : vd === 'descent'
          ? ' v נגד הגרדיאנט: הירידה המהירה ביותר.'
          : vd === 'level'
            ? ' v ניצב לגרדיאנט: בכיוון המשיק לקו הגובה.'
            : '';
  return base + tail;
}
