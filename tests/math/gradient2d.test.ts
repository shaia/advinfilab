/**
 * src/math/gradient2d.ts, filed by accuracy category. Each test is named after the claim it checks.
 * The closed forms are the ones lesson 5.4 states; finite differences cross-check them. The theorems themselves are
 * proved in the lesson: a sample of points and directions is evidence, never a proof.
 */

import { describe, expect, it } from 'vitest';
import { centralDiff, relativeError } from '~/math/analysis';
import {
  PRESETS,
  PRESET_IDS,
  coneVelocity,
  det3,
  dot,
  gapDeg,
  norm2,
  rSin,
  rSinDx,
  rate,
  snap,
  steepestDeg,
  tangentDir,
  unit,
  verdict,
  type V2,
} from '~/math/gradient2d';

const PTS: V2[] = [
  [4, 3],
  [2, 1],
  [-1.3, 0.7],
  [0.5, -2.2],
  [2.9, 1.9],
];

describe('exact identities: the numbers lesson 5.4 quotes', () => {
  it('xy at (4,3): ∇f = (3,4) and the maximal rate is ‖∇f‖₂ = 5, in the direction (3/5, 4/5) (משפט 5.4.6)', () => {
    const g = PRESETS.xy.grad(4, 3);
    expect(g).toEqual([3, 4]);
    expect(norm2(g)).toBe(5);
    const phi = steepestDeg(g)!;
    expect(relativeError(unit(phi)[0], 3 / 5)).toBeLessThan(1e-14);
    expect(relativeError(unit(phi)[1], 4 / 5)).toBeLessThan(1e-14);
    expect(relativeError(rate(PRESETS.xy, [4, 3], phi), 5)).toBeLessThan(1e-14);
  });

  it('x² + 4y² at (2,1): ∇f = (4,8), orthogonal to the tangent (2,−1) of the ellipse x² + 4y² = 8 (משפט 5.4.8)', () => {
    const g = PRESETS.ellipse.grad(2, 1);
    expect(g).toEqual([4, 8]);
    expect(dot(g, [2, -1])).toBe(0);
    expect(PRESETS.ellipse.f(2, 1)).toBe(8);
    // the parametrisation (2√2 cos t, √2 sin t) passes (2,1) at t = π/4 with velocity (−2, 1)
    const t = Math.PI / 4;
    const gam = [2 * Math.SQRT2 * Math.cos(t), Math.SQRT2 * Math.sin(t)];
    const vel = [-2 * Math.SQRT2 * Math.sin(t), Math.SQRT2 * Math.cos(t)];
    expect(relativeError(gam[0], 2)).toBeLessThan(1e-14);
    expect(relativeError(gam[1], 1)).toBeLessThan(1e-14);
    expect(relativeError(vel[0], -2)).toBeLessThan(1e-14);
    expect(relativeError(vel[1], 1)).toBeLessThan(1e-14);
  });

  it('the maximum of θ ↦ D_v f(a) over a fine grid of directions is ‖∇f(a)‖₂, and the minimum is −‖∇f(a)‖₂ (Cauchy–Schwarz)', () => {
    for (const id of PRESET_IDS)
      for (const a of PTS) {
        const p = PRESETS[id];
        const n = norm2(p.grad(a[0], a[1]));
        let mx = -Infinity;
        let mn = Infinity;
        for (let k = 0; k < 36_000; k++) {
          const r = rate(p, a, k / 100);
          mx = Math.max(mx, r);
          mn = Math.min(mn, r);
          expect(Math.abs(r)).toBeLessThanOrEqual(n * (1 + 1e-12));
        }
        // the grid step is 0.01°, so the grid maximum is within n(1 − cos(0.005°)) ≈ 4e-9·n of n
        expect(relativeError(mx, n)).toBeLessThan(1e-8);
        expect(relativeError(mn, -n)).toBeLessThan(1e-8);
      }
  });

  it('the tangent direction is a unit vector orthogonal to ∇f(a), so D_v f(a) = 0 there', () => {
    for (const id of PRESET_IDS)
      for (const a of PTS) {
        const g = PRESETS[id].grad(a[0], a[1]);
        const t = tangentDir(g)!;
        expect(relativeError(norm2(t), 1)).toBeLessThan(1e-14);
        // an exact 0 compared with an absolute bound: the product of numbers of size ≤ 10 in floating point
        expect(Math.abs(dot(g, t))).toBeLessThan(1e-13);
      }
  });

  it('where ∇f(a) = 0 (xy and x² − y² at the origin) there is no steepest direction and every D_v f(a) is 0', () => {
    for (const id of ['xy', 'saddle'] as const) {
      const g = PRESETS[id].grad(0, 0);
      expect(steepestDeg(g)).toBeNull();
      expect(tangentDir(g)).toBeNull();
      expect(verdict(g, 37)).toBe('zero');
      for (const d of [0, 45, 200]) expect(Math.abs(rate(PRESETS[id], [0, 0], d))).toBe(0);
    }
  });

  it('the verdicts: within 3° of φ steepest, of φ + 180° descent, of φ ± 90° level', () => {
    const g: V2 = [3, 4];
    const phi = steepestDeg(g)!;
    expect(verdict(g, phi + 2.9)).toBe('steepest');
    expect(verdict(g, phi + 3.1)).toBe('other');
    expect(verdict(g, phi + 181)).toBe('descent');
    expect(verdict(g, phi - 91)).toBe('level');
    expect(gapDeg(359, 1)).toBe(2);
    expect(gapDeg(10, 190)).toBe(180);
  });

  it('the grid snap reaches (4,3) and (2,1) exactly and stays inside the window', () => {
    expect(snap(3.96, 5)).toBe(4);
    expect(snap(3.04, 5)).toBe(3);
    expect(snap(2.3, 5)).toBe(2.3);
    expect(snap(9, 3.5)).toBe(3.5);
    expect(snap(-9, 3.5)).toBe(-3.5);
  });

  it('the cone x² + y² − z² = 0: the velocities (1,0,1), (0,1,1), (−1,0,1) have determinant 2 (טענה 5.4.11)', () => {
    const [u, v, w] = [0, Math.PI / 2, Math.PI].map(coneVelocity);
    expect(det3([1, 0, 1], [0, 1, 1], [-1, 0, 1])).toBe(2);
    expect(Math.abs(det3(u, v, w) - 2)).toBeLessThan(1e-15);
    for (const phi of [0, 1, 2.5]) {
      const [x, y, z] = coneVelocity(phi).map((c) => 0.7 * c);
      expect(Math.abs(x * x + y * y - z * z)).toBeLessThan(1e-15);
    }
  });

  it('x² + 2y² + 3z² = 6 at (1,1,1): ∇F = (2,4,6) and the tangent plane x + 2y + 3z = 6 passes the point (הגדרה 5.4.10)', () => {
    const F = (x: number, y: number, z: number) => x * x + 2 * y * y + 3 * z * z;
    expect(F(1, 1, 1)).toBe(6);
    const g = [2 * 1, 4 * 1, 6 * 1];
    expect(g.map((c) => c / 2)).toEqual([1, 2, 3]);
    expect(1 + 2 + 3).toBe(6);
  });
});

