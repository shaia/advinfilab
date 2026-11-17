/**
 * src/math/meanvalue.ts, filed by accuracy category. Each test is named after the claim it checks.
 * The closed forms are the ones lesson 5.6 states; the root finder and the grid minimum are probes, checked against
 * them. The theorems themselves are proved in the lesson.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import {
  CURVES,
  REAL,
  chord,
  circleChordLength,
  componentPoints,
  cuspC2Squared,
  dphi,
  gap,
  minGap,
  mvtPoints,
  phi,
  ratio,
  solveRoots,
} from '~/math/meanvalue';
import type { Vec2 } from '~/math/vec';

/** a central difference, to check the closed-form gradients and velocities */
const diff = (g: (t: number) => number, t: number, h = 1e-5) => (g(t + h) - g(t - h)) / (2 * h);

describe('exact identities: the closed forms the lesson quotes', () => {
  it('x³ − y² on the segment from (0,0) to (1,1): φ(t) = t³ − t², and the only mean value point is τ = 2/3 (משפט 5.6.2)', () => {
    const a: Vec2 = [0, 0];
    const b: Vec2 = [1, 1];
    for (const t of [0, 0.3, 0.5, 1]) expect(Math.abs(phi(REAL.cubic, a, b, t) - (t ** 3 - t ** 2))).toBeLessThan(1e-15);
    const r = mvtPoints(REAL.cubic, a, b);
    expect(r.all).toBe(false);
    expect(r.slope).toBe(0);
    expect(r.roots).toHaveLength(1);
    expect(relativeError(r.roots[0], 2 / 3)).toBeLessThan(1e-12);
    expect(relativeError(r.points[0][0], 2 / 3)).toBeLessThan(1e-12);
  });

  it('x·y² on the segment from (0,0) to (1,1): φ(t) = t³, and τ = 1/√3 (worked example 1)', () => {
    const F = { ...REAL.cubic, f: (x: number, y: number) => x * y * y, grad: (x: number, y: number): Vec2 => [y * y, 2 * x * y] };
    const r = mvtPoints(F, [0, 0], [1, 1]);
    expect(r.roots).toHaveLength(1);
    expect(relativeError(r.roots[0], 1 / Math.sqrt(3))).toBeLessThan(1e-12);
  });

  it('a quadratic: the midpoint is the mean value point on every segment (φ has degree ≤ 2)', () => {
    const segs: [Vec2, Vec2][] = [
      [[0, 0], [1, 1]],
      [[-1.5, 0.3], [1.2, -1.7]],
      [[2, -2], [-2, 2]],
      [[0.25, 1], [0.25, -1]],
    ];
    for (const [a, b] of segs) {
      const r = mvtPoints(REAL.quad, a, b);
      expect(r.roots).toHaveLength(1);
      expect(relativeError(r.roots[0], 0.5)).toBeLessThan(1e-12);
      // and φ(1) − φ(0) = φ′(1/2) exactly, by algebra
      expect(Math.abs(dphi(REAL.quad, a, b, 0.5) - r.slope)).toBeLessThan(1e-12);
    }
  });

  it('sin(2x)·cos(y) on the line x = 0 is identically 0: every τ is a mean value point (`all`)', () => {
    expect(mvtPoints(REAL.wave, [0, -1.5], [0, 1.5]).all).toBe(true);
  });

  it('the circle: γ(t1) − γ(t0) = 2 sin(Δ/2)·γ′(m), the direction of the velocity at the midpoint, shorter than Δ for every Δ > 0, also Δ > 2π (טענה 5.6.3)', () => {
    for (const [t0, t1] of [
      [0, Math.PI],
      [0.3, 1.1],
      [1, 5],
      [0, 2 * Math.PI],
      [0, 9],
      [-2, 4 * Math.PI + 1],
    ]) {
      const v = chord(CURVES.circle, t0, t1);
      const D = t1 - t0;
      const u = CURVES.circle.dg((t0 + t1) / 2);
      const L = circleChordLength(D);
      expect(Math.hypot(v[0] - L * u[0], v[1] - L * u[1])).toBeLessThan(1e-14);
      expect(Math.abs(L)).toBeLessThan(D);
    }
  });

  it('the half circle: γ(π) − γ(0) = (−2, 0), and ‖πγ′(c)‖ = π ≠ 2 for every c', () => {
    const v = chord(CURVES.circle, 0, Math.PI);
    expect(Math.abs(v[0] + 2)).toBeLessThan(1e-15);
    expect(Math.abs(v[1])).toBeLessThan(1e-15);
    expect(relativeError(ratio(CURVES.circle, 0, Math.PI), 2 / Math.PI)).toBeLessThan(1e-14);
  });

  it('the cusp (t², t³): c₁ is the midpoint and c₂² = (t0² + t0·t1 + t1²)/3', () => {
    for (const [t0, t1] of [
      [0, 1.5],
      [0.25, 1],
      [-1.5, 1.5],
    ]) {
      const c1 = componentPoints(CURVES.cusp, t0, t1, 0);
      expect(c1.roots).toHaveLength(1);
      expect(Math.abs(c1.roots[0] - (t0 + t1) / 2)).toBeLessThan(1e-12);
      const c2 = componentPoints(CURVES.cusp, t0, t1, 1);
      for (const c of c2.roots) expect(relativeError(c * c, cuspC2Squared(t0, t1))).toBeLessThan(1e-10);
      expect(c2.roots.length).toBeGreaterThan(0);
    }
  });

  it('the parabola (t, t²): the first component works at every c, the second at the midpoint, so the midpoint is common', () => {
    const c1 = componentPoints(CURVES.parabola, -0.5, 1.25, 0);
    expect(c1.all).toBe(true);
    const c2 = componentPoints(CURVES.parabola, -0.5, 1.25, 1);
    expect(c2.roots).toHaveLength(1);
    expect(Math.abs(c2.roots[0] - 0.375)).toBeLessThan(1e-12);
    expect(gap(CURVES.parabola, -0.5, 1.25, 0.375)).toBeLessThan(1e-14);
  });

  it('the closed-form gradients and velocities are the derivatives (central differences, 1e-8)', () => {
    for (const F of Object.values(REAL))
      for (const [x, y] of [
        [0.3, -0.7],
        [1.2, 0.4],
        [-1.1, 1.6],
      ]) {
        const g = F.grad(x, y);
        expect(Math.abs(g[0] - diff((s) => F.f(s, y), x))).toBeLessThan(1e-8);
        expect(Math.abs(g[1] - diff((s) => F.f(x, s), y))).toBeLessThan(1e-8);
      }
    for (const C of Object.values(CURVES))
      for (const t of [-0.9, 0.2, 1.3]) {
        const d = C.dg(t);
        expect(Math.abs(d[0] - diff((s) => C.g(s)[0], t))).toBeLessThan(1e-8);
        expect(Math.abs(d[1] - diff((s) => C.g(s)[1], t))).toBeLessThan(1e-8);
      }
  });
});

