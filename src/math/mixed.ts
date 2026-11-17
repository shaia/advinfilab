/**
 * MODEL SPECIFICATION
 *
 * System:        a real function f of two variables near a point (a, b), and its second difference
 *                  Δ(h, k) = f(a + h, b + k) − f(a + h, b) − f(a, b + k) + f(a, b)
 *                with the second-difference quotient Q(h, k) = Δ(h, k)/(hk), defined for h ≠ 0 and k ≠ 0 (lesson 5.7).
 *                Presets (each with its first partial derivatives in closed form):
 *                  schwarz  xy(x² − y²)/(x² + y²), 0 at the origin, at (0, 0)    (טענה 5.7.6: the counterexample)
 *                  x3y2     x³y² at (1, 1)                                         (mixed partial 6x²y = 6)
 *                  sinxy    sin(xy) at (1, 1)                                      (mixed partial cos 1 − sin 1)
 *                  expcos   eˣ cos y at (0, π/2)                                   (mixed partial −eˣ sin y = −1)
 * Iterated limits of Q: for fixed k ≠ 0, Q(h, k) → A(k) = (∂ₓf(a, b + k) − ∂ₓf(a, b))/k as h → 0, and A(k) →
 *                ∂²f/∂y∂x(a, b) as k → 0 ("h first, then k"). Symmetrically Q(h, k) → B(h) = (∂_y f(a + h, b) −
 *                ∂_y f(a, b))/h as k → 0, and B(h) → ∂²f/∂x∂y(a, b). The figure draws A, B and the diagonal
 *                D(t) = Q(t, t) from these closed forms; the two mixed partials at the point are exact constants.
 *                For the counterexample Q(h, k) = (h² − k²)/(h² + k²), A ≡ −1, B ≡ 1 and D ≡ 0: Q is homogeneous of
 *                degree 0, so the picture on [−r, r]² is the same for every r.
 * The square:    `squareStats` samples Q on an even grid of nodes of [−r, r]² (corners included; an even count of
 *                nodes per side keeps every node off the axes, where Q is not defined) and reports min, max and
 *                max |Q − centre|. It is a probe of the supremum on the square, not the supremum itself: the caption
 *                says so. The lesson proves the limits.
 * Ignored:       IEEE rounding. Δ is a difference of four values of size |f| ≤ 3 near the presets' points, so Q carries
 *                an absolute error of about 10⁻¹⁵/|hk|. The grid nodes and the probe keep |h|, |k| ≥ r/100, so with
 *                r ≥ 10⁻⁴ the error stays below 10⁻³ (and below 10⁻⁷ at the corners, where the tests compare).
 * Valid when:    10⁻⁴ ≤ r ≤ 1.
 *
 * Drives the figure of lesson 5.7 (SecondDifference). A numerical probe never proves: tests/math/mixed.test.ts checks
 * the closed forms the lesson states.
 */

export type PresetId = 'schwarz' | 'x3y2' | 'sinxy' | 'expcos';

export interface Preset {
  id: PresetId;
  /** the formula as the figure prints it (LTR) */
  formula: string;
  /** the point (a, b) and how it is printed */
  a: number;
  b: number;
  pointLabel: string;
  f: (x: number, y: number) => number;
  fx: (x: number, y: number) => number;
  fy: (x: number, y: number) => number;
  /** ∂²f/∂y∂x(a, b) = ∂_y(∂_x f)(a, b): x first, then y */
  dyx: number;
  /** ∂²f/∂x∂y(a, b) = ∂_x(∂_y f)(a, b): y first, then x */
  dxy: number;
  /** the value the colour scale is centred on */
  centre: number;
  /** true when f is C² near the point, so Schwarz applies and Q → dyx = dxy */
  smooth: boolean;
}

const r2 = (x: number, y: number) => x * x + y * y;

/** The counterexample of טענה 5.7.6 and its first partial derivatives (0 at the origin). */
export const schwarzF = (x: number, y: number) => (x === 0 && y === 0 ? 0 : (x * y * (x * x - y * y)) / r2(x, y));
export const schwarzFx = (x: number, y: number) =>
  x === 0 && y === 0 ? 0 : (y * (x ** 4 + 4 * x * x * y * y - y ** 4)) / r2(x, y) ** 2;
export const schwarzFy = (x: number, y: number) =>
  x === 0 && y === 0 ? 0 : (x * (x ** 4 - 4 * x * x * y * y - y ** 4)) / r2(x, y) ** 2;
/** The common value of both mixed partials of the counterexample away from the origin (homogeneous of degree 0). */
export const schwarzMixed = (x: number, y: number) => ((x * x - y * y) * (x ** 4 + 10 * x * x * y * y + y ** 4)) / r2(x, y) ** 3;

