/**
 * src/math/axioms.ts, filed by accuracy category. Each test is named after the claim it checks.
 */

import { describe, expect, it } from 'vitest';
import { supDist } from '~/math/multivar';
import { relativeError } from '~/math/vec';
import { CANDIDATES, PAIRS, findViolation, gridPoint, triangleVerdict, zeroAxiomAt, type DistId } from '~/math/axioms';

describe('exact counterexamples (a single triple or pair proves "not a metric")', () => {
  it('(x−y)² breaks the triangle inequality at 0, 1, 2: 4 > 1 + 1', () => {
    const d = CANDIDATES.sq.d;
    expect(d(0, 2)).toBe(4);
    expect(d(0, 1) + d(1, 2)).toBe(2);
    expect(triangleVerdict(d, 0, 1, 2)).toBe('fails');
  });

  it('|x²−y²| gives distance 0 between the distinct points 1 and −1', () => {
    expect(zeroAxiomAt(CANDIDATES.abs2.d, 1, -1)).toBe('distinct-zero');
  });

  it('|x−y| + 1 gives a point distance 1 from itself', () => {
    expect(zeroAxiomAt(CANDIDATES.plus1.d, 0.3, 0.3)).toBe('self-nonzero');
  });
});

describe('exact identities on the grid', () => {
  it('for |x−y| the triangle inequality is an equality exactly when y lies between x and z', () => {
    const d = CANDIDATES.abs.d;
    for (let i = -10; i <= 10; i += 3) for (let j = -10; j <= 10; j++) for (let k = -10; k <= 10; k += 4) {
      const [x, y, z] = [gridPoint(i), gridPoint(j), gridPoint(k)];
      const between = Math.min(x, z) <= y && y <= Math.max(x, z);
      expect(triangleVerdict(d, x, y, z)).toBe(between ? 'equal' : 'strict');
    }
  });

  it('for (x−y)² the triangle inequality fails exactly when y lies strictly between x and z (gap −2ab)', () => {
    const d = CANDIDATES.sq.d;
    for (let i = -10; i <= 10; i += 3) for (let j = -10; j <= 10; j++) for (let k = -10; k <= 10; k += 4) {
      const [x, y, z] = [gridPoint(i), gridPoint(j), gridPoint(k)];
      const strictly = Math.min(x, z) < y && y < Math.max(x, z);
      expect(triangleVerdict(d, x, y, z) === 'fails').toBe(strictly);
    }
  });
});

describe('grid search: evidence, never proof (the proofs are in lesson 1.1)', () => {
  const metrics: DistId[] = ['abs', 'sqrt', 'frac', 'trunc', 'cube', 'disc'];
  it.each(metrics)('no triple on the grid breaks the triangle inequality for %s', (id) => {
    expect(findViolation(CANDIDATES[id].d, 15)).toBeNull();
  });

  it('the search does find a violation for (x−y)²', () => {
    expect(findViolation(CANDIDATES.sq.d, 15)).not.toBeNull();
  });
});

describe('the sup metric: the exact values agree with a dense sampling', () => {
  it('sup |sin − cos| on [0, π] is √2, at 3π/4; the endpoints give only 1', () => {
    const p = PAIRS.sincos;
    expect(relativeError(supDist(p.f, p.g, p.a, p.b), p.sup)).toBeLessThan(1e-6);
    expect(relativeError(Math.abs(p.f(p.argSup) - p.g(p.argSup)), p.sup)).toBeLessThan(1e-12);
    expect(Math.abs(p.f(0) - p.g(0))).toBe(1);
    // |sin π − cos π| = 1 up to the rounding of sin π ≈ 1.2e-16
    expect(relativeError(Math.abs(p.f(p.b) - p.g(p.b)), 1)).toBeLessThan(1e-12);
  });

  it('sup |x − x²| on [0, 1] is ¼, at ½; the endpoints give 0', () => {
    const p = PAIRS.xsq;
    expect(relativeError(supDist(p.f, p.g, p.a, p.b), p.sup)).toBeLessThan(1e-6);
    expect(p.f(p.argSup) - p.g(p.argSup)).toBe(0.25);
    expect(p.f(0) - p.g(0)).toBe(0);
    expect(p.f(1) - p.g(1)).toBe(0);
  });
});
