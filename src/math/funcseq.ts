/**
 * MODEL SPECIFICATION
 *
 * System:        sequences of bounded real functions fₙ on a closed interval [a, b], each with its pointwise limit f,
 *                as points of the space B([a, b]) with the sup metric d∞(g, h) = sup |g − h|. The ball B(f, ε) is
 *                the set of functions whose graph lies in the open tube {|y − f(x)| < ε}, up to the sup: g ∈ B(f, ε)
 *                iff sup |g − f| < ε.
 * Dynamics:      none; n is an index.
 * Boundary:      every preset carries its exact sup distance sₙ = sup |fₙ − f| as a closed formula (derived in the
 *                comment beside it) and the point where it is attained, or null when it is a supremum that is not a
 *                maximum (xⁿ on [0, 1]: the sup 1 is approached as x → 1⁻; the ramp: as x → ½⁺). The tests compare
 *                each formula with the sampled sup of src/math/multivar.ts (supDist), which is a probe, not a proof.
 *                A preset may also carry the exact L¹ distance l1(n) = ∫ |fₙ − f| (only the ramp does); the tests
 *                compare it with Simpson's rule, again a probe.
 *                The limit may have a jump at x = `jump` (a ≤ jump ≤ b): limit(jump) is its value there, and when
 *                jump < b the limit continues on (jump, b] (the ramp: 0 up to ½ inclusive, 1 on (½, 1]).
 * Ignored:       IEEE rounding of the formulas (relative 1e-15). The exp-series sup is summed as a tail, never as
 *                e − sₙ(1), which would cancel to noise of size 4e-16 for n ≳ 15.
 * Valid when:    n ≥ 1 is an integer.
 * Failure modes: `firstInTube` scans n ≤ nMax only: "from this n on" is checked on a window. For every preset here
 *                sₙ is non-increasing in n (proved beside each formula), so the window answer is the true one; a new
 *                preset must keep that property or change the scan.
 *
 * Drives the figure of lessons 1.5, 2.2 and 2.4 (FunctionBall): the tube B(f, ε) around the limit and the graph of fₙ.
 *
 * SET MODE (lesson 4.1, the second half of this file). System: a fixed centre f in C(K) (K = [a, b], or (a, b] for the
 * one preset that shows what compactness buys), a set S ⊆ C(K) (the positive functions P, or Z_p = {g : g(p) = 0}),
 * the open ball B(f, r) in the sup norm, and one probe g = f − c (a vertical shift by the constant c). Then
 * ‖g − f‖∞ = |c| exactly, so g ∈ B(f, r) iff |c| < r; g ∈ P iff inf f − c > 0 when the infimum of f is attained (a
 * minimum) and iff inf f − c ≥ 0 when it is not (f > inf f everywhere); g ∈ Z_p iff c = 0, since g(p) = f(p) − c = −c.
 * The largest r with B(f, r) ⊆ S is min f for P with an attained minimum (lesson 4.1, טענה 4.1.6(א)) and none at all
 * otherwise (Z_p has empty interior, 4.1.7(ד); in C_b((0, 1]) the ball around x leaves P, 4.1.6(ג)). Every value is a
 * closed formula; nothing is sampled. A constant shift is one probe among all g in the ball, so the figure shows
 * that a ball leaves S, and the lesson proves that a ball stays inside.
 */

export interface FnSeq {
  /** Hebrew name for the picker */
  name: string;
  /** the formula, LTR, for readouts */
  formula: string;
  a: number;
  b: number;
  f: (n: number, x: number) => number;
  /** the pointwise limit */
  limit: (x: number) => number;
  /** x where the limit jumps (its value there is limit(x)), drawn as a point; jump < b means the limit goes on after it */
  jump?: number;
  /** the exact sup over [a, b] of |fₙ − f| */
  sup: (n: number) => number;
  /** where the sup is attained, or null when it is not attained */
  argSup: (n: number) => number | null;
  /** the exact L¹ distance ∫_a^b |fₙ − f|, when it has a closed form */
  l1?: (n: number) => number;
  /** the y-window of the plot */
  y: [number, number];
}

