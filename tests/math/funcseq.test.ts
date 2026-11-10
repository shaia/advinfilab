/**
 * src/math/funcseq.ts, filed by accuracy category. Each test is named after the claim it checks.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import { SEQS, firstInTube, inTube, type SeqId } from '~/math/funcseq';
import { supDist } from '~/math/multivar';

const IDS = Object.keys(SEQS) as SeqId[];

describe('exact values (closed formulas)', () => {
  it('the hump nx/(1+n²x²) has sup ½ for every n, attained at x = 1/n', () => {
    for (const n of [1, 2, 5, 40]) {
      expect(SEQS.bump.sup(n)).toBe(0.5);
      expect(SEQS.bump.f(n, 1 / n)).toBeCloseTo(0.5, 14);
    }
  });

  it('x/n first enters the tube of radius 0.1 at n = 11 (1/10 is not < 0.1): the definition N is 10', () => {
    expect(inTube(SEQS['x-over-n'], 10, 0.1)).toBe(false);
    expect(inTube(SEQS['x-over-n'], 11, 0.1)).toBe(true);
    expect(firstInTube(SEQS['x-over-n'], 0.1, 60)).toBe(11);
  });

  it('xⁿ on [0, ½] enters the tube of radius 0.02 at n = 6 ((½)⁵ = 0.03125, (½)⁶ = 0.015625)', () => {
    expect(firstInTube(SEQS['xn-half'], 0.02, 60)).toBe(6);
  });

  it('xⁿ on [0, 1] and the hump never enter a tube of radius ≤ ½ around their pointwise limit', () => {
    for (const eps of [0.5, 0.3, 0.1]) {
      expect(firstInTube(SEQS.xn, eps, 60)).toBeNull();
      expect(firstInTube(SEQS.bump, eps, 60)).toBeNull();
    }
  });

  it('xⁿ(1−x) has sup nⁿ/(n+1)ⁿ⁺¹: 0.08192 at n = 4', () => {
    expect(SEQS['xn-1mx'].sup(4)).toBeCloseTo(0.08192, 14);
  });
});

describe('the formulas agree with the sampled sup (a probe, 20 001 points)', () => {
  it('every attained sup matches supDist to 1e-6 relative', () => {
    for (const id of IDS) {
      const s = SEQS[id];
      if (id === 'xn') continue;
      for (const n of [1, 2, 3, 7, 20]) {
        const probe = supDist((x) => s.f(n, x), s.limit, s.a, s.b);
        expect(relativeError(probe, s.sup(n))).toBeLessThan(1e-6);
        const at = s.argSup(n);
        if (at !== null) expect(relativeError(Math.abs(s.f(n, at) - s.limit(at)), s.sup(n))).toBeLessThan(1e-12);
      }
    }
  });

  it('for xⁿ on [0, 1] the sampled sup stays below 1 and approaches it: the sup is not attained', () => {
    for (const n of [1, 5, 20]) {
      const probe = supDist((x) => x ** n, SEQS.xn.limit, 0, 1);
      expect(probe).toBeLessThan(1);
      expect(probe).toBeGreaterThan(1 - n * 1e-4);
    }
  });
});

describe('monotone sups (what makes firstInTube exact)', () => {
  it('sₙ is non-increasing in n for every preset, n ≤ 200', () => {
    for (const id of IDS) for (let n = 1; n < 200; n++) expect(SEQS[id].sup(n + 1)).toBeLessThanOrEqual(SEQS[id].sup(n) + 1e-15);
  });
});
