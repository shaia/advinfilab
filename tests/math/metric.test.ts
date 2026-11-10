/**
 * src/math/metric.ts, filed by accuracy category. Each test is named after the claim it checks.
 */

import { describe, expect, it } from 'vitest';
import { RECTS, SETS, ballFits, ballInBall, dist, distToOtherSide, distToOtherSideSet, inRect, inSet, isAccumulation, pointKind, type MetricId, type Pt } from '~/math/metric';

const NORMS: MetricId[] = ['d1', 'd2', 'dinf'];

describe('exact values (closed formulas, compared exactly or to 1e-12)', () => {
  it('the three norm distances from (0,0) to (1,−1) are 2, √2 and 1; the discrete distance is 1', () => {
    expect(dist('d1', [0, 0], [1, -1])).toBe(2);
    expect(dist('d2', [0, 0], [1, -1])).toBeCloseTo(Math.SQRT2, 14);
    expect(dist('dinf', [0, 0], [1, -1])).toBe(1);
    expect(dist('disc', [0, 0], [1, -1])).toBe(1);
    expect(dist('disc', [0.3, 0.3], [0.3, 0.3])).toBe(0);
  });

  it('a point on an included edge of the closed square has no ball inside: distance 0 to the complement', () => {
    for (const m of NORMS) expect(distToOtherSide(m, RECTS.closed, [1, 0.4])).toBe(0);
  });

  it('a point on the excluded top edge of the mixed square is outside it and at distance 0 from it', () => {
    expect(inRect(RECTS.mixed, [0.2, 1])).toBe(false);
    expect(inRect(RECTS.mixed, [0.2, -1])).toBe(true);
    for (const m of NORMS) expect(distToOtherSide(m, RECTS.mixed, [0.2, 1])).toBe(0);
  });

  it('from inside a square the distance to the complement is the nearest edge gap, the same in d1, d2, d∞', () => {
    for (const m of NORMS) expect(distToOtherSide(m, RECTS.open, [0.5, -0.2])).toBeCloseTo(0.5, 12);
  });

  it('from the corner-side point (2,2) the distance to the closed square is 2, √2, 1 in d1, d2, d∞', () => {
    expect(distToOtherSide('d1', RECTS.closed, [2, 2])).toBeCloseTo(2, 12);
    expect(distToOtherSide('d2', RECTS.closed, [2, 2])).toBeCloseTo(Math.SQRT2, 12);
    expect(distToOtherSide('dinf', RECTS.closed, [2, 2])).toBeCloseTo(1, 12);
  });

  it('in the discrete metric every point has the ball of radius 1 on its own side, even on an edge', () => {
    for (const R of Object.values(RECTS)) for (const p of [[1, 0], [0, 1], [0.2, 0.2], [3, 3]] as Pt[]) {
      expect(distToOtherSide('disc', R, p)).toBe(1);
      expect(ballFits('disc', R, p, 1)).toBe(true);
      expect(ballFits('disc', R, p, 1.01)).toBe(false);
    }
  });

  it('the half-plane y > 0 is open: every point of it has a ball of radius y inside', () => {
    for (const m of NORMS) expect(distToOtherSide(m, RECTS.half, [5, 0.3])).toBeCloseTo(0.3, 12);
  });
});

describe('brute force agrees with the formulas (sampling, to the grid cell)', () => {
  const H = 0.01;
  const grid: Pt[] = [];
  for (let i = -300; i <= 300; i++) for (let j = -300; j <= 300; j++) grid.push([i * H, j * H]);

  it('distToOtherSide is the minimum distance to a sampled point of the other side, within one grid cell (one step per coordinate: 2H in d1)', () => {
    const probes: Pt[] = [[0, 0], [0.55, -0.3], [-0.95, 0.95], [1.4, 0.2], [2, -1.7], [0.3, 1.25]];
    for (const R of [RECTS.open, RECTS.closed, RECTS.mixed]) for (const m of NORMS) for (const p of probes) {
      const side = inRect(R, p);
      let best = Infinity;
      for (const q of grid) if (inRect(R, q) !== side) best = Math.min(best, dist(m, p, q));
      expect(Math.abs(best - distToOtherSide(m, R, p))).toBeLessThanOrEqual(2 * H + 1e-12);
    }
  });
});

