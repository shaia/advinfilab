/**
 * MODEL SPECIFICATION
 *
 * System:        a real function f of two variables, a point a ∈ ℝ² and the candidate linear map T = J_f(a) built from
 *                the partial derivatives at a (מסקנה 5.3.8(2)), for the five presets of lesson 5.3:
 *                  paraboloid  f = x² + y²            at a = (1, 1),  f(a) = 2, T = (2, 2)   differentiable
 *                  sqrt        f = √|xy|              at a = (0, 0),  f(a) = 0, T = (0, 0)   not differentiable
 *                  cubic       f = x³/(x² + y²)       at a = (0, 0),  f(a) = 0, T = (1, 0)   not differentiable
 *                  square      f = x²y²/(x² + y²)     at a = (0, 0),  f(a) = 0, T = (0, 0)   differentiable
 *                  parabola    f = x²y/(x⁴ + y²)      at a = (0, 0),  f(a) = 0, T = (0, 0)   not differentiable
 *                (the three quotients are 0 at the origin). The remainder r(h) = f(a + h) − f(a) − T·h and the ratio
 *                q(h) = |r(h)| / ‖h‖₂ for h ≠ 0 (הגדרה 5.3.1). In polar form h = ρ(cos θ, sin θ), ρ > 0, with
 *                c = cos θ, s = sin θ, the ratio has a closed form (טענה 5.3.9 and the Explore of the lesson):
 *                  paraboloid  r = ρ²,              q = ρ
 *                  sqrt        r = ρ√|cs|,          q = √|cs|
 *                  cubic       r = −ρ c s²,         q = |c| s²
 *                  square      r = ρ² c² s²,        q = ρ c² s²
 *                  parabola    r = ρ c² s / (ρ² c⁴ + s²),  q = c²|s| / (ρ² c⁴ + s²)
 *                Its sup on the circle ‖h‖ = ρ, S(ρ), and the directions where it is attained, are exact:
 *                  paraboloid  S = ρ (every direction);  sqrt  S = 1/√2 at θ = π/4 + kπ/2;
 *                  cubic       S = 2/(3√3) where cos²θ = 1/3;  square  S = ρ/4 at θ = π/4 + kπ/2;
 *                  parabola    S = 1/(2ρ) where |sin θ| = ρ cos²θ (the parabola |y| = x² meets the circle there:
 *                              with A = ρc², B = |s|, q = (1/ρ)·AB/(A² + B²) ≤ 1/(2ρ), equality iff A = B).
 *                The sup over the punctured disk 0 < ‖h‖ ≤ ρ is D(ρ) = sup_{ρ′ ≤ ρ} S(ρ′): ρ, 1/√2, 2/(3√3), ρ/4
 *                and ∞ (parabola). For ε > 0, "δ = ρ works for ε" in הגדרה 5.3.1 when D(ρ) < ε.
 * Zoom:          the 3D view draws the graph and the candidate plane zoomed by 1/ρ in all three axes around
 *                (a, f(a)): over the unit disk ‖u‖ ≤ 1, the graph is u ↦ (f(a + ρu) − f(a))/ρ and the plane is
 *                u ↦ T·u. Their vertical gap is r(ρu)/ρ, at most D(ρ) in absolute value: the zoomed graphs approach
 *                the plane exactly when the ratio tends to 0.
 * Ignored:       IEEE rounding (f(a + h) − f(a) − T·h loses about 1e-16·|f(a)| to cancellation; at ρ ≥ 1e-3 the ratio
 *                is still exact to 1e-9 relative).
 * Valid when:    1e-3 ≤ ρ ≤ 1.
 *
 * Drives the figure of lesson 5.3 (TangentPlane). A numerical probe never proves: the closed forms above are proved
 * in the lesson, and tests/math/tangent.test.ts checks them against direct evaluation.
 */

import { fmtNum } from './contraction';

export { fmtNum };

export type PresetId = 'paraboloid' | 'sqrt' | 'cubic' | 'square' | 'parabola';

