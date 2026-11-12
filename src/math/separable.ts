/**
 * MODEL SPECIFICATION
 *
 * System:        (1) the space (C[0,1], d∞) and the countable set D of the polygonal functions whose nodes are the
 *                equally spaced points t_i = i/m (m ∈ ℕ) and whose values at the nodes are rational (טענה 4.4.2(ג) of
 *                the course); (2) the space (B([0,1]), d∞) and the indicators χ_[0,t], t ∈ [0,1], pairwise at
 *                distance 1 (טענה 4.4.8(א)).
 * Polygon:       for a preset f with a known modulus of continuity ω (|s − t| ≤ h ⇒ |f(s) − f(t)| ≤ ω(h), proved for
 *                each preset in its comment), and ε = e/100 with e an integer (the slider has two decimals):
 *                  m = the smallest m ∈ ℕ with ω(1/m) < ε/2  (the mesh of משפט 1.4.18 with δ read off ω),
 *                  Q = the smallest Q ∈ ℕ with 1/(2Q) < ε/2, i.e. Q = ⌊100/e⌋ + 1,
 *                  r_i = round(Q·f(t_i))/Q, so |r_i − f(t_i)| ≤ 1/(2Q) < ε/2,
 *                and p is the polygon through (t_i, r_i). The proof of 4.4.2(ג) gives ‖f − p‖∞ ≤ ω(1/m) + 1/(2Q) < ε;
 *                `boundFor` returns that number. The integer thresholds are computed from e without dividing
 *                rounded reals where the threshold can be an integer (√x: m > 40000/e², |x − ½|: m > 200/e).
 * Probe:         `supError` samples |f − p| on a grid of max(4000, 8m) + 1 points together with the nodes: evidence,
 *                exact up to the sampling for the smooth presets and exact for |x − ½| when ½ is a node.
 * Indicators:    χ_[0,t](x) = 1 for x ≤ t, 0 for x > t. For s ≠ t, ‖χ_[0,s] − χ_[0,t]‖∞ = 1 (the difference is the
 *                indicator of the half-open interval between them, which is nonempty). The open balls of radius r
 *                about two such functions are disjoint exactly when r ≤ 1/2: for r ≤ 1/2 by the triangle inequality,
 *                for r > 1/2 the midpoint (χ_[0,s] + χ_[0,t])/2 lies in both (its distance to each is 1/2).
 * Ignored:       IEEE rounding (relative 1e-15).
 * Valid when:    0.05 ≤ ε ≤ 0.5 (then m ≤ 1601), 1 ≤ m ≤ 2000 by hand.
 *
 * Drives the figure of lesson 4.4 (Separable). A numerical probe never proves: the theorems are proved in the lesson.
 */

import { fmtNum } from './contraction';

export { fmtNum };

export type FnId = 'wave' | 'osc' | 'sqrt' | 'abs';

export interface Preset {
  id: FnId;
  /** the formula, LTR */
  formula: string;
  f: (x: number) => number;
  /** a modulus of continuity on [0,1]: |s − t| ≤ h ⇒ |f(s) − f(t)| ≤ omega(h) */
  omega: (h: number) => number;
  /** the smallest m ∈ ℕ with omega(1/m) < ε/2, for ε = e/100 */
  mesh: (e: number) => number;
  /** a Lipschitz constant, or null when f is not Lipschitz */
  lip: number | null;
}

/** smallest m ∈ ℕ with L/m < ε/2, ε = e/100: m > 200L/e */
const lipMesh = (L: number) => (e: number) => Math.floor((200 * L) / e) + 1;

export const FNS: Record<FnId, Preset> = {
  // |f′| = 0.35·2π|cos 2πx| ≤ 0.7π; mean value theorem: 0.7π-Lipschitz
  wave: {
    id: 'wave',
    formula: '0.5 + 0.35·sin 2πx',
    f: (x) => 0.5 + 0.35 * Math.sin(2 * Math.PI * x),
    omega: (h) => 0.7 * Math.PI * h,
    mesh: lipMesh(0.7 * Math.PI),
    lip: 0.7 * Math.PI,
  },
  // |f′| = 0.3·6π|cos 6πx| ≤ 1.8π
  osc: {
    id: 'osc',
    formula: '0.5 + 0.3·sin 6πx',
    f: (x) => 0.5 + 0.3 * Math.sin(6 * Math.PI * x),
    omega: (h) => 1.8 * Math.PI * h,
    mesh: lipMesh(1.8 * Math.PI),
    lip: 1.8 * Math.PI,
  },
  // |√s − √t| ≤ √|s − t| (square both sides: for s ≥ t, s + t − 2√(st) ≤ s − t ⇔ t ≤ √(st)); not Lipschitz at 0.
  // ω(1/m) = 1/√m < ε/2 ⇔ m > 4/ε² = 40000/e²
  sqrt: {
    id: 'sqrt',
    formula: '√x',
    f: (x) => Math.sqrt(x),
    omega: (h) => Math.sqrt(h),
    mesh: (e) => Math.floor(40000 / (e * e)) + 1,
    lip: null,
  },
  // 1-Lipschitz (reverse triangle inequality); 1/m < ε/2 ⇔ m > 200/e
  abs: {
    id: 'abs',
    formula: '|x − 1/2|',
    f: (x) => Math.abs(x - 0.5),
    omega: (h) => h,
    mesh: (e) => Math.floor(200 / e) + 1,
    lip: 1,
  },
};

/** ε as an integer number of hundredths (the slider's grid) */
export const hundredths = (eps: number) => Math.round(eps * 100);

/** the denominator Q: the smallest Q ∈ ℕ with 1/(2Q) < ε/2, i.e. Q > 1/ε = 100/e */
export const denominator = (eps: number) => Math.floor(100 / hundredths(eps)) + 1;

