/**
 * src/math/algebra.ts, filed by accuracy category. Each test is named after the claim it checks.
 * The fits are discrete least squares on a grid: about the grid the identities and lower bounds are exact (up to
 * rounding); about the sup norm on the interval they are evidence. The theorems are proved in lesson 4.6.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import {
  N_MAX,
  basisFn,
  chebT,
  dimension,
  fitAll,
  fitAllFn,
  grid,
  intervalOf,
  provedLowerBound,
  type AlgebraId,
  type IntervalId,
  type TargetId,
} from '~/math/algebra';

const ROUND = 1e-12;

describe('exact identities: the bases', () => {
  it('Chebyshev: T_k(cos θ) = cos kθ for k ≤ 20 at several angles', () => {
    for (let k = 0; k <= 20; k++)
      for (const th of [0, 0.3, 1, 2.2, Math.PI])
        expect(Math.abs(chebT(k, Math.cos(th)) - Math.cos(k * th))).toBeLessThan(1e-12);
  });

  it('the even basis T_k(2x² − 1) is exactly even, and is a polynomial in x² (T_k(2x²−1) = T_2k(x))', () => {
    for (let j = 0; j <= 10; j++) {
      const b = basisFn('even', 'sym', j);
      for (const x of [0.1, 0.37, 0.8, 1]) {
        expect(b(x)).toBe(b(-x));
        expect(Math.abs(b(x) - chebT(2 * j, x))).toBeLessThan(1e-12);
      }
    }
  });

  it('every vanish basis function is exactly 0 at x = 0, on both intervals', () => {
    for (const iv of ['sym', 'half'] as IntervalId[]) for (let j = 0; j < N_MAX; j++) expect(basisFn('vanish', iv, j)(0) === 0).toBe(true);
  });

  it('dimensions of the degree-n parts: n+1, ⌊n/2⌋+1, n, 2n+1', () => {
    expect([0, 1, 5, 20].map((n) => dimension('poly', n))).toEqual([1, 2, 6, 21]);
    expect([0, 1, 5, 20].map((n) => dimension('even', n))).toEqual([1, 1, 3, 11]);
    expect([0, 1, 5, 20].map((n) => dimension('vanish', n))).toEqual([0, 1, 5, 20]);
    expect([0, 1, 5, 20].map((n) => dimension('trig', n))).toEqual([1, 3, 11, 41]);
  });

  it('the product formula of Q-4.6-product: cos 2x · cos 3x = ½ cos x + ½ cos 5x', () => {
    for (const x of [0.2, 1, 2.5, -1.7]) expect(Math.abs(Math.cos(2 * x) * Math.cos(3 * x) - (Math.cos(x) + Math.cos(5 * x)) / 2)).toBeLessThan(1e-15);
  });

  it('the grid contains both endpoints exactly', () => {
    const xs = grid(-Math.PI, Math.PI);
    expect(xs[0]).toBe(-Math.PI);
    expect(xs[xs.length - 1]).toBe(Math.PI);
  });
});

describe('exact identities: a member of the algebra is reproduced by its own fit', () => {
  const reproduces = (alg: AlgebraId, iv: IntervalId, f: (x: number) => number, n: number) => {
    const t = fitAllFn(alg, iv, f, n);
    expect(t.errors[n]).toBeLessThan(1e-9);
  };
  it('poly: x³ − x on [−1,1] at degree 3', () => reproduces('poly', 'sym', (x) => x ** 3 - x, 3));
  it('even: x⁴ − 3x² on [−1,1] at degree 4', () => reproduces('even', 'sym', (x) => x ** 4 - 3 * x * x, 4));
  it('vanish: x² + x on [0,1] at degree 2', () => reproduces('vanish', 'half', (x) => x * x + x, 2));
  it('trig: cos 2x · sin x = ½(sin 3x − sin x) at degree 3', () => reproduces('trig', 'sym', (x) => Math.cos(2 * x) * Math.sin(x), 3));
  it('trig: cos³x = ¾ cos x + ¼ cos 3x at degree 3 (example 2 of the lesson)', () => reproduces('trig', 'sym', (x) => Math.cos(x) ** 3, 3));
});

describe('lower bounds proved in the lesson hold for every degree (טענה 4.6.10, טענה 4.6.8א)', () => {
  const cases: [AlgebraId, IntervalId, TargetId, number][] = [
    ['even', 'sym', 'x', 1],
    ['even', 'sym', 'exp', Math.sinh(1)],
    ['vanish', 'sym', 'one', 1],
    ['vanish', 'half', 'one', 1],
    ['vanish', 'half', 'exp', 1],
    ['trig', 'sym', 'x', Math.PI],
    ['trig', 'sym', 'exp', Math.sinh(Math.PI)],
  ];
  for (const [alg, iv, t, lb] of cases)
    it(`${alg} on ${intervalOf(alg, iv).map((v) => v.toFixed(2)).join('..')} cannot approach ${t} closer than ${lb.toFixed(4)}`, () => {
      expect(relativeError(provedLowerBound(alg, iv, t), lb)).toBeLessThan(ROUND);
      for (const e of fitAll(alg, iv, t).errors) expect(e).toBeGreaterThanOrEqual(lb * (1 - 1e-9));
    });

  it('the lines a + bx do not reach x² on [0,1] closer than 1/8 (טענה 4.6.10(ד)); least squares gives 1/6 at x = 0', () => {
    const t = fitAllFn('poly', 'half', (x) => x * x, 1);
    expect(t.errors[1]).toBeGreaterThanOrEqual(1 / 8);
    expect(relativeError(t.errors[1], 1 / 6)).toBeLessThan(1e-3);
  });

  it('no lower bound is claimed where the algebra is dense', () => {
    expect(provedLowerBound('poly', 'sym', 'x')).toBe(0);
    expect(provedLowerBound('even', 'half', 'x')).toBe(0);
    expect(provedLowerBound('trig', 'sym', 'abs')).toBe(0);
  });
});

describe('convergence: where the hypotheses hold, the probe error goes down', () => {
  it('poly on [−1,1]: eˣ to below 1e-10 by degree 12', () => {
    expect(fitAll('poly', 'sym', 'exp').errors[12]).toBeLessThan(1e-10);
  });
  it('even on [0,1]: x = √(x²) is approached, below 0.05 by degree 12 and below 0.03 at degree 20', () => {
    const e = fitAll('even', 'half', 'x').errors;
    expect(e[12]).toBeLessThan(0.05);
    expect(e[11]).toBeGreaterThan(0.05);
    expect(e[20]).toBeLessThan(0.03);
    expect(e[20]).toBeLessThan(e[4]);
  });
  it('trig on [−π,π]: |x| (with |−π| = |π|) below 0.05 by degree 13, not at 12', () => {
    const e = fitAll('trig', 'sym', 'abs').errors;
    expect(e[13]).toBeLessThan(0.05);
    expect(e[12]).toBeGreaterThan(0.05);
  });
  it('vanish on [0,1]: |x| = x is in the algebra (degree 1)', () => {
    expect(fitAll('vanish', 'half', 'abs').errors[1]).toBeLessThan(1e-12);
  });
});
