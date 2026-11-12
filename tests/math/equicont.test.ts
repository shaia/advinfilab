/**
 * src/math/equicont.ts, filed by accuracy category. Each test is named after the claim it checks.
 * The closed forms are the ones lesson 4.2 states; a dense scan cross-checks them. The theorems themselves are proved
 * in the lesson: a finite number of members is evidence about an infinite family, never a proof.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import {
  FAMILIES,
  deltaStar,
  escapees,
  members,
  plDelta,
  powerDelta,
  powerFailPoint,
  powerLipBound,
  profile,
  sinDelta,
  tent,
  tentKnots,
  type Member,
} from '~/math/equicont';

/** δ_f(a) by brute force: the distance to the nearest grid point of D with |f(x) − f(a)| ≥ ε (an upper estimate). */
function scanDelta(f: (x: number) => number, a: number, eps: number, lo: number, hi: number, N = 400_000): number {
  const f0 = f(a);
  let best = Infinity;
  for (let i = 0; i <= N; i++) {
    const x = lo + ((hi - lo) * i) / N;
    if (Math.abs(f(x) - f0) >= eps) best = Math.min(best, Math.abs(x - a));
  }
  return best;
}

describe('exact identities: the closed forms the lesson quotes', () => {
  it('sin(nx) at a = 0: δ = arcsin(ε)/n (טענה 4.2.7(א): the δ of the n-th member shrinks like 1/n)', () => {
    for (const n of [1, 2, 7, 25, 40])
      for (const eps of [0.1, 0.5, 0.9]) expect(relativeError(sinDelta(1, n, 0, 0, eps, 0, Math.PI), Math.asin(eps) / n)).toBeLessThan(1e-12);
  });

  it('xⁿ at a = 1: δ = 1 − (1 − ε)^{1/n} → 0 (טענה 4.2.7(ב))', () => {
    for (const n of [1, 3, 17, 40])
      for (const eps of [0.25, 0.5]) expect(relativeError(powerDelta(n, 1, eps), 1 - (1 - eps) ** (1 / n))).toBeLessThan(1e-12);
  });

  it('x_n = 2^{−1/n} gives x_nⁿ = 1/2, so |f_n(x_n) − f_n(1)| = 1/2 (טענה 4.2.7(ב))', () => {
    for (const n of [1, 2, 10, 100]) expect(relativeError(powerFailPoint(n) ** n, 0.5)).toBeLessThan(1e-12);
  });

  it('the tent t_n at a = 0: δ = 2^{−n}(1 + ε/2), the first point where t_n reaches ε (טענה 4.2.7(ג))', () => {
    for (const n of [1, 2, 5, 12]) {
      const { xs, ys } = tentKnots(n);
      for (const eps of [0.2, 0.5, 1]) expect(relativeError(plDelta(xs, ys, 0, eps), 2 ** -n * (1 + eps / 2))).toBeLessThan(1e-12);
    }
  });

  it('the tents of טענה 3.1.9(ב): t_n is 1 at 3·2^{−n−1} and 0 outside [2^{−n}, 2^{−n+1}]', () => {
    for (const n of [1, 3, 8]) {
      expect(tent(n, 3 * 2 ** (-n - 1))).toBe(1);
      expect(tent(n, 2 ** -n)).toBe(0);
      expect(tent(n, 2 ** (-n + 1))).toBe(0);
      if (n >= 2) expect(tent(n, 0.999)).toBe(0);
    }
  });

  it('the bank: 0.95^13 > 1/2 ≥ 0.95^14 (Q-4.2-xn-n), and π/(2n) < 0.01 first at n = 158 (Q-4.2-sin-n)', () => {
    expect(0.95 ** 13).toBeGreaterThan(0.5);
    expect(0.95 ** 14).toBeLessThanOrEqual(0.5);
    expect(Math.PI / (2 * 157)).toBeGreaterThanOrEqual(0.01);
    expect(Math.PI / (2 * 158)).toBeLessThan(0.01);
  });
});

describe('cross-checks: the closed forms agree with a dense scan', () => {
  const check = (mb: Member, a: number, eps: number, lo: number, hi: number) => {
    const exact = mb.delta(a, eps);
    const scan = scanDelta(mb.f, a, eps, lo, hi);
    if (!Number.isFinite(exact)) {
      expect(scan).toBe(Infinity);
      return;
    }
    // the scan finds a grid point just past the exact boundary: within one grid step
    expect(scan).toBeGreaterThanOrEqual(exact - 1e-12);
    expect(scan - exact).toBeLessThan(((hi - lo) / 400_000) * 1.01);
  };
  for (const id of ['shift', 'freq', 'lip', 'power', 'tent'] as const) {
    it(`family ${id}: δ_f(a) at several points and ε`, () => {
      const fam = FAMILIES[id];
      const [lo, hi] = fam.domain;
      for (const mb of members(fam, id === 'tent' ? 6 : 9))
        // ε avoids the tangencies |f(a) ± ε| = max |f|, where the set {|f − f(a)| ≥ ε} is a single point a scan misses
        for (const t of [0, 0.13, 0.5, 0.77, 1])
          for (const eps of [0.15, 0.45, 1.2]) check(mb, lo + t * (hi - lo), eps, lo, hi);
    });
  }
});

