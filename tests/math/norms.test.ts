/**
 * src/math/norms.ts, filed by accuracy category. Each test is named after the claim it checks.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import { pNorm } from '~/math/multivar';
import { P_VALUES, lawHolds, norm, parallelogramSides, unitSphere, type V2 } from '~/math/norms';

describe('exact values (closed formulas)', () => {
  it('(3,−4,1) has 1-, 2-, ∞-norms 8, √26, 4', () => {
    expect(pNorm([3, -4, 1], 1)).toBe(8);
    expect(relativeError(pNorm([3, -4, 1], 2), Math.sqrt(26))).toBeLessThan(1e-15);
    expect(pNorm([3, -4, 1], Infinity)).toBe(4);
  });

  it('the parallelogram law at (1,0), (0,1): 8 vs 4 for p = 1, 2 vs 4 for p = ∞, and 2·2^(2/p) vs 4 in general', () => {
    expect(parallelogramSides([1, 0], [0, 1], 1)).toEqual({ lhs: 8, rhs: 4 });
    expect(parallelogramSides([1, 0], [0, 1], Infinity)).toEqual({ lhs: 2, rhs: 4 });
    for (const p of P_VALUES.filter((q) => q !== Infinity)) {
      expect(relativeError(parallelogramSides([1, 0], [0, 1], p).lhs, 2 * 2 ** (2 / p))).toBeLessThan(1e-14);
    }
  });

  it('the p values on the slider include 1, 2 and ∞ exactly, in increasing order', () => {
    for (const p of [1, 2, Infinity]) expect(P_VALUES).toContain(p);
    for (let i = 1; i < P_VALUES.length; i++) expect(P_VALUES[i]).toBeGreaterThan(P_VALUES[i - 1]);
  });
});

describe('identities (to rounding, relative 1e-12)', () => {
  const pairs: [V2, V2][] = [[[1, 0], [0, 1]], [[0.3, -1.2], [1.7, 0.4]], [[-2, 0.5], [0.1, 0.1]], [[1, 1], [1, -1]]];

  it('for p = 2 the parallelogram law holds for every sampled pair (it is an identity of the inner product)', () => {
    for (const [x, y] of pairs) {
      const { lhs, rhs } = parallelogramSides(x, y, 2);
      expect(relativeError(lhs, rhs)).toBeLessThan(1e-12);
      expect(lawHolds(x, y, 2)).toBe(true);
    }
  });

  it('every point the unit sphere returns has p-norm 1, for every p on the slider', () => {
    for (const p of P_VALUES) for (const q of unitSphere(p, 360)) expect(Math.abs(norm(q, p) - 1)).toBeLessThan(1e-12);
  });

  it('for collinear vectors y = cx the law holds in every p-norm: both sides equal (2 + 2c²)‖x‖²', () => {
    for (const p of P_VALUES) for (const x of [[1, 0], [0.6, -0.8]] as V2[]) for (const c of [-2, -0.5, 0.5, 1, 3]) {
      const y: V2 = [c * x[0], c * x[1]];
      const { lhs, rhs } = parallelogramSides(x, y, p);
      expect(relativeError(lhs, rhs)).toBeLessThan(1e-12);
      expect(lawHolds(x, y, p)).toBe(true);
    }
  });
});

describe('counterexamples (exact failures and exact equalities that prove nothing)', () => {
  it('for every p ≠ 2 on the slider the law fails at (1,0), (0,1), by at least 20 % relative', () => {
    for (const p of P_VALUES.filter((q) => q !== 2)) {
      const { lhs, rhs } = parallelogramSides([1, 0], [0, 1], p);
      expect(relativeError(lhs, rhs)).toBeGreaterThan(0.2);
      expect(lawHolds([1, 0], [0, 1], p)).toBe(false);
    }
  });

  it('in the 1-norm a non-collinear pair can still satisfy the law: (1,0), (1,0.5) gives 6.5 = 6.5, while (1,0), (0.5,0.5) gives 5 vs 4', () => {
    expect(parallelogramSides([1, 0], [1, 0.5], 1)).toEqual({ lhs: 6.5, rhs: 6.5 });
    expect(parallelogramSides([1, 0], [0.5, 0.5], 1)).toEqual({ lhs: 5, rhs: 4 });
    expect(lawHolds([1, 0], [0.5, 0.5], 1)).toBe(false);
  });

  it('a failing pair can differ in the fourth significant figure: (2.6,0), (2.5,0.05) in the 1-norm gives 26.545 vs 26.525', () => {
    const { lhs, rhs } = parallelogramSides([2.6, 0], [2.5, 0.05], 1);
    expect(relativeError(lhs, 26.545)).toBeLessThan(1e-12);
    expect(relativeError(rhs, 26.525)).toBeLessThan(1e-12);
    expect(lawHolds([2.6, 0], [2.5, 0.05], 1)).toBe(false);
  });
});

describe('inequalities between norms (sampled vectors)', () => {
  it('‖x‖∞ ≤ ‖x‖₂ ≤ ‖x‖₁ ≤ 2‖x‖∞ in the plane, and ‖x‖_p decreases in p', () => {
    for (let k = 0; k < 500; k++) {
      const t = (2 * Math.PI * k) / 500;
      const x: V2 = [1.3 * Math.cos(t), 0.7 * Math.sin(3 * t)];
      const [n1, n2, ni] = [norm(x, 1), norm(x, 2), norm(x, Infinity)];
      expect(ni).toBeLessThanOrEqual(n2 + 1e-15);
      expect(n2).toBeLessThanOrEqual(n1 + 1e-15);
      expect(n1).toBeLessThanOrEqual(2 * ni + 1e-15);
      for (let i = 1; i < P_VALUES.length; i++) expect(norm(x, P_VALUES[i])).toBeLessThanOrEqual(norm(x, P_VALUES[i - 1]) + 1e-15);
    }
  });
});

/* ---- lesson 3.5: plane norms and the best constants against ‖·‖₂ ---- */
import { symEigenvalues } from '~/math/multivar';
import {
  PLANE_NORMS,
  PLANE_NORM_IDS,
  discContainsBall,
  discInsideBall,
  normSphere,
  sphereExtremes,
  type PlaneNormId,
} from '~/math/norms';

