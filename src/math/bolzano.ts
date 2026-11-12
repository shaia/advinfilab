/**
 * MODEL SPECIFICATION
 *
 * System:        a sequence x₁, x₂, … of points of the plane ℝ² (indices n ∈ ℕ = {1, 2, …}), of which the first N
 *                are drawn. Three presets are bounded: every term lies in the square Q₀ = [−1, 1]² (side 2, the
 *                closed d∞-ball B[0, 1]); one preset (`escape`) is not bounded.
 * Construction:  the second proof of the Bolzano–Weierstrass theorem in ℝ² (lesson 3.1, משפט 3.1.7, proof by
 *                quartering). Put n₀ = 0 (not an index). At level j ≥ 0 the current square Q_j is cut into four closed
 *                quarters of half the side; the proof keeps a quarter that contains x_n for infinitely many n, and
 *                picks the first index n_{j+1} > n_j with x_{n_{j+1}} in it. Then x_{n_i} ∈ Q_i ⊆ Q_j for every i ≥ j,
 *                and the side of Q_j is 2·2^{−j}, so the d∞-distance between any two of x_{n_j}, x_{n_{j+1}}, … is at
 *                most 2^{1−j}: the subsequence is a Cauchy sequence.
 * Probe:         with only N terms drawn, "infinitely many" cannot be checked. The probe keeps, among the terms with
 *                index > n_j that lie in Q_j, the quarter holding the most of them (ties: the first quarter in the
 *                order lower-left, lower-right, upper-left, upper-right). Each term is assigned to one quarter by
 *                half-open cuts (x < middle → left, y < middle → lower), so the four counts add up; every assigned
 *                point lies in the closed quarter. When the kept quarter holds no later term the construction stops
 *                (`ranOut`): the drawn terms are used up, which can never happen with the infinitely many terms of
 *                the proof. Each level keeps at least a quarter of the remaining terms, so with N ≥ 4^j terms the
 *                probe reaches level j.
 * Presets:       irrational  x_n = (2{n√2} − 1, 2{n√3} − 1)  ({t} = t − ⌊t⌋): distinct terms spread over Q₀;
 *                circle      x_n = (cos n, sin n): distinct terms on the unit circle;
 *                corners     x_n = (½ + 1/(2n))·((−1)ⁿ, (−1)^{⌊n/2⌋}): four classes n mod 4, each tending to one of
 *                            (±½, ±½) from outside; the subsequence the probe builds tends to one of them;
 *                escape      x_n = (n/20)·(cos n, sin n): d₂(x_n, 0) = n/20 → ∞, no bounded square holds all terms.
 *                All terms of every preset are distinct (irrational: √2 ∉ ℚ; circle: n − m is never a multiple of 2π;
 *                corners and escape: the distance to 0 is strictly monotone in n), so in the discrete metric any two
 *                terms of a subsequence are at distance 1.
 * Ignored:       IEEE rounding (relative 1e-15); for `irrational` the fractional part of n√2 is computed in floating
 *                point, which is exact enough to place a point in its quarter except within 1e-12 of a cut (the
 *                tests check that no drawn term lies that close to a cut down to level 7).
 * Valid when:    1 ≤ N ≤ N_MAX, 0 ≤ depth ≤ DEPTH_MAX. A numerical probe never proves: the lesson proves the theorem.
 *
 * Drives the figure of lesson 3.1 (BolzanoBox).
 */

export type SeqId = 'irrational' | 'circle' | 'corners' | 'escape';

export interface Pt {
  x: number;
  y: number;
}

/** a closed square [x, x + side] × [y, y + side] */
export interface Square {
  x: number;
  y: number;
  side: number;
}

export interface SeqDef {
  id: SeqId;
  /** Hebrew name for the picker */
  name: string;
  /** the formula, LTR, for readouts */
  formula: string;
  term: (n: number) => Pt;
  bounded: boolean;
}

