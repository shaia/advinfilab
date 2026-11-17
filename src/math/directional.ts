/**
 * MODEL SPECIFICATION
 *
 * System:        a real function f of two variables, a point a, and a direction given by its angle θ (degrees),
 *                v = (cos θ, sin θ), a unit vector of ‖·‖₂. The slice of f at a in direction v is the one-variable
 *                function φ(t) = f(a + t·v); its secant slopes are the difference quotients
 *                  q(t) = (φ(t) − φ(0)) / t,   t ≠ 0,
 *                and D_v f(a) = lim_{t→0} q(t) (two-sided, הגדרה 5.2.2) when the limit exists.
 * Presets (lesson 5.2):
 *                  poly    x² + 3xy at (1,1)                      D_v f(a) = 5v₁ + 3v₂             (טענה 5.2.3(א))
 *                  xy      xy/(x²+y²), 0 at 0, at 0                φ(t) = v₁v₂ for t ≠ 0, φ(0) = 0: D_v exists
 *                                                                  exactly when v₁v₂ = 0, and is 0  (טענה 5.2.4(א))
 *                  g       x²y/(x⁴+y²), 0 at 0, at 0               D_v g(0) = v₁²/v₂ (v₂ ≠ 0), 0 (v₂ = 0)  (5.2.5)
 *                  norm    ‖x‖₂ at 0                               q(t) = |t|/t: no D_v                (5.2.3(ב))
 *                  sqrtxy  √|xy| at 0                              q(t) = √|v₁v₂|·|t|/t: D_v exists exactly
 *                                                                  when v₁v₂ = 0, and is 0             (טענה 5.2.7)
 *                  h       1 on the parabola y = x² (x ≠ 0), 0 elsewhere, at 0: the line t·v meets the parabola
 *                          for t ≠ 0 only at t* = v₂/v₁² (when v₁v₂ ≠ 0), so φ = 0 on |t| < |t*| and D_v h(0) = 0
 *                                                                                                     (טענה 5.2.6)
 *                All the D_v values above are exact closed forms, proved in the lesson; `dv` returns them. The
 *                slice is evaluated from the formula of f, except for h, whose only nonzero value on the line is at
 *                t*, a point no floating-point t hits: `slice` returns 1 exactly at t* and the figure draws the spike.
 * Directions:    `dirFromDeg` returns the exact axis vectors at multiples of 90°, so that "v₁v₂ = 0" is decided
 *                exactly there (cos 90° is not 0 in floating point).
 * Level sets:    exact curves, not marching squares (the presets are singular at 0): lines y = mx for xy/(x²+y²)
 *                with m/(1+m²) = c, parabolas y = kx² for x²y/(x⁴+y²) with k/(1+k²) = c, circles for ‖x‖₂,
 *                hyperbolas |xy| = c² for √|xy|, the branches y = (c − x²)/(3x) for x² + 3xy, and the parabola
 *                itself for h.
 * Ignored:       IEEE rounding (relative 1e-15 in the closed forms).
 * Valid when:    θ any real (taken mod 360), 0 < |t| ≤ the preset's window T.
 *
 * Drives the figure of lesson 5.2 (DirectionalSlice). A secant slope at one t is a probe, never a proof of a limit:
 * the limits are proved in the lesson, and tests/math/directional.test.ts checks the closed forms the lesson states.
 */

import { fmtNum } from './contraction';

export { fmtNum };

export type SliceId = 'poly' | 'xy' | 'g' | 'norm' | 'sqrtxy' | 'h';
export type Vec = readonly [number, number];

/** why D_v f(a) does not exist: the slice jumps at 0 (q unbounded), or the one-sided limits of q differ */
export type NoDerivative = 'jump' | 'corner';

export type Dv = { exists: true; value: number } | { exists: false; reason: NoDerivative };

export interface Polyline {
  /** the level c, or null for a curve that is not a level of a numbered family (the parabola of h) */
  level: number | null;
  pts: Vec[];
}

export interface SlicePreset {
  id: SliceId;
  /** the formula as the figure prints it (LTR) */
  formula: string;
  /** the point a */
  a: Vec;
  /** the plane panel: a box centred at a, half-height 1 (the figure widens it to the panel's aspect) */
  half: number;
  /** the slice window t ∈ [−T, T] */
  T: number;
  /** the value range of the slice panel */
  yRange: readonly [number, number];
  f: (x: number, y: number) => number;
}

