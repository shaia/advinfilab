/**
 * src/math/oscillation.ts, filed by accuracy category. Each test is named after the claim it checks.
 * Exact values are closed formulas (lesson 2.7); the Eₙ grid search is a probe, evidence for למה 2.7.20, not a proof.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import {
  BASES,
  DELTAS,
  OSC,
  SQRT_HALF,
  build,
  goodPoint,
  halfPeriod,
  hasGoodPoint,
  maxSlope,
  nodes,
  oscSup,
  qminExact,
  qminFloat,
  sampledPolyError,
  saw,
  sqrtPolyError,
  thomaePoints,
  witness,
} from '~/math/oscillation';

/** brute force: the least denominator of a fraction in (lo, hi), over all p/q with q ≤ 400 */
function qminBrute(lo: number, hi: number): number {
  for (let q = 1; q <= 400; q++) for (let p = Math.floor(lo * q) - 1; p <= Math.ceil(hi * q) + 1; p++) if (p / q > lo && p / q < hi) return q;
  return Infinity;
}

describe('exact values of the oscillation (הגדרה 2.7.8)', () => {
  it('o(sgn, 0) = 2 and o(sin(1/x) with f(0) = 5, 0) = 6, for every δ (the bank: Q-2.7-osc-sign, Q-2.7-osc-sin)', () => {
    for (const d of DELTAS) {
      expect(OSC.sgn.omega(d)).toBe(2);
      expect(OSC.sin5.omega(d)).toBe(6);
    }
  });

  it('every interval (−δ, δ) holds a point where sin(1/x) = −1: x = 1/(2πk + 3π/2) < δ for k ≥ 1/(2πδ)', () => {
    for (const d of DELTAS) {
      const k = Math.ceil(1 / (2 * Math.PI * d));
      const x = 1 / (2 * Math.PI * k + 1.5 * Math.PI);
      expect(x).toBeLessThan(d);
      expect(Math.abs(Math.sin(1 / x) + 1)).toBeLessThan(1e-12);
    }
  });

  it('Thomae at 3/4: ω = 1/4 for δ ≤ 1/12, 1/3 once 2/3 enters (δ = 0.1), 1 once the interval holds 1 (δ = 0.3)', () => {
    for (const d of [0.05, 0.02, 0.01, 0.005, 0.002, 0.001]) expect(OSC['thomae-rat'].omega(d)).toBe(0.25);
    expect(OSC['thomae-rat'].omega(0.1)).toBeCloseTo(1 / 3, 15);
    expect(OSC['thomae-rat'].omega(0.2)).toBeCloseTo(1 / 3, 15);
    expect(OSC['thomae-rat'].omega(0.3)).toBe(1);
    expect(OSC['thomae-rat'].omega(0.5)).toBe(1);
  });

  it('the exact least-denominator search agrees with brute force on (3/4 − δ, 3/4 + δ)', () => {
    for (const d of DELTAS) {
      const k = Math.round(d * 1000);
      expect(qminExact(750 - k, 750 + k, 1000)).toBe(qminBrute(0.75 - d + 1e-12, 0.75 + d - 1e-12));
    }
  });

  it('Thomae at 1/√2: the least denominator grows as δ shrinks (ω → 0, continuity at an irrational), and agrees with brute force', () => {
    const qs = DELTAS.map((d) => qminFloat(SQRT_HALF - d, SQRT_HALF + d));
    for (let i = 1; i < qs.length; i++) expect(qs[i]).toBeGreaterThanOrEqual(qs[i - 1]);
    for (const d of DELTAS) expect(qminFloat(SQRT_HALF - d, SQRT_HALF + d)).toBe(qminBrute(SQRT_HALF - d, SQRT_HALF + d));
    expect(qminFloat(SQRT_HALF - 0.01, SQRT_HALF + 0.01)).toBe(7); // 5/7 = 0.714…
    expect(OSC['thomae-irr'].omega(0.001)).toBeLessThan(0.05);
  });

  it('x·χ_ℚ(x): ω = 2δ at 0 (→ 0, continuous) and ω = 1/2 + δ at 1/2 (→ 1/2)', () => {
    for (const d of DELTAS.filter((d) => d <= 0.5)) {
      expect(relativeError(OSC['xchiq-0'].omega(d), 2 * d)).toBeLessThan(1e-15);
      expect(relativeError(OSC['xchiq-half'].omega(d), 0.5 + d)).toBeLessThan(1e-15);
    }
  });

  it('the band of values: inf = sup − ω is −1 for sgn and sin(1/x), 0 for Thomae and χ_{0}, min(a − δ, 0) for x·χ_ℚ', () => {
    for (const d of DELTAS) {
      expect(oscSup('sgn', d) - OSC.sgn.omega(d)).toBe(-1);
      expect(oscSup('sin5', d) - OSC.sin5.omega(d)).toBe(-1);
      expect(oscSup('thomae-rat', d) - OSC['thomae-rat'].omega(d)).toBe(0);
      expect(oscSup('chi0', d) - OSC.chi0.omega(d)).toBe(0);
      expect(oscSup('xchiq-half', d) - OSC['xchiq-half'].omega(d)).toBeCloseTo(Math.min(0.5 - d, 0), 14);
    }
  });

  it('Thomae points are reduced fractions with T(p/q) = 1/q, each once', () => {
    const pts = thomaePoints(0, 1, 12);
    const xs = pts.map(([x]) => x);
    expect(new Set(xs.map((x) => x.toFixed(12))).size).toBe(xs.length);
    expect(pts.find(([x]) => Math.abs(x - 0.75) < 1e-12)?.[1]).toBe(0.25);
    expect(pts.find(([x]) => Math.abs(x - 0.5) < 1e-12)?.[1]).toBe(0.5);
  });
});

