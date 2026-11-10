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
 *                maximum (xⁿ on [0, 1]: the sup 1 is approached as x → 1⁻). The tests compare each formula with the
 *                sampled sup of src/math/multivar.ts (supDist), which is a probe, not a proof.
 * Ignored:       IEEE rounding of the formulas (relative 1e-15).
 * Valid when:    n ≥ 1 is an integer.
 * Failure modes: `firstInTube` scans n ≤ nMax only: "from this n on" is checked on a window. For every preset here
 *                sₙ is non-increasing in n (proved beside each formula), so the window answer is the true one; a new
 *                preset must keep that property or change the scan.
 *
 * Drives the figure of lesson 1.5 (FunctionBall): the tube B(f, ε) around the limit and the graph of fₙ.
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
  /** x where the limit jumps (its value there is limit(x)), drawn as a point */
  jump?: number;
  /** the exact sup over [a, b] of |fₙ − f| */
  sup: (n: number) => number;
  /** where the sup is attained, or null when it is not attained */
  argSup: (n: number) => number | null;
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
