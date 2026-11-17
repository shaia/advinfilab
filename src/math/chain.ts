/**
 * MODEL SPECIFICATION
 *
 * System:        a real function f on ℝ² and a parametrised curve γ in ℝ², and the composition φ(t) = f(γ(t)).
 *                Functions (with their gradients in closed form):
 *                  T       x² − xy + y            ∇ = (2x − y, 1 − x)
 *                  saddle  x² − y²                ∇ = (2x, −2y)
 *                  xy2     xy²                    ∇ = (y², 2xy)
 *                  x3      x³/(x² + y²), 0 at 0   ∇ = (x²(x² + 3y²), −2x³y)/(x² + y²)² off 0; partials (1, 0) at 0
 *                  x2y     x²y/(x² + y²), 0 at 0  ∇ = (2xy³, x²(x² − y²))/(x² + y²)² off 0; partials (0, 0) at 0
 *                The last two are continuous, C¹ away from 0, and not differentiable at 0 (טענה 5.3.9(ב), טענה 5.5.8(א)):
 *                there "∇f(0)" is the vector of partial derivatives (הגדרה 5.4.5), which exists, and the chain-rule
 *                number ∇f(γ(t))·γ′(t) need not be the derivative of f∘γ.
 *                Curves (with their velocities in closed form):
 *                  line    γ(t) = b + t(1, m),          t ∈ [−2, 2]      (the base point b and the slope m are parameters)
 *                  circle  γ(θ) = (r cos θ, r sin θ),   θ ∈ [0, 2π]      (then f∘γ = g(r, ·) of טענה 5.5.4, slope ∂_θ g)
 *                  cubic   γ(t) = (t², t³),             t ∈ [−1.4, 1.4]
 *                  exp     γ(t) = (eᵗ, 1 + 2t),         t ∈ [−1.5, 1]
 * Chain rule:    chainRate = ∇f(γ(t))·γ′(t) (מסקנה 5.5.3, למה 5.4.7), exact for the closed forms above.
 *                quotientRate = (φ(t + h) − φ(t − h))/(2h) with h = 1e-5: a numerical probe of φ′(t), independent of the
 *                chain rule, that the figure shows beside it. Where f is differentiable at γ(t) the two agree to the
 *                probe's accuracy (≈ h² times φ‴); at a point where f is not differentiable they may disagree, and the
 *                figure shows exactly that. A probe never proves: the lesson proves 5.5.1.
 * Polar:         polarDerivs(f, r, θ) = (cos θ ∂ₓf + sin θ ∂ᵧf, −r sin θ ∂ₓf + r cos θ ∂ᵧf) at (r cos θ, r sin θ) (5.5.4).
 * Tangency:      tangencyCos = ∇f·γ′ / (‖∇f‖‖γ′‖), the cosine of the angle between them; 0 means γ′ is tangent to the
 *                level curve through γ(t) (משפט 5.4.8). Undefined (NaN) when either vector is shorter than 1e-9.
 * Window:        fitWindow returns a box with equal scales on both axes that contains the curve, for the figure.
 * Ignored:       IEEE rounding.
 * Valid when:    the parameters stay in the figure's ranges (|m| ≤ 3, 0.25 ≤ r ≤ 2.5, |b| ≤ 2).
 *
 * Drives the figure of lesson 5.5 (CurveOnLevels). tests/math/chain.test.ts checks the numbers the lesson quotes.
 */

import { fmtNum } from './contraction';
import type { Vec2 } from './vec';

export { fmtNum };

export type FuncId = 'T' | 'saddle' | 'xy2' | 'x3' | 'x2y';
export type CurveId = 'line' | 'circle' | 'cubic' | 'exp';

export interface Func {
  id: FuncId;
  /** the formula as the figure prints it (LTR) */
  formula: string;
  f: (x: number, y: number) => number;
  /** the vector of partial derivatives; the gradient wherever f is differentiable */
  grad: (x: number, y: number) => Vec2;
  /** differentiable on all of ℝ² */
  smooth: boolean;
  /** spacing of the drawn level curves */
  levelStep: number;
}

export interface CurveParams {
  /** the slope of the line's direction (1, m) */
  m: number;
  /** the radius of the circle */
  r: number;
  /** the line's base point γ(0) */
  base: Vec2;
}

export interface Curve {
  id: CurveId;
  formula: (p: CurveParams) => string;
  /** the parameter's name as printed: t, or θ on the circle */
  param: 't' | 'θ';
  domain: readonly [number, number];
  gamma: (t: number, p: CurveParams) => Vec2;
  velocity: (t: number, p: CurveParams) => Vec2;
}

const r2 = (x: number, y: number) => x * x + y * y;

