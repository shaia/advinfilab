/**
 * MODEL SPECIFICATION
 *
 * System:        a map f: X → ℝ on an interval X ⊆ ℝ (closed, half-open or a ray), iterated from x₀ ∈ X:
 *                x_{k+1} = f(x_k). The metric is d(x, y) = |x − y|. A preset carries: the formula f, the interval X
 *                with open/closed endpoint flags, the plot window and the range x₀ may take, the Lipschitz constant q
 *                of f on X when q < 1 (otherwise null, with the reason), the fixed point x* in X (or null), the
 *                point the iterates approach when it is not in X, whether f(X) ⊆ X, and the exact image of an
 *                interval under f.
 * Dynamics:      the orbit x₀, x₁, …, xₙ stops at the first iterate outside X (that iterate is kept, as the last
 *                entry, because the figure draws it hollow). Nothing is computed past it: f is not applied outside X.
 * Bounds:        for q < 1, f(X) ⊆ X and X complete (Banach, theorem 2.3.4 of the course):
 *                  a-priori      |xₙ − x*| ≤ qⁿ/(1 − q) · |x₁ − x₀|,
 *                  a-posteriori  |xₙ − x*| ≤ q/(1 − q) · |xₙ − xₙ₋₁|  (n ≥ 1).
 *                Both are returned only while the orbit has stayed in X up to xₙ. For `half-open` (X = (0, 1] is not
 *                complete) the iterates tend to 0 ∉ X; the same two bounds still hold for the distance to 0, which is
 *                what the figure reads as "the error" there (the a-priori bound is then an equality: xₙ = x₀/2ⁿ).
 * Images:        I₀ = X, I_{k+1} = f(I_k) while I_k ⊆ X. For a continuous monotone f the image of an interval is the
 *                interval between the images of its endpoints (intermediate value theorem plus monotonicity), with
 *                an open endpoint staying open; for a continuous f with one interior minimum at c (Newton's map,
 *                c = √2) the minimum of the image is f(c) when c lies in the interval, else the smaller endpoint
 *                value, and the maximum is the larger endpoint value. cos is decreasing on [0, 1], so every fⁿ is
 *                monotone there and fⁿ(X) is the interval spanned by the two numbers fⁿ(0), fⁿ(1): the iterates of the
 *                endpoints. Since I_{k+1} = f(I_k) and f is q-Lipschitz, length(I_{k+1}) ≤ q · length(I_k), hence
 *                length(fⁿ(X)) ≤ qⁿ · length(X); and if f(X) ⊆ X then I₁ ⊆ I₀, so f(I₁) ⊆ f(I₀) = I₁, i.e. the
 *                images are nested. Images are offered for bounded X only.
 * Constants:     x*(cos) = 0.7390851332151607 is the fixed point of cos, found by iterating until |Δ| < 1e-16 (tests
 *                recompute it); √2 and 3/2 are exact.
 * Ignored:       IEEE rounding (relative 1e-15).
 * Valid when:    n integer in 0 … N_MAX. A numerical probe never proves: the tests sample the Lipschitz ratio on a grid
 *                as evidence; q itself is proved in the lesson (mean value theorem and |f′| ≤ q), and each preset's
 *                derivation is in the comment beside it.
 *
 * Drives the figure of lesson 2.3 (Contraction); chapter 7 reuses it: add a preset to MAPS and its id to MapId.
 */

export const N_MAX = 40;
/** the grid of x₀ (slider step) */
export const X0_STEP = 0.01;
/** the tolerance of the task "reach-tol" */
export const TOL = 1e-3;

export interface Interval {
  lo: number;
  hi: number;
  loOpen: boolean;
  hiOpen: boolean;
}

export type MapId = 'cos' | 'newton-sqrt2' | 'half-open' | 'x-plus-inv' | 'leaves' | 'cos-R';

