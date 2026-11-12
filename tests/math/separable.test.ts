/**
 * src/math/separable.ts, filed by accuracy category. Each test is named after the claim it checks.
 * The sup errors are sampled (evidence); the bounds ω(1/m) + 1/(2Q) < ε and the distance-1 facts are proved in
 * lesson 4.4 (טענה 4.4.2(ג), טענה 4.4.8(א)).
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import {
  FNS,
  autoMesh,
  ballsDisjoint,
  boundFor,
  chiDistance,
  denominator,
  midpointDistances,
  nodeNumerators,
  polyValue,
  polygonFit,
  type FnId,
} from '~/math/separable';

const IDS: FnId[] = ['wave', 'osc', 'sqrt', 'abs'];
/** every ε the slider offers, 0.05 … 0.5 in hundredths */
const EPS: number[] = [];
for (let e = 5; e <= 50; e++) EPS.push(e / 100);

describe('exact values (the integers the lesson states)', () => {
  it('the guaranteed meshes at ε = 0.1: √x needs m = 401 (m > 4/ε²), |x − ½| m = 21, the wave m = 44', () => {
    expect(autoMesh('sqrt', 0.1)).toBe(401);
    expect(autoMesh('abs', 0.1)).toBe(21);
    expect(autoMesh('wave', 0.1)).toBe(44);
    expect(autoMesh('osc', 0.1)).toBe(114);
    expect(autoMesh('sqrt', 0.05)).toBe(1601);
  });

  it('the denominator Q is the smallest integer above 1/ε: 11 for ε = 0.1, 21 for ε = 0.05, 3 for ε = 0.5', () => {
    expect(denominator(0.1)).toBe(11);
    expect(denominator(0.05)).toBe(21);
    expect(denominator(0.5)).toBe(3);
    for (const eps of EPS) {
      const Q = denominator(eps);
      expect(1 / (2 * Q)).toBeLessThan(eps / 2);
      expect(1 / (2 * (Q - 1))).toBeGreaterThanOrEqual(eps / 2 - 1e-15);
    }
  });

  it('the guaranteed mesh is the smallest m with ω(1/m) < ε/2, for every preset and every slider value', () => {
    for (const id of IDS)
      for (const eps of EPS) {
        const m = autoMesh(id, eps);
        expect(FNS[id].omega(1 / m)).toBeLessThan(eps / 2);
        if (m > 1) expect(FNS[id].omega(1 / (m - 1))).toBeGreaterThanOrEqual(eps / 2 - 1e-12);
      }
  });

  it('the rational node values are within 1/(2Q) of f(t_i)', () => {
    for (const id of IDS) {
      const Q = 11;
      const num = nodeNumerators(FNS[id].f, 40, Q);
      num.forEach((k, i) => expect(Math.abs(k / Q - FNS[id].f(i / 40))).toBeLessThanOrEqual(1 / (2 * Q) + 1e-15));
    }
  });

  it('two different indicators χ_[0,s], χ_[0,t] are at sup distance exactly 1, however close s and t are', () => {
    for (const [s, t] of [
      [0.3, 0.6],
      [0.5, 0.51],
      [0, 1],
      [0.123, 0.1231],
    ])
      expect(chiDistance(s, t)).toBe(1);
    expect(chiDistance(0.4, 0.4)).toBe(0);
  });
});

describe('analytic bounds (the proof of טענה 4.4.2(ג))', () => {
  it('the proof bound ω(1/m) + 1/(2Q) is below ε at the guaranteed mesh, for every preset and slider value', () => {
    for (const id of IDS)
      for (const eps of EPS) {
        const m = autoMesh(id, eps);
        expect(boundFor(id, m, denominator(eps))).toBeLessThan(eps);
      }
  });

  it('the sampled error of the rational polygon never exceeds the proof bound (evidence for ‖f − p‖∞ ≤ ω(h) + 1/(2Q))', () => {
    for (const id of IDS)
      for (const eps of [0.5, 0.3, 0.2, 0.1, 0.07, 0.05]) {
        const fit = polygonFit(id, eps);
        expect(fit.err).toBeLessThanOrEqual(fit.bound + 1e-12);
        expect(fit.err).toBeLessThan(eps);
      }
  });

  it('the bound holds for every mesh, not only the guaranteed one (m = 1 … 60, ε = 0.1)', () => {
    for (const id of IDS)
      for (let m = 1; m <= 60; m++) {
        const fit = polygonFit(id, 0.1, m);
        expect(fit.err).toBeLessThanOrEqual(fit.bound + 1e-12);
      }
  });

  it('the guarantee is sufficient, not necessary: √x at ε = 0.1 is already within ε with m = 8, while the proof asks for 401', () => {
    const fit = polygonFit('sqrt', 0.1, 8);
    expect(fit.err).toBeLessThan(0.1);
    expect(fit.mAuto).toBe(401);
  });

  it('too coarse a mesh fails: |x − ½| with m = 1 or 3 and ε = 0.1 leaves the ε-tube', () => {
    expect(polygonFit('abs', 0.1, 1).err).toBeGreaterThanOrEqual(0.1);
    expect(polygonFit('abs', 0.1, 3).err).toBeGreaterThanOrEqual(0.1);
  });

  it('the open balls of radius r about two different indicators are disjoint for r ≤ ½ and share the midpoint for r > ½', () => {
    expect(ballsDisjoint(0.5)).toBe(true);
    expect(ballsDisjoint(0.51)).toBe(false);
    const [d1, d2] = midpointDistances(0.3, 0.6);
    expect(d1).toBe(0.5);
    expect(d2).toBe(0.5);
  });
});

describe('exact identities (the polygon interpolates)', () => {
  it('the polygon takes its node values at the nodes and is linear in between', () => {
    const vals = [0, 1, 0.5, 0.25];
    vals.forEach((v, i) => expect(polyValue(vals, i / 3)).toBe(v));
    expect(relativeError(polyValue(vals, 0.5), 0.75)).toBeLessThan(1e-14);
  });

  it('the interpolating polygon of x² with m pieces is within 1/(4m²) (the computation after משפט 1.4.18)', () => {
    for (const m of [2, 5, 10]) {
      const vals = Array.from({ length: m + 1 }, (_, i) => (i / m) ** 2);
      let e = 0;
      for (let j = 0; j <= 4000; j++) e = Math.max(e, Math.abs(polyValue(vals, j / 4000) - (j / 4000) ** 2));
      expect(e).toBeLessThanOrEqual(1 / (4 * m * m) + 1e-12);
      expect(relativeError(e, 1 / (4 * m * m))).toBeLessThan(1e-3);
    }
  });
});