describe('lesson 3.5, exact values: the best constants m = min_S N and M = max_S N', () => {
  it('the probe agrees with the proved values for every norm (l1: 1, √2; linf: 1/√2, 1; hex: 1/√2, √2; linear: (√5 ∓ 1)/√2), relative 1e-9', () => {
    for (const id of PLANE_NORM_IDS) {
      const e = sphereExtremes(id);
      expect(relativeError(e.m, PLANE_NORMS[id].exact.m)).toBeLessThan(1e-9);
      expect(relativeError(e.M, PLANE_NORMS[id].exact.M)).toBeLessThan(1e-9);
      // the arg points lie on the Euclidean unit circle and attain the values
      expect(Math.abs(Math.hypot(...e.argMin) - 1)).toBeLessThan(1e-15);
      expect(relativeError(PLANE_NORMS[id].value(e.argMin), e.m)).toBeLessThan(1e-12);
      expect(relativeError(PLANE_NORMS[id].value(e.argMax), e.M)).toBeLessThan(1e-12);
    }
  });

  it('for N(x) = ‖Ax‖₂, A = [[1,1],[0,2]], m and M are the square roots of the eigenvalues 3 ∓ √5 of AᵀA = [[1,1],[1,5]]', () => {
    const lam = symEigenvalues([[1, 1], [1, 5]]).sort((a, b) => a - b);
    expect(relativeError(lam[0], 3 - Math.sqrt(5))).toBeLessThan(1e-12);
    expect(relativeError(lam[1], 3 + Math.sqrt(5))).toBeLessThan(1e-12);
    expect(relativeError(Math.sqrt(lam[0]), PLANE_NORMS.linear.exact.m)).toBeLessThan(1e-12);
    expect(relativeError(Math.sqrt(lam[1]), PLANE_NORMS.linear.exact.M)).toBeLessThan(1e-12);
    // 0.8740 and 2.2882, the numbers the lesson quotes
    expect(PLANE_NORMS.linear.exact.m.toFixed(4)).toBe('0.8740');
    expect(PLANE_NORMS.linear.exact.M.toFixed(4)).toBe('2.2882');
  });

  it('the hexagon norm attains m = 1/√2 at ±(1,1)/√2 and M = √2 at ±(1,−1)/√2', () => {
    const s = Math.SQRT1_2;
    expect(relativeError(PLANE_NORMS.hex.value([s, s]), Math.SQRT1_2)).toBeLessThan(1e-15);
    expect(relativeError(PLANE_NORMS.hex.value([s, -s]), Math.SQRT2)).toBeLessThan(1e-15);
  });

  it('the largest disc on the slider grid (step 0.01) inside each unit ball and the smallest containing it', () => {
    const grid = Array.from({ length: 141 }, (_, i) => Math.round((0.2 + i * 0.01) * 100) / 100);
    const want: Record<PlaneNormId, [number, number]> = { l1: [0.7, 1], linf: [1, 1.42], hex: [0.7, 1.42], linear: [0.43, 1.15] };
    for (const id of PLANE_NORM_IDS) {
      const e = sphereExtremes(id);
      const inner = Math.max(...grid.filter((r) => discInsideBall(r, e.M)));
      const outer = Math.min(...grid.filter((r) => discContainsBall(r, e.m)));
      expect([inner, outer]).toEqual(want[id]);
    }
  });
});