export interface MapDef {
  id: MapId;
  /** the formula, for readouts */
  formula: string;
  /** the domain X as text, for readouts */
  domainText: string;
  f: (x: number) => number;
  X: Interval;
  /** plot window */
  window: { x: [number, number]; y: [number, number] };
  /** the range of x₀ the figure offers (inside X, off an open endpoint by one step) */
  x0Range: [number, number];
  /** Lipschitz constant q < 1 of f on X, or null */
  q: number | null;
  /** Hebrew reason when q is null; the claim about f∘f when there is one */
  qWhy: string;
  /** Lipschitz constant of f∘f on X when it is < 1 and f's own is not */
  q2: number | null;
  /** the fixed point in X, or null */
  fixed: number | null;
  /** where the iterates head when it is not in X (a missing endpoint, or a solution of f(x) = x outside X) */
  outside: number | null;
  /** f(X) ⊆ X */
  mapsInto: boolean;
  /** whether X is bounded (images are offered) */
  bounded: boolean;
  /** exact image of an interval I ⊆ X under f, or null when no closed form is offered (unbounded X, f not monotone) */
  image: ((I: Interval) => Interval) | null;
}

export const X_STAR_COS = 0.7390851332151607;

const closed = (lo: number, hi: number): Interval => ({ lo, hi, loOpen: false, hiOpen: false });

/** the image of an interval under a continuous increasing f: endpoints map to endpoints, open stays open */
const increasing = (f: (x: number) => number) => (I: Interval): Interval => ({ lo: f(I.lo), hi: f(I.hi), loOpen: I.loOpen, hiOpen: I.hiOpen });
/** under a continuous decreasing f the endpoints swap */
const decreasing = (f: (x: number) => number) => (I: Interval): Interval => ({ lo: f(I.hi), hi: f(I.lo), loOpen: I.hiOpen, hiOpen: I.loOpen });

const newtonF = (x: number) => x / 2 + 1 / x;
/** x/2 + 1/x has f′ = 1/2 − 1/x², negative below √2 and positive above: one interior minimum at √2, value √2 */
const newtonImage = (I: Interval): Interval => {
  const c = Math.SQRT2;
  const a = newtonF(I.lo);
  const b = newtonF(I.hi);
  const m = I.lo <= c && c <= I.hi ? newtonF(c) : Math.min(a, b);
  return closed(m, Math.max(a, b));
};

/**
 * cos on [0, 1]: |cos′| = sin x ≤ sin 1 < 1 (sin increasing on [0, π/2]); q = sin 1 = 0.8414709848…; cos([0, 1]) =
 * [cos 1, 1] ⊆ [0, 1] (cos 1 = 0.5403… > 0). Fixed point: cos x − x is continuous, 1 at 0, cos 1 − 1 < 0 at 1,
 * strictly decreasing: exactly one root, 0.7390851332151607.
 *
 * x/2 + 1/x on [1, 2] (Newton for x² = 2): |f′| = |1/2 − 1/x²| ≤ 1/2 because 1/x² ∈ [1/4, 1] gives f′ ∈ [−1/2, 1/4];
 * f([1, 2]) = [√2, 3/2] (min √2 at √2, f(1) = 3/2, f(2) = 5/4); fixed point: x/2 = 1/x, x² = 2.
 *
 * x/2 on (0, 1]: q = 1/2, f(X) = (0, 1/2] ⊆ X; f(x) = x only at 0 ∉ X, so no fixed point: xₙ = x₀/2ⁿ → 0.
 *
 * x + 1/x on [1, ∞): f′ = 1 − 1/x² ∈ [0, 1), sup = 1 not attained; |f(x) − f(y)| = |x − y|·|1 − 1/(xy)| < |x − y| for
 * x ≠ y in X (0 < 1/(xy) < 1), but the ratio tends to 1 for x, y → ∞: no q < 1. f(x) − x = 1/x > 0: no fixed point,
 * and xₙ → ∞ (xₙ₊₁² = xₙ² + 2 + 1/xₙ² ≥ xₙ² + 2). f(X) = [2, ∞) ⊆ X.
 *
 * x/2 + 1 on [0, 1]: q = 1/2; f([0, 1]) = [1, 3/2] ⊄ [0, 1]; the fixed point of the formula is 2 ∉ X. From x₀ ∈ (0, 1]
 * the first iterate x₁ = x₀/2 + 1 > 1 is already outside X; from x₀ = 0, x₁ = 1 ∈ X and x₂ = 3/2 ∉ X.
 *
 * cos on ℝ: sup |cos′| = |sin(π/2)| = 1, attained: no q < 1 (ratio → 1 for x, y → π/2). cos∘cos has derivative
 * sin(cos x)·sin x, and |cos x| ≤ 1 gives |sin(cos x)| ≤ sin 1, so q₂ = sin 1; the fixed point is that of cos (cos
 * maps ℝ into [−1, 1], where its fixed points lie, and cos x = x has one root).
 */