export const FUNCS: Record<FuncId, Func> = {
  T: {
    id: 'T',
    formula: 'f = x² − xy + y',
    f: (x, y) => x * x - x * y + y,
    grad: (x, y) => [2 * x - y, 1 - x],
    smooth: true,
    levelStep: 1,
  },
  saddle: {
    id: 'saddle',
    formula: 'f = x² − y²',
    f: (x, y) => x * x - y * y,
    grad: (x, y) => [2 * x, -2 * y],
    smooth: true,
    levelStep: 1,
  },
  xy2: {
    id: 'xy2',
    formula: 'f = xy²',
    f: (x, y) => x * y * y,
    grad: (x, y) => [y * y, 2 * x * y],
    smooth: true,
    levelStep: 1,
  },
  x3: {
    id: 'x3',
    formula: 'f = x³/(x² + y²)',
    f: (x, y) => {
      const q = r2(x, y);
      return q === 0 ? 0 : (x * x * x) / q;
    },
    grad: (x, y) => {
      const q = r2(x, y);
      if (q === 0) return [1, 0];
      return [(x * x * (x * x + 3 * y * y)) / (q * q), (-2 * x * x * x * y) / (q * q)];
    },
    smooth: false,
    levelStep: 0.5,
  },
  x2y: {
    id: 'x2y',
    formula: 'f = x²y/(x² + y²)',
    f: (x, y) => {
      const q = r2(x, y);
      return q === 0 ? 0 : (x * x * y) / q;
    },
    grad: (x, y) => {
      const q = r2(x, y);
      if (q === 0) return [0, 0];
      return [(2 * x * y * y * y) / (q * q), (x * x * (x * x - y * y)) / (q * q)];
    },
    smooth: false,
    levelStep: 0.25,
  },
};

const coord = (v: number) => fmtNum(Number(v.toPrecision(3)));

export const CURVES: Record<CurveId, Curve> = {
  line: {
    id: 'line',
    formula: (p) => {
      const [b1, b2] = p.base;
      const mt = p.m === 0 ? '' : p.m === 1 ? 't' : p.m === -1 ? '−t' : `${coord(p.m)}t`;
      const x = b1 === 0 ? 't' : `${coord(b1)} + t`;
      const y = b2 === 0 ? mt || '0' : mt === '' ? coord(b2) : mt.startsWith('−') ? `${coord(b2)} − ${mt.slice(1)}` : `${coord(b2)} + ${mt}`;
      return `γ(t) = (${x}, ${y})`;
    },
    param: 't',
    domain: [-2, 2],
    gamma: (t, p) => [p.base[0] + t, p.base[1] + p.m * t],
    velocity: (_t, p) => [1, p.m],
  },
  circle: {
    id: 'circle',
    formula: (p) => `γ(θ) = (${coord(p.r)} cos θ, ${coord(p.r)} sin θ)`,
    param: 'θ',
    domain: [0, 2 * Math.PI],
    gamma: (t, p) => [p.r * Math.cos(t), p.r * Math.sin(t)],
    velocity: (t, p) => [-p.r * Math.sin(t), p.r * Math.cos(t)],
  },
  cubic: {
    id: 'cubic',
    formula: () => 'γ(t) = (t², t³)',
    param: 't',
    domain: [-1.4, 1.4],
    gamma: (t) => [t * t, t * t * t],
    velocity: (t) => [2 * t, 3 * t * t],
  },
  exp: {
    id: 'exp',
    formula: () => 'γ(t) = (eᵗ, 1 + 2t)',
    param: 't',
    domain: [-1.5, 1],
    gamma: (t) => [Math.exp(t), 1 + 2 * t],
    velocity: (t) => [Math.exp(t), 2],
  },
};

const dot = (a: Vec2, b: Vec2) => a[0] * b[0] + a[1] * b[1];
const len = (a: Vec2) => Math.hypot(a[0], a[1]);

/** φ(t) = f(γ(t)) */
export function composite(F: Func, C: Curve, t: number, p: CurveParams): number {
  const [x, y] = C.gamma(t, p);
  return F.f(x, y);
}

/** ∇f(γ(t))·γ′(t): the derivative of f∘γ by the chain rule, when f is differentiable at γ(t) */
export function chainRate(F: Func, C: Curve, t: number, p: CurveParams): number {
  const [x, y] = C.gamma(t, p);
  return dot(F.grad(x, y), C.velocity(t, p));
}

/** the symmetric difference quotient of φ at t: a probe of φ′(t) that does not use the chain rule */
export function quotientRate(F: Func, C: Curve, t: number, p: CurveParams, h = 1e-5): number {
  return (composite(F, C, t + h, p) - composite(F, C, t - h, p)) / (2 * h);
}

