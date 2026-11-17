/**
 * MODEL SPECIFICATION
 *
 * System:        (a) a real function f: ℝ² → ℝ with its gradient, given in closed form,
 *                  cubic  f = x³ − y²            ∇f = (3x², −2y)
 *                  quad   f = x² − xy + 2y²      ∇f = (2x − y, −x + 4y)        (a quadratic: the midpoint works)
 *                  wave   f = sin(2x)·cos(y)     ∇f = (2cos(2x)cos(y), −sin(2x)sin(y))
 *                and a segment [a, b] = {a + t(b − a) : t ∈ [0, 1]} of ℝ². Along it
 *                  φ(t) = f(a + t(b − a)),   φ′(t) = ∇f(a + t(b − a))·(b − a)      (למה 5.4.7, a chain rule step)
 *                and the mean value points are the τ ∈ (0, 1) with φ′(τ) = φ(1) − φ(0) (משפט 5.6.2).
 *                (b) a curve γ: [lo, hi] → ℝ² with its velocity, in closed form,
 *                  circle   γ = (cos t, sin t)   on [0, 2π]     ‖γ′‖ = 1
 *                  parabola γ = (t, t²)          on [−1.5, 1.5]  ‖γ′‖ = √(1 + 4t²)
 *                  cusp     γ = (t², t³)         on [−1.5, 1.5]  ‖γ′‖ = |t|·√(4 + 9t²)
 *                and an interval [t0, t1]. The chord is γ(t1) − γ(t0), and a common mean value point would be a
 *                c ∈ (t0, t1) with (t1 − t0)γ′(c) = γ(t1) − γ(t0) (טענה 5.6.3: usually there is none). For each
 *                component i separately, Lagrange gives its own points c_i with (t1 − t0)γ_i′(c_i) = γ_i(t1) − γ_i(t0).
 *                The gap ‖(t1 − t0)γ′(c) − (γ(t1) − γ(t0))‖₂ is 0 exactly at a common point. The mean value inequality
 *                (משפט 5.6.4(א)) says ‖γ(t1) − γ(t0)‖₂ ≤ (t1 − t0)·sup ‖γ′‖₂ over [t0, t1]; the sup is in closed form.
 * Closed forms the lesson quotes:
 *                  x³ − y² on [(0,0), (1,1)]: φ(t) = t³ − t², the only τ is 2/3;
 *                  a quadratic: φ is a polynomial of degree ≤ 2, so τ = 1/2 on every segment (φ affine: every τ);
 *                  the circle: γ(t1) − γ(t0) = 2 sin(Δ/2)·γ′(m), Δ = t1 − t0, m = (t0 + t1)/2, so the chord has the
 *                  direction of γ′(m) and the length 2|sin(Δ/2)| < Δ for every Δ > 0; on the drawn domain (Δ ≤ 2π) the
 *                  least gap is Δ − 2 sin(Δ/2);
 *                  the cusp: c₁ = m, and c₂² = (t0² + t0t1 + t1²)/3; a common point only when t0 = t1.
 * Roots:         the points are the zeros of a continuous function g on an open interval. They are found by sign
 *                changes on a grid of N cells, refined by bisection to 1e-13, plus local minima of |g| below a
 *                tolerance (a touching zero); when |g| ≤ tol on the whole grid, every point works (`all`). A zero
 *                between two grid nodes with no sign change and |g| above the tolerance at both is missed: a probe.
 * Ignored:       IEEE rounding (relative 1e-12).
 * Valid when:    a ≠ b, t0 < t1, inside the drawn windows.
 *
 * Drives the figure of lesson 5.6 (MeanValue). A numerical probe never proves: the theorems are proved in the lesson,
 * and tests/math/meanvalue.test.ts checks the closed forms the lesson states.
 */

import { fmtNum } from './contraction';
import type { Vec2 } from './vec';

export { fmtNum };

/* ------------------------------------------------------------- roots of a function of one variable */

export interface Roots {
  roots: number[];
  /** g vanishes (to the tolerance) on the whole interval: every point is a root */
  all: boolean;
}