describe('analytic bounds the lesson proves, checked on the drawn members', () => {
  it('a common Lipschitz constant 1 gives δ ≥ ε at every point (טענה 4.2.5(א)): shifts and sin(nx)/n', () => {
    for (const id of ['shift', 'lip'] as const)
      for (const eps of [0.1, 0.3, 0.5]) expect(profile(FAMILIES[id], 40, eps).min).toBeGreaterThanOrEqual(eps - 1e-12);
  });

  it('xⁿ at a = 1/2: δ*(a) ≥ min(b − a, ε/C_b) with b = 3/4, C_b = sup n b^{n−1}, for every m (טענה 4.2.7(ב))', () => {
    const C = powerLipBound(0.75);
    expect(relativeError(C, 1.6875)).toBeLessThan(1e-12); // 3·(3/4)² = 4·(3/4)³ = 27/16
    for (const eps of [0.1, 0.5]) {
      const lower = Math.min(0.25, eps / C);
      for (const m of [1, 10, 40]) expect(deltaStar(FAMILIES.power, m, 0.5, eps).delta).toBeGreaterThanOrEqual(lower - 1e-12);
    }
  });

  it('sup_n n·b^{n−1} is finite for b < 1 and grows without bound as b → 1 (why the proof needs b < 1)', () => {
    for (const b of [0.5, 0.9, 0.99]) {
      let brute = 0;
      for (let n = 1; n < 20_000; n++) brute = Math.max(brute, n * b ** (n - 1));
      expect(relativeError(powerLipBound(b), brute)).toBeLessThan(1e-12);
    }
    expect(powerLipBound(0.999)).toBeGreaterThan(300);
  });

  it('the failure points: δ*(0) for sin(nx), δ*(1) for xⁿ and δ*(0) for tents decrease to 0 as m grows', () => {
    const at = (id: 'freq' | 'power' | 'tent', a: number, m: number) => deltaStar(FAMILIES[id], m, a, 0.5).delta;
    for (const [id, a] of [
      ['freq', 0],
      ['power', 1],
      ['tent', 0],
    ] as const) {
      const ds = [1, 2, 4, 8, 12].map((m) => at(id, a, m));
      for (let i = 1; i < ds.length; i++) expect(ds[i]).toBeLessThan(ds[i - 1]);
    }
    expect(at('freq', 0, 40)).toBeLessThan(0.014);
    expect(at('tent', 0, 12)).toBeLessThan(2 ** -11);
  });

  it('the tents are equicontinuous away from 0: at a = 1/2, δ*(a) does not change once m ≥ 3', () => {
    const d3 = deltaStar(FAMILIES.tent, 3, 0.5, 0.5).delta;
    expect(deltaStar(FAMILIES.tent, 12, 0.5, 0.5).delta).toBe(d3);
  });

  it('escapees are exactly the members with δ_f(a) < δ (a member stays in its box iff δ ≤ δ_f(a))', () => {
    const fam = FAMILIES.freq;
    const ds = members(fam, 10).map((mb) => mb.delta(0.3, 0.5));
    const out = escapees(fam, 10, 0.3, 0.5, 0.1);
    expect(out).toEqual(ds.map((d, i) => (d < 0.1 ? i : -1)).filter((i) => i >= 0));
  });

  it('the figure tasks are reachable: xⁿ with ε = 0.4 needs m ≥ 17 for δ*(1) < 0.03; sin(nx) with ε = 0.5 needs m ≥ 27 for δ*(0) < 0.02', () => {
    expect(deltaStar(FAMILIES.power, 16, 1, 0.4).delta).toBeGreaterThanOrEqual(0.03);
    expect(deltaStar(FAMILIES.power, 17, 1, 0.4).delta).toBeLessThan(0.03);
    expect(deltaStar(FAMILIES.freq, 26, 0, 0.5).delta).toBeGreaterThanOrEqual(0.02);
    expect(deltaStar(FAMILIES.freq, 27, 0, 0.5).delta).toBeLessThan(0.02);
  });
});
