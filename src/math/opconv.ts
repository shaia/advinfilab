/**
 * MODEL SPECIFICATION
 *
 * System:        (a) four sequences of 2×2 matrices A_k (k = 1, 2, …) acting on ℝ² with the same p-norm,
 *                p ∈ {1, 2, ∞}, on the domain and the target, compared with a matrix A:
 *                  shear  A_k = (1 1/k; 0 1)            → A = I,        A_k − A = (1/k)·(0 1; 0 0)
 *                  rot    A_k = rotation by 1/k radians  → A = I,        A_k − A = (cos θ − 1)I + sin θ·J, θ = 1/k
 *                  scale  A_k = (2 + 1/k 0; 0 1/2)       → A = diag(2, 1/2), A_k − A = (1/k)·(1 0; 0 0)
 *                  flip   A_k = (−1)^k I                 compared with A = I; it has no limit at all.
 *                (b) the space C[0,1] with ‖·‖∞ and the functionals T_k f = f(1/k) − f(0), on four sample
 *                functions √x, cos 3x, x², sin πx, and the witness g_k(x) = min(1, 2kx − 1).
 * Dynamics:      none; closed values at each k.
 * Boundary:      the closed forms the tests check against opNorm (multivar.ts):
 *                  shear, scale: ‖A_k − A‖_p = 1/k for p = 1, 2, ∞ (a single entry 1/k);
 *                  rot: ‖A_k − I‖₂ = 2 sin(1/(2k)) (A_k − I is √(2 − 2cos θ) times a rotation),
 *                       ‖A_k − I‖₁ = ‖A_k − I‖∞ = 1 − cos(1/k) + sin(1/k) (column / row sum);
 *                  flip: ‖A_k − I‖_p = 2 for odd k and 0 for even k, while ‖A_k‖_p = ‖I‖_p = 1 for every k.
 *                  T_k f: 1/√k, cos(3/k) − 1, 1/k², sin(π/k); each → 0 as k → ∞ (pointwise convergence to 0).
 *                  g_k is continuous and piecewise linear with nodes 0, 1/k, 1: g_k(0) = −1, g_k = 1 on
 *                  [1/k, 1], so ‖g_k‖∞ = 1 and T_k g_k = 2. With |T_k f| ≤ 2‖f‖∞ this gives ‖T_k‖ = 2 for every k.
 *                Every error above decreases in k (for rot: d/dθ [1 − cos θ + sin θ] = sin θ + cos θ > 0 on
 *                (0, 1]; for cos 3x: 3/k ∈ (0, 3] ⊂ (0, π) where 1 − cos is increasing; for sin πx from k = 2 on),
 *                so the first k with error < ε is where the tail stays below ε, except sin πx at k = 1
 *                (sin π = 0 but sin(π/2) = 1): `tailStart` handles that case.
 * Ignored:       other sequences and functions; k beyond the figure's range when scanning (`tailStart` looks at
 *                k ≤ kMax only, which is evidence, the monotonicity above is the proof).
 * Valid when:    k is a positive integer.
 * Failure modes: IEEE rounding at the kinks: sin(π·1) is 1.2e-16, not 0, and k·(1/k) can be 1 − 2⁻⁵³. `sinPi`
 *                and `witness` snap those two cases to their exact values (a change below 1e-12).
 *
 * The figure of lesson 1.9 (OperatorConvergence) draws from here; tests/math/opconv.test.ts checks the closed
 * forms against opNorm and the limits.
 */

import { opNorm, type Mat } from './multivar';
import type { P } from './opnorm2d';

export type M2 = [[number, number], [number, number]];
export type SeqId = 'shear' | 'rot' | 'scale' | 'flip';
export type FnId = 'sqrt' | 'cos3' | 'x2' | 'sinpi';