/** The zeros of g in the open interval (lo, hi). */
export function solveRoots(g: (t: number) => number, lo: number, hi: number, N = 2000, tol = 1e-10): Roots {
  const h = (hi - lo) / N;
  const ts: number[] = [];
  const gs: number[] = [];
  // the interior grid: the end points are excluded (the theorems promise interior points)
  for (let i = 1; i < N; i++) {
    ts.push(lo + i * h);
    gs.push(g(lo + i * h));
  }
  const scale = Math.max(1, ...gs.map((v) => Math.abs(v)));
  if (gs.every((v) => Math.abs(v) <= tol * scale)) return { roots: [], all: true };
  const roots: number[] = [];
  const bisect = (a: number, b: number, ga: number) => {
    for (let k = 0; k < 200 && b - a > 1e-13; k++) {
      const m = (a + b) / 2;
      const gm = g(m);
      if (gm === 0) return m;
      if (Math.sign(gm) === Math.sign(ga)) {
        a = m;
        ga = gm;
      } else b = m;
    }
    return (a + b) / 2;
  };
  const push = (r: number) => {
    if (!roots.some((s) => Math.abs(s - r) < 1e-7)) roots.push(r);
  };
  for (let i = 0; i < gs.length; i++) {
    if (gs[i] === 0) push(ts[i]);
    else if (i + 1 < gs.length && gs[i + 1] !== 0 && Math.sign(gs[i]) !== Math.sign(gs[i + 1])) push(bisect(ts[i], ts[i + 1], gs[i]));
  }
  // a zero where g touches 0 without changing sign: a local minimum of |g| below the tolerance
  for (let i = 1; i + 1 < gs.length; i++) {
    const a = Math.abs(gs[i]);
    if (a <= Math.abs(gs[i - 1]) && a <= Math.abs(gs[i + 1]) && Math.sign(gs[i - 1]) === Math.sign(gs[i + 1])) {
      // golden-section search for the minimum of |g| on [t_{i−1}, t_{i+1}]
      let l = ts[i - 1];
      let r = ts[i + 1];
      const phi = (Math.sqrt(5) - 1) / 2;
      for (let k = 0; k < 80; k++) {
        const m1 = r - phi * (r - l);
        const m2 = l + phi * (r - l);
        if (Math.abs(g(m1)) < Math.abs(g(m2))) r = m2;
        else l = m1;
      }
      const t = (l + r) / 2;
      if (Math.abs(g(t)) <= 1e-9 * scale) push(t);
    }
  }
  return { roots: roots.sort((u, w) => u - w), all: false };
}

/* ------------------------------------------------------------- (a) a real function on a segment */

export type RealId = 'cubic' | 'quad' | 'wave';

export interface RealFn {
  id: RealId;
  /** plain-text formula for the legend (LTR) */
  formula: string;
  f: (x: number, y: number) => number;
  grad: (x: number, y: number) => Vec2;
  /** spacing of the drawn level curves */
  step: number;
}

export const REAL: Record<RealId, RealFn> = {
  cubic: {
    id: 'cubic',
    formula: 'f = x³ − y²',
    f: (x, y) => x ** 3 - y ** 2,
    grad: (x, y) => [3 * x * x, -2 * y],
    step: 0.5,
  },
  quad: {
    id: 'quad',
    formula: 'f = x² − xy + 2y²',
    f: (x, y) => x * x - x * y + 2 * y * y,
    grad: (x, y) => [2 * x - y, -x + 4 * y],
    step: 0.75,
  },
  wave: {
    id: 'wave',
    formula: 'f = sin(2x)·cos(y)',
    f: (x, y) => Math.sin(2 * x) * Math.cos(y),
    grad: (x, y) => [2 * Math.cos(2 * x) * Math.cos(y), -Math.sin(2 * x) * Math.sin(y)],
    step: 0.25,
  },
};

const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];

/** φ(t) = f(a + t(b − a)) */
export function phi(F: RealFn, a: Vec2, b: Vec2, t: number): number {
  const p = lerp(a, b, t);
  return F.f(p[0], p[1]);
}

/** φ′(t) = ∇f(a + t(b − a))·(b − a) */
export function dphi(F: RealFn, a: Vec2, b: Vec2, t: number): number {
  const p = lerp(a, b, t);
  const g = F.grad(p[0], p[1]);
  return g[0] * (b[0] - a[0]) + g[1] * (b[1] - a[1]);
}

export interface MvtPoints extends Roots {
  /** the slope of the chord of φ on [0, 1]: φ(1) − φ(0) = f(b) − f(a) */
  slope: number;
  /** the points c = a + τ(b − a) for the roots τ */
  points: Vec2[];
}

/** The τ ∈ (0, 1) with φ′(τ) = φ(1) − φ(0), and the points c on the segment. */
export function mvtPoints(F: RealFn, a: Vec2, b: Vec2): MvtPoints {
  const slope = phi(F, a, b, 1) - phi(F, a, b, 0);
  const r = solveRoots((t) => dphi(F, a, b, t) - slope, 0, 1);
  return { ...r, slope, points: r.roots.map((t) => lerp(a, b, t)) };
}

