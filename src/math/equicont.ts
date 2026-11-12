/**
 * MODEL SPECIFICATION
 *
 * System:        a family of real functions on a closed interval D = [lo, hi] with |x − y|, of which the figure draws
 *                the first m members:
 *                  shift  sin(x + c_j),  c_j = 2π(j − 1)/m, j = 1…m, on [0, π]   (טענה 4.2.5(ב): |f′| ≤ 1)
 *                  freq   sin(nx),       n = 1…m,                     on [0, π]   (טענה 4.2.7(א): fails at 0)
 *                  lip    sin(nx)/n,     n = 1…m,                     on [0, π]   (טענה 4.2.5(א): 1-Lipschitz)
 *                  power  xⁿ,            n = 1…m,                     on [0, 1]   (טענה 4.2.7(ב): fails at 1 only)
 *                  tent   t_n,           n = 1…m,                     on [0, 1]   (טענה 4.2.7(ג): fails at 0 only)
 *                where t_n(x) = max(0, 1 − 2^{n+1}|x − 3·2^{−n−1}|) are the tents of טענה 3.1.9(ב).
 * The δ of one member at a point: for f on D, a ∈ D and ε > 0 put
 *                  δ_f(a) = inf{ |x − a| : x ∈ D, |f(x) − f(a)| ≥ ε }   (inf ∅ = ∞).
 *                The set is closed and f is continuous, so every δ ≤ δ_f(a) satisfies "|x − a| < δ ⇒ |f(x) − f(a)| < ε",
 *                and no larger δ does: δ_f(a) is the largest δ of הגדרה 1.6.1 at a. The point of D nearest to a with
 *                |f(x) − f(a)| ≥ ε has |f(x) − f(a)| = ε exactly (intermediate value theorem), so δ_f(a) is the
 *                distance to the nearest solution of f(x) = f(a) ± ε in D. It is computed in closed form:
 *                  A·sin(ωx + c): the solutions of sin u = s₀ ± ε/A (arcsin and π − arcsin, plus periods);
 *                  xⁿ: increasing, so x = (aⁿ ± ε)^{1/n} when that lies in [0, 1];
 *                  t_n: piecewise linear, solved on each linear piece.
 * The δ of the drawn members at a: δ*(a) = min_j δ_{f_j}(a), exact for these m members. For the whole (infinite)
 *                family the true largest δ is inf over all members ≤ δ*(a): a finite m is a probe, and the caption says
 *                so. `profile` samples a ↦ δ*(a) on a grid of D; its minimum is an upper estimate of the δ that works
 *                at every point for the drawn members (a probe between grid points).
 * Ignored:       IEEE rounding (relative 1e-12 in arcsin and powers).
 * Valid when:    1 ≤ m ≤ 40, 0 < ε ≤ 2.
 *
 * Drives the figure of lesson 4.2 (Equicontinuity). A numerical probe never proves: the theorems are proved in the
 * lesson, and tests/math/equicont.test.ts checks the closed forms the lesson states.
 */

import { fmtNum } from './contraction';

export { fmtNum };

export type FamilyId = 'shift' | 'freq' | 'lip' | 'power' | 'tent';

export interface Member {
  /** the parameter shown in the readout: c_j, n */
  label: string;
  f: (x: number) => number;
  /** δ_f(a) for this member; ∞ when no point of D is ε away in value */
  delta: (a: number, eps: number) => number;
  /** breakpoints the drawing must hit exactly (tents) */
  kinks?: number[];
}

export interface Family {
  id: FamilyId;
  /** the formula as the figure prints it (LTR) */
  formula: string;
  /** the parameter's name in the readout */
  param: string;
  domain: readonly [number, number];
  maxM: number;
  member: (j: number, m: number) => Member;
}

const TWO_PI = 2 * Math.PI;

/**
 * The distance from u0 to the nearest u ∈ [uLo, uHi] with |sin u − sin u0| ≥ e (∞ if none). Every such nearest point
 * solves sin u = sin u0 ± e, and every solution qualifies, so it is the distance to the nearest solution in range.
 */
export function nearestSinLevel(u0: number, e: number, uLo: number, uHi: number): number {
  if (!(e > 0)) return 0;
  const s0 = Math.sin(u0);
  const tol = 1e-12 * Math.max(1, Math.abs(uLo), Math.abs(uHi));
  const k0 = Math.floor(u0 / TWO_PI);
  let best = Infinity;
  for (const v of [s0 + e, s0 - e]) {
    if (v > 1 + 1e-15 || v < -1 - 1e-15) continue;
    const r = Math.asin(Math.max(-1, Math.min(1, v)));
    for (let k = k0 - 2; k <= k0 + 2; k++) {
      for (const root of [r + TWO_PI * k, Math.PI - r + TWO_PI * k]) {
        if (root < uLo - tol || root > uHi + tol) continue;
        best = Math.min(best, Math.abs(root - u0));
      }
    }
  }
  return best;
}

