/**
 * src/math/bernstein.ts, filed by accuracy category. Each test is named after the claim it checks.
 * Exact identities are checked in rational arithmetic at rational points; the sup errors are sampled probes, evidence
 * for the theorems proved in lesson 4.5, not proofs.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import {
  PRESETS,
  bernsteinAt,
  bernsteinExact,
  bernsteinFn,
  binom,
  chebyshevBound,
  farMass,
  lipschitzBound,
  nodeValues,
  presetError,
  q,
  qabs,
  qadd,
  qdiv,
  qeq,
  qmul,
  qsub,
  secondMoment,
  supError,
  theoremBound,
  weights,
  zigzag,
  type Q,
} from '~/math/bernstein';
import { bernstein } from '~/math/multivar';

const POINTS: Q[] = [q(0), q(1), q(1, 2), q(1, 3), q(2, 7), q(5, 9), q(11, 13), q(1, 100)];
const NS = [1, 2, 3, 4, 5, 7, 10, 20];
const one = q(1);

describe('exact identities (למה 4.5.2, למה 4.5.3), in rational arithmetic', () => {
  it('B_n 1 = 1 (the binomial theorem)', () => {
    for (const n of NS) for (const x of POINTS) expect(qeq(bernsteinExact(() => one, n, x), one)).toBe(true);
  });

  it('B_n x = x', () => {
    for (const n of NS) for (const x of POINTS) expect(qeq(bernsteinExact((k, m) => q(k, m), n, x), x)).toBe(true);
  });

  it('B_n x² = x² + x(1 − x)/n', () => {
    for (const n of NS)
      for (const x of POINTS) {
        const lhs = bernsteinExact((k, m) => q(k * k, m * m), n, x);
        const rhs = qadd(qmul(x, x), qdiv(qmul(x, qsub(one, x)), q(n)));
        expect(qeq(lhs, rhs)).toBe(true);
      }
  });

  it('Σ (k/n − x)² b_{n,k}(x) = x(1 − x)/n', () => {
    for (const n of NS)
      for (const x of POINTS) {
        const lhs = bernsteinExact((k, m) => {
          const d = qsub(q(k, m), x);
          return qmul(d, d);
        }, n, x);
        expect(qeq(lhs, qdiv(qmul(x, qsub(one, x)), q(n)))).toBe(true);
      }
  });

  it('B_n f agrees with f at 0 and at 1 (טענה 4.5.6(א))', () => {
    const f = (k: number, n: number) => qabs(qsub(q(k, n), q(1, 3)));
    for (const n of NS) {
      expect(qeq(bernsteinExact(f, n, q(0)), q(1, 3))).toBe(true);
      expect(qeq(bernsteinExact(f, n, q(1)), q(2, 3))).toBe(true);
    }
  });

  it('the bank numbers: B_3|x − 1/2|(1/2) = 1/4 and B_4|x − 1/2|(1/4) = 71/256', () => {
    const f = (k: number, n: number) => qabs(qsub(q(k, n), q(1, 2)));
    expect(qeq(bernsteinExact(f, 3, q(1, 2)), q(1, 4))).toBe(true);
    expect(qeq(bernsteinExact(f, 4, q(1, 4)), q(71, 256))).toBe(true);
  });

  it('B_n x² does not interpolate: at k/n with 0 < k < n the gap is k(n − k)/n³ > 0', () => {
    for (const n of [2, 3, 5, 8])
      for (let k = 1; k < n; k++) {
        const x = q(k, n);
        const gap = qsub(bernsteinExact((j, m) => q(j * j, m * m), n, x), qmul(x, x));
        expect(qeq(gap, q(k * (n - k), n ** 3))).toBe(true);
      }
  });

  it('binom matches Pascal’s rule', () => {
    for (let n = 1; n < 30; n++) for (let k = 1; k < n; k++) expect(binom(n, k)).toBe(binom(n - 1, k - 1) + binom(n - 1, k));
  });
});

describe('floating point agrees with the exact values', () => {
  it('the weights sum to 1 for n up to 2000, also near the ends', () => {
    for (const n of [1, 10, 100, 600, 2000])
      for (const x of [0, 1e-6, 0.013, 0.5, 0.987, 1 - 1e-6, 1]) {
        const s = weights(n, x).reduce((a, b) => a + b, 0);
        expect(Math.abs(s - 1)).toBeLessThan(1e-10); // exact value 1: an absolute bound
      }
  });

  it('bernsteinAt agrees with multivar.bernstein (direct sum) for small n', () => {
    for (const n of [1, 3, 8, 20])
      for (const x of [0.1, 0.37, 0.5, 0.9]) {
        const a = bernsteinFn(Math.cos, n, x);
        expect(relativeError(a, bernstein(Math.cos, n, x))).toBeLessThan(1e-12);
      }
  });

  it('the second moment is x(1 − x)/n in floating point too', () => {
    for (const n of [5, 50, 600]) for (const x of [0.2, 0.5, 0.71]) expect(relativeError(secondMoment(n, x), (x * (1 - x)) / n)).toBeLessThan(1e-10);
  });

  it('bernsteinAt of x² matches x² + x(1 − x)/n', () => {
    for (const n of [7, 100, 600]) for (const x of [0.03, 0.5, 0.8]) expect(relativeError(bernsteinAt(nodeValues((t) => t * t, n), x), x * x + (x * (1 - x)) / n)).toBeLessThan(1e-11);
  });
});

describe('analytic limits: the sup errors the lesson quotes', () => {
  it('‖B_n x² − x²‖∞ = 1/(4n), attained at 1/2', () => {
    for (const n of [1, 10, 25, 50, 250, 600]) {
      const r = presetError('square', n);
      expect(relativeError(r.err, 1 / (4 * n))).toBeLessThan(1e-9);
      expect(r.at).toBe(0.5);
    }
  });

  it('|x − 1/2|: the error stays below L/(2√n) (טענה 4.5.4א), and quadrupling n roughly halves it', () => {
    for (const n of [1, 4, 25, 100, 400]) expect(presetError('abs', n).err).toBeLessThanOrEqual(lipschitzBound(1, n) + 1e-12);
    const ratio = presetError('abs', 400).err / presetError('abs', 100).err;
    expect(Math.abs(ratio - 0.5)).toBeLessThan(0.01);
  });

  it('the zigzag stays below its Lipschitz bound 2.4/(2√n)', () => {
    for (const n of [1, 10, 100, 600]) expect(presetError('zigzag', n).err).toBeLessThanOrEqual(lipschitzBound(2.4, n) + 1e-12);
  });

  it('sin(1/(x+0.1)) needs a large n: error ≥ 0.1 at n = 400 and < 0.1 at n = 500 (the figure’s task)', () => {
    expect(presetError('osc', 400).err).toBeGreaterThan(0.1);
    expect(presetError('osc', 500).err).toBeLessThan(0.1);
  });
});

describe('convergence: the estimates of the proof of משפט 4.5.4', () => {
  it('the far weight is at most x(1 − x)/(nδ²)', () => {
    for (const n of [5, 50, 97, 300])
      for (const x of [0.1, 0.5, 0.83]) for (const d of [0.05, 0.1, 0.25]) expect(farMass(n, x, d)).toBeLessThanOrEqual(chebyshevBound(n, x, d) + 1e-12);
  });

  it('the far-mass task: at x = 0.5, δ = 0.1 the far weight is ≥ 0.05 at n = 50 and < 0.05 at n = 97 and 150', () => {
    expect(farMass(50, 0.5, 0.1)).toBeGreaterThan(0.05);
    expect(farMass(97, 0.5, 0.1)).toBeLessThan(0.05);
    expect(farMass(150, 0.5, 0.1)).toBeLessThan(0.05);
  });

  it('the bound ε + M/(2nδ²) holds for the zigzag with its Lipschitz δ = ε/L', () => {
    const L = PRESETS.zigzag.lip;
    const M = 0.9; // max of the zigzag
    for (const eps of [0.2, 0.1])
      for (const n of [10, 100, 600]) expect(presetError('zigzag', n).err).toBeLessThanOrEqual(theoremBound(M, eps, eps / L, n));
  });

  it('every preset error decreases from n = 50 to n = 600', () => {
    for (const id of Object.keys(PRESETS) as (keyof typeof PRESETS)[]) expect(presetError(id, 600).err).toBeLessThan(presetError(id, 50).err);
  });

  it('supError never exceeds the true error: it is a maximum over sample points', () => {
    const r = supError((t) => t * t, 9, 37);
    expect(r.err).toBeLessThanOrEqual(1 / 36 + 1e-15);
    expect(zigzag(0.25)).toBeCloseTo(0.8, 12);
  });
});
