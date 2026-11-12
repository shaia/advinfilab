/**
 * src/math/cover.ts, filed by accuracy category. Each test is named after the claim it checks.
 * Every decision in the module is exact rational arithmetic; grid sweeps below are probes that cross-check the closed
 * formulas (the claims themselves are proved in lesson 3.2).
 */

import { describe, expect, it } from 'vitest';
import {
  BLOCKS,
  GRID_DEN,
  PRESETS,
  ZERO,
  ballHome,
  covers,
  describeCover,
  eq,
  fewestBlocks,
  fmtRat,
  largestLebesgue,
  le,
  lt,
  minPrefixN,
  onGrid,
  pointIv,
  rat,
  selected,
  slack,
  subR,
  add,
  tailIv,
  uncoveredInterval,
  uncoveredSeq,
  uncoveredText,
  type IntervalSet,
  type OpenIv,
} from '~/math/cover';

const I = (lo: [number, number], hi: [number, number], loOpen = false, hiOpen = false): IntervalSet => ({
  kind: 'interval',
  lo: rat(...lo),
  hi: rat(...hi),
  loOpen,
  hiOpen,
});
const O = (l: [number, number], r: [number, number], name = 'A'): OpenIv => ({ l: rat(...l), r: rat(...r), name });
const prefix = (id: keyof typeof PRESETS, n: number, v0 = false) => selected(PRESETS[id], { n, v0, picks: [] });
const picks = (...idx: number[]) => BLOCKS.map((_, i) => idx.includes(i + 1));

describe('exact rational arithmetic', () => {
  it('rat reduces and normalises the sign; slider values snap to exact multiples of 1/200', () => {
    expect(rat(6, -4)).toEqual({ p: -3, q: 2 });
    expect(eq(rat(1, 100), onGrid(0.01))).toBe(true);
    expect(eq(rat(1, 8), onGrid(0.125 + 1e-12))).toBe(true); // 0.01 is not on the 1/200 grid ...
    expect(eq(rat(1, 200), onGrid(0.005))).toBe(true);
    expect(eq(add(rat(1, 3), rat(1, 6)), rat(1, 2))).toBe(true);
    expect(fmtRat(rat(1, 33))).toBe('1/33');
    expect(fmtRat(rat(1, 8))).toBe('0.125');
    expect(fmtRat(rat(-3, 20))).toBe('-0.15');
  });
});

describe('exact values (the numbers the lesson quotes)', () => {
  it('U₂, …, U_N cover [0.03, 0.97] first at N = 34; at N = 33 the piece [0.03, 1/33] is left', () => {
    expect(minPrefixN(PRESETS['tail-inner'], false)).toBe(34);
    expect(uncoveredText(PRESETS['tail-inner'].set, prefix('tail-inner', 33))).toBe('[0.03, 1/33]');
  });

  it('no prefix U₂, …, U_N with N ≤ 200 covers (0, 1); at N = 200 exactly (0, 1/200] is left', () => {
    expect(minPrefixN(PRESETS['tail-open'], false)).toBeNull();
    expect(uncoveredText(PRESETS['tail-open'].set, prefix('tail-open', 200))).toBe('(0, 0.005]');
  });

  it('K = {0} ∪ {1/n}: V₀, V₁, …, V_N cover first at N = 6 (1/7 < 3/20 < 1/6); without V₀ never', () => {
    expect(minPrefixN(PRESETS['points-K'], true)).toBe(6);
    expect(minPrefixN(PRESETS['points-K'], false)).toBeNull();
    expect(uncoveredText(PRESETS['points-K'].set, prefix('points-K', 5, true))).toBe('1/6');
    expect(lt(rat(1, 7), rat(3, 20)) && lt(rat(3, 20), rat(1, 6))).toBe(true);
  });

  it('{1/n} with V₁, …, V₂₀ leaves every 1/n with n ≥ 21 uncovered', () => {
    const u = uncoveredSeq({ kind: 'seq', zero: false }, prefix('points-Kstar', 20));
    expect(u).toEqual({ zero: false, ns: [], tailFrom: 21 });
  });

  it('the fewest blocks covering [0, 1] are exactly {W₁, W₂, W₃}', () => {
    expect(fewestBlocks(PRESETS.blocks)).toEqual({ count: 3, masks: [0b00111] });
  });

  it('largest Lebesgue numbers: {W₁, W₂, W₃} gives 1/20 (at 0.35), all five give 1/8 (at 0.425)', () => {
    const X = PRESETS.blocks.set as IntervalSet;
    const a = largestLebesgue(X, selected(PRESETS.blocks, { n: 0, v0: false, picks: picks(1, 2, 3) }))!;
    expect(eq(a.value!, rat(1, 20))).toBe(true);
    expect(eq(a.at!, rat(7, 20))).toBe(true);
    const b = largestLebesgue(X, BLOCKS)!;
    expect(eq(b.value!, rat(1, 8))).toBe(true);
    expect(eq(b.at!, rat(17, 40))).toBe(true);
  });

  it('the bank questions: [0,1] with [0, 0.6), (0.4, 1] has largest Lebesgue number 0.1; [0,2] with [0, 1.3), (0.7, 2] has 0.3', () => {
    // a set open in X = [0, 1] such as [0, 0.6) is (−1, 0.6) ∩ X: the left end outside X imposes nothing
    const L1 = largestLebesgue(I([0, 1], [1, 1]), [O([-1, 1], [3, 5]), O([2, 5], [2, 1])])!;
    expect(eq(L1.value!, rat(1, 10))).toBe(true);
    const L2 = largestLebesgue(I([0, 1], [2, 1]), [O([-1, 1], [13, 10]), O([7, 10], [3, 1])])!;
    expect(eq(L2.value!, rat(3, 10))).toBe(true);
  });
});