/** δ_f(a) for f(x) = A·sin(ωx + c) on [lo, hi] (A, ω > 0). */
export function sinDelta(A: number, omega: number, c: number, a: number, eps: number, lo: number, hi: number): number {
  return nearestSinLevel(omega * a + c, eps / A, omega * lo + c, omega * hi + c) / omega;
}

/** δ_f(a) for f(x) = xⁿ on [0, 1]. */
export function powerDelta(n: number, a: number, eps: number): number {
  const an = a ** n;
  let best = Infinity;
  if (an + eps <= 1) best = Math.min(best, (an + eps) ** (1 / n) - a);
  if (an - eps >= 0) best = Math.min(best, a - (an - eps) ** (1 / n));
  return best;
}

/** The value at x of the piecewise-linear function through (xs[i], ys[i]) (xs increasing, x in range). */
export function plValue(xs: readonly number[], ys: readonly number[], x: number): number {
  if (x <= xs[0]) return ys[0];
  for (let i = 0; i + 1 < xs.length; i++) {
    if (x <= xs[i + 1]) {
      const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
      return ys[i] + t * (ys[i + 1] - ys[i]);
    }
  }
  return ys[ys.length - 1];
}

/** δ_f(a) for a piecewise-linear f: on each piece the set {|ℓ − v0| ≥ ε} is solved exactly. */
export function plDelta(xs: readonly number[], ys: readonly number[], a: number, eps: number): number {
  const v0 = plValue(xs, ys, a);
  let best = Infinity;
  const nearestIn = (L: number, R: number) => {
    if (L > R) return;
    const p = Math.min(R, Math.max(L, a));
    best = Math.min(best, Math.abs(p - a));
  };
  for (let i = 0; i + 1 < xs.length; i++) {
    const [p, q] = [xs[i], xs[i + 1]];
    const [yp, yq] = [ys[i], ys[i + 1]];
    const s = (yq - yp) / (q - p);
    for (const [T, up] of [
      [v0 + eps, true],
      [v0 - eps, false],
    ] as const) {
      // the part of [p, q] where ℓ ≥ T (up) or ℓ ≤ T (down)
      if (s === 0) {
        if (up ? yp >= T : yp <= T) nearestIn(p, q);
        continue;
      }
      const r = p + (T - yp) / s;
      if ((s > 0) === up) nearestIn(Math.max(r, p), q);
      else nearestIn(p, Math.min(r, q));
    }
  }
  return best;
}

/** The tent t_n of טענה 3.1.9(ב): its knots on [0, 1]. */
export function tentKnots(n: number): { xs: number[]; ys: number[] } {
  const lo = 2 ** -n;
  const mid = 3 * 2 ** (-n - 1);
  const hi = 2 ** (-n + 1);
  const xs = [0, lo, mid, hi];
  const ys = [0, 0, 1, 0];
  if (hi < 1) {
    xs.push(1);
    ys.push(0);
  }
  return { xs, ys };
}

export const tent = (n: number, x: number) => Math.max(0, 1 - 2 ** (n + 1) * Math.abs(x - 3 * 2 ** (-n - 1)));

export const FAMILIES: Record<FamilyId, Family> = {
  shift: {
    id: 'shift',
    formula: 'sin(x + c)',
    param: 'c',
    domain: [0, Math.PI],
    maxM: 40,
    member: (j, m) => {
      const c = (TWO_PI * (j - 1)) / m;
      return {
        label: `c = ${fmtNum(Number(c.toFixed(3)))}`,
        f: (x) => Math.sin(x + c),
        delta: (a, eps) => sinDelta(1, 1, c, a, eps, 0, Math.PI),
      };
    },
  },
  freq: {
    id: 'freq',
    formula: 'sin(nx)',
    param: 'n',
    domain: [0, Math.PI],
    maxM: 40,
    member: (n) => ({
      label: `n = ${n}`,
      f: (x) => Math.sin(n * x),
      delta: (a, eps) => sinDelta(1, n, 0, a, eps, 0, Math.PI),
    }),
  },
  lip: {
    id: 'lip',
    formula: 'sin(nx)/n',
    param: 'n',
    domain: [0, Math.PI],
    maxM: 40,
    member: (n) => ({
      label: `n = ${n}`,
      f: (x) => Math.sin(n * x) / n,
      delta: (a, eps) => sinDelta(1 / n, n, 0, a, eps, 0, Math.PI),
    }),
  },
  power: {
    id: 'power',
    formula: 'xⁿ',
    param: 'n',
    domain: [0, 1],
    maxM: 40,
    member: (n) => ({
      label: `n = ${n}`,
      f: (x) => x ** n,
      delta: (a, eps) => powerDelta(n, a, eps),
    }),
  },
  tent: {
    id: 'tent',
    formula: 'tₙ',
    param: 'n',
    domain: [0, 1],
    maxM: 12,
    member: (n) => {
      const { xs, ys } = tentKnots(n);
      return {
        label: `n = ${n}`,
        f: (x) => tent(n, x),
        delta: (a, eps) => plDelta(xs, ys, a, eps),
        kinks: xs,
      };
    },
  },
};

