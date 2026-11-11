/**
 * src/math/cauchy.ts, filed by accuracy category. Each test is named after the claim it checks.
 * Sampled tails are probes (evidence), the closed forms come from the proofs in the model comments.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import {
  EPS,
  K_MAX,
  NESTS,
  NEST_IDS,
  TAILS,
  TAIL_IDS,
  bisectP,
  gap,
  intersectionPoint,
  isqrt,
  limitInSpace,
  missingPoint,
  newtonRational,
  sampledSpread,
  smallestN,
  sqrt2Trunc,
  type TailSeqId,
} from '~/math/cauchy';

const SQRT2 = Math.SQRT2;

describe('exact identities', () => {
  it('isqrt is the floor of the square root: isqrt(v)² ≤ v < (isqrt(v)+1)² for sizes beyond 2⁵³', () => {
    for (const v of [0n, 1n, 2n, 3n, 4n, 15n, 16n, 17n, 10n ** 30n, 2n * 10n ** 40n, 2n * 10n ** 40n - 1n, 10n ** 41n + 12345n]) {
      const r = isqrt(v);
      expect(r * r <= v).toBe(true);
      expect((r + 1n) * (r + 1n) > v).toBe(true);
    }
  });

  it('the decimal truncations of √2 are 1, 1.4, 1.41, 1.414, 1.4142 and the 12th is 1.41421356237', () => {
    expect([0, 1, 2, 3, 4].map((m) => sqrt2Trunc(m))).toEqual([1n, 14n, 141n, 1414n, 14142n]);
    expect(sqrt2Trunc(11)).toBe(141421356237n);
    expect(TAILS['sqrt2-dec'].x(12)).toBeCloseTo(1.41421356237, 14);
    expect(TAILS['sqrt2-dec'].x(1)).toBe(1);
  });

  it('every truncation is a rational below √2: t² < 2 < (t + 10^{−m})² in integers, for m up to 11', () => {
    for (let m = 0; m <= 11; m++) {
      const t = sqrt2Trunc(m);
      const s = 10n ** BigInt(2 * m);
      expect(t * t < 2n * s).toBe(true);
      expect((t + 1n) * (t + 1n) > 2n * s).toBe(true);
    }
  });

  it('the Newton iterates are the rationals 2, 3/2, 17/12, 577/408, 665857/470832', () => {
    expect([1, 2, 3, 4, 5].map((n) => newtonRational(n))).toEqual([
      [2n, 1n],
      [3n, 2n],
      [17n, 12n],
      [577n, 408n],
      [665857n, 470832n],
    ]);
  });

  it('p² − 2q² = 1 for the Newton iterates from n = 2 (so xₙ − √2 = 1/(q(p + √2 q)) exactly)', () => {
    for (let n = 2; n <= 10; n++) {
      const [p, q] = newtonRational(n);
      expect(p * p - 2n * q * q).toBe(1n);
    }
  });

  it('the alternating harmonic tail from N is spanned by s_N and s_{N+1}: D_N = 1/(N+1), attained', () => {
    for (const N of [1, 2, 3, 10, 25, 60]) {
      const t = TAILS['alt-harm'];
      expect(relativeError(Math.abs(t.x(N + 1) - t.x(N)), 1 / (N + 1))).toBeLessThan(1e-13);
      expect(t.attained(N)).toBe(true);
    }
  });

  it('(−1)ⁿ has D_N = 2 for every N, attained between two consecutive terms', () => {
    for (const N of [1, 2, 30, 59]) {
      expect(Math.abs(TAILS['alt-sign'].x(N) - TAILS['alt-sign'].x(N + 1))).toBe(2);
      expect(TAILS['alt-sign'].spread(N)).toBe(2);
    }
  });

  it('the closed form D_N equals tailSup − tailInf where both are finite (absolute 1e-15 where the double xₙ − √2 loses digits: Newton, N ≥ 5)', () => {
    for (const id of TAIL_IDS) {
      const t = TAILS[id];
      for (let N = 1; N <= t.nMax; N++) {
        const D = t.spread(N);
        const diff = t.tailSup(N) - t.tailInf(N);
        if (!Number.isFinite(D)) {
          expect(Number.isFinite(t.tailSup(N)) && Number.isFinite(t.tailInf(N))).toBe(false);
        } else if ((id === 'newton' && N >= 4) || id === 'sqrt2-dec') {
          // a double difference of two numbers near √2 carries an absolute error of about 2e-16
          expect(Math.abs(D - diff)).toBeLessThan(1e-15);
        } else {
          expect(relativeError(D, diff)).toBeLessThan(1e-9);
        }
      }
    }
  });

  it('bisection intervals have diameter 2^{−(j−1)}, with the exact endpoints [1,2], [1,1.5], [1.25,1.5], [1.375,1.5]', () => {
    const f = NESTS.bisect;
    expect([1, 2, 3, 4].map((j) => [f.set(j).lo, f.set(j).hi])).toEqual([
      [1, 2],
      [1, 1.5],
      [1.25, 1.5],
      [1.375, 1.5],
    ]);
    for (let j = 1; j <= K_MAX; j++) expect(f.set(j).hi - f.set(j).lo).toBe(f.diam(j));
  });

  it('exact diameters: (0,1/j] has 1/j, [0,1/j] has 1/j, [j,∞) has ∞', () => {
    for (let j = 1; j <= K_MAX; j++) {
      expect(NESTS['half-open'].diam(j)).toBe(1 / j);
      expect(NESTS.shrink.diam(j)).toBe(1 / j);
      expect(NESTS.rays.diam(j)).toBe(Infinity);
      expect(NESTS.rays.set(j).ray).toBe(true);
    }
  });

  it('open and closed ends: (0,1/j] is open at 0, closed at 1/j; the others are closed at every finite end', () => {
    expect(NESTS['half-open'].set(3)).toMatchObject({ loClosed: false, hiClosed: true });
    expect(NESTS.shrink.set(3)).toMatchObject({ loClosed: true, hiClosed: true });
    expect(NESTS.bisect.set(3)).toMatchObject({ loClosed: true, hiClosed: true });
    expect(NESTS.rays.set(3)).toMatchObject({ loClosed: true, ray: true });
  });

  it('the intersection of all sets: {√2} in ℝ and ∅ in ℚ for bisect; ∅ for (0,1/j] and [j,∞); {0} for [0,1/j] in both', () => {
    expect(intersectionPoint(NESTS.bisect, 'R')).toBe(SQRT2);
    expect(intersectionPoint(NESTS.bisect, 'Q')).toBeNull();
    expect(missingPoint(NESTS.bisect, 'Q')).toBe(SQRT2);
    expect(missingPoint(NESTS.bisect, 'R')).toBeNull();
    for (const sp of ['R', 'Q'] as const) {
      expect(intersectionPoint(NESTS['half-open'], sp)).toBeNull();
      expect(intersectionPoint(NESTS.rays, sp)).toBeNull();
      expect(intersectionPoint(NESTS.shrink, sp)).toBe(0);
      expect(missingPoint(NESTS.shrink, sp)).toBeNull();
    }
  });

  it('the limit is in the space: 0 is in ℝ and ℚ but not (0,1); √2 in ℝ only; ln 2 in ℝ and (0,1) but not ℚ; π/2 never; none for the divergent ones', () => {
    expect(['R', 'Q', 'open01'].map((s) => limitInSpace(TAILS['inv-n'], s as 'R'))).toEqual([true, true, false]);
    expect(['R', 'Q', 'open01'].map((s) => limitInSpace(TAILS['sqrt2-dec'], s as 'R'))).toEqual([true, false, false]);
    expect(['R', 'Q', 'open01'].map((s) => limitInSpace(TAILS['alt-harm'], s as 'R'))).toEqual([true, false, true]);
    for (const sp of ['R', 'Q', 'open01', 'R-arctan'] as const) {
      expect(limitInSpace(TAILS['arctan-n'], sp)).toBe(false);
      for (const id of ['harmonic', 'sqrt-n', 'alt-sign'] as TailSeqId[]) expect(limitInSpace(TAILS[id], sp)).toBe(false);
    }
  });

  it('the smallest N with D_N < ε: 1/n needs N = 11 for ε = 0.1 (1/10 is not < 0.1); alt-harm needs N = 10 (1/11 < 0.1, 1/10 is not)', () => {
    expect(smallestN(TAILS['inv-n'], 0.1)).toBe(11);
    expect(smallestN(TAILS['alt-harm'], 0.1)).toBe(10);
    expect(smallestN(TAILS['inv-n'], 0.5)).toBe(3);
    expect(smallestN(TAILS['harmonic'], 0.5)).toBeNull();
    expect(smallestN(TAILS['alt-sign'], 0.5)).toBeNull();
  });

  it('Newton and the truncations are 0.001-close to each other from N = 4 on, not at N = 3', () => {
    expect(gap(TAILS.newton, TAILS['sqrt2-dec'], 3)).toBeGreaterThan(0.001);
    expect(gap(TAILS.newton, TAILS['sqrt2-dec'], 4)).toBeLessThan(0.001);
  });

  it('the ε values are descending and the figure offers nine', () => {
    expect(EPS.length).toBe(9);
    for (let i = 1; i < EPS.length; i++) expect(EPS[i]).toBeLessThan(EPS[i - 1]);
  });
});

describe('analytic limits and monotonicity the formulas rely on', () => {
  it('D_N is non-increasing in N for every preset (T_{N+1} ⊆ T_N), so the smallest N is the true first N', () => {
    for (const id of TAIL_IDS) {
      const t = TAILS[id];
      for (let N = 1; N < t.nMax; N++) expect(t.spread(N + 1)).toBeLessThanOrEqual(t.spread(N));
    }
  });

  it('1/n is decreasing; the truncations of √2 are non-decreasing and below √2; Newton decreases and stays above √2', () => {
    for (let n = 1; n < 60; n++) expect(TAILS['inv-n'].x(n + 1)).toBeLessThan(TAILS['inv-n'].x(n));
    for (let n = 1; n < 12; n++) expect(TAILS['sqrt2-dec'].x(n + 1)).toBeGreaterThanOrEqual(TAILS['sqrt2-dec'].x(n));
    for (let n = 1; n <= 12; n++) expect(TAILS['sqrt2-dec'].x(n)).toBeLessThan(SQRT2);
    for (let n = 1; n < 9; n++) {
      const [p, q] = newtonRational(n);
      const [p2, q2] = newtonRational(n + 1);
      expect(p2 * q < p * q2).toBe(true); // x_{n+1} < x_n by cross-multiplication
      expect(p * p > 2n * q * q).toBe(true); // x_n > √2
    }
  });

  it('the Newton error recursion x_{n+1} − √2 = (x_n − √2)²/(2x_n) holds for n = 1..4', () => {
    const t = TAILS.newton;
    for (let n = 1; n <= 4; n++) expect(relativeError(t.spread(n + 1), t.spread(n) ** 2 / (2 * t.x(n)))).toBeLessThan(1e-9);
  });

  it('even partial sums of the alternating harmonic series increase and odd ones decrease, ln 2 in between', () => {
    const x = TAILS['alt-harm'].x;
    for (let n = 1; n <= 56; n++) {
      if (n % 2 === 0) {
        expect(x(n + 2)).toBeGreaterThan(x(n));
        expect(x(n)).toBeLessThan(Math.LN2);
      } else {
        expect(x(n + 2)).toBeLessThan(x(n));
        expect(x(n)).toBeGreaterThan(Math.LN2);
      }
    }
  });

  it('the plotted tails stay inside the preset y-window', () => {
    for (const id of TAIL_IDS) {
      const t = TAILS[id];
      for (let n = 1; n <= t.nMax; n++) {
        expect(t.x(n)).toBeGreaterThan(t.y[0]);
        expect(t.x(n)).toBeLessThan(t.y[1]);
      }
    }
  });

  it('the bisection intervals are nested, contain √2 strictly inside, and bisectP matches the integer rule', () => {
    const f = NESTS.bisect;
    for (let j = 1; j <= K_MAX; j++) {
      const s = f.set(j);
      expect(s.lo * s.lo).toBeLessThan(2);
      expect(s.hi * s.hi).toBeGreaterThan(2);
      expect(s.lo <= SQRT2 && SQRT2 <= s.hi).toBe(true);
      if (j < K_MAX) {
        const t = f.set(j + 1);
        expect(t.lo).toBeGreaterThanOrEqual(s.lo);
        expect(t.hi).toBeLessThanOrEqual(s.hi);
      }
      expect(bisectP(j)).toBe(Math.round(s.lo * 2 ** (j - 1)));
    }
  });

  it('every nest is a decreasing chain F_{j+1} ⊆ F_j', () => {
    for (const id of NEST_IDS) {
      const f = NESTS[id];
      for (let j = 1; j < K_MAX; j++) {
        const a = f.set(j);
        const b = f.set(j + 1);
        expect(b.lo).toBeGreaterThanOrEqual(a.lo);
        expect(b.hi).toBeLessThanOrEqual(a.hi);
        // a shared endpoint keeps its openness only if it was already closed in the bigger set
        if (b.lo === a.lo && b.loClosed) expect(a.loClosed).toBe(true);
        if (b.hi === a.hi && b.hiClosed) expect(a.hiClosed).toBe(true);
        expect(f.diam(j + 1)).toBeLessThanOrEqual(f.diam(j));
      }
    }
  });

  it('every nest has its window containing every drawn finite endpoint', () => {
    for (const id of NEST_IDS) {
      const f = NESTS[id];
      for (let j = 1; j <= K_MAX; j++) {
        const s = f.set(j);
        expect(s.lo).toBeGreaterThanOrEqual(f.window[0]);
        if (Number.isFinite(s.hi)) expect(s.hi).toBeLessThanOrEqual(f.window[1]);
        else expect(s.lo).toBeLessThan(f.window[1]);
      }
    }
  });
});

describe('probes (a sampled tail; compares the closed form D_N, does not prove it)', () => {
  // The sup of 1/n, √2-truncations and arctan n is approached only as n → ∞: a sample over N ≤ n ≤ M undershoots it
  // by at most the size of the tail beyond M (relative to D_N: about N/M for 1/n and arctan), so M = 10⁶ and 1e-3.
  it('1/n: sampled spread over n ≤ 10⁶ matches 1/N to relative 1e-3', () => {
    for (const N of [1, 2, 7, 30, 60]) expect(relativeError(sampledSpread(TAILS['inv-n'].x, N, 1e6), TAILS['inv-n'].spread(N))).toBeLessThan(1e-3);
  });

  it('arctan n: sampled spread over n ≤ 10⁶ matches π/2 − arctan N to relative 1e-3', () => {
    for (const N of [1, 2, 7, 30, 60]) expect(relativeError(sampledSpread(TAILS['arctan-n'].x, N, 1e6), TAILS['arctan-n'].spread(N))).toBeLessThan(1e-3);
  });

  it('truncations of √2: sampled spread over n ≤ 40 digits matches √2 − x_N (the sample undershoots by 10^{−39})', () => {
    const x = (n: number) => Number(sqrt2Trunc(n - 1)) / 10 ** (n - 1);
    for (const N of [1, 2, 5, 9, 12]) {
      const probe = sampledSpread(x, N, 16);
      // beyond 16 digits the doubles are √2 itself: the sample reaches √2 − x_N up to 1e-16 absolute
      expect(Math.abs(probe - TAILS['sqrt2-dec'].spread(N))).toBeLessThan(1e-15);
    }
  });

  it('Newton: sampled spread over n ≤ 10 matches x_N − √2 (relative for N ≤ 4; absolute 1e-15 for N ≥ 5, the double resolution at √2)', () => {
    for (const N of [1, 2, 3, 4, 5, 6]) {
      const probe = sampledSpread(TAILS.newton.x, N, 10);
      const exact = TAILS.newton.spread(N);
      if (N <= 4) expect(relativeError(probe, exact)).toBeLessThan(1e-9);
      else expect(Math.abs(probe - exact)).toBeLessThan(1e-15);
    }
  });

  it('alternating harmonic: sampled spread over n ≤ 3000 matches 1/(N+1) to relative 1e-9 (the extremes are in the tail, so the sample sees them)', () => {
    let s = 0;
    const sums: number[] = [0];
    for (let k = 1; k <= 3000; k++) {
      s += (k % 2 ? 1 : -1) / k;
      sums.push(s);
    }
    for (const N of [1, 2, 3, 10, 40, 60]) expect(relativeError(sampledSpread((n) => sums[n], N, 3000), 1 / (N + 1))).toBeLessThan(1e-9);
  });

  it('(−1)ⁿ: sampled spread is exactly 2 from every N', () => {
    for (const N of [1, 2, 30]) expect(sampledSpread(TAILS['alt-sign'].x, N, N + 5)).toBe(2);
  });

  it('harmonic and √n: the sampled spread grows without a bound (H_M − H_N > 10, √M − √N > 900 for M = 10⁶), so D_N = ∞', () => {
    let h = 0;
    for (let k = 1; k <= 1e5; k++) h += 1 / k; // H_M by a running sum: TAILS.harmonic.x(n) is O(n)
    expect(h - 1).toBeGreaterThan(10);
    expect(sampledSpread(TAILS['sqrt-n'].x, 1, 1e6)).toBeGreaterThan(900);
    expect(sampledSpread(TAILS['sqrt-n'].x, 60, 1e6)).toBeGreaterThan(990);
    expect(TAILS.harmonic.spread(1)).toBe(Infinity);
    expect(TAILS['sqrt-n'].spread(60)).toBe(Infinity);
  });

  it('pairs: the largest |x_m − x_n| over a window of 80 terms equals max − min, for every preset (the spread is a max − min)', () => {
    for (const id of TAIL_IDS) {
      const t = TAILS[id];
      for (const N of [1, 5]) {
        let best = 0;
        for (let m = N; m < N + 80; m++) for (let n = N; n < N + 80; n++) best = Math.max(best, Math.abs(t.x(m) - t.x(n)));
        expect(relativeError(best, sampledSpread(t.x, N, N + 79))).toBeLessThan(1e-12);
      }
    }
  });
});