const SEQ_TABLE = {
  // |x/n| ≤ 1/n on [0, 1], equality at x = 1; decreasing in n
  'x-over-n': {
    name: 'x/n',
    formula: 'fₙ(x) = x/n',
    a: 0,
    b: 1,
    f: (n, x) => x / n,
    limit: () => 0,
    sup: (n) => 1 / n,
    argSup: () => 1,
    y: [-0.3, 1.1],
  },
  // xⁿ is increasing on [0, ½], so the max is (½)ⁿ at x = ½; decreasing in n
  'xn-half': {
    name: 'xⁿ על [0, ½]',
    formula: 'fₙ(x) = xⁿ, 0 ≤ x ≤ ½',
    a: 0,
    b: 0.5,
    f: (n, x) => x ** n,
    limit: () => 0,
    sup: (n) => 0.5 ** n,
    argSup: () => 0.5,
    y: [-0.15, 0.6],
  },
  // f = 0 on [0, 1) and f(1) = 1. On [0, 1): sup xⁿ = 1, not attained; at x = 1 the difference is 0. So sₙ = 1 for all n
  xn: {
    name: 'xⁿ על [0, 1]',
    formula: 'fₙ(x) = xⁿ, 0 ≤ x ≤ 1',
    a: 0,
    b: 1,
    f: (n, x) => x ** n,
    limit: (x) => (x < 1 ? 0 : 1),
    jump: 1,
    sup: () => 1,
    argSup: () => null,
    y: [-0.3, 1.25],
  },
  // |sin(nx)/n| ≤ 1/n, equality at x = π/(2n) ∈ [0, π]; decreasing in n
  sin: {
    name: 'sin(nx)/n',
    formula: 'fₙ(x) = sin(nx)/n, 0 ≤ x ≤ π',
    a: 0,
    b: Math.PI,
    f: (n, x) => Math.sin(n * x) / n,
    limit: () => 0,
    sup: (n) => 1 / n,
    argSup: (n) => Math.PI / (2 * n),
    y: [-1.1, 1.1],
  },
  // with t = nx: t/(1 + t²) ≤ ½ since (1 − t)² ≥ 0, equality at t = 1, i.e. x = 1/n ∈ [0, 1]: sₙ = ½ for every n
  bump: {
    name: 'גבעה נודדת',
    formula: 'fₙ(x) = nx/(1 + n²x²)',
    a: 0,
    b: 1,
    f: (n, x) => (n * x) / (1 + n * n * x * x),
    limit: () => 0,
    sup: () => 0.5,
    argSup: (n) => 1 / n,
    y: [-0.2, 0.75],
  },
  // g(x) = xⁿ(1 − x): g′ = xⁿ⁻¹(n − (n + 1)x) = 0 at x = n/(n+1), the max (g = 0 at both ends):
  // sₙ = nⁿ/(n+1)ⁿ⁺¹ ≤ 1/(n+1). Decreasing: sₙ₊₁/sₙ = (1 + 1/(n(n+2)))ⁿ · (1 − 1/(n+2))² ≤ e^{1/(n+2)} · e^{−2/(n+2)} < 1
  'xn-1mx': {
    name: 'xⁿ(1 − x)',
    formula: 'fₙ(x) = xⁿ(1 − x)',
    a: 0,
    b: 1,
    f: (n, x) => x ** n * (1 - x),
    limit: () => 0,
    sup: (n) => (n / (n + 1)) ** n / (n + 1),
    argSup: (n) => n / (n + 1),
    y: [-0.12, 0.45],
  },
  // On [0, ½] fₙ = 0 = f. On (½, 1] f = 1 and 1 − fₙ = max(0, 1 − n(x − ½)) < 1 for x > ½ (fₙ(x) > 0 there), tending to 1
  // as x → ½⁺: sₙ = 1 for every n, not attained. Non-increasing: constant. L¹: with w = x − ½ ∈ (0, ½], ∫ max(0, 1 − nw) dw
  // is the triangle of height 1 and base 1/n when 1/n ≤ ½ (n ≥ 2): area 1/(2n); for n = 1 the base is cut at ½:
  // ∫₀^½ (1 − w) dw = ½ − ⅛ = 3/8. The limit χ_(½,1] is not continuous: it is not in C[0, 1], yet each fₙ is.
  ramp: {
    name: 'רמפה שמתקרבת למדרגה',
    formula: 'fₙ(x) = min(1, max(0, n(x − 1/2)))',
    a: 0,
    b: 1,
    f: (n, x) => Math.min(1, Math.max(0, n * (x - 0.5))),
    limit: (x) => (x > 0.5 ? 1 : 0),
    jump: 0.5,
    sup: () => 1,
    argSup: () => null,
    l1: (n) => (n >= 2 ? 1 / (2 * n) : 3 / 8),
    y: [-0.2, 1.2],
  },
  // With u = |x − ½| ∈ [0, ½] and h = 1/n: fₙ − f = √(u² + h²) − u, whose derivative in u is u/√(u² + h²) − 1 < 0, so it
  // decreases in u and the max is at u = 0, x = ½: sₙ = 1/n. Decreasing in n.
  'smooth-abs': {
    name: 'ערך מוחלט מוחלק',
    formula: 'fₙ(x) = √((x − 1/2)² + 1/n²)',
    a: 0,
    b: 1,
    f: (n, x) => Math.sqrt((x - 0.5) ** 2 + 1 / (n * n)),
    limit: (x) => Math.abs(x - 0.5),
    sup: (n) => 1 / n,
    argSup: () => 0.5,
    y: [-0.1, 1.2],
  },
  // Σ_{k≥1} cos(kx)/2^k = Re(z/(1 − z)) with z = e^{ix}/2, |z| = ½ < 1: = (½cos x − ¼)/(1 − cos x + ¼) = (cos x/2 − 1/4)/(5/4 − cos x).
  // |f − sₙ| = |Σ_{k>n} cos(kx)/2^k| ≤ Σ_{k>n} 2^{−k} = 2^{−n} (Weierstrass M-test with Mₖ = 2^{−k}), and at x = 0 every
  // cos(kx) = 1 so f(0) − sₙ(0) = 2^{−n}: sₙ = 2^{−n} at x = 0. Decreasing: halves with n.
  'cos-series': {
    name: 'טור קוסינוסים',
    formula: 'sₙ(x) = Σ cos(kx)/2^k, k = 1..n',
    a: -Math.PI,
    b: Math.PI,
    f: (n, x) => {
      let s = 0;
      for (let k = 1; k <= n; k++) s += Math.cos(k * x) / 2 ** k;
      return s;
    },
    limit: (x) => (Math.cos(x) / 2 - 0.25) / (1.25 - Math.cos(x)),
    sup: (n) => 2 ** -n,
    argSup: () => 0,
    y: [-0.7, 1.15],
  },
  // eˣ − sₙ(x) = Σ_{k>n} xᵏ/k! ≥ 0 and each term is increasing in x on [0, 1], so the max is at x = 1: sₙ = e − sₙ(1) =
  // Σ_{k>n} 1/k!. It is summed as that tail (40 terms; the ratio of consecutive terms is ≤ 1/(n + 2) ≤ ⅓, so the
  // neglected part is below 3⁻⁴⁰ relative), which keeps full relative accuracy where e − sₙ(1) would cancel.
  // Decreasing: s_{n+1}(1) = sₙ(1) + 1/(n + 1)! > sₙ(1).
  'exp-series': {
    name: 'טור חזקות של eˣ',
    formula: 'sₙ(x) = Σ xᵏ/k!, k = 0..n',
    a: 0,
    b: 1,
    f: (n, x) => {
      let term = 1;
      let s = 1;
      for (let k = 1; k <= n; k++) {
        term *= x / k;
        s += term;
      }
      return s;
    },
    limit: (x) => Math.exp(x),
    sup: (n) => {
      let t = 1;
      for (let k = 1; k <= n + 1; k++) t /= k;
      let sum = 0;
      for (let j = 0; j < 40; j++) {
        sum += t;
        t /= n + 2 + j;
      }
      return sum;
    },
    argSup: () => 1,
    y: [-0.2, 2.9],
  },
} satisfies Record<string, FnSeq>;
export type SeqId = keyof typeof SEQ_TABLE;
/** typed as FnSeq so optional fields (jump) and the full signatures are visible on every preset */
export const SEQS: Record<SeqId, FnSeq> = SEQ_TABLE;

