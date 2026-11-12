/**
 * src/math/diagonal.ts, filed by accuracy category. Each test is named after the claim it checks.
 * The rows and the diagonal are finite: the structural claims (nesting, the diagonal is increasing and lies in row j
 * from place j on) are exact on these N terms; claims about convergence are only evidence. The lemma and the theorem
 * are proved in lesson 4.3.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import {
  FAMILIES,
  MAX_ROWS,
  WINDOW,
  bump,
  buildRows,
  densePoint,
  diagonal,
  firstAllInside,
  inWindow,
  isIncreasing,
  isSubsequence,
  scaledTent,
  smoothAbs,
  spreadAt,
  spreadOnD,
  supDiff,
  supSpread,
  tent,
  tentsAlive,
  windowIndex,
  type FamilyId,
} from '~/math/diagonal';

const FAMS: FamilyId[] = ['shift', 'osc'];

describe('exact structure of the diagonal construction (lemma 4.3.6, on N terms)', () => {
  it('q_j enumerates the dyadic rationals of (0,1) level by level, without repetition', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(densePoint)).toEqual([1 / 2, 1 / 4, 3 / 4, 1 / 8, 3 / 8, 5 / 8, 7 / 8]);
    const first = Array.from({ length: 2 ** 10 - 1 }, (_, i) => densePoint(i + 1));
    expect(new Set(first).size).toBe(first.length);
    // the first 2^m − 1 points are exactly the k/2^m, 0 < k < 2^m: a 2^{−m}-net of [0,1] for every m
    const m = 10;
    const want = Array.from({ length: 2 ** m - 1 }, (_, k) => (k + 1) / 2 ** m);
    expect([...first].sort((a, b) => a - b)).toEqual(want);
  });

  it('every window index is in range and v = 1 lies in the last window', () => {
    expect(windowIndex(-1)).toBe(0);
    expect(windowIndex(1)).toBe(Math.round(2 / WINDOW) - 1);
    expect(windowIndex(0.49)).toBe(2);
  });

  for (const fam of FAMS) {
    const rows = buildRows(fam);
    const g = diagonal(rows);

    it(`${fam}: each row is a subsequence of the previous one, and its values at q_j lie in its window`, () => {
      expect(rows).toHaveLength(MAX_ROWS);
      for (let j = 0; j < rows.length; j++) {
        const r = rows[j];
        expect(isIncreasing(r.indices)).toBe(true);
        if (j > 0) expect(isSubsequence(r.indices, rows[j - 1].indices)).toBe(true);
        expect(r.hi - r.lo).toBe(WINDOW);
        for (const n of r.indices) {
          const v = FAMILIES[fam].f(n, r.q);
          expect(v).toBeGreaterThanOrEqual(r.lo);
          expect(v).toBeLessThanOrEqual(r.hi);
        }
      }
    });

    it(`${fam}: the diagonal is strictly increasing, and from place j on it lies in row j`, () => {
      expect(isIncreasing(g)).toBe(true);
      for (let j = 1; j <= g.length; j++) expect(isSubsequence(g.slice(j - 1), rows[j - 1].indices)).toBe(true);
    });

    it(`${fam}: the k-th element of a subset of row j is at least the k-th element of row j (why the diagonal increases)`, () => {
      for (let j = 1; j < rows.length; j++) {
        const sub = rows[j].indices;
        const sup = rows[j - 1].indices;
        for (let k = 0; k < Math.min(sub.length, 200); k++) expect(sub[k]).toBeGreaterThanOrEqual(sup[k]);
      }
    });

    it(`${fam}: from place j on, the diagonal values at q_1 … q_j are within one window width`, () => {
      for (let j = 1; j <= g.length; j++) expect(spreadOnD(fam, g.slice(j - 1), j)).toBeLessThanOrEqual(WINDOW);
    });
  }

  it('the diagonals the e2e test reads: shift 4, 5, 10, 11, 17, 23 and osc 2, 16, 40, 66, 267, 468', () => {
    expect(diagonal(buildRows('shift'))).toEqual([4, 5, 10, 11, 17, 23]);
    expect(diagonal(buildRows('osc'))).toEqual([2, 16, 40, 66, 267, 468]);
  });

  it('the tail task: the first place from which every circle is filled is at most the number of rows (step 4), and is 4 for osc', () => {
    for (const fam of FAMS) {
      const rows = buildRows(fam);
      for (let R = 1; R <= MAX_ROWS; R++) expect(firstAllInside(fam, rows.slice(0, R))).toBeLessThanOrEqual(R);
    }
    const osc = buildRows('osc');
    expect(firstAllInside('osc', osc)).toBe(4);
    // the Explore step shows row S_2 of osc: the tail from place 2 is in the windows of q_1, q_2, q_3, not of q_4, q_5, q_6
    const g = diagonal(osc).slice(1);
    for (const j of [1, 2, 3]) expect(g.every((n) => inWindow('osc', n, osc[j - 1]))).toBe(true);
    for (const j of [4, 5, 6]) expect(g.every((n) => inWindow('osc', n, osc[j - 1]))).toBe(false);
    // the shifts: the whole diagonal is in every window, so the task is set on osc
    expect(firstAllInside('shift', buildRows('shift'))).toBe(1);
  });
});

describe('closed forms of the lesson and its bank (exact identities)', () => {
  it('at every x at most one tent t_n is nonzero, so n·t_n is pointwise bounded; ‖n·t_n‖∞ = n (טענה 4.3.5)', () => {
    for (let i = 0; i <= 4000; i++) expect(tentsAlive(i / 4000).length).toBeLessThanOrEqual(1);
    for (const n of [1, 2, 5, 9]) expect(scaledTent(n, 3 * 2 ** (-n - 1))).toBe(n);
    // the dyadic endpoints 2^{−n} are zeros of every tent
    for (let n = 1; n <= 20; n++) expect(tentsAlive(2 ** -n)).toEqual([]);
  });

  it('the moving bumps max(0, 1 − |x − n|) are pairwise at sup distance exactly 1 (טענה 4.3.10(ג))', () => {
    for (const [n, m] of [
      [1, 2],
      [3, 4],
      [2, 7],
    ]) {
      const d = supDiff((x) => bump(n, x), (x) => bump(m, x), -1, 10, [n, m]);
      expect(d).toBe(1);
    }
  });

  it('√((x − 1/2)² + 1/n²) is within exactly 1/n of |x − 1/2| on [0,1], has sup ≤ 1 for n ≥ 2 and |slope| < 1 (טענה 4.3.11(א))', () => {
    for (const n of [2, 3, 10, 100]) {
      const d = supDiff((x) => smoothAbs(n, x), (x) => Math.abs(x - 0.5), 0, 1, [0.5]);
      expect(relativeError(d, 1 / n)).toBeLessThan(1e-12);
      expect(smoothAbs(n, 0)).toBeLessThanOrEqual(1);
      expect(smoothAbs(2, 0)).toBeCloseTo(Math.SQRT1_2, 14);
    }
    // n = 1 would leave the unit ball: √(1/4 + 1) > 1
    expect(smoothAbs(1, 0)).toBeGreaterThan(1);
  });

  it('‖x^n − x^{2n}‖∞ = 1/4 on [0,1], attained at x = 2^{−1/n} (Q-4.3-xn-dist with n = 7)', () => {
    const n = 7;
    const d = supDiff((x) => x ** n, (x) => x ** (2 * n), 0, 1, [2 ** (-1 / n)]);
    expect(relativeError(d, 0.25)).toBeLessThan(1e-12);
  });

  it('sin(k!·π·x) vanishes at p/q once k ≥ q and has sup norm 1 (MC-c4-dense-convergence-enough)', () => {
    const fact = (k: number): number => (k <= 1 ? 1 : k * fact(k - 1));
    for (const [p, q] of [
      [1, 2],
      [2, 3],
      [3, 5],
    ]) {
      const k = q;
      // k!·p/q is an integer
      expect(Number.isInteger((fact(k) * p) / q)).toBe(true);
      expect(Math.abs(Math.sin(Math.PI * ((fact(k) * p) / q)))).toBeLessThan(1e-12);
    }
    expect(Math.sin(fact(5) * Math.PI * (1 / (2 * fact(5))))).toBeCloseTo(1, 14);
  });

  it('the bound of Q-4.3-bound: |f(0)| ≤ 1 and |f′| ≤ 2 on [0,3] give ‖f‖∞ ≤ 7, attained by 1 + 2x', () => {
    expect(1 + 2 * 3).toBe(7);
  });

  it('W-4.3-01(ג): n²x(1 − x)^n is at least n/4 at x = 1/(2n) (Bernoulli), and tends to 0 at each fixed x', () => {
    const f = (n: number, x: number) => n * n * x * (1 - x) ** n;
    for (const n of [1, 2, 3, 10, 100, 1000]) {
      expect(f(n, 1 / (2 * n))).toBeGreaterThanOrEqual(n / 4);
      // Bernoulli: (1 − 1/(2n))^n ≥ 1 − n/(2n) = 1/2
      expect((1 - 1 / (2 * n)) ** n).toBeGreaterThanOrEqual(0.5);
    }
    expect(f(0 + 1, 0)).toBe(0);
    for (const x of [0.5, 0.1, 0.01]) expect(f(5000, x)).toBeLessThan(1e-12);
  });

  it('the diagonal indices of lemma 4.3.6 for the rows 2^j·ℕ: the k-th element of row k is k·2^k (n_3 = 24)', () => {
    const nk = (k: number) => k * 2 ** k;
    expect([1, 2, 3, 4].map(nk)).toEqual([2, 8, 24, 64]);
    expect(isIncreasing([1, 2, 3, 4, 5, 6].map(nk))).toBe(true);
  });

  it('a 1-Lipschitz shift family: |sin(x + c) − sin(y + c)| ≤ |x − y| (mean value theorem), checked on a grid', () => {
    for (const c of [0, 1, 4, 17]) for (let i = 0; i < 50; i++) {
      const x = i / 50;
      const y = (i + 1) / 50;
      expect(Math.abs(Math.sin(x + c) - Math.sin(y + c))).toBeLessThanOrEqual(Math.abs(x - y) + 1e-15);
    }
    expect(tent(1, 0.75)).toBe(1);
  });
});

describe('probes (evidence, not proof): what equicontinuity changes', () => {
  it('osc: from place 4 on, the diagonal is within 0.1 at q_1 … q_6, yet two of its members differ by about 2 somewhere', () => {
    const g = diagonal(buildRows('osc'));
    const tail = g.slice(3);
    expect(spreadOnD('osc', tail, 6)).toBeLessThan(0.1);
    expect(supSpread('osc', tail).value).toBeGreaterThan(1.9);
  });

  it('shift: from place 3 on, the diagonal is within 0.5 everywhere on [0,1] (the figure task), and from place 5 on within 0.2', () => {
    const g = diagonal(buildRows('shift'));
    expect(supSpread('shift', g.slice(2)).value).toBeLessThan(0.5);
    expect(supSpread('shift', g.slice(4)).value).toBeLessThan(0.2);
    // the members are 1-Lipschitz, so the spread moves by at most 2|x − y| between two points
    const tail = g.slice(2);
    for (let i = 0; i < 100; i++) {
      const x = i / 100;
      const y = (i + 1) / 100;
      expect(Math.abs(spreadAt('shift', tail, x) - spreadAt('shift', tail, y))).toBeLessThanOrEqual(2 * (y - x) + 1e-12);
    }
  });

  it('shift rows shrink slowly and osc rows fast: one window at q_1 already pins sin(x + n) near q_1', () => {
    const s = buildRows('shift').map((r) => r.indices.length);
    const o = buildRows('osc').map((r) => r.indices.length);
    expect(s[5] / s[0]).toBeGreaterThan(0.5);
    expect(o[5] / o[0]).toBeLessThan(0.05);
  });
});