/** cos of the angle between ∇f(γ(t)) and γ′(t); NaN when either is (numerically) zero */
export function tangencyCos(F: Func, C: Curve, t: number, p: CurveParams): number {
  const [x, y] = C.gamma(t, p);
  const g = F.grad(x, y);
  const v = C.velocity(t, p);
  const lg = len(g);
  const lv = len(v);
  if (lg < 1e-9 || lv < 1e-9) return NaN;
  return dot(g, v) / (lg * lv);
}

/** ∂_r g and ∂_θ g for g(r, θ) = f(r cos θ, r sin θ), by the chain rule (טענה 5.5.4) */
export function polarDerivs(F: Func, r: number, th: number): { dr: number; dth: number } {
  const x = r * Math.cos(th);
  const y = r * Math.sin(th);
  const [fx, fy] = F.grad(x, y);
  return { dr: Math.cos(th) * fx + Math.sin(th) * fy, dth: -r * Math.sin(th) * fx + r * Math.cos(th) * fy };
}

/** ∂ₓf and ∂ᵧf recovered from ∂_r g, ∂_θ g (r > 0): the inverse formulas of טענה 5.5.4 */
export function cartesianFromPolar(dr: number, dth: number, r: number, th: number): Vec2 {
  return [Math.cos(th) * dr - (Math.sin(th) / r) * dth, Math.sin(th) * dr + (Math.cos(th) / r) * dth];
}

export interface Box {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

/** the bounding box of the curve over its parameter domain (sampled at n + 1 points) */
export function curveBox(C: Curve, p: CurveParams, n = 400): Box {
  const [lo, hi] = C.domain;
  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (let i = 0; i <= n; i++) {
    const [x, y] = C.gamma(lo + ((hi - lo) * i) / n, p);
    xmin = Math.min(xmin, x);
    xmax = Math.max(xmax, x);
    ymin = Math.min(ymin, y);
    ymax = Math.max(ymax, y);
  }
  return { xmin, xmax, ymin, ymax };
}

/**
 * A window with equal scales on both axes (so right angles look right: the gradient is drawn perpendicular to the
 * level curves) that contains `box` and the origin, padded by `pad` of its size, with width / height = `aspect`.
 */
export function fitWindow(box: Box, aspect: number, pad = 0.15): Box {
  const xmin = Math.min(box.xmin, 0);
  const xmax = Math.max(box.xmax, 0);
  const ymin = Math.min(box.ymin, 0);
  const ymax = Math.max(box.ymax, 0);
  let w = Math.max(xmax - xmin, 1) * (1 + 2 * pad);
  let h = Math.max(ymax - ymin, 1) * (1 + 2 * pad);
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  const cx = (xmin + xmax) / 2;
  const cy = (ymin + ymax) / 2;
  return { xmin: cx - w / 2, xmax: cx + w / 2, ymin: cy - h / 2, ymax: cy + h / 2 };
}

/** max over the curve's domain (sampled) of ‖∇f(γ(t))‖ and of ‖γ′(t)‖: the figure scales its arrows by them */
export function arrowScales(F: Func, C: Curve, p: CurveParams, n = 200): { grad: number; vel: number } {
  const [lo, hi] = C.domain;
  let g = 0;
  let v = 0;
  for (let i = 0; i <= n; i++) {
    const t = lo + ((hi - lo) * i) / n;
    const [x, y] = C.gamma(t, p);
    g = Math.max(g, len(F.grad(x, y)));
    v = Math.max(v, len(C.velocity(t, p)));
  }
  return { grad: g, vel: v };
}

/** the smallest value of ∂_θ g on the circle of radius r, sampled at n points (a probe) */
export function minPolarTheta(F: Func, r: number, n = 3600): { theta: number; value: number } {
  let best = { theta: 0, value: Infinity };
  for (let i = 0; i < n; i++) {
    const th = (2 * Math.PI * i) / n;
    const v = polarDerivs(F, r, th).dth;
    if (v < best.value) best = { theta: th, value: v };
  }
  return best;
}

/** four significant digits, as the figure prints numbers */
export const show = (v: number) => (Number.isFinite(v) ? fmtNum(Number(v.toPrecision(4))) : '—');

/** a one-line Hebrew description for screen readers */
export function describe(F: Func, C: Curve, t: number, p: CurveParams): string {
  const [x, y] = C.gamma(t, p);
  const g = F.grad(x, y);
  const v = C.velocity(t, p);
  return `${F.formula} לאורך ${C.formula(p)}, ב-${C.param} = ${show(t)}: הנקודה (${show(x)}, ${show(y)}), הגרדיאנט (${show(g[0])}, ${show(g[1])}), המהירות (${show(v[0])}, ${show(v[1])}), ומכפלתם הסקלרית ${show(chainRate(F, C, t, p))}; שיפוע הגרף בבדיקה מספרית ${show(quotientRate(F, C, t, p))}.`;
}
