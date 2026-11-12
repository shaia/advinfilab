/**
 * MODEL SPECIFICATION
 *
 * System:        a target f on an interval and four families of functions, each a subalgebra of C(interval)
 *                filtered by a degree n (lesson 4.6, טענה 4.6.2, טענה 4.6.10):
 *                  poly    all polynomials of degree ≤ n, on [−1,1] ('sym') or [0,1] ('half');
 *                  even    the polynomials in x² of degree ≤ n (so in x² of degree ≤ ⌊n/2⌋), on [−1,1] or [0,1];
 *                  vanish  the polynomials p of degree ≤ n with p(0) = 0, on [−1,1] or [0,1];
 *                  trig    the trigonometric polynomials c + Σ_{k≤n} (a_k cos kx + b_k sin kx), on [−π,π].
 *                The union over n of each family is the algebra the lesson studies; the degree-n part is a
 *                finite-dimensional subspace, which is what a computer can fit.
 * Fit:           discrete least squares on the uniform grid of GRID points of the interval (endpoints included):
 *                the fit of degree n is the orthogonal projection of (f(x_i)) onto the span of the basis vectors
 *                (b_j(x_i)) for the uniform weights. The bases are numerically stable: Chebyshev polynomials
 *                T_k(u) of the affine variable u ∈ [−1,1] (poly), T_k(2x² − 1) (even: a polynomial in x² of degree
 *                k, exactly even in x because it is computed from x·x), x·T_k(u) (vanish: exactly 0 at x = 0), and
 *                1, cos kx, sin kx (trig). The maximal basis (degree N_MAX) is orthonormalised once by modified
 *                Gram–Schmidt applied twice ("twice is enough"); the bases are nested, so the fit of degree n is the
 *                partial sum of the projections on the first dim(n) orthonormal vectors.
 * Error:         the sup error reported is max_i |f(x_i) − p_n(x_i)| over the grid: a probe of ‖f − p_n‖∞, and the
 *                least-squares p_n is not the best uniform approximation (it is within a modest factor of it). So
 *                the figure shows evidence, not the theorem. One thing is exact: when the grid contains the points
 *                where the algebra fails to separate (±1 for even/sym, ±π for trig) or where it vanishes (0 for
 *                vanish), the probe obeys the lower bound the lesson proves for every member of the algebra
 *                (`provedLowerBound`), because that bound only looks at those points.
 * Ignored:       IEEE rounding (relative 1e-13 after the orthonormalisation; the tests check reproduction of
 *                members of the algebra to 1e-9).
 * Valid when:    0 ≤ n ≤ N_MAX = 20.
 *
 * Drives the figure of lesson 4.6 (AlgebraFit). A numerical probe never proves: density and the lower bounds are
 * proved in the lesson (משפט 4.6.6, טענה 4.6.10).
 */

export type AlgebraId = 'poly' | 'even' | 'vanish' | 'trig';
export type IntervalId = 'sym' | 'half';
export type TargetId = 'x' | 'abs' | 'one' | 'exp';

export const N_MAX = 20;
export const GRID = 1001;

export const ALGEBRAS: Record<AlgebraId, { label: string; formula: string }> = {
  poly: { label: 'כל הפולינומים', formula: 'p(x)' },
  even: { label: 'פולינומים ב-x²', formula: 'q(x²)' },
  vanish: { label: 'פולינומים שמתאפסים ב-0', formula: 'p(0) = 0' },
  trig: { label: 'פולינומים טריגונומטריים', formula: 'c + Σ (aₖ cos kx + bₖ sin kx)' },
};

export const TARGETS: Record<TargetId, { formula: string; f: (x: number) => number }> = {
  x: { formula: 'f(x) = x', f: (x) => x },
  abs: { formula: 'f(x) = |x|', f: (x) => Math.abs(x) },
  one: { formula: 'f(x) = 1', f: () => 1 },
  exp: { formula: 'f(x) = eˣ', f: (x) => Math.exp(x) },
};

/** Chebyshev polynomial T_k(u) by the three-term recurrence T_{k+1} = 2u T_k − T_{k−1}. */
export function chebT(k: number, u: number): number {
  if (k === 0) return 1;
  let a = 1;
  let b = u;
  for (let j = 1; j < k; j++) {
    const c = 2 * u * b - a;
    a = b;
    b = c;
  }
  return b;
}

export function intervalOf(alg: AlgebraId, iv: IntervalId): [number, number] {
  if (alg === 'trig') return [-Math.PI, Math.PI];
  return iv === 'sym' ? [-1, 1] : [0, 1];
}

/** the affine variable u ∈ [−1, 1] of a polynomial interval */
const uOf = (iv: IntervalId, x: number) => (iv === 'sym' ? x : 2 * x - 1);

/** dimension of the degree-n part */
export function dimension(alg: AlgebraId, n: number): number {
  if (alg === 'poly') return n + 1;
  if (alg === 'even') return Math.floor(n / 2) + 1;
  if (alg === 'vanish') return n;
  return 2 * n + 1;
}

