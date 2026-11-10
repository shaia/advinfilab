/**
 * MODEL SPECIFICATION
 *
 * System:        candidate distance functions d: ℝ × ℝ → [0, ∞) on the real line (some metrics, some not), and
 *                pairs of bounded functions on a closed interval for the sup metric.
 * Dynamics:      none; each candidate is a closed formula, evaluated in IEEE double precision.
 * Boundary:      the axioms are checked at the points the caller passes: a triple that breaks the triangle
 *                inequality, or a pair x ≠ y with d(x,y) = 0, is a counterexample and proves "not a metric";
 *                a search that finds nothing on a grid is evidence only. Which presets are metrics is
 *                proved in lesson 1.1, never here.
 * Ignored:       rounding: the triangle verdict uses a slack TOL = 1e-9, so an equality case (|x−z| =
 *                |x−y| + |y−z| with y between) is reported as equality, not as a failure by 1e-16.
 * Valid when:    the points are on the figure's 0.1 grid inside [−2.5, 2.5]; there every failure of a
 *                non-metric preset exceeds TOL by orders of magnitude ((x−y)² fails by 2ab ≥ 0.02).
 * Failure modes: a candidate that fails only for points off the grid would look like a metric to `findViolation`.
 *
 * Lesson 1.1's figure (MetricCheck) draws from here, and the lesson's numbers are recomputed with it.
 */

export const TOL = 1e-9;

export type DistId = 'abs' | 'sq' | 'sqrt' | 'frac' | 'trunc' | 'cube' | 'abs2' | 'plus1' | 'disc';

export interface Candidate {
  d: (x: number, y: number) => number;
  /** the formula, plain text for the readout (LTR) */
  formula: string;
  /** proved in the lesson: which axiom fails, or null for a metric */
  fails: null | 'zero' | 'triangle';
}

export const CANDIDATES: Record<DistId, Candidate> = {
  abs: { d: (x, y) => Math.abs(x - y), formula: '|x − y|', fails: null },
  sq: { d: (x, y) => (x - y) ** 2, formula: '(x − y)²', fails: 'triangle' },
  sqrt: { d: (x, y) => Math.sqrt(Math.abs(x - y)), formula: '√|x − y|', fails: null },
  frac: { d: (x, y) => Math.abs(x - y) / (1 + Math.abs(x - y)), formula: '|x − y| / (1 + |x − y|)', fails: null },
  trunc: { d: (x, y) => Math.min(Math.abs(x - y), 1), formula: 'min(|x − y|, 1)', fails: null },
  cube: { d: (x, y) => Math.abs(x ** 3 - y ** 3), formula: '|x³ − y³|', fails: null },
  abs2: { d: (x, y) => Math.abs(x * x - y * y), formula: '|x² − y²|', fails: 'zero' },
  plus1: { d: (x, y) => Math.abs(x - y) + 1, formula: '|x − y| + 1', fails: 'zero' },
  disc: { d: (x, y) => (x === y ? 0 : 1), formula: 'הבדידה', fails: null },
};

/** d(x,y) + d(y,z) − d(x,z): the triangle inequality holds for this triple iff this is ≥ 0 (up to TOL). */
export const triangleGap = (d: Candidate['d'], x: number, y: number, z: number) => d(x, y) + d(y, z) - d(x, z);

export type TriangleVerdict = 'strict' | 'equal' | 'fails';
export function triangleVerdict(d: Candidate['d'], x: number, y: number, z: number): TriangleVerdict {
  const g = triangleGap(d, x, y, z);
  if (g < -TOL) return 'fails';
  return Math.abs(g) <= TOL ? 'equal' : 'strict';
}

/** The zero axiom at one pair: d(x,y) = 0 exactly when x = y. Returns the way it fails, or null. */
export function zeroAxiomAt(d: Candidate['d'], x: number, y: number): null | 'distinct-zero' | 'self-nonzero' {
  const v = d(x, y);
  if (x === y) return Math.abs(v) <= TOL ? null : 'self-nonzero';
  return Math.abs(v) <= TOL ? 'distinct-zero' : null;
}

/** The grid the figure snaps to: multiples of 0.1, built from integers so that equal points compare equal. */
export const gridPoint = (k: number) => Math.round(k) / 10;

/** The first triple on the grid {−n/10, …, n/10} that breaks the triangle inequality, or null (evidence only). */
export function findViolation(d: Candidate['d'], n = 25): [number, number, number] | null {
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (let k = -n; k <= n; k++) {
    const [x, y, z] = [gridPoint(i), gridPoint(j), gridPoint(k)];
    if (triangleGap(d, x, y, z) < -TOL) return [x, y, z];
  }
  return null;
}

/* ---------------------------------------------------------------- the sup metric on B([a, b]) */

export type PairId = 'sincos' | 'xsq';

export interface FnPair {
  f: (x: number) => number;
  g: (x: number) => number;
  a: number;
  b: number;
  fName: string;
  gName: string;
  /** the exact sup of |f − g| on [a, b] and a point where it is attained (proved in the lesson) */
  sup: number;
  argSup: number;
}

export const PAIRS: Record<PairId, FnPair> = {
  // sin x − cos x = √2·sin(x − π/4); on [0, π] the maximum of |…| is √2, at x = 3π/4
  sincos: { f: Math.sin, g: Math.cos, a: 0, b: Math.PI, fName: 'sin x', gName: 'cos x', sup: Math.SQRT2, argSup: (3 * Math.PI) / 4 },
  // x − x² = x(1 − x) ≥ 0 on [0, 1], maximal at x = ½ with value ¼; zero at both ends
  xsq: { f: (x) => x, g: (x) => x * x, a: 0, b: 1, fName: 'x', gName: 'x²', sup: 0.25, argSup: 0.5 },
};