/** fₙ ∈ B(f, ε) in the sup metric: sup |fₙ − f| < ε (strict: the ball is open). */
export const inTube = (s: FnSeq, n: number, eps: number): boolean => s.sup(n) < eps;

/**
 * The first n ≤ nMax such that fₘ ∈ B(f, ε) for every n ≤ m ≤ nMax, or null when f_nMax is outside. The definition's N
 * (every n > N) is this value minus one.
 */
export function firstInTube(s: FnSeq, eps: number, nMax: number): number | null {
  if (!inTube(s, nMax, eps)) return null;
  let n = nMax;
  while (n > 1 && inTube(s, n - 1, eps)) n--;
  return n;
}

/** the ε values the figure offers, wide to narrow */
export const EPS = [1, 0.5, 0.3, 0.2, 0.1, 0.05, 0.02] as const;

/** EPS followed by two finer radii, for the presets whose sup falls below 0.02 within n ≤ 60 (EPS is its prefix) */
export const EPS_FINE = [...EPS, 0.01, 0.005] as const;

/** presets of lessons 2.2 and 2.4 offer EPS_FINE; the presets of lesson 1.5 keep EPS */
export const FINE_SEQS: readonly SeqId[] = ['ramp', 'smooth-abs', 'cos-series', 'exp-series'];