describe('lesson 3.5, identities and inequalities (sampled vectors)', () => {
  const pts: V2[] = Array.from({ length: 400 }, (_, k) => {
    const t = (2 * Math.PI * k) / 400;
    return [1.7 * Math.cos(3 * t) + 0.2, 0.9 * Math.sin(t) - 0.1];
  });

  it('every norm satisfies m‖x‖₂ ≤ N(x) ≤ M‖x‖₂ with its exact constants', () => {
    for (const id of PLANE_NORM_IDS) {
      const { m, M } = PLANE_NORMS[id].exact;
      for (const x of pts) {
        const n2 = Math.hypot(...x);
        expect(PLANE_NORMS[id].value(x)).toBeGreaterThanOrEqual(m * n2 * (1 - 1e-12));
        expect(PLANE_NORMS[id].value(x)).toBeLessThanOrEqual(M * n2 * (1 + 1e-12));
      }
    }
  });

  it('every norm is homogeneous and satisfies the triangle inequality on the sample (evidence; the proofs are in the lesson)', () => {
    for (const id of PLANE_NORM_IDS) {
      const N = PLANE_NORMS[id].value;
      for (let i = 0; i < pts.length; i += 7) {
        const x = pts[i];
        const y = pts[(i * 13 + 5) % pts.length];
        expect(relativeError(N([-2.5 * x[0], -2.5 * x[1]]), 2.5 * N(x))).toBeLessThan(1e-14);
        expect(N([x[0] + y[0], x[1] + y[1]])).toBeLessThanOrEqual(N(x) + N(y) + 1e-12);
      }
    }
  });

  it('every boundary point normSphere returns has N = 1', () => {
    for (const id of PLANE_NORM_IDS) for (const q of normSphere(id, 360)) expect(Math.abs(PLANE_NORMS[id].value(q) - 1)).toBeLessThan(1e-12);
  });
});

describe('lesson 3.5, counterexamples', () => {
  it('(√|x|+√|y|)² is homogeneous and positive but breaks the triangle inequality at (1,0), (0,1): 4 > 1 + 1', () => {
    const N = (v: V2) => (Math.sqrt(Math.abs(v[0])) + Math.sqrt(Math.abs(v[1]))) ** 2;
    expect(N([1, 1])).toBe(4);
    expect(N([1, 0]) + N([0, 1])).toBe(2);
  });

  it('sphereExtremes refuses a sample count that misses the angles kπ/4', () => {
    expect(() => sphereExtremes('hex', 1000 + 4)).toThrow();
  });
});
