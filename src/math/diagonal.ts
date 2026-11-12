/**
 * MODEL SPECIFICATION
 *
 * System:        a bounded sequence of functions f_n : [0,1] → [−1, 1], n = 1, 2, …, N (N finite), and the dyadic
 *                rationals of (0,1) enumerated as q_1 = 1/2, q_2 = 1/4, q_3 = 3/4, q_4 = 1/8, q_5 = 3/8, … (level by
 *                level, left to right): a countable dense subset D of [0,1]. Two families:
 *                  shift: f_n(x) = sin(x + n)   (1-Lipschitz for every n: רציפה במידה אחידה, טענה 4.2.5(א));
 *                  osc:   f_n(x) = sin(n x)     (bounded by 1, not רציפה במידה אחידה, טענה 4.2.7(א)).
 * Rows:          the nested subsequences of למה 4.3.6. Row 0 is all of 1, …, N. Row j keeps the indices n of row j−1
 *                whose value f_n(q_j) lies in one window W_j of width w (the windows tile [−1, 1]: [−1, −1+w), …,
 *                [1−w, 1]); W_j is the window holding the most indices of row j−1 (ties: the lowest window). This is the
 *                finite stand-in for the pigeonhole step of Bolzano–Weierstrass: among finitely many windows one
 *                holds infinitely many terms; among finitely many terms the figure takes the fullest. Row j is a
 *                subsequence of row j−1, and every value of row j at q_j is in W_j: exact on these N terms.
 * Diagonal:      g_k = the k-th index (in increasing order) of row k, k = 1, …, K. It is strictly increasing because
 *                row k+1 ⊆ row k (the (k+1)-th element of a subset is at least the (k+1)-th element of the set), and
 *                g_k ∈ row j for every k ≥ j: exactly the two facts of the proof of למה 4.3.6.
 * Spread:        spreadAt(x) = max − min of g_k(x) over a tail of the diagonal; supSpread samples max_k,l ‖g_k − g_l‖∞
 *                on a grid of [0,1]: a probe.
 * Ignored:       IEEE rounding. Nothing here converges: with finitely many terms a window of fixed width replaces a
 *                limit. The figure's caption says that it is a probe; the lemma and the theorem are proved in lesson
 *                4.3.
 * Valid when:    N ≤ 50 000, K ≤ 6 rows with w = 1/2 (each row keeps about a third of the previous one, so row 6 of
 *                N = 20 000 terms still has more than 6 indices; `buildRows` reports a row that is too short).
 *
 * Also the closed forms the lesson and its bank state (each recomputed in tests/math/diagonal.test.ts): the tents of
 * טענה 3.1.9(ב) and the pointwise bound of n·t_n, the moving bumps of טענה 4.3.10(ג), the smoothed |x − 1/2| of
 * טענה 4.3.11(א), and ‖x^n − x^{2n}‖∞ = 1/4.
 */

import { tent } from './epsnet';
import { fmtNum } from './contraction';

export { fmtNum, tent };

export type FamilyId = 'shift' | 'osc';

export interface Family {
  id: FamilyId;
  /** Hebrew label for the picker */
  label: string;
  /** the formula, LTR */
  formula: string;
  f: (n: number, x: number) => number;
  /** one Lipschitz constant for the whole family, or null when there is none */
  lip: number | null;
}

export const FAMILIES: Record<FamilyId, Family> = {
  shift: { id: 'shift', label: 'הזזות', formula: 'sin(x + n)', f: (n, x) => Math.sin(x + n), lip: 1 },
  osc: { id: 'osc', label: 'תנודות', formula: 'sin(nx)', f: (n, x) => Math.sin(n * x), lip: null },
};

/** the bound of both families: |f_n(x)| ≤ 1 */
export const BOUND = 1;
/** the window width of the figure */
export const WINDOW = 0.5;
/** the number of terms the figure works with */
export const TERMS = 20000;
/** the most rows the figure builds */
export const MAX_ROWS = 6;

/** q_j, j ≥ 1: the dyadic rationals of (0,1) level by level: 1/2; 1/4, 3/4; 1/8, 3/8, 5/8, 7/8; … */
export function densePoint(j: number): number {
  if (!Number.isInteger(j) || j < 1) throw new RangeError(`densePoint: j must be a positive integer, got ${j}`);
  const level = Math.floor(Math.log2(j)) + 1; // j in [2^{level−1}, 2^level − 1]
  const i = j - 2 ** (level - 1); // 0 … 2^{level−1} − 1
  return (2 * i + 1) / 2 ** level;
}

/** the window of [−M, M] (width w) that holds v; v = M goes to the last window */
export function windowIndex(v: number, M = BOUND, w = WINDOW): number {
  const count = Math.round((2 * M) / w);
  const i = Math.floor((v + M) / w);
  return Math.max(0, Math.min(count - 1, i));
}

export interface Row {
  /** the row number j ≥ 1 */
  j: number;
  /** the point q_j */
  q: number;
  /** the window W_j = [lo, hi] (closed at hi only for the last window) */
  lo: number;
  hi: number;
  /** the indices n of the row, increasing */
  indices: number[];
}

/**
 * Rows 1 … K of the nested subsequences: row j keeps the indices of row j−1 whose value at q_j is in the fullest
 * window. Throws when a row would have fewer than j indices (the diagonal needs the j-th one).
 */