describe('exact identities of the construction in למה 2.7.20', () => {
  it('the sawtooth has height H and slope ±L: values in [0, H], and |φ(x + h*) − φ(x)| = Lh* at the witness', () => {
    const H = 0.05;
    for (const L of [6, 37, 200]) {
      for (let j = 0; j <= 997; j++) {
        const x = j / 1000;
        const v = saw(x, H, L);
        expect(v).toBeGreaterThanOrEqual(-1e-15);
        expect(v).toBeLessThanOrEqual(H + 1e-15);
        const h = witness(x, H, L);
        expect(h).toBeGreaterThan(0);
        expect(h).toBeLessThanOrEqual(halfPeriod(H, L) + 1e-15);
        expect(Math.abs(Math.abs(saw(x + h, H, L) - v) - L * h)).toBeLessThan(1e-12);
      }
    }
  });

  it('for √x: M = √m and ‖√x − pₘ‖∞ = 1/(4√m) (the sampled sup reaches the formula)', () => {
    for (const m of [1, 4, 7, 16, 40]) {
      expect(relativeError(maxSlope(nodes(BASES.sqrt.f, m)), Math.sqrt(m))).toBeLessThan(1e-12);
      const s = sampledPolyError(BASES.sqrt.f, nodes(BASES.sqrt.f, m), 40000);
      expect(s).toBeLessThanOrEqual(sqrtPolyError(m) + 1e-12);
      expect(relativeError(s, sqrtPolyError(m))).toBeLessThan(1e-3);
    }
    // m = 7 is the first with ‖√x − p‖ < 0.1 = r/2 for r = 0.2
    expect(sqrtPolyError(6)).toBeGreaterThan(0.1);
    expect(sqrtPolyError(7)).toBeLessThan(0.1);
  });
});

describe('probes of Eₙ (evidence for למה 2.7.20, not proofs)', () => {
  it('a polygonal line with slopes ≤ n is in Eₙ: every grid point witnesses it', () => {
    const b = build(BASES.wave.f, 8, 0.05, 0);
    const M = maxSlope(b.v);
    const n = Math.ceil(M);
    expect(goodPoint(b, 0, n).good).toBe(true);
    expect(hasGoodPoint(b, n)).toBe(0);
  });

  it('with L > n + M (and H/L < 1/n) no grid point witnesses g = p + φ ∈ Eₙ, for both bases', () => {
    for (const base of ['sqrt', 'wave'] as const) {
      for (const n of [1, 3, 5]) {
        const m = 10;
        const H = 0.05;
        const M = maxSlope(nodes(BASES[base].f, m));
        const L = Math.floor(n + M) + 1;
        expect(H / L).toBeLessThan(1 / n);
        const b = build(BASES[base].f, m, H, L);
        expect(hasGoodPoint(b, n, 400)).toBeNull();
        // and at every grid x the lesson's witness h* already breaks the cone
        for (let j = 0; j <= 100; j++) {
          const x = (j * (1 - 1 / n)) / 100;
          const h = witness(x, H, L);
          expect(Math.abs(b.g(x + h) - b.g(x))).toBeGreaterThan(n * h);
        }
      }
    }
  });

  it('the bank number (Q-2.7-sawtooth): p = x², n = 3, the lower bound (L − 2)h exceeds 3h exactly when L > 5', () => {
    const lower = (L: number, h: number) => (L - 2) * h;
    expect(lower(5, 0.01)).toBeCloseTo(3 * 0.01, 15);
    expect(lower(5.001, 0.01)).toBeGreaterThan(3 * 0.01);
  });
});
