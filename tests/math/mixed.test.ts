/**
 * src/math/mixed.ts, filed by accuracy category. Each test is named after the claim it checks.
 * The closed forms are the ones lesson 5.7 states (טענה 5.7.6, the presets of figure 5.7). Finite differences
 * cross-check the closed-form partial derivatives; a probe on a grid is evidence, never a proof.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import {
  PRESETS,
  diagonal,
  innerH,
  innerK,
  quotient,
  schwarzF,
  schwarzFx,
  schwarzFy,
  schwarzMixed,
  secondDifference,
  squareStats,
  type PresetId,
} from '~/math/mixed';

const central = (g: (t: number) => number, t: number, e = 1e-5) => (g(t + e) - g(t - e)) / (2 * e);
const S = PRESETS.schwarz;
const pts: [number, number][] = [
  [0.3, 0.7],
  [-1.2, 0.4],
  [2, -1],
  [0.05, -0.02],
];

describe('exact identities: the closed forms of טענה 5.7.6', () => {
  it('the second-difference quotient of the counterexample at 0 is (h² − k²)/(h² + k²)', () => {
    for (const [h, k] of pts) expect(relativeError(quotient(S, h, k), (h * h - k * k) / (h * h + k * k))).toBeLessThan(1e-12);
  });

  it('Δ(h, k) = f(h, k) at the origin, because f vanishes on both axes', () => {
    for (const [h, k] of pts) expect(secondDifference(S, h, k)).toBe(schwarzF(h, k));
    for (const t of [-2, -0.1, 0.3, 5]) {
      expect(Math.abs(schwarzF(t, 0))).toBe(0);
      expect(Math.abs(schwarzF(0, t))).toBe(0);
    }
  });

  it('∂ₓf(0, y) = −y and ∂_y f(x, 0) = x for every real number (also at 0)', () => {
    for (const t of [-3, -0.5, 0, 0.25, 4]) {
      expect(Math.abs(schwarzFx(0, t) + t)).toBeLessThan(1e-14 * Math.max(1, Math.abs(t)));
      expect(Math.abs(schwarzFy(t, 0) - t)).toBeLessThan(1e-14 * Math.max(1, Math.abs(t)));
    }
  });

  it('so the inner limits are constant: A ≡ −1 (h first) and B ≡ 1 (k first), and the diagonal D ≡ 0', () => {
    for (const s of [-0.8, -1e-3, 2e-4, 0.5]) {
      expect(relativeError(innerH(S, s), -1)).toBeLessThan(1e-12);
      expect(relativeError(innerK(S, s), 1)).toBeLessThan(1e-12);
      expect(Math.abs(diagonal(S, s))).toBeLessThan(1e-15);
    }
  });

  it('the mixed partial off 0 is homogeneous of degree 0: 1 on the x-axis, −1 on the y-axis, 0 on y = x', () => {
    for (const t of [1e-3, 0.7, 12]) {
      expect(relativeError(schwarzMixed(t, 0), 1)).toBeLessThan(1e-14);
      expect(relativeError(schwarzMixed(0, t), -1)).toBeLessThan(1e-14);
      expect(Math.abs(schwarzMixed(t, t))).toBeLessThan(1e-14);
      expect(relativeError(schwarzMixed(t * 0.3, t * 0.7), schwarzMixed(0.3, 0.7))).toBeLessThan(1e-12);
    }
  });

  it('x³y² at (1, 1): Q(h, k) = (3 + 3h + h²)(2 + k), so Q → 6', () => {
    const P = PRESETS.x3y2;
    for (const [h, k] of [
      [0.5, -0.25],
      [1e-2, 3e-2],
      [-1e-3, 1e-3],
    ])
      expect(relativeError(quotient(P, h, k), (3 + 3 * h + h * h) * (2 + k))).toBeLessThan(1e-8);
  });

  it('eˣ cos y at (0, π/2): Q(h, k) = −((eʰ − 1)/h)(sin k/k)', () => {
    const P = PRESETS.expcos;
    for (const [h, k] of [
      [0.5, -0.25],
      [1e-2, 3e-2],
    ])
      expect(relativeError(quotient(P, h, k), -((Math.exp(h) - 1) / h) * (Math.sin(k) / k))).toBeLessThan(1e-9);
  });
});

describe('convergence: finite differences agree with the closed-form partial derivatives', () => {
  it('∂ₓf and ∂_y f of every preset match central differences away from the origin', () => {
    for (const id of Object.keys(PRESETS) as PresetId[]) {
      const P = PRESETS[id];
      for (const [x, y] of [
        [0.3, 0.7],
        [1.1, 0.9],
        [-0.4, 1.6],
      ]) {
        expect(Math.abs(P.fx(x, y) - central((t) => P.f(t, y), x))).toBeLessThan(1e-8);
        expect(Math.abs(P.fy(x, y) - central((t) => P.f(x, t), y))).toBeLessThan(1e-8);
      }
    }
  });

  it('away from 0 both mixed partials of the counterexample equal the closed form (x² − y²)(x⁴ + 10x²y² + y⁴)/(x² + y²)³', () => {
    for (const [x, y] of pts.slice(0, 3)) {
      expect(Math.abs(central((t) => schwarzFx(x, t), y) - schwarzMixed(x, y))).toBeLessThan(1e-7);
      expect(Math.abs(central((t) => schwarzFy(t, y), x) - schwarzMixed(x, y))).toBeLessThan(1e-7);
    }
  });

  it('for the smooth presets the inner limits A and B tend to the stored mixed partials, which agree', () => {
    for (const id of ['x3y2', 'sinxy', 'expcos'] as PresetId[]) {
      const P = PRESETS[id];
      expect(P.dyx).toBe(P.dxy);
      expect(Math.abs(innerH(P, 1e-6) - P.dyx)).toBeLessThan(1e-4);
      expect(Math.abs(innerK(P, 1e-6) - P.dxy)).toBeLessThan(1e-4);
      expect(Math.abs(diagonal(P, 1e-4) - P.dyx)).toBeLessThan(1e-2);
    }
  });

  it('sin(xy) at (1, 1): the mixed partial is cos 1 − sin 1 ≈ −0.3012', () => {
    expect(relativeError(PRESETS.sinxy.dyx, -0.3011686789397567)).toBeLessThan(1e-12);
  });
});

describe('analytic limits: what the figure shows when zooming in (a probe on a grid)', () => {
  it('for the counterexample the values on [−r, r]² fill (−1, 1) at every zoom: degree 0', () => {
    for (const r of [1, 1e-2, 1e-4]) {
      const s = squareStats(S, r);
      expect(s.min).toBeLessThan(-0.99);
      expect(s.max).toBeGreaterThan(0.99);
    }
  });

  it('x³y² at (1, 1): max |Q − 6| on the square is below 0.01 at r = 10⁻³ and above it at r = 10⁻²·⁹', () => {
    expect(squareStats(PRESETS.x3y2, 1e-3).dev).toBeLessThan(0.01);
    expect(squareStats(PRESETS.x3y2, 10 ** -2.9).dev).toBeGreaterThan(0.01);
  });

  it('the smooth presets settle: max |Q − L| on the square shrinks with r', () => {
    for (const id of ['x3y2', 'sinxy', 'expcos'] as PresetId[]) {
      const P = PRESETS[id];
      const big = squareStats(P, 0.1).dev;
      const small = squareStats(P, 1e-3).dev;
      expect(small).toBeLessThan(big / 20);
      expect(small).toBeLessThan(0.01);
    }
  });
});