const frac = (t: number) => t - Math.floor(t);

export const SEQS: Record<SeqId, SeqDef> = {
  irrational: {
    id: 'irrational',
    name: 'פיזור אי-רציונלי',
    formula: 'xₙ = (2{n√2} − 1, 2{n√3} − 1)',
    term: (n) => ({ x: 2 * frac(n * Math.SQRT2) - 1, y: 2 * frac(n * Math.sqrt(3)) - 1 }),
    bounded: true,
  },
  circle: {
    id: 'circle',
    name: 'מעגל היחידה',
    formula: 'xₙ = (cos n, sin n)',
    term: (n) => ({ x: Math.cos(n), y: Math.sin(n) }),
    bounded: true,
  },
  corners: {
    id: 'corners',
    name: 'ארבע פינות',
    formula: 'xₙ = (½ + 1/(2n))·((−1)ⁿ, (−1)ᵏ), k = ⌊n/2⌋',
    term: (n) => {
      const r = 0.5 + 1 / (2 * n);
      return { x: r * (n % 2 === 0 ? 1 : -1), y: r * (Math.floor(n / 2) % 2 === 0 ? 1 : -1) };
    },
    bounded: true,
  },
  escape: {
    id: 'escape',
    name: 'סדרה לא חסומה',
    formula: 'xₙ = (n/20)·(cos n, sin n)',
    term: (n) => ({ x: (n / 20) * Math.cos(n), y: (n / 20) * Math.sin(n) }),
    bounded: false,
  },
};

export const SEQ_IDS = Object.keys(SEQS) as SeqId[];

/** the numbers of drawn terms the slider offers */
export const N_CHOICES = [50, 200, 1000, 5000, 20000] as const;
export const N_MAX = N_CHOICES[N_CHOICES.length - 1];
export const DEPTH_MAX = 10;
/** the starting square Q₀ = [−1, 1]² */
export const Q0: Square = { x: -1, y: -1, side: 2 };

/** the side of Q_j: 2·2^{−j} */
export const sideAt = (j: number) => 2 * 2 ** -j;

/** the first N terms x₁, …, x_N; entry i − 1 is x_i */
export function terms(seq: SeqDef, N: number): Pt[] {
  return Array.from({ length: N }, (_, i) => seq.term(i + 1));
}

/** the quarter of Q that p is assigned to: 0 lower-left, 1 lower-right, 2 upper-left, 3 upper-right (half-open cuts) */
export function quarterOf(p: Pt, Q: Square): number {
  const h = Q.side / 2;
  return (p.x < Q.x + h ? 0 : 1) + (p.y < Q.y + h ? 0 : 2);
}

/** quarter q of Q, as a closed square */
export function quarter(Q: Square, q: number): Square {
  const h = Q.side / 2;
  return { x: Q.x + (q % 2) * h, y: Q.y + (q >= 2 ? h : 0), side: h };
}

/** p lies in the closed square Q */
export const inSquare = (p: Pt, Q: Square, tol = 0) =>
  p.x >= Q.x - tol && p.x <= Q.x + Q.side + tol && p.y >= Q.y - tol && p.y <= Q.y + Q.side + tol;

export const dInf = (p: Pt, q: Pt) => Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y));
export const d2 = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.y - q.y);
export const dDiscrete = (p: Pt, q: Pt) => (p.x === q.x && p.y === q.y ? 0 : 1);

export interface Chain {
  /** Q₀, Q₁, …, Q_J (J = picks.length) */
  squares: Square[];
  /** n₁ < n₂ < … < n_J */
  picks: number[];
  /** counts[j] = the number of drawn terms with index > n_j in each quarter of Q_j (j = 0 … J − 1, or J when ranOut) */
  counts: number[][];
  /** the drawn terms with index > n_J that lie in Q_J */
  remaining: number;
  /** the construction stopped before the requested depth: the kept quarter held no later drawn term */
  ranOut: boolean;
}