/** the j-th basis function of the maximal (nested) basis */
export function basisFn(alg: AlgebraId, iv: IntervalId, j: number): (x: number) => number {
  if (alg === 'poly') return (x) => chebT(j, uOf(iv, x));
  if (alg === 'even') return (x) => chebT(j, 2 * (x * x) - 1);
  if (alg === 'vanish') return (x) => x * chebT(j, uOf(iv, x));
  // trig: 1, cos x, sin x, cos 2x, sin 2x, …
  if (j === 0) return () => 1;
  const k = Math.ceil(j / 2);
  return j % 2 === 1 ? (x) => Math.cos(k * x) : (x) => Math.sin(k * x);
}

/** the uniform grid of `count` points of [a, b], both endpoints included exactly */
export function grid(a: number, b: number, count = GRID): Float64Array {
  const xs = new Float64Array(count);
  for (let i = 0; i < count; i++) xs[i] = i === count - 1 ? b : a + ((b - a) * i) / (count - 1);
  return xs;
}

const dot = (u: Float64Array, v: Float64Array) => {
  let s = 0;
  for (let i = 0; i < u.length; i++) s += u[i] * v[i];
  return s;
};

/** orthonormal vectors spanning the same nested subspaces as the columns (modified Gram–Schmidt, twice) */
export function orthonormalize(cols: Float64Array[]): Float64Array[] {
  const out: Float64Array[] = [];
  for (const c of cols) {
    const v = Float64Array.from(c);
    for (let pass = 0; pass < 2; pass++)
      for (const q of out) {
        const r = dot(q, v);
        for (let i = 0; i < v.length; i++) v[i] -= r * q[i];
      }
    const nrm = Math.sqrt(dot(v, v));
    if (!(nrm > 1e-12 * Math.sqrt(c.length))) throw new Error('algebra: the basis is numerically dependent');
    for (let i = 0; i < v.length; i++) v[i] /= nrm;
    out.push(v);
  }
  return out;
}

export interface FitTable {
  xs: Float64Array;
  /** f on the grid */
  fx: Float64Array;
  /** fits[n] = the least-squares fit of degree n on the grid, n = 0 … N_MAX */
  fits: Float64Array[];
  /** errors[n] = max over the grid of |f − fits[n]| (a probe of the sup distance) */
  errors: number[];
  /** argmax[n] = a grid index where errors[n] is attained */
  argmax: number[];
}

/** least-squares fits of every degree 0 … nMax of an arbitrary f */
export function fitAllFn(alg: AlgebraId, iv: IntervalId, f: (x: number) => number, nMax = N_MAX, count = GRID): FitTable {
  const [a, b] = intervalOf(alg, iv);
  const xs = grid(a, b, count);
  const fx = xs.map(f);
  const dMax = dimension(alg, nMax);
  const cols: Float64Array[] = [];
  for (let j = 0; j < dMax; j++) cols.push(xs.map(basisFn(alg, iv, j)));
  const Q = orthonormalize(cols);
  const coef = Q.map((q) => dot(q, fx));
  const fits: Float64Array[] = [];
  const errors: number[] = [];
  const argmax: number[] = [];
  for (let n = 0; n <= nMax; n++) {
    const d = dimension(alg, n);
    const p = new Float64Array(xs.length);
    for (let j = 0; j < d; j++) for (let i = 0; i < xs.length; i++) p[i] += coef[j] * Q[j][i];
    let e = 0;
    let at = 0;
    for (let i = 0; i < xs.length; i++) {
      const r = Math.abs(fx[i] - p[i]);
      if (r > e) {
        e = r;
        at = i;
      }
    }
    fits.push(p);
    errors.push(e);
    argmax.push(at);
  }
  return { xs, fx, fits, errors, argmax };
}

const cache = new Map<string, FitTable>();

/** the fit table of a preset target, cached (the figure asks for it on every change) */
export function fitAll(alg: AlgebraId, iv: IntervalId, target: TargetId): FitTable {
  const key = `${alg}|${alg === 'trig' ? 'trig' : iv}|${target}`;
  let t = cache.get(key);
  if (!t) {
    t = fitAllFn(alg, iv, TARGETS[target].f);
    cache.set(key, t);
  }
  return t;
}

/**
 * The lower bound the lesson proves for ‖f − g‖∞ over every g in the closure of the algebra, or 0 when it proves
 * none (the algebra is dense there):
 *   even on [−1,1]: g(x) = g(−x), so the bound is max_{x∈[0,1]} |f(x) − f(−x)|/2 (here at x = 1 for the presets);
 *   vanish:         g(0) = 0, so the bound is |f(0)|;
 *   trig:           g(−π) = g(π), so the bound is |f(π) − f(−π)|/2.
 * (טענה 4.6.10(א),(ב) and טענה 4.6.8א; the presets are monotone or even, so the endpoint gives the max.)
 */
export function provedLowerBound(alg: AlgebraId, iv: IntervalId, target: TargetId): number {
  const f = TARGETS[target].f;
  if (alg === 'even' && iv === 'sym') return Math.abs(f(1) - f(-1)) / 2;
  if (alg === 'vanish') return Math.abs(f(0));
  if (alg === 'trig') return Math.abs(f(Math.PI) - f(-Math.PI)) / 2;
  return 0;
}