describe('analytic limits: the counterexample of טענה 5.4.4', () => {
  it('∂ₓg(1/(2πk), 0) = −1 and ∂ₓg(1/((2k+1)π), 0) = 1 for every k: ∂ₓg has no limit at 0', () => {
    for (const k of [1, 2, 5, 50, 1000]) {
      // sin(2πk) is 0 up to rounding in 2πk, so the comparison is absolute, with the bound 2x·|sin(2πk)| ≤ 1e-12
      expect(Math.abs(rSinDx(1 / (2 * Math.PI * k), 0) + 1)).toBeLessThan(1e-9);
      expect(Math.abs(rSinDx(1 / ((2 * k + 1) * Math.PI), 0) - 1)).toBeLessThan(1e-9);
      expect(Math.abs(rSinDx(-1 / (2 * Math.PI * k), 0) - 1)).toBeLessThan(1e-9);
    }
  });

  it('|g(h)| ≤ ‖h‖₂², so the remainder quotient |g(h)|/‖h‖₂ ≤ ‖h‖₂ → 0: Dg(0) = 0', () => {
    for (const r of [1, 0.1, 1e-3, 1e-6])
      for (const th of [0, 0.7, 2, 4]) {
        const h: V2 = [r * Math.cos(th), r * Math.sin(th)];
        expect(Math.abs(rSin(h[0], h[1])) / norm2(h)).toBeLessThanOrEqual(r * (1 + 1e-12));
      }
  });

  it('the partials of g at 0 are 0 by the definition: g(t,0)/t = t·sin(1/|t|) → 0', () => {
    for (const t of [1e-2, -1e-3, 1e-6]) expect(Math.abs(rSin(t, 0) / t)).toBeLessThanOrEqual(Math.abs(t));
  });
});

describe('convergence: the closed forms agree with finite differences', () => {
  it('each preset gradient equals the central difference of f (relative 1e-7)', () => {
    for (const id of PRESET_IDS)
      for (const a of PTS) {
        const p = PRESETS[id];
        const g = p.grad(a[0], a[1]);
        const dx = centralDiff((x) => p.f(x, a[1]), a[0], 1e-5);
        const dy = centralDiff((y) => p.f(a[0], y), a[1], 1e-5);
        for (const [c, d] of [
          [g[0], dx],
          [g[1], dy],
        ])
          expect(Math.abs(c - d)).toBeLessThan(1e-7 * Math.max(1, Math.abs(c)));
      }
  });

  it('D_v f(a) = ∇f(a)·v agrees with the slope of t ↦ f(a + tv) at 0 (משפט 5.4.6)', () => {
    for (const id of PRESET_IDS)
      for (const a of PTS)
        for (const d of [0, 33, 120, 251]) {
          const p = PRESETS[id];
          const v = unit(d);
          const slope = centralDiff((t) => p.f(a[0] + t * v[0], a[1] + t * v[1]), 0, 1e-5);
          expect(Math.abs(slope - rate(p, a, d))).toBeLessThan(1e-7 * Math.max(1, Math.abs(slope)));
        }
  });

  it('the formula for ∂ₓg off the origin agrees with the central difference', () => {
    for (const [x, y] of [
      [0.3, 0.1],
      [-0.2, 0.05],
      [0.05, 0],
      [1, -1],
    ]) {
      const d = centralDiff((s) => rSin(s, y), x, 1e-7);
      expect(Math.abs(d - rSinDx(x, y))).toBeLessThan(1e-5);
    }
  });

  it('the C¹ proof on f = xy at a = (1,2): |r(h)|/‖h‖₂ ≤ ‖h‖₂/2 → 0 (משפט 5.4.2; here r(h) = h₁h₂)', () => {
    const f = PRESETS.xy.f;
    const g = PRESETS.xy.grad(1, 2);
    for (const r of [1, 1e-2, 1e-4])
      for (const th of [0.3, 1.1, 2.6]) {
        const h: V2 = [r * Math.cos(th), r * Math.sin(th)];
        const rem = f(1 + h[0], 2 + h[1]) - f(1, 2) - dot(g, h);
        expect(Math.abs(rem - h[0] * h[1])).toBeLessThan(1e-12);
        expect(Math.abs(rem) / norm2(h)).toBeLessThanOrEqual((r / 2) * (1 + 1e-9));
      }
  });
});