const PRESET_LIST: SlicePreset[] = [
  { id: 'poly', formula: 'x² + 3xy', a: [1, 1], half: 1, T: 0.5, yRange: [0, 8], f: (x, y) => x * x + 3 * x * y },
  {
    id: 'xy',
    formula: 'xy/(x² + y²)',
    a: [0, 0],
    half: 1,
    T: 1,
    yRange: [-0.6, 0.6],
    f: (x, y) => (x === 0 && y === 0 ? 0 : (x * y) / (x * x + y * y)),
  },
  {
    id: 'g',
    formula: 'x²y/(x⁴ + y²)',
    a: [0, 0],
    half: 1,
    T: 1,
    yRange: [-0.6, 0.6],
    f: (x, y) => (x === 0 && y === 0 ? 0 : (x * x * y) / (x ** 4 + y * y)),
  },
  { id: 'norm', formula: '‖x‖₂', a: [0, 0], half: 1, T: 1, yRange: [-0.1, 1.1], f: (x, y) => Math.hypot(x, y) },
  { id: 'sqrtxy', formula: '√|xy|', a: [0, 0], half: 1, T: 1, yRange: [-0.1, 0.8], f: (x, y) => Math.sqrt(Math.abs(x * y)) },
  // floating-point points are (almost) never on y = x² exactly: the figure reads the slice through `slice`
  { id: 'h', formula: 'h', a: [0, 0], half: 1, T: 1, yRange: [-0.15, 1.15], f: (x, y) => (x !== 0 && y === x * x ? 1 : 0) },
];

export const PRESETS: Record<SliceId, SlicePreset> = Object.fromEntries(PRESET_LIST.map((p) => [p.id, p])) as Record<SliceId, SlicePreset>;

/** v = (cos θ, sin θ), with the exact axis vectors at multiples of 90°. */
export function dirFromDeg(deg: number): Vec {
  const d = ((deg % 360) + 360) % 360;
  if (d === 0) return [1, 0];
  if (d === 90) return [0, 1];
  if (d === 180) return [-1, 0];
  if (d === 270) return [0, -1];
  const r = (d * Math.PI) / 180;
  return [Math.cos(r), Math.sin(r)];
}

/** the angle in [0, 360) of a nonzero vector, in degrees */
export const degOf = (v: Vec): number => {
  const d = (Math.atan2(v[1], v[0]) * 180) / Math.PI;
  return d < 0 ? d + 360 : d;
};

/** h's slice: the line t·v meets y = x² away from 0 only at t* = v₂/v₁², when v₁v₂ ≠ 0 */
export function spikeT(v: Vec): number | null {
  return v[0] !== 0 && v[1] !== 0 ? v[1] / (v[0] * v[0]) : null;
}

/** φ(t) = f(a + t·v) */
export function slice(p: SlicePreset, v: Vec, t: number): number {
  if (p.id === 'h') return t !== 0 && t === spikeT(v) ? 1 : 0;
  return p.f(p.a[0] + t * v[0], p.a[1] + t * v[1]);
}

/** the secant slope q(t) = (φ(t) − φ(0))/t, t ≠ 0 */
export function quotient(p: SlicePreset, v: Vec, t: number): number {
  return (slice(p, v, t) - slice(p, v, 0)) / t;
}

/** lim_{t→0, t≠0} φ(t): equals φ(0) except for xy/(x²+y²) off the axes, where the slice jumps */
export function sliceLimit(p: SlicePreset, v: Vec): number {
  if (p.id === 'xy') return v[0] * v[1];
  return slice(p, v, 0);
}

/** D_v f(a), exact (the closed forms of the lesson) */
export function dv(p: SlicePreset, v: Vec): Dv {
  const [v1, v2] = v;
  switch (p.id) {
    case 'poly':
      // ∂ₓf = 2x + 3y = 5, ∂ᵧf = 3x = 3 at (1,1); the slice is a quadratic in t
      return { exists: true, value: 5 * v1 + 3 * v2 };
    case 'xy':
      return v1 * v2 === 0 ? { exists: true, value: 0 } : { exists: false, reason: 'jump' };
    case 'g':
      return { exists: true, value: v2 === 0 ? 0 : (v1 * v1) / v2 };
    case 'norm':
      return { exists: false, reason: 'corner' };
    case 'sqrtxy':
      return v1 * v2 === 0 ? { exists: true, value: 0 } : { exists: false, reason: 'corner' };
    case 'h':
      return { exists: true, value: 0 };
  }
}

/**
 * The one-sided limits of q at 0 (right, left), exact; ±∞ when q is unbounded on that side (the jump of xy/(x²+y²):
 * q(t) = v₁v₂/t).
 */
export function oneSided(p: SlicePreset, v: Vec): readonly [number, number] {
  const [v1, v2] = v;
  switch (p.id) {
    case 'xy': {
      const c = v1 * v2;
      if (c === 0) return [0, 0];
      return c > 0 ? [Infinity, -Infinity] : [-Infinity, Infinity];
    }
    case 'norm':
      return [1, -1];
    case 'sqrtxy': {
      const s = Math.sqrt(Math.abs(v1 * v2));
      return [s, -s];
    }
    default: {
      const d = dv(p, v);
      return d.exists ? [d.value, d.value] : [NaN, NaN];
    }
  }
}