export const MAPS: Record<MapId, MapDef> = {
  cos: {
    id: 'cos',
    formula: 'f(x) = cos x',
    domainText: '[0, 1]',
    f: Math.cos,
    X: closed(0, 1),
    window: { x: [-0.05, 1.15], y: [-0.05, 1.15] },
    x0Range: [0, 1],
    q: Math.sin(1),
    qWhy: '',
    q2: null,
    fixed: X_STAR_COS,
    outside: null,
    mapsInto: true,
    bounded: true,
    image: decreasing(Math.cos),
  },
  'newton-sqrt2': {
    id: 'newton-sqrt2',
    formula: 'f(x) = x/2 + 1/x',
    domainText: '[1, 2]',
    f: newtonF,
    X: closed(1, 2),
    window: { x: [0.8, 2.2], y: [0.8, 2.2] },
    x0Range: [1, 2],
    q: 0.5,
    qWhy: '',
    q2: null,
    fixed: Math.SQRT2,
    outside: null,
    mapsInto: true,
    bounded: true,
    image: newtonImage,
  },
  'half-open': {
    id: 'half-open',
    formula: 'f(x) = x/2',
    domainText: '(0, 1]',
    f: (x) => x / 2,
    X: { lo: 0, hi: 1, loOpen: true, hiOpen: false },
    window: { x: [-0.1, 1.2], y: [-0.1, 1.2] },
    x0Range: [X0_STEP, 1],
    q: 0.5,
    qWhy: '',
    q2: null,
    fixed: null,
    outside: 0,
    mapsInto: true,
    bounded: true,
    image: increasing((x) => x / 2),
  },
  'x-plus-inv': {
    id: 'x-plus-inv',
    formula: 'f(x) = x + 1/x',
    domainText: '[1, ∞)',
    f: (x) => x + 1 / x,
    X: { lo: 1, hi: Infinity, loOpen: false, hiOpen: true },
    window: { x: [0.5, 10.5], y: [0.5, 10.5] },
    x0Range: [1, 10],
    q: null,
    qWhy: 'המרחקים מצטמצמים ממש, אבל אין קבוע q < 1: הסופרמום של |f′| הוא 1 ואינו מתקבל.',
    q2: null,
    fixed: null,
    outside: null,
    mapsInto: true,
    bounded: false,
    image: increasing((x) => x + 1 / x),
  },
  leaves: {
    id: 'leaves',
    formula: 'f(x) = x/2 + 1',
    domainText: '[0, 1]',
    f: (x) => x / 2 + 1,
    X: closed(0, 1),
    window: { x: [-0.1, 2.3], y: [-0.1, 2.3] },
    x0Range: [0, 1],
    q: 0.5,
    qWhy: '',
    q2: null,
    fixed: null,
    outside: 2,
    mapsInto: false,
    bounded: true,
    image: increasing((x) => x / 2 + 1),
  },
  'cos-R': {
    id: 'cos-R',
    formula: 'f(x) = cos x',
    domainText: 'ℝ',
    f: Math.cos,
    X: { lo: -Infinity, hi: Infinity, loOpen: true, hiOpen: true },
    window: { x: [-3, 3], y: [-3, 3] },
    x0Range: [-3, 3],
    q: null,
    qWhy: 'ב-ℝ אין קבוע q < 1: הסופרמום של |f′| = |sin x| הוא 1 והוא מתקבל. אבל ל-cos∘cos יש q = sin 1.',
    q2: Math.sin(1),
    fixed: X_STAR_COS,
    outside: null,
    mapsInto: true,
    bounded: false,
    image: null,
  },
};

export const MAP_IDS = Object.keys(MAPS) as MapId[];

export const inX = (m: MapDef, x: number): boolean =>
  (m.X.loOpen ? x > m.X.lo : x >= m.X.lo) && (m.X.hiOpen ? x < m.X.hi : x <= m.X.hi);

