/**
 * src/math/continuity.ts, filed by accuracy category. Each test is named after the claim it checks.
 */

import { describe, expect, it } from 'vitest';
import { PRESETS, deltaWorks, innerFits, normRatio, type NormP, type PresetId } from '~/math/continuity';
import { pNorm } from '~/math/multivar';

describe('exact values (closed formulas)', () => {
  it('x² at a = 1, ε = 0.5 allows δ = √1.5 − 1; at a = 2.5 only √6.75 − 2.5', () => {
    expect(PRESETS.square.deltaStar(1, 0.5)).toBeCloseTo(Math.sqrt(1.5) - 1, 14);
    expect(PRESETS.square.deltaStar(2.5, 0.5)).toBeCloseTo(Math.sqrt(6.75) - 2.5, 14);
  });

  it('√|x| at 0 allows exactly δ = ε², and ε² works at every point (uniform)', () => {
    expect(PRESETS.sqrt.deltaStar(0, 0.5)).toBeCloseTo(0.25, 14);
    for (const a of [0, 0.1, 0.25, 0.3, 1, 2.9]) expect(PRESETS.sqrt.deltaStar(a, 0.5)).toBeGreaterThanOrEqual(0.25 - 1e-12);
    expect(PRESETS.sqrt.deltaStar(0.25, 0.5)).toBeCloseTo(0.25, 14);
  });

  it('the jump has no δ at 0 for ε ≤ 1, and δ* = |a| elsewhere', () => {
    expect(PRESETS.jump.deltaStar(0, 0.5)).toBe(0);
    expect(deltaWorks('jump', 0, 0.5, 0.01)).toBe(false);
    expect(PRESETS.jump.deltaStar(-0.4, 0.5)).toBeCloseTo(0.4, 14);
    expect(PRESETS.jump.deltaStar(0, 1.2)).toBe(Infinity);
  });

  it('the norm ratios on ℝ² are √2 (d1/d2, d2/d∞), 2 (d1/d∞) and 1 the other way', () => {
    expect(normRatio(1, 2)).toBeCloseTo(Math.SQRT2, 14);
    expect(normRatio(2, Infinity)).toBeCloseTo(Math.SQRT2, 14);
    expect(normRatio(1, Infinity)).toBe(2);
    expect(normRatio(Infinity, 1)).toBe(1);
    expect(normRatio(2, 1)).toBe(1);
    expect(innerFits(1, 1, Infinity, 0.5)).toBe(true);
    expect(innerFits(1, 1, Infinity, 0.55)).toBe(false);
  });
});

describe('brute force agrees with the formulas (sampling)', () => {
  /** the smallest |x − a| with |f(x) − f(a)| ≥ ε on a fine grid around a: δ* from below, to the grid step */
  const sampled = (id: PresetId, a: number, eps: number, h = 1e-5, reach = 8) => {
    const { f } = PRESETS[id];
    for (let k = 1; k * h <= reach; k++) {
      const t = k * h;
      if (Math.abs(f(a + t) - f(a)) >= eps || Math.abs(f(a - t) - f(a)) >= eps) return t;
    }
    return Infinity;
  };

  it('δ*(a, ε) is the first distance at which f leaves the ε-band, to one grid step, for every preset (ε ≥ 1 and |a| = ε² included)', () => {
    for (const id of ['line', 'square', 'sqrt', 'jump'] as PresetId[]) for (const eps of [0.2, 0.5, 0.9, 1.2]) {
      for (const a of [-2.5, -0.7, -0.1, 0.05, 0.25, 0.3, 1, 2.2, eps * eps, -eps * eps]) {
        // at √|x|'s branch point |a| = ε² the graph touches the band edge at the single point x = 0, which a grid
        // reaches only up to rounding: that case is checked exactly in the next test instead
        if (id === 'sqrt' && Math.abs(Math.abs(a) - eps * eps) < 1e-12) continue;
        const exact = PRESETS[id].deltaStar(a, eps);
        const seen = sampled(id, a, eps);
        // the jump never leaves a band wider than its height: no distance is the first, and δ* is +∞
        if (exact === Infinity) expect(seen).toBe(Infinity);
        else expect(Math.abs(seen - exact)).toBeLessThanOrEqual(1.5e-5);
      }
    }
  });

  it('at √|x|’s branch point |a| = ε², δ* = ε² exactly: x = 0 is at distance ε², and its value differs by exactly ε', () => {
    for (const eps of [0.2, 0.5, 1.2]) for (const a of [eps * eps, -eps * eps]) {
      const d = PRESETS.sqrt.deltaStar(a, eps);
      expect(d).toBeCloseTo(eps * eps, 12);
      // the open interval of radius ε² around a just misses 0, where |√0 − √|a|| = ε is not < ε
      expect(Math.abs(PRESETS.sqrt.f(0) - PRESETS.sqrt.f(a))).toBeCloseTo(eps, 12);
      expect(deltaWorks('sqrt', a, eps, d)).toBe(true);
      expect(deltaWorks('sqrt', a, eps, d + 1e-6)).toBe(false);
    }
  });

  it('the uniform δ on |a| ≤ W is the minimum of δ*(a, ε) over a grid of a, for every preset and W ∈ {0.01, 0.3, 3}', () => {
    for (const id of ['line', 'square', 'sqrt', 'jump'] as PresetId[]) for (const eps of [0.3, 0.5]) for (const W of [0.01, 0.3, 3]) {
      let min = Infinity;
      for (let i = -3000; i <= 3000; i++) min = Math.min(min, PRESETS[id].deltaStar((W * i) / 3000, eps));
      expect(Math.abs(min - PRESETS[id].uniformDelta(eps, W))).toBeLessThan(1e-9);
    }
  });

  it('‖v‖_p ≤ normRatio(p, q)·‖v‖_q on sampled directions, with near-equality somewhere', () => {
    const ps: NormP[] = [1, 2, Infinity];
    for (const p of ps) for (const q of ps) {
      const C = normRatio(p, q);
      let worst = 0;
      for (let k = 0; k < 3600; k++) {
        const v = [Math.cos((2 * Math.PI * k) / 3600), Math.sin((2 * Math.PI * k) / 3600)];
        worst = Math.max(worst, pNorm(v, p) / pNorm(v, q));
      }
      expect(worst).toBeLessThanOrEqual(C + 1e-12);
      expect(worst).toBeGreaterThan(C - 1e-6);
    }
  });
});
