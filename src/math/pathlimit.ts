/**
 * MODEL SPECIFICATION
 *
 * System:        five real functions of two variables near the origin, each defined on ℝ² ∖ {0} (lesson 5.1):
 *                  xy     xy/(x² + y²)            (טענה 5.1.8(א): constant m/(1 + m²) on the line y = mx)
 *                  parab  x²y/(x⁴ + y²)           (טענה 5.1.8(ב): 0 on every line, k/(1 + k²) on y = kx²)
 *                  x3     x³/(x² + y²)            (טענה 5.1.9: |f| ≤ |x| ≤ ρ)
 *                  x2y2   x²y²/(x² + y²)          (טענה 5.1.9: |f| ≤ ρ²/4)
 *                  alpha  |x|^α y/(x² + y²), α>0  (טענה 5.1.11: a limit at 0 exactly when α > 1)
 *                The candidate limit at the origin is L = 0 for all five.
 * Paths to 0:    γ(t) for t ∈ (0, 1], approaching the origin as t → 0⁺, never through it:
 *                  line      γ(t) = (s·t, s·m·t)      the ray of y = mx on the side s = ±1 (x > 0 or x < 0)
 *                  parabola  γ(t) = (s·t, k·t²)        the half of y = kx² on the side s
 *                The limit along a path, lim_{t→0⁺} f(γ(t)), is given in closed form (`pathLimit`): a number,
 *                or ±∞ when f(γ(t)) tends to ±∞ (no finite limit). Every closed form is a one-line computation that
 *                the lesson prints; tests/math/pathlimit.test.ts checks each against f(γ(t)) at small t.
 * Circles:       S(ρ) = sup{ |f(p) − L| : ‖p‖₂ = ρ }, the quantity of טענה 5.1.9(ב): lim f = L ⇔ S(ρ) → 0.
 *                Closed forms, with the point where the sup is attained (`circleArgmax`):
 *                  xy: 1/2 at θ = π/4;  parab: 1/2 where the circle meets y = x² (AM–GM: x⁴ + y² ≥ 2x²|y|);
 *                  x3: ρ at θ = 0;  x2y2: ρ²/4 at θ = π/4;
 *                  alpha: M(α)·ρ^{α−1} with M(α) = α^{α/2}/(1 + α)^{(1+α)/2}, at tan θ = 1/√α.
 * Ignored:       IEEE rounding (relative 1e-12). The figure samples finitely many ρ and t: what it shows is a
 *                probe, and the caption says so; the limits themselves are proved in the lesson.
 * Valid when:    0 < ρ ≤ 1, 0 < t ≤ 1, |m| ≤ 5, |k| ≤ 3, 0.5 ≤ α ≤ 3.
 *
 * Drives the figure of lesson 5.1 (PathLimit).
 */

import { fmtNum } from './contraction';

export { fmtNum };

export type PresetId = 'xy' | 'parab' | 'x3' | 'x2y2' | 'alpha';
export type PathKind = 'line' | 'parabola';
export type Side = 1 | -1;

export interface Path {
  kind: PathKind;
  /** slope of the line y = mx */
  m: number;
  /** coefficient of the parabola y = kx² */
  k: number;
  /** x > 0 (1) or x < 0 (−1) */
  side: Side;
}

export interface Preset {
  id: PresetId;
  /** the formula as the figure prints it (LTR) */
  formula: string;
  f: (x: number, y: number, alpha: number) => number;
  /** lim_{t→0⁺} f(γ(t)): a number, or ±∞ */
  pathLimit: (p: Path, alpha: number) => number;
  /** sup over the circle ‖p‖₂ = ρ of |f(p) − 0| */
  circleSup: (rho: number, alpha: number) => number;
  /** a point of the circle where the sup is attained */
  circleArgmax: (rho: number, alpha: number) => [number, number];
  /** |value| at which the shading saturates */
  scale: number;
}

export const M_MIN = -5;
export const M_MAX = 5;
export const K_MIN = -3;
export const K_MAX = 3;
export const RHO_MIN = 0.01;
export const RHO_MAX = 1;
export const ALPHA_MIN = 0.5;
export const ALPHA_MAX = 3;

/** M(α) = max_θ |cos θ|^α |sin θ| = α^{α/2}/(1 + α)^{(1+α)/2} (at tan²θ = 1/α). */
export function alphaConst(alpha: number): number {
  return alpha ** (alpha / 2) / (1 + alpha) ** ((1 + alpha) / 2);
}