describe('the lemma behind "an open ball is open" (B(y, R − d(a,y)) ⊆ B(a,R)), sampled', () => {
  it('every sampled point of B(y, s) with s = R − d(a,y) lies in B(a, R), in each norm metric', () => {
    const a: Pt = [0, 0];
    const R = 1;
    for (const m of NORMS) for (const y of [[0.5, 0.3], [-0.2, 0.7], [0.1, -0.05]] as Pt[]) {
      const s = R - dist(m, a, y);
      expect(s).toBeGreaterThan(0);
      for (let k = 0; k < 2000; k++) {
        const t = (2 * Math.PI * k) / 2000;
        const u = 0.999 * s;
        // points on the d2-circle of radius 0.999·s around y: all of them lie in the d2 and d∞ balls B(y, s), but in
        // d1 those off the axes do not, so the guard keeps only the points of B(y, s) in the metric under test
        const z: Pt = [y[0] + u * Math.cos(t), y[1] + u * Math.sin(t)];
        if (dist(m, y, z) < s) expect(dist(m, a, z)).toBeLessThan(R);
      }
      expect(ballInBall(m, a, R, y, s)).toBe(true);
    }
  });

  it('with the radius s = d(a,y) instead, the ball sticks out once d(a,y) > R/2: the point y + s·(y−a)/‖y−a‖ is outside', () => {
    const a: Pt = [0, 0];
    for (const m of NORMS) {
      const y: Pt = [0.7, 0];
      const s = dist(m, a, y);
      const w: Pt = [y[0] + 0.99 * s, 0];
      expect(dist(m, y, w)).toBeLessThan(s);
      expect(dist(m, a, w)).toBeGreaterThanOrEqual(1);
      expect(ballInBall(m, a, 1, y, s)).toBe(false);
    }
  });

  it('the radius R − d(a,y) is the largest that fits: a radius a hair above it sticks out (witness y + t·y/‖y‖)', () => {
    const a: Pt = [0, 0];
    for (const m of NORMS) for (const y of [[0.5, 0.3], [-0.2, 0.7], [0.1, -0.05]] as Pt[]) {
      const s = 1 - dist(m, a, y);
      expect(ballInBall(m, a, 1, y, s + 1e-6)).toBe(false);
      // the witness: move from y away from a by t, with s < t < s + 1e-6, measured in the metric's own norm
      const ny = dist(m, a, y);
      const t = s + 5e-7;
      const w: Pt = [y[0] + (t * y[0]) / ny, y[1] + (t * y[1]) / ny];
      expect(dist(m, y, w)).toBeLessThan(s + 1e-6);
      expect(dist(m, a, w)).toBeGreaterThan(1);
    }
  });

  it('at the naive rule\'s boundary d(a,y) = ½ the ball B(y, d(a,y)) still fits, exactly', () => {
    for (const m of NORMS) expect(ballInBall(m, [0, 0], 1, [0.5, 0], dist(m, [0, 0], [0.5, 0]))).toBe(true);
  });
});