/**
 * The quadratic coefficient of the slice of x² + 3xy at (1,1): φ(t) = φ(0) + t·D_v f(a) + t²·(v₁² + 3v₁v₂), so
 * q(t) − D_v f(a) = t·(v₁² + 3v₁v₂) exactly.
 */
export const polyCurvature = (v: Vec): number => v[0] * v[0] + 3 * v[0] * v[1];

/* ------------------------------------------------------------------ level sets (exact curves) */

/** a line through the origin in direction (1, m) (or the y-axis for m = ∞), clipped to a disc of radius R */
const lineThrough0 = (m: number, R: number): Vec[] => {
  if (!Number.isFinite(m)) return [[0, -R], [0, R]];
  const n = Math.hypot(1, m);
  return [[(-R) / n, (-R * m) / n], [R / n, (R * m) / n]];
};

/** the two slopes (or parabola coefficients) k with k/(1 + k²) = c, 0 < |c| ≤ 1/2 */
export function levelRoots(c: number): [number, number] {
  const s = Math.sqrt(Math.max(0, 1 - 4 * c * c));
  return [(1 - s) / (2 * c), (1 + s) / (2 * c)];
}

const sampled = (lo: number, hi: number, n: number, fx: (x: number) => Vec | null): Vec[][] => {
  const runs: Vec[][] = [];
  let cur: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const p = fx(lo + ((hi - lo) * i) / n);
    if (p) cur.push(p);
    else if (cur.length) {
      runs.push(cur);
      cur = [];
    }
  }
  if (cur.length > 1) runs.push(cur);
  return runs.filter((r) => r.length > 1);
};

/** Level curves of the preset near a, in world coordinates, for the box |x − a₁| ≤ wx, |y − a₂| ≤ wy. */
export function levelCurves(p: SlicePreset, wx: number, wy: number): Polyline[] {
  const R = Math.hypot(wx, wy) + 0.1;
  const out: Polyline[] = [];
  const axes = (level: number) => {
    out.push({ level, pts: [[-R, 0], [R, 0]] });
    out.push({ level, pts: [[0, -R], [0, R]] });
  };
  switch (p.id) {
    case 'poly': {
      const [a1, a2] = p.a;
      for (const c of [0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14]) {
        // y = (c − x²)/(3x), x ≠ 0
        for (const run of sampled(a1 - wx, a1 + wx, 600, (x) => {
          if (Math.abs(x) < 1e-6) return null;
          const y = (c - x * x) / (3 * x);
          return Math.abs(y - a2) <= wy + 0.5 ? [x, y] : null;
        }))
          out.push({ level: c, pts: run });
      }
      break;
    }
    case 'xy':
      axes(0);
      for (const c of [-0.5, -0.4, -0.2, 0.2, 0.4, 0.5]) {
        const [m1, m2] = levelRoots(c);
        out.push({ level: c, pts: lineThrough0(m1, R) });
        if (Math.abs(Math.abs(c) - 0.5) > 1e-12) out.push({ level: c, pts: lineThrough0(m2, R) });
      }
      break;
    case 'g':
      axes(0);
      for (const c of [-0.5, -0.4, -0.2, 0.2, 0.4, 0.5]) {
        const ks = levelRoots(c);
        for (const k of Math.abs(Math.abs(c) - 0.5) > 1e-12 ? ks : [ks[0]]) {
          for (const run of sampled(-wx, wx, 400, (x) => (Math.abs(k * x * x) <= wy + 0.5 ? [x, k * x * x] : null)))
            out.push({ level: c, pts: run });
        }
      }
      break;
    case 'norm':
      for (const r of [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8]) {
        const pts: Vec[] = [];
        for (let i = 0; i <= 240; i++) pts.push([r * Math.cos((2 * Math.PI * i) / 240), r * Math.sin((2 * Math.PI * i) / 240)]);
        out.push({ level: r, pts });
      }
      break;
    case 'sqrtxy':
      axes(0);
      for (const c of [0.2, 0.4, 0.6, 0.8]) {
        for (const sx of [1, -1])
          for (const sy of [1, -1]) {
            for (const run of sampled(0.001, wx, 400, (x) => {
              const y = (c * c) / x;
              return y <= wy + 0.5 ? [sx * x, sy * y] : null;
            }))
              out.push({ level: c, pts: run });
          }
      }
      break;
    case 'h':
      for (const run of sampled(-wx, wx, 400, (x) => (x * x <= wy + 0.5 ? [x, x * x] : null))) out.push({ level: null, pts: run });
      break;
  }
  return out;
}
