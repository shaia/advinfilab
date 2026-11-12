/**
 * MODEL SPECIFICATION
 *
 * System:        a set X ⊆ ℝ with d(x, y) = |x − y| (an interval with open/closed ends, or the sequence set
 *                {1/n : n ∈ ℕ}, with or without 0) and a family of open intervals of ℝ that covers X. The figure
 *                selects finitely many of them (a prefix U₂, …, U_N of an infinite family, or any subset of a finite
 *                one) and asks: do they cover X, what is left uncovered, does the open ball B_X(x, δ) of the space X lie
 *                in one of them, and what is the largest Lebesgue number of the selection (lesson 3.2, def. 3.2.7).
 * Arithmetic:    every endpoint is rational, so all of it is exact: a rational is a reduced pair p/q of safe integers
 *                (q > 0). The probe x and the radius δ live on the grid 1/GRID_DEN (the sliders' step), so they are
 *                rational too, and "B(x, δ) fits" and "δ is the largest Lebesgue number" are exact comparisons.
 * Coverage:      for an interval X: X minus the union of finitely many open intervals is a finite union of intervals
 *                (sort by left end, merge overlapping ones; a shared endpoint (a, b) ∪ (b, c) leaves b uncovered).
 *                For the sequence set: an open interval (l, r) with l ≤ 0 < r contains every 1/n < r, so with ρ the
 *                largest such r only the finitely many n ≤ 1/ρ are checked one by one; without such an interval an
 *                interval (l, r) with l > 0 contains 1/n only for n < 1/l, so every n ≥ M = max ⌊1/l⌋ + 1 is uncovered
 *                (infinitely many points), and the figure says so.
 * Ball in X:     B_X(x, δ) = {y ∈ X : |y − x| < δ}. For X an interval and x ∈ (l, r): B_X(x, δ) ⊆ (l, r) iff
 *                (no point of X is ≤ l, or x − δ ≥ l) and (no point of X is ≥ r, or x + δ ≤ r). "No point of X is ≤ l"
 *                means l < inf X, or l = inf X with X open there. So φ(x) = the largest δ that fits (x − l and/or r − x,
 *                or ∞ when X ⊆ (l, r)); φ = 0 when x ∉ (l, r).
 * Lebesgue:      δ > 0 is a Lebesgue number of the selection iff δ ≤ g(x) := max_j φ_j(x) for every x ∈ X, so the
 *                largest one is inf_X g (it is itself a Lebesgue number: the condition is a weak inequality). For a
 *                finite selection that covers an interval, g is continuous on X and linear between consecutive points
 *                of C = {ends of X} ∪ {l_j, r_j} ∪ {(l_j + r_k)/2}, so inf g = min of g over C ∩ closure(X), where at an
 *                open end of X the one-sided limit from inside X is used (membership l_j ≤ c < r_j at the left end,
 *                l_j < c ≤ r_j at the right end). If one selected interval contains X, every δ > 0 works: ∞.
 *                Computed for interval sets only; for the sequence set the figure reports coverage only.
 * Ignored:       nothing numerical: no floating point enters a decision (toNumber is for drawing only).
 * Valid when:    selections are finite (the figure never holds infinitely many sets; an infinite cover's behaviour is
 *                proved in the lesson, and the captions say the figure is a probe).
 *
 * Drives the figure of lesson 3.2 (CoverGame).
 */

/* ------------------------------------------------------------------ exact rationals */

export interface Rat {
  readonly p: number;
  readonly q: number;
}

const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
};

export function rat(p: number, q = 1): Rat {
  if (!Number.isSafeInteger(p) || !Number.isSafeInteger(q) || q === 0) throw new Error(`rat(${p}, ${q}): not a ratio of safe integers`);
  if (q < 0) {
    p = -p;
    q = -q;
  }
  const g = gcd(p, q);
  return { p: p / g, q: q / g };
}

export const add = (a: Rat, b: Rat) => rat(a.p * b.q + b.p * a.q, a.q * b.q);
export const subR = (a: Rat, b: Rat) => rat(a.p * b.q - b.p * a.q, a.q * b.q);
export const mid = (a: Rat, b: Rat) => rat(a.p * b.q + b.p * a.q, 2 * a.q * b.q);
export const cmp = (a: Rat, b: Rat) => Math.sign(a.p * b.q - b.p * a.q);
export const eq = (a: Rat, b: Rat) => cmp(a, b) === 0;
export const lt = (a: Rat, b: Rat) => cmp(a, b) < 0;
export const le = (a: Rat, b: Rat) => cmp(a, b) <= 0;
export const minR = (a: Rat, b: Rat) => (le(a, b) ? a : b);
export const maxR = (a: Rat, b: Rat) => (le(a, b) ? b : a);
export const toNumber = (a: Rat) => a.p / a.q;
export const ZERO = rat(0);
export const ONE = rat(1);