/** The k-th matrix of a sequence (k ≥ 1). */
export function seqMatrix(seq: SeqId, k: number): M2 {
  switch (seq) {
    case 'shear':
      return [[1, 1 / k], [0, 1]];
    case 'rot': {
      const c = Math.cos(1 / k);
      const s = Math.sin(1 / k);
      return [[c, -s], [s, c]];
    }
    case 'scale':
      return [[2 + 1 / k, 0], [0, 0.5]];
    case 'flip': {
      const sg = k % 2 === 0 ? 1 : -1;
      return [[sg, 0], [0, sg]];
    }
  }
}

/** The matrix each sequence is compared with: its limit, or for `flip` (which has no limit) the identity. */
export function seqTarget(seq: SeqId): M2 {
  return seq === 'scale' ? [[2, 0], [0, 0.5]] : [[1, 0], [0, 1]];
}

/** Whether the sequence converges (to `seqTarget`). */
export const CONVERGES: Record<SeqId, boolean> = { shear: true, rot: true, scale: true, flip: false };

export const diff = (A: Mat, B: Mat): M2 => [
  [A[0][0] - B[0][0], A[0][1] - B[0][1]],
  [A[1][0] - B[1][0], A[1][1] - B[1][1]],
];

/** A_k − A. */
export const errMatrix = (seq: SeqId, k: number): M2 => diff(seqMatrix(seq, k), seqTarget(seq));

/** ‖A_k − A‖_p, the operator norm (multivar.opNorm: column sum, √λ_max(MᵀM), row sum). */
export const errNorm = (seq: SeqId, k: number, p: P): number => opNorm(errMatrix(seq, k), p);

/** The largest entry |a_ij^(k) − a_ij|. */
export const entryErr = (seq: SeqId, k: number): number => Math.max(...errMatrix(seq, k).flat().map(Math.abs));

/**
 * The smallest K in [1, kMax] with v(k) < ε for every k in [K, kMax], or null when v(kMax) ≥ ε. A comparison
 * within 1e-12 of ε counts as "not below": at a tie (1/5 against ε = 0.2) the strict inequality fails, and
 * opNorm's √ of an eigenvalue can land a rounding error on either side of it.
 */
export function tailStart(v: (k: number) => number, eps: number, kMax = 60): number | null {
  let K: number | null = null;
  for (let k = kMax; k >= 1; k--) {
    if (below(v(k), eps)) K = k;
    else break;
  }
  return K;
}

/** a < ε, with a tie (within 1e-12) counted as not below. */
export const below = (a: number, eps: number): boolean => a < eps - 1e-12;

/** sin(πx), exact (0) at integers. */
export const sinPi = (x: number): number => (Number.isInteger(x) ? 0 : Math.sin(Math.PI * x));

/** The sample functions in C[0,1]. */
export const FNS: Record<FnId, (x: number) => number> = {
  sqrt: Math.sqrt,
  cos3: (x) => Math.cos(3 * x),
  x2: (x) => x * x,
  sinpi: sinPi,
};

/** T_k f = f(1/k) − f(0). */
export const Tk = (f: (x: number) => number, k: number): number => f(1 / k) - f(0);

/**
 * The witness g_k(x) = min(1, 2kx − 1): −1 at 0, 1 from 1/k on, linear in between. The kink at kx = 1 is snapped
 * (k·(1/k) can round to 1 − 2⁻⁵³), so g_k(1/k) = 1 exactly.
 */
export const witness =
  (k: number) =>
  (x: number): number => {
    const t = k * x;
    return t >= 1 - 1e-12 ? 1 : 2 * t - 1;
  };

/** The nodes of the piecewise-linear g_k: its sup norm is the largest |g_k| there. */
export const witnessNodes = (k: number): number[] => [0, 1 / k, 1];

/** ‖g_k‖∞ on [0,1], exact for a piecewise-linear function: the largest |value| at a node. */
export const witnessSup = (k: number): number => Math.max(...witnessNodes(k).map((x) => Math.abs(witness(k)(x))));