describe('presets from outside and on excluded side edges (exact)', () => {
  it('from (0.5, −0.4), below the half-plane y > 0, the distance to it is 0.4 in every norm metric', () => {
    for (const m of NORMS) {
      expect(inRect(RECTS.half, [0.5, -0.4])).toBe(false);
      expect(distToOtherSide(m, RECTS.half, [0.5, -0.4])).toBeCloseTo(0.4, 12);
    }
  });

  it('the side edge point (1, 0) of the mixed square is outside it and at distance 0 from it', () => {
    expect(inRect(RECTS.mixed, [1, 0])).toBe(false);
    for (const m of NORMS) expect(distToOtherSide(m, RECTS.mixed, [1, 0])).toBe(0);
  });

  it('the corners (±1, −1) of the mixed square are not in it, though the bottom edge is', () => {
    expect(inRect(RECTS.mixed, [1, -1])).toBe(false);
    expect(inRect(RECTS.mixed, [-1, -1])).toBe(false);
    expect(inRect(RECTS.mixed, [0, -1])).toBe(true);
  });
});

describe('lesson 1.4: kinds of points of a rectangle with an isolated point, and of a segment (exact)', () => {
  it('in the open square with the point (1.5, 0): the centre is interior, an edge point boundary, (1.5, 0) boundary, (3, 0) exterior', () => {
    const S = SETS.isolated;
    for (const m of NORMS) {
      expect(pointKind(m, S, [0, 0])).toBe('interior');
      expect(pointKind(m, S, [1, 0.3])).toBe('boundary');
      expect(pointKind(m, S, [1.5, 0])).toBe('boundary');
      expect(pointKind(m, S, [1.9, 1.4])).toBe('exterior');
    }
    expect(inSet(S, [1.5, 0])).toBe(true);
    expect(inSet(S, [1, 0.3])).toBe(false);
  });

  it('(1.5, 0) is an isolated point and the excluded edge point (1, 0.3) is an accumulation point outside the set', () => {
    const S = SETS.isolated;
    for (const m of NORMS) {
      expect(isAccumulation(m, S, [1.5, 0])).toBe(false);
      expect(isAccumulation(m, S, [1, 0.3])).toBe(true);
      expect(isAccumulation(m, S, [0.2, 0.2])).toBe(true);
      expect(isAccumulation(m, S, [1.2, 0])).toBe(false);
    }
  });

  it('the distance from an outside point to the set counts the extra point: from (1.8, 0) it is 0.3, not the 0.8 to the square', () => {
    for (const m of NORMS) expect(distToOtherSideSet(m, SETS.isolated, [1.8, 0])).toBeCloseTo(0.3, 12);
  });

  it('every point of the segment (0,1] × {0} is a boundary point, (0,0) too (outside it), and all of [0,1] × {0} accumulate', () => {
    const S = SETS.segment;
    for (const m of NORMS) {
      for (const p of [[0.5, 0], [1, 0], [0, 0]] as Pt[]) expect(pointKind(m, S, p)).toBe('boundary');
      expect(inSet(S, [0, 0])).toBe(false);
      expect(inSet(S, [1, 0])).toBe(true);
      expect(isAccumulation(m, S, [0, 0])).toBe(true);
      expect(isAccumulation(m, S, [1.05, 0])).toBe(false);
      expect(pointKind(m, S, [0.5, 0.05])).toBe('exterior');
    }
  });

  it('in the discrete metric every point is interior or exterior and none accumulates', () => {
    for (const S of Object.values(SETS)) for (const p of [[1, 0.3], [1.5, 0], [0.5, 0], [0, 0]] as Pt[]) {
      expect(pointKind('disc', S, p)).not.toBe('boundary');
      expect(isAccumulation('disc', S, p)).toBe(false);
    }
  });

  it('the plain rectangle presets agree with the rectangle functions of lesson 1.3', () => {
    const probes: Pt[] = [[0, 0], [1, 0.4], [0.2, 1], [1.5, 0.5], [0.5, 0]];
    for (const id of ['open', 'closed', 'mixed', 'half'] as const) for (const m of [...NORMS, 'disc'] as MetricId[]) for (const p of probes) {
      expect(distToOtherSideSet(m, SETS[id], p)).toBe(distToOtherSide(m, RECTS[id], p));
      expect(inSet(SETS[id], p)).toBe(inRect(RECTS[id], p));
    }
  });
});
