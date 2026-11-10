/**
 * src/math/opnorm2d.ts, filed by accuracy category. Each test is named after the claim it checks.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import { pNorm, type Mat } from '~/math/multivar';
import { MATRICES, apply, maximiser, norms, spherePoint, stretch, type P } from '~/math/opnorm2d';

const PS: P[] = [1, 2, Infinity];
const SAMPLE: Mat[] = [...Object.values(MATRICES), [[2, -1], [1, 3]], [[0, 0], [0, 0]], [[-1.5, 0.5], [2.5, -3]]];

describe('exact values (closed formulas)', () => {
  it('for (1 2; 3 4): ‖A‖₁ = 6 (column sum), ‖A‖∞ = 7 (row sum), ‖A‖₂ = √(15 + √221)', () => {
    const n = norms(MATRICES.gen);
    expect(n.one).toBe(6);
    expect(n.inf).toBe(7);
    expect(relativeError(n.two, Math.sqrt(15 + Math.sqrt(221)))).toBeLessThan(1e-13);
  });

  it('for the triangular (1 1; 0 1) the 2-norm is the golden ratio, though every eigenvalue is 1', () => {
    expect(relativeError(norms(MATRICES.tri).two, (1 + Math.sqrt(5)) / 2)).toBeLessThan(1e-13);
  });

  it('a rotation has 2-norm 1 and stretches every direction by exactly 1 in the 2-norm', () => {
    expect(relativeError(norms(MATRICES.rot).two, 1)).toBeLessThan(1e-13);
    for (let k = 0; k < 36; k++) expect(relativeError(stretch(MATRICES.rot, spherePoint(2, k / 5), 2), 1)).toBeLessThan(1e-13);
  });

  it('the maximiser is a unit vector and A attains its operator norm there', () => {
    for (const A of SAMPLE) for (const p of PS) {
      const x = maximiser(A, p);
      expect(Math.abs(pNorm(x, p) - 1)).toBeLessThan(1e-13);
      const want = p === 1 ? norms(A).one : p === 2 ? norms(A).two : norms(A).inf;
      expect(Math.abs(pNorm(apply(A, x), p) - want)).toBeLessThanOrEqual(1e-12 * Math.max(1, want));
    }
  });

  it('every spherePoint has p-norm 1', () => {
    for (const p of PS) for (let k = 0; k < 50; k++) expect(Math.abs(pNorm(spherePoint(p, k * 0.13), p) - 1)).toBeLessThan(1e-14);
  });
});

describe('sampling the sphere approaches the norm from below and never exceeds it (convergence)', () => {
  it('max over 20 000 directions of ‖Ax‖_p is ≤ ‖A‖_op and within 1e-6 relative of it', () => {
    for (const A of SAMPLE) for (const p of PS) {
      const want = p === 1 ? norms(A).one : p === 2 ? norms(A).two : norms(A).inf;
      let best = 0;
      for (let k = 0; k < 20_000; k++) best = Math.max(best, pNorm(apply(A, spherePoint(p, (2 * Math.PI * k) / 20_000)), p));
      expect(best).toBeLessThanOrEqual(want * (1 + 1e-12) + 1e-15);
      if (want > 0) expect(relativeError(best, want)).toBeLessThan(1e-6);
    }
  });
});
