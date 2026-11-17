/**
 * src/math/chain.ts, filed by accuracy category. Each test is named after the claim it checks.
 * The closed forms are the ones lesson 5.5 quotes; the symmetric difference quotient is an independent probe of the
 * derivative of f∘γ. The theorems themselves (5.5.1–5.5.8) are proved in the lesson: agreement on samples is evidence.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import {
  CURVES,
  FUNCS,
  arrowScales,
  cartesianFromPolar,
  chainRate,
  composite,
  curveBox,
  fitWindow,
  minPolarTheta,
  polarDerivs,
  quotientRate,
  tangencyCos,
  type CurveParams,
  type FuncId,
} from '~/math/chain';

const P: CurveParams = { m: 1, r: 2, base: [0, 0] };

describe('exact identities: the numbers the lesson quotes', () => {
  it('T = x² − xy + y along (t², t³) at t = 1: ∇T(1,1)·γ′(1) = (1,0)·(2,3) = 2 (מסקנה 5.5.3)', () => {
    expect(chainRate(FUNCS.T, CURVES.cubic, 1, P)).toBe(2);
    // the substitution T(γ(t)) = t⁴ − t⁵ + t³ has derivative 4 − 5 + 3 = 2 at t = 1
    expect(composite(FUNCS.T, CURVES.cubic, 1.3, P)).toBeCloseTo(1.3 ** 4 - 1.3 ** 5 + 1.3 ** 3, 12);
  });

  it('xy² along (eᵗ, 1 + 2t) at t = 0: ∇f(1,1)·γ′(0) = (1,2)·(1,2) = 5 (Q-5.5-curve)', () => {
    expect(chainRate(FUNCS.xy2, CURVES.exp, 0, P)).toBe(5);
  });

  it('x² − y² in polar coordinates: ∂_θ g(2, π/4) = −8 = −2r² sin 2θ (טענה 5.5.4)', () => {
    expect(relativeError(polarDerivs(FUNCS.saddle, 2, Math.PI / 4).dth, -8)).toBeLessThan(1e-12);
    for (const [r, th] of [[0.7, 0.3], [2, 2.1], [1.4, 5]] as const)
      expect(relativeError(polarDerivs(FUNCS.saddle, r, th).dth, -2 * r * r * Math.sin(2 * th))).toBeLessThan(1e-12);
  });

  it('on the circle of radius 2 the most negative ∂_θ g of x² − y² is −8, at θ = π/4 and 5π/4 (task polar-min)', () => {
    const best = minPolarTheta(FUNCS.saddle, 2);
    expect(relativeError(best.value, -8)).toBeLessThan(1e-12);
    // −8 sin 2θ has period π: the sampled minimum lands on one of the two
    expect(Math.abs((best.theta % Math.PI) - Math.PI / 4)).toBeLessThan(1e-12);
  });

  it('‖∇f‖² = (∂_r g)² + (∂_θ g)²/r² at sample points (טענה 5.5.4: a rotation preserves length)', () => {
    for (const id of ['T', 'saddle', 'xy2'] as FuncId[])
      for (const [r, th] of [[0.5, 1], [1.7, 2.5], [2.3, 4.4]] as const) {
        const F = FUNCS[id];
        const [fx, fy] = F.grad(r * Math.cos(th), r * Math.sin(th));
        const { dr, dth } = polarDerivs(F, r, th);
        expect(relativeError(dr * dr + (dth * dth) / (r * r), fx * fx + fy * fy)).toBeLessThan(1e-12);
      }
  });

  it('the inverse formulas recover ∇f from ∂_r g, ∂_θ g; at (r, θ) = (2, π/6) with ∇f = (2, −1): ∂_r g = √3 − ½, ∂_θ g = −2 − √3', () => {
    const th = Math.PI / 6;
    const dr = Math.cos(th) * 2 + Math.sin(th) * -1;
    const dth = -2 * Math.sin(th) * 2 + 2 * Math.cos(th) * -1;
    expect(relativeError(dr, Math.sqrt(3) - 0.5)).toBeLessThan(1e-12);
    expect(relativeError(dth, -2 - Math.sqrt(3))).toBeLessThan(1e-12);
    const [fx, fy] = cartesianFromPolar(dr, dth, 2, th);
    expect(relativeError(fx, 2)).toBeLessThan(1e-12);
    expect(relativeError(fy, -1)).toBeLessThan(1e-12);
  });

  it('Euler for the degree-1 functions x³/(x²+y²) and x²y/(x²+y²): x·∇f(x) = f(x) away from 0 (משפט 5.5.7)', () => {
    for (const id of ['x3', 'x2y'] as FuncId[])
      for (const [x, y] of [[0.3, 0.7], [-1.2, 0.4], [2, -1]] as const) {
        const [fx, fy] = FUNCS[id].grad(x, y);
        expect(relativeError(x * fx + y * fy, FUNCS[id].f(x, y))).toBeLessThan(1e-12);
      }
  });

  it('xy² on the unit circle: ∂_θ g = sin θ(2cos²θ − sin²θ) vanishes at tan²θ = 2, where ∇f ≠ 0 and γ′ ⊥ ∇f (task polar-zero)', () => {
    const C1: CurveParams = { ...P, r: 1 };
    const th = Math.atan(Math.SQRT2);
    expect(Math.abs(polarDerivs(FUNCS.xy2, 1, th).dth)).toBeLessThan(1e-15);
    expect(Math.abs(tangencyCos(FUNCS.xy2, CURVES.circle, th, C1))).toBeLessThan(1e-15);
    const [x, y] = CURVES.circle.gamma(th, C1);
    expect(Math.hypot(...FUNCS.xy2.grad(x, y))).toBeGreaterThan(1);
  });
});

describe('analytic limits: where f is not differentiable the chain-rule number is not the derivative', () => {
  it('x³/(x²+y²) along (t, t): f(γ(t)) = t/2, so (f∘γ)′(0) = ½, while ∇f(0)·γ′(0) = (1,0)·(1,1) = 1 (שאלת החיזוי)', () => {
    for (const t of [-0.3, 1e-3, 0.8]) expect(relativeError(composite(FUNCS.x3, CURVES.line, t, P), t / 2)).toBeLessThan(1e-12);
    expect(relativeError(quotientRate(FUNCS.x3, CURVES.line, 0, P), 0.5)).toBeLessThan(1e-9);
    expect(chainRate(FUNCS.x3, CURVES.line, 0, P)).toBe(1);
  });

  it('x²y/(x²+y²) along (t, mt): f∘γ = mt/(1 + m²), slope m/(1+m²), while ∇f(0) = 0 gives 0 (טענה 5.5.8(א))', () => {
    for (const m of [1, -2, 0.5]) {
      const p = { ...P, m };
      expect(relativeError(quotientRate(FUNCS.x2y, CURVES.line, 0, p), m / (1 + m * m))).toBeLessThan(1e-9);
      expect(chainRate(FUNCS.x2y, CURVES.line, 0, p)).toBe(0);
    }
  });
});

describe('convergence: the difference quotient approaches the chain-rule number where f is differentiable', () => {
  it('for every smooth preset and curve, |quotient − ∇f·γ′| shrinks like h² (relative 1e-6 at h = 1e-5)', () => {
    for (const fid of ['T', 'saddle', 'xy2'] as FuncId[])
      for (const C of Object.values(CURVES))
        for (const s of [0.13, 0.5, 0.91]) {
          const t = C.domain[0] + s * (C.domain[1] - C.domain[0]);
          const exact = chainRate(FUNCS[fid], C, t, P);
          const q = quotientRate(FUNCS[fid], C, t, P);
          expect(Math.abs(q - exact)).toBeLessThan(1e-6 * Math.max(1, Math.abs(exact)));
        }
  });

  it('away from 0 the non-differentiable presets obey the chain rule too (they are C¹ off the origin)', () => {
    const p = { ...P, base: [0.4, -0.3] as const };
    for (const fid of ['x3', 'x2y'] as FuncId[])
      for (const t of [-1, 0.2, 1.5]) {
        const exact = chainRate(FUNCS[fid], CURVES.line, t, p);
        expect(Math.abs(quotientRate(FUNCS[fid], CURVES.line, t, p) - exact)).toBeLessThan(1e-6);
      }
  });

  it('x² − y² along (eᵗ, 1 + 2t): (f∘γ)′ = 2e^{2t} − 4(1 + 2t) changes sign near t ≈ −0.384 and t ≈ 0.839 (task tangent)', () => {
    const d = (t: number) => chainRate(FUNCS.saddle, CURVES.exp, t, P);
    for (const t of [-1, 0, 0.5, 1]) expect(relativeError(d(t), 2 * Math.exp(2 * t) - 4 * (1 + 2 * t))).toBeLessThan(1e-12);
    expect(d(-0.4) * d(-0.3)).toBeLessThan(0);
    expect(d(0.8) * d(0.9)).toBeLessThan(0);
  });
});

describe('the drawing helpers', () => {
  it('fitWindow contains the curve and the origin and has the requested aspect', () => {
    for (const C of Object.values(CURVES)) {
      const b = curveBox(C, P);
      const w = fitWindow(b, 1.3);
      expect(w.xmin).toBeLessThanOrEqual(Math.min(b.xmin, 0));
      expect(w.xmax).toBeGreaterThanOrEqual(Math.max(b.xmax, 0));
      expect(w.ymin).toBeLessThanOrEqual(Math.min(b.ymin, 0));
      expect(w.ymax).toBeGreaterThanOrEqual(Math.max(b.ymax, 0));
      expect(relativeError((w.xmax - w.xmin) / (w.ymax - w.ymin), 1.3)).toBeLessThan(1e-12);
    }
  });

  it('arrowScales are positive for every preset pair', () => {
    for (const F of Object.values(FUNCS)) for (const C of Object.values(CURVES)) {
      const s = arrowScales(F, C, P);
      expect(s.grad).toBeGreaterThan(0);
      expect(s.vel).toBeGreaterThan(0);
    }
  });
});