export const FAMILY_IDS = Object.keys(FAMILIES) as FamilyId[];

export const clampM = (fam: Family, m: number) => Math.max(1, Math.min(fam.maxM, Math.round(m)));

export function members(fam: Family, m: number): Member[] {
  const k = clampM(fam, m);
  return Array.from({ length: k }, (_, i) => fam.member(i + 1, k));
}

/** δ*(a) = min over the drawn members of δ_f(a), and the index (0-based) of a member that attains it. */
export function deltaStar(fam: Family, m: number, a: number, eps: number): { delta: number; worst: number } {
  let delta = Infinity;
  let worst = -1;
  members(fam, m).forEach((mb, i) => {
    const d = mb.delta(a, eps);
    if (d < delta) {
      delta = d;
      worst = i;
    }
  });
  return { delta, worst };
}

/** a ↦ δ*(a) on N + 1 equally spaced points of D; `min` is the smallest sampled value (a probe). */
export function profile(fam: Family, m: number, eps: number, N = 240): { a: number[]; d: number[]; min: number; argmin: number } {
  const [lo, hi] = fam.domain;
  const ms = members(fam, m);
  const a: number[] = [];
  const d: number[] = [];
  let min = Infinity;
  let argmin = lo;
  for (let i = 0; i <= N; i++) {
    const x = lo + ((hi - lo) * i) / N;
    let v = Infinity;
    for (const mb of ms) v = Math.min(v, mb.delta(x, eps));
    a.push(x);
    d.push(v);
    if (v < min) {
      min = v;
      argmin = x;
    }
  }
  return { a, d, min, argmin };
}

/** The members that leave their ε-box over the window |x − a| < δ: exactly those with δ_f(a) < δ. */
export function escapees(fam: Family, m: number, a: number, eps: number, delta: number): number[] {
  return members(fam, m)
    .map((mb, i) => (mb.delta(a, eps) < delta ? i : -1))
    .filter((i) => i >= 0);
}

/** A point of the window |x − a| ≤ δ_f(a) where |f(x) − f(a)| = ε: the nearest escape, for the hollow marker. */
export function escapePoint(mb: Member, a: number, eps: number, lo: number, hi: number): number | null {
  const d = mb.delta(a, eps);
  if (!Number.isFinite(d)) return null;
  const f0 = mb.f(a);
  const ok = (x: number) => x >= lo - 1e-12 && x <= hi + 1e-12 && Math.abs(Math.abs(mb.f(x) - f0) - eps) < 1e-6;
  if (ok(a + d)) return a + d;
  if (ok(a - d)) return a - d;
  return null;
}

/** The point x_n = 2^{−1/n} of טענה 4.2.7(ב): x_n → 1 and x_n^n = 1/2. */
export const powerFailPoint = (n: number) => 2 ** (-1 / n);

/** sup over n ≥ 1 of n·b^{n−1} for 0 ≤ b < 1 (טענה 4.2.7(ב)): attained at n = ⌊1/(−ln b)⌋ or the next integer. */
export function powerLipBound(b: number): number {
  if (b <= 0) return 1;
  const t = -1 / Math.log(b);
  let best = 1;
  for (const n of [1, Math.floor(t), Math.floor(t) + 1, Math.ceil(t) + 1]) if (n >= 1) best = Math.max(best, n * b ** (n - 1));
  return best;
}

export function describeFamily(fam: Family, m: number, a: number, eps: number, delta: number): string {
  const ds = deltaStar(fam, m, a, eps).delta;
  const out = escapees(fam, m, a, eps, delta).length;
  const k = clampM(fam, m);
  const dsTxt = Number.isFinite(ds) ? `δ הגדול ביותר בנקודה הוא בערך ${fmtNum(Number(ds.toPrecision(3)))}` : 'כל δ מתאים בנקודה';
  return `המשפחה ${fam.formula}, ${k} איברים, a = ${fmtNum(Number(a.toFixed(3)))}, ε = ${fmtNum(eps)}, δ = ${fmtNum(delta)}. ${dsTxt}. ${out === 0 ? 'כל האיברים נשארים במלבנים שלהם.' : `${out} איברים יוצאים מהמלבן שלהם.`}`;
}