export interface Preset {
  id: PresetId;
  /** the formula as the figure prints it (LTR) */
  formula: string;
  /** the point a */
  a: readonly [number, number];
  /** the point as printed */
  at: string;
  f: (x: number, y: number) => number;
  /** f(a) */
  fa: number;
  /** the candidate T = J_f(a), a row (∂ₓf(a), ∂ᵧf(a)) */
  J: readonly [number, number];
  differentiable: boolean;
  /** |r(h)|/‖h‖₂ at h = ρ(cos θ, sin θ), closed form */
  ratioExact: (rho: number, theta: number) => number;
  /** S(ρ): the sup of the ratio on the circle ‖h‖₂ = ρ, closed form */
  circleSup: (rho: number) => number;
  /** D(ρ): the sup of the ratio on 0 < ‖h‖₂ ≤ ρ, closed form */
  diskSup: (rho: number) => number;
  /** the directions θ ∈ [0, 2π) where S(ρ) is attained; null when every direction attains it */
  worst: (rho: number) => number[] | null;
}

export const RHO_MIN = 1e-3;
export const RHO_MAX = 1;

const TAU = 2 * Math.PI;
const quad = (t: number) => [t, Math.PI - t, Math.PI + t, TAU - t];

/** The angle θ ∈ (0, π/2) with cos²θ = 1/3, where |cos θ| sin²θ is largest. */
export const CUBIC_WORST = Math.acos(1 / Math.sqrt(3));
/** max_θ |cos θ| sin²θ = 2/(3√3) */
export const CUBIC_SUP = 2 / (3 * Math.sqrt(3));

/** The root s ∈ (0, 1) of ρs² + s − ρ = 0, i.e. s = ρ(1 − s²) = ρ cos²θ: where the circle of radius ρ meets |y| = x². */
export function parabolaSin(rho: number): number {
  // (−1 + √(1 + 4ρ²))/(2ρ), written without cancellation
  return (2 * rho) / (1 + Math.sqrt(1 + 4 * rho * rho));
}

export const PRESETS: Record<PresetId, Preset> = {
  paraboloid: {
    id: 'paraboloid',
    formula: 'x² + y²',
    a: [1, 1],
    at: '(1, 1)',
    f: (x, y) => x * x + y * y,
    fa: 2,
    J: [2, 2],
    differentiable: true,
    ratioExact: (rho) => rho,
    circleSup: (rho) => rho,
    diskSup: (rho) => rho,
    worst: () => null,
  },
  sqrt: {
    id: 'sqrt',
    formula: '√|xy|',
    a: [0, 0],
    at: '(0, 0)',
    f: (x, y) => Math.sqrt(Math.abs(x * y)),
    fa: 0,
    J: [0, 0],
    differentiable: false,
    ratioExact: (_rho, t) => Math.sqrt(Math.abs(Math.cos(t) * Math.sin(t))),
    circleSup: () => Math.SQRT1_2,
    diskSup: () => Math.SQRT1_2,
    worst: () => quad(Math.PI / 4),
  },
  cubic: {
    id: 'cubic',
    formula: 'x³/(x² + y²)',
    a: [0, 0],
    at: '(0, 0)',
    f: (x, y) => (x === 0 && y === 0 ? 0 : (x * x * x) / (x * x + y * y)),
    fa: 0,
    J: [1, 0],
    differentiable: false,
    ratioExact: (_rho, t) => Math.abs(Math.cos(t)) * Math.sin(t) ** 2,
    circleSup: () => CUBIC_SUP,
    diskSup: () => CUBIC_SUP,
    worst: () => quad(CUBIC_WORST),
  },
  square: {
    id: 'square',
    formula: 'x²y²/(x² + y²)',
    a: [0, 0],
    at: '(0, 0)',
    f: (x, y) => (x === 0 && y === 0 ? 0 : (x * x * y * y) / (x * x + y * y)),
    fa: 0,
    J: [0, 0],
    differentiable: true,
    ratioExact: (rho, t) => rho * (Math.cos(t) * Math.sin(t)) ** 2,
    circleSup: (rho) => rho / 4,
    diskSup: (rho) => rho / 4,
    worst: () => quad(Math.PI / 4),
  },
  parabola: {
    id: 'parabola',
    formula: 'x²y/(x⁴ + y²)',
    a: [0, 0],
    at: '(0, 0)',
    f: (x, y) => (x === 0 && y === 0 ? 0 : (x * x * y) / (x ** 4 + y * y)),
    fa: 0,
    J: [0, 0],
    differentiable: false,
    ratioExact: (rho, t) => {
      const c2 = Math.cos(t) ** 2;
      const s = Math.abs(Math.sin(t));
      return (c2 * s) / (rho * rho * c2 * c2 + s * s);
    },
    circleSup: (rho) => 1 / (2 * rho),
    diskSup: () => Infinity,
    worst: (rho) => quad(Math.asin(parabolaSin(rho))),
  },
};

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];