/** the denominator of the probe and radius grid: sliders step by 1/200 = 0.005 */
export const GRID_DEN = 200;
export const onGrid = (v: number) => rat(Math.round(v * GRID_DEN), GRID_DEN);

/** A decimal when the denominator has only the factors 2 and 5 (at most 4 places), otherwise p/q. */
export function fmtRat(a: Rat): string {
  let q = a.q;
  while (q % 2 === 0) q /= 2;
  while (q % 5 === 0) q /= 5;
  if (q === 1) {
    const s = toNumber(a).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
    if (Number(s) === toNumber(a)) return s === '-0' ? '0' : s;
  }
  return `${a.p}/${a.q}`;
}

/* ------------------------------------------------------------------ sets and families */

export interface IntervalSet {
  kind: 'interval';
  lo: Rat;
  hi: Rat;
  loOpen: boolean;
  hiOpen: boolean;
}
/** {1/n : n ∈ ℕ}, with 0 when `zero` */
export interface SeqSet {
  kind: 'seq';
  zero: boolean;
}
export type CoverSet = IntervalSet | SeqSet;

/** an open interval (l, r) of ℝ, with its name in the figure (U₅, V₀, W₂) */
export interface OpenIv {
  l: Rat;
  r: Rat;
  name: string;
}

const SUB = '₀₁₂₃₄₅₆₇₈₉';
export const sub = (k: number) => String(k).replace(/\d/g, (d) => SUB[Number(d)]);

/** U_n = (1/n, 1), n ≥ 2 */
export const tailIv = (n: number): OpenIv => ({ l: rat(1, n), r: ONE, name: `U${sub(n)}` });
/** V₀ = (−3/20, 3/20); V_n = (1/n − ρ_n, 1/n + ρ_n) with ρ_n = 1/(3n(n+1)), n ≥ 1: V_n meets the sequence set only in 1/n */
export const pointIv = (n: number): OpenIv => {
  if (n === 0) return { l: rat(-3, 20), r: rat(3, 20), name: 'V₀' };
  const c = rat(1, n);
  const rho = rat(1, 3 * n * (n + 1));
  return { l: subR(c, rho), r: add(c, rho), name: `V${sub(n)}` };
};
/** a finite family over [0, 1]: W₁ = (−0.1, 0.4), W₂ = (0.3, 0.7), W₃ = (0.6, 1.1), W₄ = (0.15, 0.55), W₅ = (0.45, 0.85) */
export const BLOCKS: OpenIv[] = [
  [-10, 40],
  [30, 70],
  [60, 110],
  [15, 55],
  [45, 85],
].map(([l, r], i) => ({ l: rat(l, 100), r: rat(r, 100), name: `W${sub(i + 1)}` }));

export const TAIL_MAX = 200;
export const POINTS_MAX = 20;

export type PresetId = 'tail-inner' | 'tail-open' | 'points-K' | 'points-Kstar' | 'blocks';

export interface Preset {
  id: PresetId;
  set: CoverSet;
  /** the set as text, for readouts and the picker */
  setText: string;
  family: 'tail' | 'points' | 'blocks';
  /** the family as text */
  familyText: string;
  /** prefix: the slider N chooses the first sets; pick: toggles */
  select: 'prefix' | 'pick';
  nMin: number;
  nMax: number;
  /** points family: V₀ may be switched on */
  allowV0: boolean;
  /** plot window on the line */
  window: [number, number];
}

const iv = (lo: Rat, hi: Rat, loOpen: boolean, hiOpen: boolean): IntervalSet => ({ kind: 'interval', lo, hi, loOpen, hiOpen });

