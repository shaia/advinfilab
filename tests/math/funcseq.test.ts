/**
 * src/math/funcseq.ts, filed by accuracy category. Each test is named after the claim it checks.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import { EPS, EPS_FINE, RADII, SEQS, SET_CASES, ballInSet, firstInTube, inTube, largestBall, shiftInBall, shiftInSet, shiftKeyValue, type SeqId } from '~/math/funcseq';
import { simpson, supDist } from '~/math/multivar';

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
      if (s.argSup(1) === null) continue;
      // exp-series: e − sₙ(1) is below the 4e-16 rounding of the probe for n ≳ 15, so its probe uses small n only
      for (const n of id === 'exp-series' ? [1, 2, 3, 4] : [1, 2, 3, 7, 20]) {
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

describe('chapter-2 presets: exact sup, where it is attained, and the sampled sup (a probe)', () => {
  it('ramp: sup 1 for every n, not attained; the sampled sup stays below 1 and approaches it as the grid refines at x = ½⁺', () => {
    const s = SEQS.ramp;
    for (const n of [1, 2, 5, 20, 60]) {
      expect(s.sup(n)).toBe(1);
      expect(s.argSup(n)).toBeNull();
      const probe = supDist((x) => s.f(n, x), s.limit, 0, 1);
      expect(probe).toBeLessThan(1);
      // the first grid point right of ½ is ½ + 5e-5, where fₙ = n·5e-5
      expect(relativeError(probe, 1 - n * 5e-5)).toBeLessThan(1e-9);
    }
    expect(s.limit(0.5)).toBe(0);
    expect(s.limit(0.5 + 1e-9)).toBe(1);
  });

  it('smooth-abs: sup 1/n attained at x = ½ and the sampled sup agrees', () => {
    const s = SEQS['smooth-abs'];
    for (const n of [1, 2, 7, 20, 60]) {
      expect(s.argSup(n)).toBe(0.5);
      expect(relativeError(s.f(n, 0.5) - s.limit(0.5), 1 / n)).toBeLessThan(1e-14);
      expect(relativeError(supDist((x) => s.f(n, x), s.limit, 0, 1), s.sup(n))).toBeLessThan(1e-6);
    }
  });

  it('cos-series: sup 2^−n attained at x = 0 and the sampled sup on [−π, π] agrees', () => {
    const s = SEQS['cos-series'];
    for (const n of [1, 2, 3, 7, 20]) {
      expect(s.argSup(n)).toBe(0);
      expect(relativeError(supDist((x) => s.f(n, x), s.limit, s.a, s.b), 2 ** -n)).toBeLessThan(1e-6);
    }
  });

  it('exp-series: sup e − sₙ(1) attained at x = 1; the tail sum agrees with it while no cancellation hides it (n ≤ 8)', () => {
    const s = SEQS['exp-series'];
    for (const n of [1, 2, 3, 4, 6, 8]) {
      expect(s.argSup(n)).toBe(1);
      expect(relativeError(s.sup(n), Math.E - s.f(n, 1))).toBeLessThan(1e-9);
      expect(relativeError(supDist((x) => s.f(n, x), s.limit, 0, 1), s.sup(n))).toBeLessThan(1e-9);
    }
    expect(s.sup(1)).toBeCloseTo(Math.E - 2, 14);
    expect(s.sup(200)).toBeGreaterThanOrEqual(0);
  });

  it('the new presets are monotone in n and the finer ε radii extend EPS as a prefix', () => {
    for (const id of ['ramp', 'smooth-abs', 'cos-series', 'exp-series'] as const) for (let n = 1; n < 200; n++) expect(SEQS[id].sup(n + 1)).toBeLessThanOrEqual(SEQS[id].sup(n));
    expect(EPS_FINE.slice(0, EPS.length)).toEqual([...EPS]);
  });
});

describe('ramp: the L¹ distance ∫|fₙ − f| (Simpson is a probe)', () => {
  it('l1(n) = 1/(2n) for n ≥ 2 and 3/8 for n = 1', () => {
    const l1 = SEQS.ramp.l1!;
    expect(l1(1)).toBe(3 / 8);
    for (const n of [2, 3, 10, 20]) expect(l1(n)).toBe(1 / (2 * n));
  });

  it('agrees with Simpson on (½, 1] (where f = 1; fₙ = f on [0, ½]) for n = 1, 2, 3, 10, 20, 60', () => {
    const s = SEQS.ramp;
    for (const x of [0, 0.1, 0.25, 0.5]) for (const n of [1, 7, 60]) expect(s.f(n, x)).toBe(s.limit(x));
    for (const n of [1, 2, 3, 10, 20, 60]) {
      // the kink at ½ + 1/n is not a node in general: 100 000 panels keep the error far below 1e-6
      const probe = simpson((x) => Math.abs(s.f(n, x) - 1), 0.5, 1, 100_000);
      expect(relativeError(probe, s.l1!(n))).toBeLessThan(1e-6);
    }
  });

  it('only the ramp carries l1', () => {
    for (const id of IDS) expect(SEQS[id].l1 !== undefined).toBe(id === 'ramp');
  });
});

describe('series presets: the limit formulas', () => {
  it('cos-series limit (cos x/2 − 1/4)/(5/4 − cos x) agrees with the partial sum n = 60 (tail ≤ 2^−60), by relative error', () => {
    const s = SEQS['cos-series'];
    for (const x of [0, 0.5, 1, 2, 3, -2.5, Math.PI, -Math.PI]) expect(relativeError(s.f(60, x), s.limit(x))).toBeLessThan(1e-13);
    // at x = π/3 the limit is exactly 0: an absolute bound, the tail 2^−60 plus rounding
    expect(Math.abs(s.f(60, Math.PI / 3) - s.limit(Math.PI / 3))).toBeLessThan(1e-15);
    expect(s.limit(0)).toBe(1);
  });

  it('exp-series partial sum n = 25 agrees with Math.exp on [0, 1], by relative error', () => {
    const s = SEQS['exp-series'];
    for (const x of [0, 0.1, 0.3, 0.5, 0.9, 1]) expect(relativeError(s.f(25, x), Math.exp(x))).toBeLessThan(1e-14);
  });
});

describe('first n in the tube (the tasks of lessons 2.2 and 2.4)', () => {
  it('cos-series with ε = 0.01 enters at n = 7 (2^−6 = 0.0156, 2^−7 = 0.0078)', () => {
    expect(firstInTube(SEQS['cos-series'], 0.01, 60)).toBe(7);
  });
  it('smooth-abs with ε = 0.05 enters at n = 21 (1/20 is not < 0.05)', () => {
    expect(firstInTube(SEQS['smooth-abs'], 0.05, 60)).toBe(21);
  });
  it('ramp never enters a tube of radius ≤ 1 (EPS_FINE)', () => {
    for (const e of EPS_FINE) expect(firstInTube(SEQS.ramp, e, 60)).toBeNull();
  });
});

describe('lesson 4.1: Taylor polynomials of eˣ (the polynomials are not closed)', () => {
  it('exp-series with ε = 0.01 enters at n = 4 (tail Σ_{k≥4} 1/k! = 0.0516, Σ_{k≥5} 1/k! = 0.00995) and stays', () => {
    const s = SEQS['exp-series'];
    expect(relativeError(s.sup(3), Math.E - (1 + 1 + 1 / 2 + 1 / 6))).toBeLessThan(1e-12);
    expect(relativeError(s.sup(4), Math.E - (1 + 1 + 1 / 2 + 1 / 6 + 1 / 24))).toBeLessThan(1e-12);
    expect(s.sup(3)).toBeGreaterThan(0.01);
    expect(s.sup(4)).toBeLessThan(0.01);
    expect(firstInTube(s, 0.01, 60)).toBe(4);
  });
  it('the Lagrange bound e/(n+1)! dominates the exact sup (it is the bound the lesson proves)', () => {
    const s = SEQS['exp-series'];
    let fact = 1;
    for (let n = 1; n <= 15; n++) {
      fact *= n + 1;
      expect(s.sup(n)).toBeLessThanOrEqual(Math.E / fact);
    }
  });
});

describe('set mode (lesson 4.1): exact membership of the shift g = f − c', () => {
  it('pos: min of x² − x + ½ is ¼ at ½ (exact), and the sampled min agrees (a probe)', () => {
    const s = SET_CASES.pos;
    expect(s.f(0.5)).toBe(0.25);
    let m = Infinity;
    for (let i = 0; i <= 20000; i++) m = Math.min(m, s.f(i / 20000));
    expect(relativeError(m, s.inf)).toBeLessThan(1e-12);
  });
  it('pos: the largest ball inside P has radius min f = ¼; B(f, 0.3) contains the shift by ¼, which leaves P', () => {
    const s = SET_CASES.pos;
    expect(largestBall(s)).toBe(0.25);
    expect(ballInSet(s, 0.25)).toBe(true);
    expect(ballInSet(s, 0.3)).toBe(false);
    expect(shiftInBall(0.25, 0.3)).toBe(true);
    expect(shiftInSet(s, 0.25)).toBe(false);
    expect(shiftInSet(s, 0.24)).toBe(true);
    expect(shiftInBall(0.25, 0.25)).toBe(false);
  });
  it('pos-open: inf x on (0, 1] is 0 and not attained: no ball, and every positive shift leaves P', () => {
    const s = SET_CASES['pos-open'];
    expect(largestBall(s)).toBeNull();
    for (const r of RADII) expect(ballInSet(s, r)).toBe(false);
    expect(shiftInSet(s, 0)).toBe(true);
    expect(shiftInSet(s, 0.01)).toBe(false);
    expect(shiftInSet(s, -0.3)).toBe(true);
  });
  it('zero: f(½) = 0 up to rounding of sin π (absolute 1e-16), Z_p has no ball, and only c = 0 stays in it', () => {
    const s = SET_CASES.zero;
    // absolute bound: the exact value is 0, and Math.sin(Math.PI) is 1.22e-16
    expect(Math.abs(s.f(s.p as number))).toBeLessThan(1e-15);
    expect(largestBall(s)).toBeNull();
    expect(shiftInSet(s, 0)).toBe(true);
    expect(shiftInSet(s, 0.01)).toBe(false);
    expect(shiftKeyValue(s, 0.03)).toBe(-0.03);
  });
});