const inInterval = (J: Interval, x: number) => (J.loOpen ? x > J.lo : x >= J.lo) && (J.hiOpen ? x < J.hi : x <= J.hi);

/** x₀ clamped to the range the preset offers and snapped to the grid X0_STEP */
export function snapX0(m: MapDef, x: number): number {
  const [lo, hi] = m.x0Range;
  const v = Math.round(Math.max(lo, Math.min(hi, x)) / X0_STEP) * X0_STEP;
  return Number(Math.max(lo, Math.min(hi, v)).toFixed(6));
}

export interface Orbit {
  /** x₀, …, x_k, where k = n, or the first index outside X */
  xs: number[];
  /** the index of the first iterate outside X within 0 … n, or null */
  escapedAt: number | null;
}

/** x₀, …, xₙ, stopping at the first iterate outside X (it is kept as the last entry). */
export function orbit(m: MapDef, x0: number, n: number): Orbit {
  const xs = [x0];
  if (!inX(m, x0)) return { xs, escapedAt: 0 };
  for (let k = 1; k <= n; k++) {
    const x = m.f(xs[k - 1]);
    xs.push(x);
    if (!inX(m, x)) return { xs, escapedAt: k };
  }
  return { xs, escapedAt: null };
}

/** qⁿ/(1 − q) · |x₁ − x₀|, or null when q is unknown, f(X) ⊄ X, or the orbit left X before xₙ. */
export function aPriori(m: MapDef, x0: number, n: number): number | null {
  if (m.q === null || !m.mapsInto || !inX(m, x0)) return null;
  const x1 = m.f(x0);
  if (!inX(m, x1)) return null;
  return (m.q ** n / (1 - m.q)) * Math.abs(x1 - x0);
}

/** q/(1 − q) · |xₙ − xₙ₋₁| for n ≥ 1, or null likewise (the orbit must be in X up to xₙ). */
export function aPosteriori(m: MapDef, x0: number, n: number): number | null {
  if (m.q === null || !m.mapsInto || n < 1) return null;
  const o = orbit(m, x0, n);
  if (o.escapedAt !== null) return null;
  return (m.q / (1 - m.q)) * Math.abs(o.xs[n] - o.xs[n - 1]);
}

/** the point the error is measured against: x* if it exists in X, else where the iterates head, else null */
export const target = (m: MapDef): number | null => m.fixed ?? m.outside;

/** |xₙ − target| (null when there is none or the orbit left X before n) */
export function trueError(m: MapDef, x0: number, n: number): number | null {
  const t = target(m);
  const o = orbit(m, x0, n);
  if (t === null || o.escapedAt !== null) return null;
  return Math.abs(o.xs[n] - t);
}

/** the smallest n in 0 … nMax with a-priori bound < tol, or null */
export function firstNApriori(m: MapDef, x0: number, tol: number = TOL, nMax: number = N_MAX): number | null {
  for (let n = 0; n <= nMax; n++) {
    const b = aPriori(m, x0, n);
    if (b !== null && b < tol) return n;
  }
  return null;
}

const length = (I: Interval) => I.hi - I.lo;
const subsetOfX = (m: MapDef, I: Interval) =>
  (I.lo > m.X.lo || (I.lo === m.X.lo && !(m.X.loOpen && !I.loOpen))) && (I.hi < m.X.hi || (I.hi === m.X.hi && !(m.X.hiOpen && !I.hiOpen)));

/**
 * I₀ = X, I_{k+1} = f(I_k), k = 0 … n, stopping early (a shorter array) when some I_k ⊄ X. Null for unbounded X.
 */
export function images(m: MapDef, n: number): Interval[] | null {
  if (!m.bounded || m.image === null) return null;
  const out: Interval[] = [m.X];
  for (let k = 1; k <= n; k++) {
    const prev = out[k - 1];
    if (!subsetOfX(m, prev)) break;
    out.push(m.image(prev));
  }
  return out;
}

export const intervalLength = length;
export const intervalHas = inInterval;

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export const sub = (k: number) => String(k).replace(/\d/g, (d) => SUB[Number(d)]);
export const sup = (k: number) => String(k).replace(/-/g, '⁻').replace(/\d/g, (d) => SUP[Number(d)]);

