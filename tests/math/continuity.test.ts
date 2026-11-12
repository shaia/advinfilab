/**
 * src/math/continuity.ts, filed by accuracy category. Each test is named after the claim it checks.
 */

import { describe, expect, it } from 'vitest';
import {
  DOMAIN_PRESETS,
  PRESETS,
  deltaWorks,
  deltaWorksOn,
  innerFits,
  normRatio,
  sinBadNeighbours,
  type DomainPresetId,
  type NormP,
  type PresetId,
} from '~/math/continuity';
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

/* ---------------------------------------------- lesson 3.4: f restricted to a compact interval D (DOMAIN_PRESETS) */

const DOMAIN_IDS: DomainPresetId[] = ['recip', 'sinrecip', 'sqrtc', 'squareW'];
/** a parameter value that gives each preset a domain where δ* is finite somewhere */
const PARAMS: Record<DomainPresetId, number[]> = { recip: [0.05, 0.2, 0.4], sinrecip: [0.05, 0.1, 0.25], sqrtc: [0, 0.01, 0.1], squareW: [1, 2, 4] };

/** the smallest |x − a| over a fine grid of x ∈ D with |f(x) − f(a)| ≥ ε: δ*_D from above, to the grid step */
function sampledNearest(id: DomainPresetId, a: number, eps: number, p: number, n = 200000) {
  const P = DOMAIN_PRESETS[id];
  const [lo, hi] = P.domain(p);
  let best = Infinity;
  for (let i = 0; i <= n; i++) {
    const x = lo + ((hi - lo) * i) / n;
    if (Math.abs(P.f(x) - P.f(a)) >= eps) best = Math.min(best, Math.abs(x - a));
  }
  return { best, step: (hi - lo) / n };
}

describe('lesson 3.4, exact values (closed formulas on a compact interval)', () => {
  it('1/x on [c, 1] has uniform δ = c²ε/(1 − cε): 1/6 at c = ½, ε = ½, and 1/780 at c = 0.05', () => {
    expect(DOMAIN_PRESETS.recip.uniformDelta(0.5, 0.5)).toBeCloseTo(1 / 6, 14);
    expect(DOMAIN_PRESETS.recip.uniformDelta(0.5, 0.05)).toBeCloseTo(0.0025 * 0.5 / 0.975, 14);
    expect(DOMAIN_PRESETS.recip.uniformDelta(0.5, 0.2)).toBeCloseTo(0.02 / 0.9, 14);
    // the range [1, 1/c] is narrower than ε: every δ works
    expect(DOMAIN_PRESETS.recip.uniformDelta(0.5, 0.8)).toBe(Infinity);
  });

  it('1/x at a = ½ on [0.2, 1], ε = ½: the nearest bad point is x = 0.4, at distance 0.1', () => {
    const nb = DOMAIN_PRESETS.recip.nearestBad(0.5, 0.5, 0.2);
    expect(nb.x).toBeCloseTo(0.4, 14);
    expect(nb.dist).toBeCloseTo(0.1, 14);
    expect(deltaWorksOn('recip', 0.5, 0.5, 0.1, 0.2)).toBe(true);
    expect(deltaWorksOn('recip', 0.5, 0.5, 0.1001, 0.2)).toBe(false);
  });

  it('√x on [c, 1] has uniform δ = 2ε√c + ε², which is ε² on [0, 1]', () => {
    expect(DOMAIN_PRESETS.sqrtc.uniformDelta(0.5, 0)).toBeCloseTo(0.25, 14);
    expect(DOMAIN_PRESETS.sqrtc.uniformDelta(0.1, 0)).toBeCloseTo(0.01, 14);
    expect(DOMAIN_PRESETS.sqrtc.uniformDelta(0.5, 0.04)).toBeCloseTo(0.2 + 0.25, 14);
  });

  it('x² on [−W, W] has uniform δ = W − √(W² − ε): 1 − √0.5 at W = 1, ε = ½', () => {
    expect(DOMAIN_PRESETS.squareW.uniformDelta(0.5, 1)).toBeCloseTo(1 - Math.sqrt(0.5), 14);
    expect(DOMAIN_PRESETS.squareW.uniformDelta(1, 0.5)).toBe(Infinity);
    // the same at a = −W, by symmetry
    expect(DOMAIN_PRESETS.squareW.nearestBad(-1, 0.5, 1).dist).toBeCloseTo(1 - Math.sqrt(0.5), 14);
  });

  it('sin(1/x) at uₐ = π/2, ε = ½: the nearest u with sin u ≤ ½ are 5π/6 above and π/6 below (arcsin ½ = π/6)', () => {
    // s = 1: {sin u ≤ ½} starts at 5π/6 above π/2 and ends at π/6 below it
    const { above, below } = sinBadNeighbours(Math.PI / 2, 0.5);
    expect(above).toBeCloseTo((5 * Math.PI) / 6, 13);
    expect(below).toBeCloseTo(Math.PI / 6, 13);
  });
});