/** the guaranteed mesh m of the proof for this preset and ε */
export const autoMesh = (fn: FnId, eps: number) => FNS[fn].mesh(hundredths(eps));

/** the numerators k_i of the rational node values r_i = k_i/Q, i = 0…m */
export function nodeNumerators(f: (x: number) => number, m: number, Q: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= m; i++) out.push(Math.round(Q * f(i / m)));
  return out;
}

/** the polygon with equally spaced nodes i/m and node values vals[i], evaluated at x ∈ [0,1] */
export function polyValue(vals: number[], x: number): number {
  const m = vals.length - 1;
  if (x <= 0) return vals[0];
  if (x >= 1) return vals[m];
  const u = x * m;
  const i = Math.min(m - 1, Math.floor(u));
  const lam = u - i;
  return (1 - lam) * vals[i] + lam * vals[i + 1];
}

/** sampled sup |f − p| on [0,1] (a probe): a grid of max(4000, 8m) + 1 points and the nodes */
export function supError(f: (x: number) => number, vals: number[]): number {
  const m = vals.length - 1;
  const N = Math.max(4000, 8 * m);
  let e = 0;
  for (let j = 0; j <= N; j++) {
    const x = j / N;
    e = Math.max(e, Math.abs(f(x) - polyValue(vals, x)));
  }
  for (let i = 0; i <= m; i++) e = Math.max(e, Math.abs(f(i / m) - vals[i]));
  return e;
}

export interface PolygonFit {
  m: number;
  Q: number;
  /** numerators of the node values */
  num: number[];
  /** node values r_i = num_i / Q */
  vals: number[];
  /** the sampled sup error ‖f − p‖∞ (probe) */
  err: number;
  /** the proof's bound ω(1/m) + 1/(2Q) */
  bound: number;
  /** the mesh the proof guarantees for this ε */
  mAuto: number;
}

/** the rational polygon of mesh m for the preset and ε (m defaults to the guaranteed mesh) */
export function polygonFit(fn: FnId, eps: number, mByHand?: number): PolygonFit {
  const F = FNS[fn];
  const mAuto = autoMesh(fn, eps);
  const m = mByHand ?? mAuto;
  const Q = denominator(eps);
  const num = nodeNumerators(F.f, m, Q);
  const vals = num.map((k) => k / Q);
  return { m, Q, num, vals, err: supError(F.f, vals), bound: boundFor(fn, m, Q), mAuto };
}

/** the proof's bound on ‖f − p‖∞: ω(1/m) + 1/(2Q) */
export const boundFor = (fn: FnId, m: number, Q: number) => FNS[fn].omega(1 / m) + 1 / (2 * Q);

/** the number of polygons of mesh m whose node values are fractions k/Q in [0, 1]: (Q + 1)^(m+1) — finite for each m, Q */
export const polygonsInSlice = (m: number, Q: number) => (Q + 1) ** (m + 1);

/* ------------------------------------------------------------------ indicators */

/** χ_[0,t](x) */
export const chi = (t: number, x: number) => (x <= t ? 1 : 0);

/** sampled ‖χ_[0,s] − χ_[0,t]‖∞ on a grid with the points s, t and a point strictly between them (a probe of 1) */
export function chiDistance(s: number, t: number, N = 2000): number {
  const xs: number[] = [];
  for (let j = 0; j <= N; j++) xs.push(j / N);
  const [a, b] = s < t ? [s, t] : [t, s];
  xs.push(a, b, (a + b) / 2);
  let d = 0;
  for (const x of xs) d = Math.max(d, Math.abs(chi(s, x) - chi(t, x)));
  return d;
}

/** the open balls of radius r about two different indicators are disjoint ⇔ r ≤ 1/2 (exact, from the proof) */
export const ballsDisjoint = (r: number) => r <= 0.5;

/** the midpoint function (χ_[0,s] + χ_[0,t])/2 and its sampled distance to each of the two */
export function midpointDistances(s: number, t: number, N = 2000): [number, number] {
  let d1 = 0;
  let d2 = 0;
  const [a, b] = s < t ? [s, t] : [t, s];
  const xs: number[] = [a, b, (a + b) / 2];
  for (let j = 0; j <= N; j++) xs.push(j / N);
  for (const x of xs) {
    const mid = (chi(s, x) + chi(t, x)) / 2;
    d1 = Math.max(d1, Math.abs(mid - chi(s, x)));
    d2 = Math.max(d2, Math.abs(mid - chi(t, x)));
  }
  return [d1, d2];
}

export function describePolygon(fn: FnId, eps: number, fit: PolygonFit, auto: boolean): string {
  const F = FNS[fn];
  return (
    `הפונקציה ${F.formula}, אפסילון ${fmtNum(eps)}. ` +
    `קו שבור עם ${fit.m} קטעים שווים${auto ? ' (המספר שההוכחה מבטיחה)' : ''}, וערכים רציונליים במכנה ${fit.Q}. ` +
    `המרחק במדגם: ${fmtNum(Number(fit.err.toPrecision(3)))}, ${fit.err < eps ? 'קטן מאפסילון' : 'לא קטן מאפסילון'}.`
  );
}

export function describeIndicators(s: number, t: number, r: number): string {
  return (
    `הפונקציות המציינות של [0, ${fmtNum(s)}] ושל [0, ${fmtNum(t)}], במרחק ${s === t ? 0 : 1}. ` +
    `כדורים ברדיוס ${fmtNum(r)}: ${s === t ? 'אותו כדור.' : ballsDisjoint(r) ? 'זרים.' : 'נחתכים, ופונקציית האמצע בשניהם.'}`
  );
}