export const PRESETS: Record<PresetId, Preset> = {
  'tail-inner': {
    id: 'tail-inner',
    set: iv(rat(3, 100), rat(97, 100), false, false),
    setText: '[0.03, 0.97]',
    family: 'tail',
    familyText: 'U_n = (1/n, 1)',
    select: 'prefix',
    nMin: 2,
    nMax: TAIL_MAX,
    allowV0: false,
    window: [-0.08, 1.08],
  },
  'tail-open': {
    id: 'tail-open',
    set: iv(ZERO, ONE, true, true),
    setText: '(0, 1)',
    family: 'tail',
    familyText: 'U_n = (1/n, 1)',
    select: 'prefix',
    nMin: 2,
    nMax: TAIL_MAX,
    allowV0: false,
    window: [-0.08, 1.08],
  },
  'points-K': {
    id: 'points-K',
    set: { kind: 'seq', zero: true },
    setText: 'K = {0} ∪ {1/n}',
    family: 'points',
    familyText: 'V₀, V₁, V₂, …',
    select: 'prefix',
    nMin: 0,
    nMax: POINTS_MAX,
    allowV0: true,
    window: [-0.2, 1.08],
  },
  'points-Kstar': {
    id: 'points-Kstar',
    set: { kind: 'seq', zero: false },
    setText: '{1/n}',
    family: 'points',
    familyText: 'V₁, V₂, V₃, …',
    select: 'prefix',
    nMin: 0,
    nMax: POINTS_MAX,
    allowV0: false,
    window: [-0.2, 1.08],
  },
  blocks: {
    id: 'blocks',
    set: iv(ZERO, ONE, false, false),
    setText: '[0, 1]',
    family: 'blocks',
    familyText: 'W₁, …, W₅',
    select: 'pick',
    nMin: 0,
    nMax: 0,
    allowV0: false,
    window: [-0.15, 1.15],
  },
};

export interface Selection {
  /** prefix families: tail U₂…U_n (n ≥ 2), points V₁…V_n (n ≥ 0, none when n = 0) */
  n: number;
  /** points family: V₀ included */
  v0: boolean;
  /** blocks: which of W₁…W₅ */
  picks: boolean[];
}

/** The finitely many sets the figure currently holds. */
export function selected(pr: Preset, s: Selection): OpenIv[] {
  if (pr.family === 'blocks') return BLOCKS.filter((_, i) => s.picks[i]);
  if (pr.family === 'tail') {
    const out: OpenIv[] = [];
    for (let k = 2; k <= s.n; k++) out.push(tailIv(k));
    return out;
  }
  const out: OpenIv[] = [];
  if (pr.allowV0 && s.v0) out.push(pointIv(0));
  for (let k = 1; k <= s.n; k++) out.push(pointIv(k));
  return out;
}

/* ------------------------------------------------------------------ coverage */

export interface Piece {
  lo: Rat;
  hi: Rat;
  loOpen: boolean;
  hiOpen: boolean;
}

export const pieceEmpty = (p: Piece) => lt(p.hi, p.lo) || (eq(p.hi, p.lo) && (p.loOpen || p.hiOpen));

/** X ∖ ⋃ ivs for an interval X: a list of disjoint nonempty pieces, left to right. */
export function uncoveredInterval(X: IntervalSet, ivs: OpenIv[]): Piece[] {
  const sorted = [...ivs].sort((a, b) => cmp(a.l, b.l));
  // merge: overlapping open intervals join; touching ones (r = l') leave their common end uncovered
  const merged: { l: Rat; r: Rat }[] = [];
  for (const v of sorted) {
    const last = merged[merged.length - 1];
    if (last && lt(v.l, last.r)) last.r = maxR(last.r, v.r);
    else merged.push({ l: v.l, r: v.r });
  }
  // gaps of the union: (−∞, l₁], [r₁, l₂], …, [r_k, ∞)  (closed where they meet the union)
  const gaps: { lo: Rat | null; hi: Rat | null }[] = [];
  let prev: Rat | null = null;
  for (const m of merged) {
    gaps.push({ lo: prev, hi: m.l });
    prev = m.r;
  }
  gaps.push({ lo: prev, hi: null });
  const out: Piece[] = [];
  for (const g of gaps) {
    // intersect the closed gap with X
    let lo = X.lo;
    let loOpen = X.loOpen;
    if (g.lo !== null) {
      if (lt(X.lo, g.lo)) {
        lo = g.lo;
        loOpen = false;
      }
    }
    let hi = X.hi;
    let hiOpen = X.hiOpen;
    if (g.hi !== null) {
      if (lt(g.hi, X.hi)) {
        hi = g.hi;
        hiOpen = false;
      }
    }
    const p = { lo, hi, loOpen, hiOpen };
    if (!pieceEmpty(p)) out.push(p);
  }
  return out;
}

export interface SeqUncovered {
  /** 0 is in the set and not covered */
  zero: boolean;
  /** the finitely many n < tailFrom with 1/n uncovered */
  ns: number[];
  /** every n ≥ tailFrom is uncovered (infinitely many points), or null */
  tailFrom: number | null;
}

const inIv = (x: Rat, v: OpenIv) => lt(v.l, x) && lt(x, v.r);