export const PRESETS: Record<PresetId, Preset> = {
  schwarz: {
    id: 'schwarz',
    formula: 'f = xy(x² − y²)/(x² + y²)',
    a: 0,
    b: 0,
    pointLabel: '(0, 0)',
    f: schwarzF,
    fx: schwarzFx,
    fy: schwarzFy,
    dyx: -1,
    dxy: 1,
    centre: 0,
    smooth: false,
  },
  x3y2: {
    id: 'x3y2',
    formula: 'f = x³y²',
    a: 1,
    b: 1,
    pointLabel: '(1, 1)',
    f: (x, y) => x ** 3 * y ** 2,
    fx: (x, y) => 3 * x * x * y * y,
    fy: (x, y) => 2 * x ** 3 * y,
    dyx: 6,
    dxy: 6,
    centre: 6,
    smooth: true,
  },
  sinxy: {
    id: 'sinxy',
    formula: 'f = sin(xy)',
    a: 1,
    b: 1,
    pointLabel: '(1, 1)',
    f: (x, y) => Math.sin(x * y),
    fx: (x, y) => y * Math.cos(x * y),
    fy: (x, y) => x * Math.cos(x * y),
    dyx: Math.cos(1) - Math.sin(1),
    dxy: Math.cos(1) - Math.sin(1),
    centre: Math.cos(1) - Math.sin(1),
    smooth: true,
  },
  expcos: {
    id: 'expcos',
    formula: 'f = eˣ cos y',
    a: 0,
    b: Math.PI / 2,
    pointLabel: '(0, π/2)',
    f: (x, y) => Math.exp(x) * Math.cos(y),
    fx: (x, y) => Math.exp(x) * Math.cos(y),
    fy: (x, y) => -Math.exp(x) * Math.sin(y),
    dyx: -1,
    dxy: -1,
    centre: -1,
    smooth: true,
  },
};

/** Δ(h, k) at the preset's point. */
export function secondDifference(P: Preset, h: number, k: number): number {
  const { f, a, b } = P;
  return f(a + h, b + k) - f(a + h, b) - f(a, b + k) + f(a, b);
}

/** Q(h, k) = Δ(h, k)/(hk); NaN on the axes, where it is not defined. */
export function quotient(P: Preset, h: number, k: number): number {
  if (h === 0 || k === 0) return NaN;
  return secondDifference(P, h, k) / (h * k);
}

/** A(k) = lim_{h→0} Q(h, k) = (∂ₓf(a, b + k) − ∂ₓf(a, b))/k: the inner limit when h goes to 0 first. */
export function innerH(P: Preset, k: number): number {
  if (k === 0) return NaN;
  return (P.fx(P.a, P.b + k) - P.fx(P.a, P.b)) / k;
}

/** B(h) = lim_{k→0} Q(h, k) = (∂_y f(a + h, b) − ∂_y f(a, b))/h: the inner limit when k goes to 0 first. */
export function innerK(P: Preset, h: number): number {
  if (h === 0) return NaN;
  return (P.fy(P.a + h, P.b) - P.fy(P.a, P.b)) / h;
}

/** D(t) = Q(t, t): the quotient along the diagonal h = k, the path the proof of Schwarz's theorem takes. */
export const diagonal = (P: Preset, t: number) => quotient(P, t, t);

export interface SquareStats {
  min: number;
  max: number;
  /** max |Q − centre| over the grid */
  dev: number;
}

/** Q on an even grid of N × N nodes of [−r, r]² (corners included, no node on an axis): a probe. */
export function squareStats(P: Preset, r: number, N = 60): SquareStats {
  const n = N % 2 === 0 ? N : N + 1;
  let min = Infinity;
  let max = -Infinity;
  let dev = 0;
  for (let i = 0; i < n; i++) {
    const h = -r + (2 * r * i) / (n - 1);
    for (let j = 0; j < n; j++) {
      const k = -r + (2 * r * j) / (n - 1);
      const q = quotient(P, h, k);
      if (!Number.isFinite(q)) continue;
      if (q < min) min = q;
      if (q > max) max = q;
      dev = Math.max(dev, Math.abs(q - P.centre));
    }
  }
  return { min, max, dev };
}

/** Significant digits for the readouts: 4 by default, trailing zeros dropped. */
export function fmtSig(v: number, sig = 4): string {
  if (!Number.isFinite(v)) return '—';
  if (v === 0 || Math.abs(v) < 1e-12) return '0';
  const a = Math.abs(v);
  if (a >= 1e-3 && a < 1e5) {
    const s = Number(v.toPrecision(sig)).toString();
    return s.replace('-', '−');
  }
  const e = Math.floor(Math.log10(a));
  const m = Number((v / 10 ** e).toPrecision(Math.max(1, sig - 1)));
  const sup = String(e)
    .replace('-', '⁻')
    .replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);
  return `${String(m).replace('-', '−')}·10${sup}`;
}
