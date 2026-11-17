/**
 * src/math/directional.ts, filed by accuracy category. Each test is named after the claim it checks.
 * The closed forms are the ones lesson 5.2 proves; the secant slopes at small t are a probe that agrees with them.
 * A probe never proves a limit: the limits are proved in the lesson.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import { PRESETS, dirFromDeg, dv, degOf, levelCurves, levelRoots, oneSided, polyCurvature, quotient, slice, sliceLimit, spikeT, type Vec } from '~/math/directional';

const v35: Vec = [3 / 5, 4 / 5];
const diag: Vec = [Math.SQRT1_2, Math.SQRT1_2];
const value = (d: ReturnType<typeof dv>) => (d.exists ? d.value : NaN);

describe('exact identities: the closed forms of lesson 5.2', () => {
  it('x² + 3xy at (1,1) in direction (3/5, 4/5): D_v f(a) = 27/5 (טענה 5.2.3(א))', () => {
    expect(relativeError(value(dv(PRESETS.poly, v35)), 27 / 5)).toBeLessThan(1e-15);
  });

  it('x² + 3xy at (1,1): the secant slope is exactly D_v f(a) + t(v₁² + 3v₁v₂) (the slice is a quadratic)', () => {
    for (const deg of [0, 30, 53.13, 135, 250])
      for (const t of [0.5, 0.1, -0.2, -0.01]) {
        const v = dirFromDeg(deg);
        const want = value(dv(PRESETS.poly, v)) + t * polyCurvature(v);
        expect(Math.abs(quotient(PRESETS.poly, v, t) - want)).toBeLessThan(1e-12);
      }
  });

  it('x²y/(x⁴+y²) at 0 in direction (3/5, 4/5): D_v g(0) = v₁²/v₂ = 9/20 (טענה 5.2.5)', () => {
    expect(relativeError(value(dv(PRESETS.g, v35)), 9 / 20)).toBeLessThan(1e-15);
  });

  it('x²y/(x⁴+y²): the direction angle with D_v g(0) = 9/20 and v₂ > 0 is atan2(4, ±3): sin θ = 4/5 solves s² + 0.45s − 1 = 0', () => {
    const s = (-0.45 + Math.sqrt(0.45 ** 2 + 4)) / 2;
    expect(relativeError(s, 0.8)).toBeLessThan(1e-15);
    for (const v of [v35, [-3 / 5, 4 / 5] as Vec]) expect(relativeError(value(dv(PRESETS.g, v)), 0.45)).toBeLessThan(1e-15);
  });

  it('x²y/(x⁴+y²): the partial derivatives at 0 are 0 and the diagonal derivative is 1/√2, so v ↦ D_v g(0) is not c·v (טענה 5.2.5)', () => {
    expect(value(dv(PRESETS.g, dirFromDeg(0)))).toBe(0);
    expect(value(dv(PRESETS.g, dirFromDeg(90)))).toBe(0);
    expect(relativeError(value(dv(PRESETS.g, diag)), Math.SQRT1_2)).toBeLessThan(1e-15);
  });

  it('xy/(x²+y²): the slice off the axes is the constant v₁v₂ (1/2 on the diagonal), and 0 at t = 0 (טענה 5.2.4(א))', () => {
    expect(slice(PRESETS.xy, diag, 0)).toBe(0);
    for (const t of [1, 0.3, -0.001]) expect(relativeError(slice(PRESETS.xy, diag, t), 0.5)).toBeLessThan(1e-15);
    expect(relativeError(sliceLimit(PRESETS.xy, diag), 0.5)).toBeLessThan(1e-15);
  });

  it('xy/(x²+y²): the partial derivatives at 0 exist and are 0; off the axes there is no D_v (a jump)', () => {
    expect(dv(PRESETS.xy, dirFromDeg(0))).toEqual({ exists: true, value: 0 });
    expect(dv(PRESETS.xy, dirFromDeg(270))).toEqual({ exists: true, value: 0 });
    expect(dv(PRESETS.xy, diag)).toEqual({ exists: false, reason: 'jump' });
  });

  it('‖x‖₂ at 0: q(t) = |t|/t is exactly 1 for t > 0 and −1 for t < 0, in every direction (טענה 5.2.3(ב))', () => {
    for (const deg of [0, 17, 90, 200])
      for (const t of [0.5, 1e-3, -1e-3, -0.5]) expect(quotient(PRESETS.norm, dirFromDeg(deg), t)).toBeCloseTo(Math.sign(t), 14);
    expect(oneSided(PRESETS.norm, diag)).toEqual([1, -1]);
  });

  it('√|xy| at 0 in direction (1,1)/√2: q(t) = |t|/(√2 t), one-sided limits ±1/√2 (טענה 5.2.7)', () => {
    for (const t of [0.4, 1e-4]) {
      expect(relativeError(quotient(PRESETS.sqrtxy, diag, t), Math.SQRT1_2)).toBeLessThan(1e-12);
      expect(relativeError(quotient(PRESETS.sqrtxy, diag, -t), -Math.SQRT1_2)).toBeLessThan(1e-12);
    }
    expect(dv(PRESETS.sqrtxy, dirFromDeg(0))).toEqual({ exists: true, value: 0 });
  });

  it('the parabola indicator h: the line t·v meets y = x² only at t* = v₂/v₁², h = 1 there, and D_v h(0) = 0 (טענה 5.2.6)', () => {
    for (const deg of [10, 45, 135, 300]) {
      const v = dirFromDeg(deg);
      const ts = spikeT(v)!;
      expect(relativeError(ts * v[1], (ts * v[0]) ** 2)).toBeLessThan(1e-14);
      expect(slice(PRESETS.h, v, ts)).toBe(1);
      expect(slice(PRESETS.h, v, ts / 2)).toBe(0);
      expect(dv(PRESETS.h, v)).toEqual({ exists: true, value: 0 });
    }
    expect(spikeT(dirFromDeg(0))).toBeNull();
    expect(spikeT(dirFromDeg(90))).toBeNull();
  });

  it('the level sets: k/(1 + k²) = c has the roots (1 ± √(1 − 4c²))/(2c), and their product is 1', () => {
    for (const c of [0.2, -0.4, 0.45]) {
      const [k1, k2] = levelRoots(c);
      for (const k of [k1, k2]) expect(relativeError(k / (1 + k * k), c)).toBeLessThan(1e-14);
      expect(relativeError(k1 * k2, 1)).toBeLessThan(1e-14);
    }
  });

  it('the level curves lie on their level: g = c on the drawn parabolas, xy/(x²+y²) = c on the drawn lines', () => {
    for (const id of ['g', 'xy', 'norm', 'sqrtxy', 'poly'] as const) {
      const p = PRESETS[id];
      for (const line of levelCurves(p, 1.6, 1)) {
        if (line.level === null) continue;
        for (const [x, y] of line.pts) {
          if (Math.hypot(x, y) < 1e-9) continue;
          if (line.level === 0 && x * y === 0) {
            expect(Math.abs(p.f(x, y))).toBe(0);
            continue;
          }
          expect(Math.abs(p.f(x, y) - line.level)).toBeLessThan(1e-9);
        }
      }
    }
  });

  it('directions: the exact axis vectors at multiples of 90°, and the angle round-trips', () => {
    expect(dirFromDeg(90)).toEqual([0, 1]);
    expect(dirFromDeg(-90)).toEqual([0, -1]);
    expect(dirFromDeg(360)).toEqual([1, 0]);
    for (const deg of [12.5, 53.13, 181, 359.9]) expect(Math.abs(degOf(dirFromDeg(deg)) - deg)).toBeLessThan(1e-9);
  });
});

describe('analytic limits: the secant slopes approach the closed form (a probe of the proved limits)', () => {
  it('x²y/(x⁴+y²): q(t) → v₁²/v₂ with error ≤ t²v₁⁴·(v₁²/v₂³), in every non-horizontal direction', () => {
    for (const deg of [20, 53.13, 100, 250]) {
      const v = dirFromDeg(deg);
      const D = value(dv(PRESETS.g, v));
      for (const t of [1e-2, 1e-3, -1e-3]) {
        // q = v₁²v₂/(t²v₁⁴ + v₂²), so |q − v₁²/v₂| = t²v₁⁶/(|v₂|(t²v₁⁴ + v₂²)) ≤ t²v₁⁶/|v₂|³
        const bound = (t * t * v[0] ** 6) / Math.abs(v[1]) ** 3;
        expect(Math.abs(quotient(PRESETS.g, v, t) - D)).toBeLessThanOrEqual(bound * (1 + 1e-9) + 1e-15);
      }
    }
  });

  it('xy/(x²+y²) off the axes: |q(t)| = |v₁v₂|/|t| grows without bound as t → 0 (no derivative)', () => {
    const v = dirFromDeg(30);
    const c = Math.abs(v[0] * v[1]);
    for (const t of [1e-1, 1e-3, 1e-5]) expect(relativeError(Math.abs(quotient(PRESETS.xy, v, t)), c / t)).toBeLessThan(1e-12);
  });
});