export function uncoveredSeq(X: SeqSet, ivs: OpenIv[]): SeqUncovered {
  const zero = X.zero && !ivs.some((v) => inIv(ZERO, v));
  // ρ: the largest r of an interval (l, r) with l ≤ 0 < r, which contains every 1/n < r
  let rho: Rat | null = null;
  for (const v of ivs) if (le(v.l, ZERO) && lt(ZERO, v.r)) rho = rho === null ? v.r : maxR(rho, v.r);
  let limit: number;
  let tailFrom: number | null = null;
  if (rho !== null) {
    // 1/n < ρ for n > 1/ρ: those are covered; check n ≤ ⌊1/ρ⌋ (at least n = 1)
    limit = Math.max(1, Math.floor(rho.q / rho.p));
  } else {
    // an interval with l > 0 contains 1/n only for n < 1/l
    let M = 1;
    for (const v of ivs) if (lt(ZERO, v.l)) M = Math.max(M, Math.floor(v.l.q / v.l.p) + 1);
    tailFrom = M;
    limit = M - 1;
  }
  const ns: number[] = [];
  for (let n = 1; n <= limit; n++) if (!ivs.some((v) => inIv(rat(1, n), v))) ns.push(n);
  return { zero, ns, tailFrom };
}

export function covers(X: CoverSet, ivs: OpenIv[]): boolean {
  if (X.kind === 'interval') return uncoveredInterval(X, ivs).length === 0;
  const u = uncoveredSeq(X, ivs);
  return !u.zero && u.ns.length === 0 && u.tailFrom === null;
}

/* ------------------------------------------------------------------ balls and Lebesgue numbers */

/** no point of X lies at or left of l */
const leftFree = (X: IntervalSet, l: Rat) => lt(l, X.lo) || (eq(l, X.lo) && X.loOpen);
/** no point of X lies at or right of r */
const rightFree = (X: IntervalSet, r: Rat) => lt(X.hi, r) || (eq(r, X.hi) && X.hiOpen);
/** X ⊆ (l, r) */
export const containsX = (X: IntervalSet, v: OpenIv) => leftFree(X, v.l) && rightFree(X, v.r);

/**
 * φ(x): the largest δ with B_X(x, δ) ⊆ v, for x in the closure of X; `side` says how membership is read at an open end
 * of X (the limit from inside X). Returns null for ∞ (X ⊆ v) and ZERO when x is not in v.
 */
export function phi(X: IntervalSet, v: OpenIv, x: Rat, side: 'in' | 'from-right' | 'from-left' = 'in'): Rat | null {
  const member =
    side === 'from-right' ? le(v.l, x) && lt(x, v.r) : side === 'from-left' ? lt(v.l, x) && le(x, v.r) : inIv(x, v);
  if (!member) return ZERO;
  const lf = leftFree(X, v.l);
  const rf = rightFree(X, v.r);
  if (lf && rf) return null;
  if (lf) return subR(v.r, x);
  if (rf) return subR(x, v.l);
  return minR(subR(x, v.l), subR(v.r, x));
}

/** g(x) = max over the selection of φ(x); null for ∞ */
export function slack(X: IntervalSet, ivs: OpenIv[], x: Rat, side: 'in' | 'from-right' | 'from-left' = 'in'): Rat | null {
  let best: Rat = ZERO;
  for (const v of ivs) {
    const f = phi(X, v, x, side);
    if (f === null) return null;
    best = maxR(best, f);
  }
  return best;
}

/** Does B_X(x, δ) lie in one of the selected sets? Returns the first such set, or null. x must be a point of X. */
export function ballHome(X: IntervalSet, ivs: OpenIv[], x: Rat, delta: Rat): OpenIv | null {
  for (const v of ivs) {
    const f = phi(X, v, x);
    if (f === null || (lt(ZERO, f) && le(delta, f))) return v;
  }
  return null;
}

export interface Lebesgue {
  /** the largest Lebesgue number, or null for ∞ (one selected set contains X) */
  value: Rat | null;
  /** a point of the closure of X where g attains the infimum (an open end of X when the infimum is a limit) */
  at: Rat | null;
  atOpenEnd: boolean;
}