/** r(h) = f(a + h) − f(a) − T·h, by direct evaluation. */
export function remainder(P: Preset, h1: number, h2: number): number {
  return P.f(P.a[0] + h1, P.a[1] + h2) - P.fa - (P.J[0] * h1 + P.J[1] * h2);
}

/** |r(h)| / ‖h‖₂ by direct evaluation (h ≠ 0). */
export function ratio(P: Preset, h1: number, h2: number): number {
  return Math.abs(remainder(P, h1, h2)) / Math.hypot(h1, h2);
}

export function ratioPolar(P: Preset, rho: number, theta: number): number {
  return ratio(P, rho * Math.cos(theta), rho * Math.sin(theta));
}

/** S(ρ) by scanning N directions: a probe (a lower estimate of the exact sup). */
export function circleSupScan(P: Preset, rho: number, N = 7200): { sup: number; theta: number } {
  let sup = -Infinity;
  let theta = 0;
  for (let k = 0; k < N; k++) {
    const t = (TAU * k) / N;
    const q = ratioPolar(P, rho, t);
    if (q > sup) {
      sup = q;
      theta = t;
    }
  }
  return { sup, theta };
}

/** The zoomed graph over the unit disk: u ↦ (f(a + ρu) − f(a))/ρ. */
export function zoomedGraph(P: Preset, rho: number, u1: number, u2: number): number {
  return (P.f(P.a[0] + rho * u1, P.a[1] + rho * u2) - P.fa) / rho;
}

/** The candidate plane in zoomed coordinates: u ↦ T·u (it does not depend on ρ). */
export function zoomedPlane(P: Preset, u1: number, u2: number): number {
  return P.J[0] * u1 + P.J[1] * u2;
}

/**
 * The ratio on an n × n grid of cell centres covering the unit square [−1, 1]² of zoomed coordinates u = h/ρ
 * (row-major, row 0 at u₂ = +1). NaN outside the unit disk. Cell centres never hit u = 0 when n is even.
 */
export function ratioGrid(P: Preset, rho: number, n: number): Float64Array {
  const g = new Float64Array(n * n);
  for (let j = 0; j < n; j++) {
    const u2 = 1 - (2 * (j + 0.5)) / n;
    for (let i = 0; i < n; i++) {
      const u1 = -1 + (2 * (i + 0.5)) / n;
      g[j * n + i] = u1 * u1 + u2 * u2 > 1 ? NaN : ratio(P, rho * u1, rho * u2);
    }
  }
  return g;
}

/** Does δ = ρ work for this ε, in the sense D(ρ) < ε? */
export const rhoWorks = (P: Preset, rho: number, eps: number) => P.diskSup(rho) < eps;

/** Degrees in [0, 360) of an angle in radians. */
export const deg = (t: number) => ((((t * 180) / Math.PI) % 360) + 360) % 360;

/** The smallest angular distance between two angles in degrees. */
export function angleGap(aDeg: number, bDeg: number): number {
  const d = Math.abs((((aDeg - bDeg) % 360) + 360) % 360);
  return Math.min(d, 360 - d);
}

/** A sentence for the screen-reader live region. */
export function describe(P: Preset, rho: number, eps: number, thetaDeg: number): string {
  const q0 = P.ratioExact(rho, (thetaDeg * Math.PI) / 180);
  // cos(π/2) is 6e-17, not 0: on an axis the exact ratio comes out ~1e-9 instead of 0. Read that as 0.
  const q = Math.abs(q0) < 1e-9 ? 0 : q0;
  const S = P.circleSup(rho);
  const works = rhoWorks(P, rho, eps);
  return (
    `הפונקציה ${P.formula} סביב ${P.at}, המועמד (${P.J[0]}, ${P.J[1]}). ρ = ${fmtNum(Number(rho.toPrecision(3)))}, ε = ${fmtNum(Number(eps.toPrecision(3)))}. ` +
    `בכיוון ${fmtNum(Number(thetaDeg.toFixed(1)))} מעלות היחס הוא ${fmtNum(Number(q.toPrecision(3)))}; ` +
    `הסופרמום על המעגל ${fmtNum(Number(S.toPrecision(3)))}. ` +
    (works ? 'ρ מתאים כ-δ ל-ε הזה.' : 'ρ אינו מתאים כ-δ ל-ε הזה.')
  );
}