export function buildRows(fam: FamilyId, K = MAX_ROWS, N = TERMS, M = BOUND, w = WINDOW): Row[] {
  const f = FAMILIES[fam].f;
  const count = Math.round((2 * M) / w);
  let prev = Array.from({ length: N }, (_, i) => i + 1);
  const rows: Row[] = [];
  for (let j = 1; j <= K; j++) {
    const q = densePoint(j);
    const bins: number[][] = Array.from({ length: count }, () => []);
    for (const n of prev) bins[windowIndex(f(n, q), M, w)].push(n);
    let best = 0;
    for (let b = 1; b < count; b++) if (bins[b].length > bins[best].length) best = b;
    const indices = bins[best];
    if (indices.length < j) throw new RangeError(`buildRows: row ${j} has only ${indices.length} indices`);
    rows.push({ j, q, lo: -M + best * w, hi: -M + (best + 1) * w, indices });
    prev = indices;
  }
  return rows;
}

/** g_k = the k-th index of row k (1-based k), k = 1 … rows.length */
export const diagonal = (rows: readonly Row[]): number[] => rows.map((r, k) => r.indices[k]);

/** is `a` (increasing) a subsequence of `b` (increasing), i.e. a subset of it? */
export function isSubsequence(a: readonly number[], b: readonly number[]): boolean {
  let i = 0;
  for (const x of b) if (i < a.length && a[i] === x) i++;
  return i === a.length;
}

export const isIncreasing = (a: readonly number[]): boolean => a.every((x, i) => i === 0 || a[i - 1] < x);

/** is f_n(q_j) inside the window W_j of row j? (the filled circles of the figure) */
export const inWindow = (fam: FamilyId, n: number, r: Row): boolean => {
  const v = FAMILIES[fam].f(n, r.q);
  return v >= r.lo && v <= r.hi;
};

/**
 * The first place k from which the whole tail g_k, g_{k+1}, … of the diagonal of `rows` passes through the windows of
 * every row shown (all circles filled). Step 4 of the proof of למה 4.3.6 guarantees k ≤ rows.length (g_K ∈ row K); an
 * earlier k is luck of the data. Used by the figure's tail task.
 */
export function firstAllInside(fam: FamilyId, rows: readonly Row[]): number {
  const g = diagonal(rows);
  for (let k = 1; k <= g.length; k++) if (g.slice(k - 1).every((n) => rows.every((r) => inWindow(fam, n, r)))) return k;
  return g.length;
}

/** max − min of f_n(x) over the indices `idx` */
export function spreadAt(fam: FamilyId, idx: readonly number[], x: number): number {
  const f = FAMILIES[fam].f;
  let lo = Infinity;
  let hi = -Infinity;
  for (const n of idx) {
    const v = f(n, x);
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return idx.length ? hi - lo : 0;
}

/** max over x on a grid of [0,1] of spreadAt: the sampled max_{k,l} ‖g_k − g_l‖∞ (a probe) */
export function supSpread(fam: FamilyId, idx: readonly number[], samples = 2001): { value: number; at: number } {
  let value = 0;
  let at = 0;
  for (let i = 0; i < samples; i++) {
    const x = i / (samples - 1);
    const s = spreadAt(fam, idx, x);
    if (s > value) {
      value = s;
      at = x;
    }
  }
  return { value, at };
}

/** the largest spread of the indices `idx` at the points q_1 … q_m of D */
export function spreadOnD(fam: FamilyId, idx: readonly number[], m: number): number {
  let s = 0;
  for (let j = 1; j <= m; j++) s = Math.max(s, spreadAt(fam, idx, densePoint(j)));
  return s;
}

/* ---- closed forms of the lesson ---- */

/** n·t_n(x): the scaled tents of טענה 4.3.5 */
export const scaledTent = (n: number, x: number) => n * tent(n, x);

/** the indices n ≥ 1 with t_n(x) ≠ 0: at most one (the open supports (2^{−n}, 2^{−n+1}) are disjoint) */
export function tentsAlive(x: number, nMax = 60): number[] {
  const out: number[] = [];
  for (let n = 1; n <= nMax; n++) if (tent(n, x) !== 0) out.push(n);
  return out;
}

/** the moving bump of טענה 4.3.10(ג): f_n(x) = max(0, 1 − |x − n|) on ℝ */
export const bump = (n: number, x: number) => Math.max(0, 1 - Math.abs(x - n));

/** the smoothed corner of טענה 4.3.11(א): √((x − 1/2)² + 1/n²) */
export const smoothAbs = (n: number, x: number) => Math.sqrt((x - 0.5) ** 2 + 1 / (n * n));

/** sampled sup of |g − h| on [a, b] with the given extra points (breakpoints) included */
export function supDiff(g: (x: number) => number, h: (x: number) => number, a: number, b: number, extra: number[] = [], n = 20000): number {
  let s = 0;
  const xs = [...Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n), ...extra];
  for (const x of xs) s = Math.max(s, Math.abs(g(x) - h(x)));
  return s;
}

/* ---- descriptions (aria-live) ---- */

export function describe(s: { fam: FamilyId; rows: number; sel: number; x: number }, rows: readonly Row[]): string {
  const F = FAMILIES[s.fam];
  const g = diagonal(rows);
  const tail = g.slice(s.sel - 1);
  return (
    `המשפחה ${F.formula}, ${s.rows} שורות. ` +
    `האלכסון: ${g.join(', ')}. ` +
    `השורה המודגשת ${s.sel}; פונקציות האלכסון ממקום ${s.sel} והלאה רחוקות זו מזו בנקודה ${fmtNum(Number(s.x.toFixed(3)))} עד ${fmtNum(Number(spreadAt(s.fam, tail, s.x).toFixed(3)))}.`
  );
}