/** The largest Lebesgue number of a finite selection that covers the interval X; null when it does not cover. */
export function largestLebesgue(X: IntervalSet, ivs: OpenIv[]): Lebesgue | null {
  if (!covers(X, ivs)) return null;
  if (ivs.some((v) => containsX(X, v))) return { value: null, at: null, atOpenEnd: false };
  const cands: Rat[] = [X.lo, X.hi];
  for (const v of ivs) cands.push(v.l, v.r);
  for (const a of ivs) for (const b of ivs) cands.push(mid(a.l, b.r));
  let best: Rat | null = null;
  let at: Rat | null = null;
  let atOpenEnd = false;
  for (const c of cands) {
    if (lt(c, X.lo) || lt(X.hi, c)) continue;
    const atLo = eq(c, X.lo) && X.loOpen;
    const atHi = eq(c, X.hi) && X.hiOpen;
    const g = slack(X, ivs, c, atLo ? 'from-right' : atHi ? 'from-left' : 'in');
    if (g === null) continue;
    if (best === null || lt(g, best)) {
      best = g;
      at = c;
      atOpenEnd = atLo || atHi;
    }
  }
  return { value: best, at, atOpenEnd };
}

/* ------------------------------------------------------------------ what the tasks look for */

/** The smallest N for which the prefix selection covers X (V₀ as given), or null if none up to nMax does. */
export function minPrefixN(pr: Preset, v0: boolean): number | null {
  for (let n = pr.nMin; n <= pr.nMax; n++) if (covers(pr.set, selected(pr, { n, v0, picks: [] }))) return n;
  return null;
}

/** The fewest blocks that cover X, and every subset (as a bit mask) of that size that does. */
export function fewestBlocks(pr: Preset): { count: number; masks: number[] } {
  let count = Infinity;
  let masks: number[] = [];
  for (let m = 1; m < 1 << BLOCKS.length; m++) {
    const picks = BLOCKS.map((_, i) => ((m >> i) & 1) === 1);
    if (!covers(pr.set, selected(pr, { n: 0, v0: false, picks }))) continue;
    const c = picks.filter(Boolean).length;
    if (c < count) {
      count = c;
      masks = [m];
    } else if (c === count) masks.push(m);
  }
  return { count, masks };
}

/* ------------------------------------------------------------------ text */

export function pieceText(p: Piece): string {
  if (eq(p.lo, p.hi)) return `{${fmtRat(p.lo)}}`;
  return `${p.loOpen ? '(' : '['}${fmtRat(p.lo)}, ${fmtRat(p.hi)}${p.hiOpen ? ')' : ']'}`;
}

/** the uncovered part as one LTR string */
export function uncoveredText(X: CoverSet, ivs: OpenIv[]): string {
  if (X.kind === 'interval') return uncoveredInterval(X, ivs).map(pieceText).join(' ∪ ');
  const u = uncoveredSeq(X, ivs);
  const parts: string[] = [];
  if (u.zero) parts.push('0');
  for (const n of u.ns) parts.push(n === 1 ? '1' : `1/${n}`);
  if (u.tailFrom !== null) parts.push(`1/n for all n ≥ ${u.tailFrom}`);
  return parts.join(', ');
}

export interface CoverState {
  preset: PresetId;
  sel: Selection;
  x: number;
  delta: number;
  showProbe: boolean;
  showL: boolean;
}

/** One Hebrew sentence for the screen-reader line and the canvas label. */
export function describeCover(s: CoverState): string {
  const pr = PRESETS[s.preset];
  const ivs = selected(pr, s.sel);
  const names = ivs.length === 0 ? 'אף קבוצה' : ivs.length <= 6 ? ivs.map((v) => v.name).join(', ') : `${ivs[0].name}, …, ${ivs[ivs.length - 1].name}`;
  const parts = [`הקבוצה X = ${pr.setText}. נבחרו ${ivs.length} קבוצות: ${names}.`];
  if (covers(pr.set, ivs)) parts.push('הן מכסות את X.');
  else parts.push(`הן אינן מכסות את X; לא מכוסה: ${uncoveredText(pr.set, ivs)}.`);
  if (pr.set.kind === 'interval' && s.showProbe) {
    const x = onGrid(s.x);
    const d = onGrid(s.delta);
    const home = ballHome(pr.set, ivs, x, d);
    parts.push(home ? `הכדור B(${fmtRat(x)}, ${fmtRat(d)}) מוכל ב-${home.name}.` : `הכדור B(${fmtRat(x)}, ${fmtRat(d)}) אינו מוכל באף קבוצה שנבחרה.`);
  }
  if (pr.set.kind === 'interval' && s.showL) {
    const L = largestLebesgue(pr.set, ivs);
    if (L) parts.push(L.value === null ? 'כל δ > 0 הוא מספר לבג: קבוצה אחת מכילה את X.' : `מספר לבג הגדול ביותר: ${fmtRat(L.value)}.`);
  }
  return parts.join(' ');
}