describe('exact identities of the coverage algebra', () => {
  it('touching open intervals leave their common end uncovered: (0, 1/2) ∪ (1/2, 2) misses {1/2} in [0, 1]', () => {
    const X = I([0, 1], [1, 1]);
    const u = uncoveredInterval(X, [O([0, 1], [1, 2]), O([1, 2], [2, 1])]);
    expect(u.map((p) => [fmtRat(p.lo), fmtRat(p.hi), p.loOpen, p.hiOpen])).toEqual([
      ['0', '0', false, false],
      ['0.5', '0.5', false, false],
    ]);
  });

  it('an open end of X is never "uncovered": (0, 1) ⊆ (0, 1/2) ∪ (1/3, 1)', () => {
    expect(covers(I([0, 1], [1, 1], true, true), [O([0, 1], [1, 2]), O([1, 3], [1, 1])])).toBe(true);
    expect(covers(I([0, 1], [1, 1]), [O([0, 1], [1, 2]), O([1, 3], [1, 1])])).toBe(false);
  });

  it('the union of U₂, …, U_N is U_N: the uncovered part of (0, 1) is (0, 1/N] for every N', () => {
    for (let N = 2; N <= 60; N++) expect(uncoveredText(PRESETS['tail-open'].set, prefix('tail-open', N))).toBe(`(0, ${fmtRat(rat(1, N))}]`);
  });

  it('V_n meets {0} ∪ {1/m} only in 1/n (n = 1 … 200): its radius 1/(3n(n+1)) is below half the gaps', () => {
    for (let n = 1; n <= 200; n++) {
      const v = pointIv(n);
      for (let m = 1; m <= 210; m++) expect(lt(v.l, rat(1, m)) && lt(rat(1, m), v.r)).toBe(m === n);
      expect(lt(ZERO, v.l)).toBe(true);
    }
  });

  it('the largest Lebesgue number is ∞ exactly when one chosen set contains X', () => {
    expect(largestLebesgue(I([0, 1], [1, 1], true, true), [O([0, 1], [1, 1])])!.value).toBeNull();
    expect(largestLebesgue(I([0, 1], [1, 1]), [O([0, 1], [1, 1])])).toBeNull(); // does not even cover [0, 1]
  });
});

describe('analytic claims (cross-checked by exact sweeps on the grid)', () => {
  /** every grid point of X */
  const gridPoints = (X: IntervalSet) => {
    const out = [];
    for (let k = -GRID_DEN; k <= 2 * GRID_DEN; k++) {
      const x = rat(k, GRID_DEN);
      const inside = (X.loOpen ? lt(X.lo, x) : le(X.lo, x)) && (X.hiOpen ? lt(x, X.hi) : le(x, X.hi));
      if (inside) out.push(x);
    }
    return out;
  };

  it('δ = L is a Lebesgue number of every covering block selection, and L + 1/200 is not (the worst point fails)', () => {
    const X = PRESETS.blocks.set as IntervalSet;
    for (let m = 1; m < 32; m++) {
      const ivs = BLOCKS.filter((_, i) => (m >> i) & 1);
      const L = largestLebesgue(X, ivs);
      if (!L || L.value === null) continue;
      for (const x of gridPoints(X)) expect(ballHome(X, ivs, x, L.value)).not.toBeNull();
      expect(ballHome(X, ivs, L.at!, add(L.value, rat(1, GRID_DEN)))).toBeNull();
    }
  });

  it('on (0, 1) with (0, 0.6), (0.4, 1) the largest Lebesgue number is 0.1, and near the open end 0 the slack tends to 0.6', () => {
    const X = I([0, 1], [1, 1], true, true);
    const ivs = [O([0, 1], [3, 5]), O([2, 5], [1, 1])];
    expect(eq(largestLebesgue(X, ivs)!.value!, rat(1, 10))).toBe(true);
    expect(eq(slack(X, ivs, ZERO, 'from-right')!, rat(3, 5))).toBe(true);
    expect(eq(slack(X, ivs, rat(1, 1000))!, subR(rat(3, 5), rat(1, 1000)))).toBe(true);
  });

  it('the cover (1/n, 1) of (0, 1) has no Lebesgue number: for δ, the ball around x ≤ δ lies in no U_n (n ≤ 200)', () => {
    const X = PRESETS['tail-open'].set as IntervalSet;
    const all = prefix('tail-open', 200);
    for (const d of [0.5, 0.1, 0.02, 0.005]) {
      const delta = onGrid(d);
      expect(ballHome(X, all, delta, delta)).toBeNull();
      expect(ballHome(X, all, rat(1, GRID_DEN), delta)).toBeNull();
    }
    // and a ball away from 0 does fit: B(1/2, 1/4) ⊆ U_4 = (1/4, 1)
    expect(ballHome(X, all, rat(1, 2), rat(1, 4))?.name).toBe(tailIv(4).name);
  });

  it('the readout sentence names the coverage and the probe', () => {
    const s = describeCover({ preset: 'blocks', sel: { n: 0, v0: false, picks: picks(1, 2, 3) }, x: 0.35, delta: 0.05, showProbe: true, showL: true });
    expect(s).toContain('הן מכסות את X');
    expect(s).toContain('B(0.35, 0.05) מוכל ב-W₁');
    expect(s).toContain('0.05');
  });
});