/** The point (x, x²), x > 0, where the parabola y = x² meets the circle of radius ρ: x² = (√(1 + 4ρ²) − 1)/2. */
export function parabolaOnCircle(rho: number): [number, number] {
  // (√(1 + 4ρ²) − 1)/2 = 2ρ²/(√(1 + 4ρ²) + 1), the form without cancellation for small ρ
  const x2 = (2 * rho * rho) / (Math.sqrt(1 + 4 * rho * rho) + 1);
  return [Math.sqrt(x2), x2];
}

const r2 = (x: number, y: number) => x * x + y * y;
const D45 = Math.SQRT1_2;

export const PRESETS: Record<PresetId, Preset> = {
  xy: {
    id: 'xy',
    formula: 'xy/(x² + y²)',
    f: (x, y) => (x * y) / r2(x, y),
    // on y = mx: m x²/((1 + m²) x²); on y = kx²: k t/(1 + k² t²) → 0
    pathLimit: (p) => (p.kind === 'line' ? p.m / (1 + p.m * p.m) : 0),
    circleSup: () => 0.5,
    circleArgmax: (rho) => [rho * D45, rho * D45],
    scale: 0.5,
  },
  parab: {
    id: 'parab',
    formula: 'x²y/(x⁴ + y²)',
    f: (x, y) => (x * x * y) / (x ** 4 + y * y),
    // on y = mx: s·m t/(t² + m²) → 0 (and 0 when m = 0); on y = kx²: k t⁴/((1 + k²) t⁴) = k/(1 + k²)
    pathLimit: (p) => (p.kind === 'line' ? 0 : p.k / (1 + p.k * p.k)),
    circleSup: () => 0.5,
    circleArgmax: (rho) => parabolaOnCircle(rho),
    scale: 0.5,
  },
  x3: {
    id: 'x3',
    formula: 'x³/(x² + y²)',
    f: (x, y) => (x * x * x) / r2(x, y),
    pathLimit: () => 0,
    circleSup: (rho) => rho,
    circleArgmax: (rho) => [rho, 0],
    scale: 1,
  },
  x2y2: {
    id: 'x2y2',
    formula: 'x²y²/(x² + y²)',
    f: (x, y) => (x * x * y * y) / r2(x, y),
    pathLimit: () => 0,
    circleSup: (rho) => (rho * rho) / 4,
    circleArgmax: (rho) => [rho * D45, rho * D45],
    scale: 0.5,
  },
  alpha: {
    id: 'alpha',
    formula: '|x|^α y/(x² + y²)',
    f: (x, y, a) => (Math.abs(x) ** a * y) / r2(x, y),
    // on y = mx: s·m t^{α−1}/(1 + m²); on y = kx²: k t^α/(1 + k² t²) → 0 for every α > 0
    pathLimit: (p, a) => {
      if (p.kind === 'parabola' || p.m === 0) return 0;
      const c = (p.side * p.m) / (1 + p.m * p.m);
      if (a > 1) return 0;
      if (a === 1) return c;
      return c > 0 ? Infinity : -Infinity;
    },
    circleSup: (rho, a) => alphaConst(a) * rho ** (a - 1),
    circleArgmax: (rho, a) => [rho * Math.sqrt(a / (1 + a)), rho * Math.sqrt(1 / (1 + a))],
    scale: 1,
  },
};

export const PRESET_IDS: PresetId[] = ['xy', 'parab', 'x3', 'x2y2', 'alpha'];

/** γ(t) of the path. */
export function gamma(p: Path, t: number): [number, number] {
  const x = p.side * t;
  return p.kind === 'line' ? [x, p.m * x] : [x, p.k * t * t];
}

/** f(γ(t)). */
export function pathValue(pr: Preset, p: Path, t: number, alpha: number): number {
  const [x, y] = gamma(p, t);
  return pr.f(x, y, alpha);
}

/** The path of the given kind through the point (x, y) ≠ 0, clamped to the sliders' ranges. */
export function pathThrough(kind: PathKind, x: number, y: number): Path {
  const side: Side = x < 0 ? -1 : 1;
  const ax = Math.max(Math.abs(x), 1e-9);
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const round = (v: number) => Math.round(v * 100) / 100;
  return {
    kind,
    side,
    m: kind === 'line' ? round(clamp(y / (side * ax), M_MIN, M_MAX)) : 0,
    k: kind === 'parabola' ? round(clamp(y / (ax * ax), K_MIN, K_MAX)) : 0,
  };
}

/** The path as the figure prints it (LTR). */
export function describePath(p: Path): string {
  const side = p.side > 0 ? 'x > 0' : 'x < 0';
  if (p.kind === 'line') return `y = ${fmtNum(p.m)}·x,  ${side}`;
  return `y = ${fmtNum(p.k)}·x²,  ${side}`;
}