describe('analytic limits: the mean value inequality and its sharpness', () => {
  it('the circle: the mean speed sin(Δ/2)/(Δ/2) < 1 = sup‖γ′‖, and it tends to 1 as Δ → 0 (> 0.99 once Δ < 0.49)', () => {
    for (const D of [2 * Math.PI, 3, 1, 0.49, 0.1, 1e-3]) {
      const q = ratio(CURVES.circle, 0.2, 0.2 + D);
      expect(q).toBeLessThan(1);
      // absolute: at Δ = 2π both sides are 0 (sin π = 0)
      expect(Math.abs(q - Math.sin(D / 2) / (D / 2))).toBeLessThan(1e-12);
    }
    expect(ratio(CURVES.circle, 0.2, 0.69)).toBeGreaterThan(0.99);
    expect(ratio(CURVES.circle, 0.2, 0.2 + 0.495)).toBeLessThan(0.99);
  });

  it('the mean value inequality ‖γ(t1) − γ(t0)‖ ≤ (t1 − t0)·sup‖γ′‖ holds for every preset on a grid of intervals (משפט 5.6.4(א))', () => {
    for (const C of Object.values(CURVES)) {
      const [lo, hi] = C.domain;
      for (let i = 0; i <= 12; i++)
        for (let j = i + 1; j <= 12; j++) {
          const t0 = lo + ((hi - lo) * i) / 12;
          const t1 = lo + ((hi - lo) * j) / 12;
          expect(ratio(C, t0, t1)).toBeLessThanOrEqual(C.speedSup(t0, t1) * (1 + 1e-12));
        }
    }
  });

  it('the closed-form sup of the speed is the max of ‖γ′‖ over a fine grid', () => {
    for (const C of Object.values(CURVES))
      for (const [t0, t1] of [
        [-1.2, 0.4],
        [0.1, 1.4],
        [-1.5, -0.5],
      ]) {
        if (t0 < C.domain[0] || t1 > C.domain[1]) continue;
        let m = 0;
        for (let i = 0; i <= 4000; i++) {
          const d = C.dg(t0 + ((t1 - t0) * i) / 4000);
          m = Math.max(m, Math.hypot(d[0], d[1]));
        }
        expect(relativeError(m, C.speedSup(t0, t1))).toBeLessThan(1e-12);
      }
  });
});

describe('convergence: the probes against the closed forms', () => {
  it('the circle: the least gap on a grid tends to Δ − 2 sin(Δ/2) > 0, attained at the midpoint (no common point)', () => {
    for (const [t0, t1] of [
      [0, Math.PI],
      [0.5, 2],
      [1, 4.5],
    ]) {
      const D = t1 - t0;
      const m = minGap(CURVES.circle, t0, t1, 2400);
      expect(Math.abs(m.gap - (D - 2 * Math.sin(D / 2)))).toBeLessThan(1e-5 * D);
      expect(Math.abs(m.c - (t0 + t1) / 2)).toBeLessThan((2 * D) / 2400);
      expect(m.gap).toBeGreaterThan(0);
    }
    // the full circle: the chord is 0 and every candidate has length 2π, so the gap is 2π at every c
    expect(Math.abs(minGap(CURVES.circle, 0, 2 * Math.PI).gap - 2 * Math.PI)).toBeLessThan(1e-12);
  });

  it('the cusp: no common point on [0, 1.5]: the least gap stays above 0.1', () => {
    expect(minGap(CURVES.cusp, 0, 1.5).gap).toBeGreaterThan(0.1);
  });

  it('solveRoots finds a touching zero (t − 1/3)² and a crossing zero t − 0.7', () => {
    const touch = solveRoots((t) => (t - 1 / 3) ** 2, 0, 1);
    expect(touch.roots).toHaveLength(1);
    expect(Math.abs(touch.roots[0] - 1 / 3)).toBeLessThan(1e-4);
    const cross = solveRoots((t) => t - 0.7, 0, 1);
    expect(cross.roots).toHaveLength(1);
    expect(Math.abs(cross.roots[0] - 0.7)).toBeLessThan(1e-12);
  });

  it('sin(2x)·cos(y): the segment from (−2, −2) to (1, 1) has three mean value points (the task is reachable)', () => {
    const r = mvtPoints(REAL.wave, [-2, -2], [1, 1]);
    expect(r.roots.length).toBeGreaterThanOrEqual(3);
    for (const t of r.roots) expect(Math.abs(dphi(REAL.wave, [-2, -2], [1, 1], t) - r.slope)).toBeLessThan(1e-9);
  });
});