describe('lesson 3.4, brute force agrees (sampling)', () => {
  it('δ*_D(a, ε) is the distance to the nearest sampled bad point, to two grid steps, for every preset', () => {
    for (const id of DOMAIN_IDS) for (const p of PARAMS[id]) for (const eps of [0.3, 0.5]) {
      const [lo, hi] = DOMAIN_PRESETS[id].domain(p);
      for (const t of [0, 0.13, 0.37, 0.5, 0.81, 1]) {
        const a = lo + (hi - lo) * t;
        if (id === 'sqrtc' && a === 0) continue; // a = 0 is the domain's own end; checked by the formula test
        const exact = DOMAIN_PRESETS[id].nearestBad(a, eps, p).dist;
        const { best, step } = sampledNearest(id, a, eps, p);
        if (exact === Infinity) expect(best).toBe(Infinity);
        else expect(Math.abs(best - exact)).toBeLessThanOrEqual(2 * step + 1e-9);
      }
    }
  });

  it('the uniform δ is the smallest distance between two sampled points of D whose values differ by ≥ ε', () => {
    for (const id of DOMAIN_IDS) for (const p of PARAMS[id]) {
      const eps = 0.5;
      const P = DOMAIN_PRESETS[id];
      const [lo, hi] = P.domain(p);
      // pairs (x, y) with x on a grid and y = the nearest bad point of x: the minimum over x is the infimum over pairs
      let min = Infinity;
      const n = 20000;
      for (let i = 0; i <= n; i++) {
        // sin(1/x) oscillates near c: grid evenly in u = 1/x there, evenly in x elsewhere
        const x = id === 'sinrecip' ? 1 / (1 + ((1 / p - 1) * i) / n) : lo + ((hi - lo) * i) / n;
        min = Math.min(min, P.nearestBad(x, eps, p).dist);
      }
      const u = P.uniformDelta(eps, p);
      if (u === Infinity) expect(min).toBe(Infinity);
      else {
        // the formula (or the refined sample) is never above the grid minimum, and the grid gets within 1%
        expect(u).toBeLessThanOrEqual(min + 1e-12);
        expect(min).toBeLessThanOrEqual(u * 1.01 + 1e-12);
      }
    }
  });
});

describe('lesson 3.4, limits (Cantor on [c, 1] versus its failure on (0, 1])', () => {
  it('the uniform δ of 1/x and of sin(1/x) on [c, 1] tends to 0 as c → 0; that of √x stays above ε²', () => {
    const eps = 0.5;
    let prevR = Infinity;
    let prevS = Infinity;
    for (const c of [0.2, 0.1, 0.05, 0.02, 0.01]) {
      const r = DOMAIN_PRESETS.recip.uniformDelta(eps, c);
      const s = DOMAIN_PRESETS.sinrecip.uniformDelta(eps, c);
      expect(r).toBeLessThan(prevR);
      expect(s).toBeLessThan(prevS);
      // both are of the order of c²: the oscillation of f near c happens over x-intervals of length ~ c²
      expect(r).toBeLessThanOrEqual(c * c);
      expect(s).toBeLessThanOrEqual(2 * c * c);
      expect(DOMAIN_PRESETS.sqrtc.uniformDelta(eps, c)).toBeGreaterThan(eps * eps);
      [prevR, prevS] = [r, s];
    }
  });

  it('the uniform δ of x² on [−W, W] is squeezed between ε/(2W) and ε/W, so it tends to 0 as W → ∞', () => {
    for (const W of [1, 2, 5, 10, 100]) {
      const u = DOMAIN_PRESETS.squareW.uniformDelta(0.5, W);
      expect(u).toBeGreaterThanOrEqual(0.5 / (2 * W));
      expect(u).toBeLessThanOrEqual(0.5 / W);
    }
  });
});