/**
 * The quartering construction to level `depth` on the first N terms (see the specification). Returns null for an
 * unbounded preset, where the proof has no square to start from.
 */
export function quarterChain(seq: SeqDef, N: number, depth: number): Chain | null {
  if (!seq.bounded) return null;
  const pts = terms(seq, N);
  // S_j: indices (1-based) greater than n_j whose term lies in Q_j, in increasing order
  let S = pts.map((_, i) => i + 1).filter((n) => inSquare(pts[n - 1], Q0));
  const squares: Square[] = [Q0];
  const picks: number[] = [];
  const counts: number[][] = [];
  let ranOut = false;
  for (let j = 0; j < depth; j++) {
    const Q = squares[j];
    const c = [0, 0, 0, 0];
    for (const n of S) c[quarterOf(pts[n - 1], Q)]++;
    counts.push(c);
    let best = 0;
    for (let q = 1; q < 4; q++) if (c[q] > c[best]) best = q;
    if (c[best] === 0) {
      ranOut = true;
      break;
    }
    const inBest = S.filter((n) => quarterOf(pts[n - 1], Q) === best);
    picks.push(inBest[0]);
    squares.push(quarter(Q, best));
    S = inBest.slice(1);
  }
  return { squares, picks, counts, remaining: S.length, ranOut };
}

/** the largest d∞-distance between two of the picked terms x_{n_j}, x_{n_{j+1}}, … (from level j ≥ 1 on) */
export function tailSpread(seq: SeqDef, picks: number[], j: number): number {
  const pts = picks.slice(j - 1).map((n) => seq.term(n));
  let m = 0;
  for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) m = Math.max(m, dInf(pts[a], pts[b]));
  return m;
}

/** a short number for readouts: up to 4 significant digits, a true minus sign */
export function fmtNum(v: number): string {
  if (v === 0) return '0';
  const a = Math.abs(v);
  const s = a >= 1e-3 && a < 1e5 ? String(Number(v.toPrecision(4))) : v.toExponential(2);
  return s.replace('-', '−');
}

/** subscript digits for labels like x₁₂ */
export const sub = (n: number) => String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]);

export interface BolzanoState {
  seq: SeqId;
  N: number;
  depth: number;
  discrete: boolean;
  /**
   * For the unbounded preset: state the conclusion (no bounded square holds every term). The figure withholds it while
   * the task that asks this question is open, so the readout does not answer the task for the student. Default true.
   */
  verdict?: boolean;
}

/** a plain-language description for screen readers */
export function describeBolzano(s: BolzanoState): string {
  const seq = SEQS[s.seq];
  if (!seq.bounded) {
    const facts = `${seq.formula}, ${s.N} איברים מצוירים: d₂(x${sub(s.N)}, 0) = ${s.N}/20 = ${fmtNum(s.N / 20)}.`;
    return s.verdict === false
      ? `${facts} הריבוע המקווקו הוא Q₀ = [−1, 1]².`
      : `${facts} הסדרה אינה חסומה: d₂(xₙ, 0) = n/20, ולכן אין ריבוע חסום שמכיל את כל איבריה, וההוכחה בחציות לא יכולה להתחיל.`;
  }
  const ch = quarterChain(seq, s.N, s.depth)!;
  const J = ch.picks.length;
  const parts = [`${seq.formula}, ${s.N} איברים מצוירים, ${J} חציות.`];
  if (J > 0) parts.push(`האינדקסים שנבחרו: ${ch.picks.join(', ')}. צלע הריבוע האחרון ${fmtNum(sideAt(J))}.`);
  if (ch.ranOut) parts.push(`בשלב ${J + 1} לא נשאר בין האיברים המצוירים איבר מתאים: צריך לצייר יותר איברים.`);
  if (s.discrete) parts.push('במטריקה הבדידה המרחק בין כל שני איברים שונים של תת-הסדרה הוא 1.');
  return parts.join(' ');
}