/* ------------------------------------------------------------------ set mode (lesson 4.1) */

export interface SetCase {
  /** Hebrew name for the picker */
  name: string;
  /** the centre, LTR, for readouts */
  formula: string;
  a: number;
  b: number;
  /** the domain is (a, b] rather than [a, b]: C_b((a, b]) instead of C[a, b] */
  openLeft?: boolean;
  /** the centre f */
  f: (x: number) => number;
  /** which set: the positive functions P, or Z_p */
  set: 'pos' | 'zero';
  /** the point of Z_p */
  p?: number;
  /** the exact infimum of f over the domain (pos presets) */
  inf: number;
  /** where the infimum is attained, or null when it is not a minimum */
  argInf: number | null;
  /** the y-window of the plot */
  y: [number, number];
}

const SET_TABLE = {
  // x² − x + ½ = (x − ½)² + ¼ ≥ ¼, equality only at x = ½: min ¼ at ½
  pos: {
    name: 'P: פונקציה חיובית',
    formula: 'f(x) = x² − x + 1/2',
    a: 0,
    b: 1,
    f: (x) => x * x - x + 0.5,
    set: 'pos',
    inf: 0.25,
    argInf: 0.5,
    y: [-0.45, 1.05],
  },
  // f(x) = x on (0, 1]: inf 0, not attained (0 is not in the domain)
  'pos-open': {
    name: 'P′ על (0, 1]',
    formula: 'f(x) = x, 0 < x ≤ 1',
    a: 0,
    b: 1,
    openLeft: true,
    f: (x) => x,
    set: 'pos',
    inf: 0,
    argInf: null,
    y: [-0.45, 1.15],
  },
  // ½ sin(2πx) vanishes at p = ½ (sin π = 0); the readout uses the exact value f(p) = 0, never Math.sin(Math.PI)
  zero: {
    name: 'Zₚ עם p = 1/2',
    formula: 'f(x) = sin(2πx)/2',
    a: 0,
    b: 1,
    f: (x) => Math.sin(2 * Math.PI * x) / 2,
    set: 'zero',
    p: 0.5,
    inf: -0.5,
    argInf: 0.75,
    y: [-0.85, 0.85],
  },
} satisfies Record<string, SetCase>;
export type SetId = keyof typeof SET_TABLE;
export const SET_CASES: Record<SetId, SetCase> = SET_TABLE;

/** the radii the set mode offers */
export const RADII = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5] as const;

/** ‖(f − c) − f‖∞ = |c|: the shift is in the open ball B(f, r) iff |c| < r */
export const shiftInBall = (c: number, r: number): boolean => Math.abs(c) < r;

/** the value of g = f − c at p for Z_p (exactly −c, since f(p) = 0), or its infimum for P (exactly inf f − c) */
export const shiftKeyValue = (s: SetCase, c: number): number => (s.set === 'zero' ? -c : s.inf - c);

/** g = f − c belongs to the set: Z_p iff c = 0; P iff inf f − c > 0 (minimum attained) or ≥ 0 (not attained) */
export function shiftInSet(s: SetCase, c: number): boolean {
  if (s.set === 'zero') return c === 0;
  return s.argInf === null ? c <= s.inf : c < s.inf;
}

/** the largest r with B(f, r) ⊆ S, or null when no ball around f lies in S */
export const largestBall = (s: SetCase): number | null => (s.set === 'pos' && s.argInf !== null && s.inf > 0 ? s.inf : null);

/** the whole ball B(f, r) lies in S (proved in lesson 4.1; the shift is the witness when it does not) */
export function ballInSet(s: SetCase, r: number): boolean {
  const R = largestBall(s);
  return R !== null && r <= R;
}