/** 6 significant figures, plain between 0.01 and 10⁴, otherwise a·10ⁿ; U+2212 for the minus sign */
export function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
  if (v === 0) return '0';
  const a = Math.abs(v);
  const trim = (s: string) => (s.includes('.') ? s.replace(/\.?0+$/, '') : s);
  let body: string;
  if (a >= 0.01 && a < 1e4) body = trim(Number(a.toPrecision(6)).toFixed(6));
  else {
    const e = Math.floor(Math.log10(a));
    let mant = Number((a / 10 ** e).toPrecision(4));
    let ee = e;
    if (mant >= 10) {
      mant /= 10;
      ee += 1;
    }
    body = `${trim(mant.toFixed(3))}·10${sup(ee)}`;
  }
  return v < 0 ? `−${body}` : body;
}

export interface ContractionState {
  map: MapId;
  x0: number;
  n: number;
  showBound: boolean;
  showImages: boolean;
}

/** The sentence of the figure's live region (a screen-reader description), built only from the model's numbers. */
export function describeContraction(s: ContractionState): string {
  const m = MAPS[s.map];
  const o = orbit(m, s.x0, s.n);
  const k = o.xs.length - 1;
  const parts = [`${m.formula} על X = ${m.domainText}, x₀ = ${fmtNum(s.x0)}, n = ${s.n}.`];
  if (o.escapedAt !== null) {
    parts.push(
      o.escapedAt === 0
        ? 'x₀ מחוץ ל-X.'
        : `האיטרציה יצאה מ-X: x${sub(k)} = ${fmtNum(o.xs[k])} מחוץ ל-X, והיא נעצרה שם.`,
    );
  } else {
    parts.push(`x${sub(k)} = ${fmtNum(o.xs[k])}.`);
    if (k >= 1) parts.push(`d(x${sub(k - 1)}, x${sub(k)}) = ${fmtNum(Math.abs(o.xs[k] - o.xs[k - 1]))}.`);
  }
  if (m.fixed !== null) {
    parts.push(`נקודת השבת x* = ${fmtNum(m.fixed)}.`);
    const err = trueError(m, s.x0, s.n);
    if (err !== null) parts.push(`השגיאה |x${sub(k)} − x*| = ${fmtNum(err)}.`);
  } else {
    parts.push('אין נקודת שבת ב-X.');
    if (m.outside !== null) {
      parts.push(m.id === 'half-open' ? `הסדרה שואפת ל-${fmtNum(m.outside)}, מחוץ ל-X.` : `נקודת השבת של הנוסחה היא ${fmtNum(m.outside)}, מחוץ ל-X.`);
      const err = trueError(m, s.x0, s.n);
      if (err !== null) parts.push(`המרחק |x${sub(k)} − ${fmtNum(m.outside)}| = ${fmtNum(err)}.`);
    }
  }
  if (s.showBound) {
    if (m.q === null) parts.push(`אין q < 1. ${m.qWhy}`);
    else if (!m.mapsInto) parts.push(`q = ${fmtNum(m.q)}, אבל f(X) אינה מוכלת ב-X, ולכן אין חסמים.`);
    else {
      const pr = aPriori(m, s.x0, s.n);
      const po = aPosteriori(m, s.x0, s.n);
      parts.push(`q = ${fmtNum(m.q)}.`);
      if (pr !== null) parts.push(`החסם האפריורי: ${fmtNum(pr)}.`);
      if (po !== null) parts.push(`החסם האפוסטריורי: ${fmtNum(po)}.`);
    }
  }
  if (s.showImages) {
    const im = images(m, s.n);
    if (im === null) parts.push('X אינה חסומה, ואין תמונות לסמן.');
    else if (im.length <= s.n) parts.push(`התמונה f${sup(im.length)}(X) אינה מוגדרת: f${sup(im.length - 1)}(X) אינה מוכלת ב-X.`);
    else {
      const I = im[s.n];
      parts.push(`אורך התמונה f${sup(s.n)}(X): ${fmtNum(length(I))}.`);
      if (m.q !== null) parts.push(`החסם q${sup(s.n)}·אורך(X): ${fmtNum(m.q ** s.n * length(m.X))}.`);
    }
  }
  return parts.join(' ');
}