/* ------------------------------------------------------------- (b) a vector function: a curve in the plane */

export type CurveId = 'circle' | 'parabola' | 'cusp';

export interface Curve {
  id: CurveId;
  formula: string;
  domain: [number, number];
  /** the step of the t0, t1 sliders */
  step: number;
  g: (t: number) => Vec2;
  dg: (t: number) => Vec2;
  /** sup of ‖γ′(t)‖₂ over [t0, t1], in closed form */
  speedSup: (t0: number, t1: number) => number;
  /** the drawn window of the plane: x range; y follows the aspect */
  view: { cx: number; cy: number; half: number };
}

export const CURVES: Record<CurveId, Curve> = {
  circle: {
    id: 'circle',
    formula: 'γ(t) = (cos t, sin t)',
    domain: [0, 2 * Math.PI],
    step: Math.PI / 24,
    g: (t) => [Math.cos(t), Math.sin(t)],
    dg: (t) => [-Math.sin(t), Math.cos(t)],
    speedSup: () => 1,
    view: { cx: 0, cy: 0, half: 1.6 },
  },
  parabola: {
    id: 'parabola',
    formula: 'γ(t) = (t, t²)',
    domain: [-1.5, 1.5],
    step: 1 / 32,
    g: (t) => [t, t * t],
    dg: (t) => [1, 2 * t],
    // √(1 + 4t²) grows with |t|: the sup is at the end point farther from 0
    speedSup: (t0, t1) => Math.sqrt(1 + 4 * Math.max(t0 * t0, t1 * t1)),
    view: { cx: 0, cy: 1.1, half: 1.7 },
  },
  cusp: {
    id: 'cusp',
    formula: 'γ(t) = (t², t³)',
    domain: [-1.5, 1.5],
    step: 1 / 32,
    g: (t) => [t * t, t ** 3],
    dg: (t) => [2 * t, 3 * t * t],
    // |t|·√(4 + 9t²) grows with |t|
    speedSup: (t0, t1) => {
      const s = Math.max(Math.abs(t0), Math.abs(t1));
      return s * Math.sqrt(4 + 9 * s * s);
    },
    view: { cx: 1.1, cy: 0, half: 2.2 },
  },
};

/** γ(t1) − γ(t0) */
export function chord(C: Curve, t0: number, t1: number): Vec2 {
  const p = C.g(t0);
  const q = C.g(t1);
  return [q[0] - p[0], q[1] - p[1]];
}

/** ‖γ(t1) − γ(t0)‖₂ / (t1 − t0): the mean speed, which the mean value inequality bounds by sup ‖γ′‖₂ */
export function ratio(C: Curve, t0: number, t1: number): number {
  const v = chord(C, t0, t1);
  return Math.hypot(v[0], v[1]) / Math.abs(t1 - t0);
}

/** ‖(t1 − t0)γ′(c) − (γ(t1) − γ(t0))‖₂: zero exactly at a common mean value point c */
export function gap(C: Curve, t0: number, t1: number, c: number): number {
  const v = chord(C, t0, t1);
  const d = C.dg(c);
  const D = t1 - t0;
  return Math.hypot(D * d[0] - v[0], D * d[1] - v[1]);
}

/** The least gap over a grid of [t0, t1] (a probe; the circle has the closed form Δ − 2 sin(Δ/2)). */
export function minGap(C: Curve, t0: number, t1: number, N = 1200): { c: number; gap: number } {
  let best = { c: t0, gap: Infinity };
  for (let i = 1; i < N; i++) {
    const c = t0 + ((t1 - t0) * i) / N;
    const g = gap(C, t0, t1, c);
    if (g < best.gap) best = { c, gap: g };
  }
  return best;
}

/** Lagrange for component i alone: the c ∈ (t0, t1) with (t1 − t0)γ_i′(c) = γ_i(t1) − γ_i(t0). */
export function componentPoints(C: Curve, t0: number, t1: number, i: 0 | 1): Roots {
  const v = chord(C, t0, t1)[i];
  const D = t1 - t0;
  return solveRoots((c) => D * C.dg(c)[i] - v, t0, t1);
}

/** The circle: the chord is 2 sin(Δ/2)·γ′(m), Δ = t1 − t0, m the midpoint. */
export const circleChordLength = (D: number) => 2 * Math.sin(D / 2);

/** The cusp (t², t³): the second component's point satisfies c² = (t0² + t0t1 + t1²)/3. */
export const cuspC2Squared = (t0: number, t1: number) => (t0 * t0 + t0 * t1 + t1 * t1) / 3;
