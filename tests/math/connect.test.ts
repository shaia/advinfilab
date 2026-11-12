/**
 * src/math/connect.ts, filed by accuracy category. Each test is named after the claim it checks.
 * The exact segment tests are compared with a fine sampling of the segment: that is evidence, not proof; the
 * theorems behind the figure (3.6.11, 3.6.12, 3.6.13) are proved in lesson 3.6.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import {
  GRID,
  REGIONS,
  approach,
  checkPath,
  distSqToOrigin,
  distToJ,
  exitParam,
  firstK,
  originOnSegment,
  peakCount,
  peaks,
  sineG,
  snap,
  snapY,
  type RegionId,
  type V,
} from '~/math/connect';

/** sampled membership of a point (x, y) in U, straight from the definition of each preset */
const inU: Record<RegionId, (x: number, y: number) => boolean> = {
  annulus: (x, y) => Math.hypot(x, y) > 1 && Math.hypot(x, y) < 2,
  punctured: (x, y) => x !== 0 || y !== 0,
  'two-discs': (x, y) => Math.hypot(x + 1.2, y) < 1 || Math.hypot(x - 1.2, y) < 1,
  line: (x, y) => y === 0 && x !== 0,
};

/** a segment sampled at N+1 points; the endpoints and rational points are hit exactly */
const sampledInside = (id: RegionId, a: V, b: V, N = 4000) => {
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    const x = ((1 - t) * a[0] + t * b[0]) / GRID;
    const y = ((1 - t) * a[1] + t * b[1]) / GRID;
    if (!inU[id](x, y)) return false;
  }
  return true;
};

/** a deterministic pseudo-random grid vertex in [−22, 22]² */
function* vertices(seed: number, count: number): Generator<V> {
  let s = seed;
  const next = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s;
  };
  for (let i = 0; i < count; i++) yield [(next() % 45) - 22, (next() % 45) - 22];
}

describe('exact identities (integer arithmetic)', () => {
  it('the squared distance from 0 to a segment: the perpendicular foot inside, and an endpoint otherwise', () => {
    // [(1,1),(1,−1)] in grid units: the foot (1,0) is inside, distance² 1
    const d1 = distSqToOrigin([1, 1], [1, -1]);
    expect(d1.num / d1.den).toBe(1);
    // [(3,4),(6,8)] points away from 0: the nearest point is (3,4), distance² 25
    expect(distSqToOrigin([3, 4], [6, 8])).toEqual({ num: 25, den: 1 });
    // [(15,0),(0,15)]: distance² = 15²/2 = 112.5
    const d3 = distSqToOrigin([15, 0], [0, 15]);
    expect(d3.num / d3.den).toBe(112.5);
  });

  it('the origin lies on [a, b] exactly when a, b are collinear with 0 and on opposite sides (or one is 0)', () => {
    expect(originOnSegment([10, 0], [-10, 0])).toBe(true);
    expect(originOnSegment([3, 6], [-1, -2])).toBe(true);
    expect(originOnSegment([3, 6], [1, 2])).toBe(false);
    expect(originOnSegment([10, 0], [0, 10])).toBe(false);
    expect(originOnSegment([0, 0], [5, 7])).toBe(true);
  });

  it('annulus: the straight segment from p = (1.5, 0) to q = (−1.5, 0) leaves U, and the path via (0, 1.5) stays in U', () => {
    const r = REGIONS.annulus;
    expect(r.segmentInside(r.start, r.target)).toBe(false);
    const path: V[] = [r.start, [0, 15], r.target];
    expect(checkPath(r, path)).toMatchObject({ inside: true, reached: true, done: true });
  });

  it('annulus: a corner on the inner circle is not in U (open set), even though every other point of the path is', () => {
    const r = REGIONS.annulus;
    expect(r.contains([10, 0])).toBe(false);
    expect(r.contains([0, 20])).toBe(false);
    expect(checkPath(r, [r.start, [10, 0]]).inside).toBe(false);
  });

  it('punctured plane: p = (1, 0) and q = (−1, 0) are joined by two segments through (0, 1), not by one', () => {
    const r = REGIONS.punctured;
    expect(r.segmentInside(r.start, r.target)).toBe(false);
    expect(checkPath(r, [r.start, [0, 10], r.target]).done).toBe(true);
  });

  it('two discs: no polygonal path from one disc to the other stays in U (every segment between the discs fails)', () => {
    const r = REGIONS['two-discs'];
    const left: V[] = [];
    const right: V[] = [];
    for (let i = -25; i <= 25; i++) for (let j = -12; j <= 12; j++) {
      if (r.contains([i, j])) (i < 0 ? left : right).push([i, j]);
    }
    for (const a of right.filter((_, k) => k % 7 === 0)) for (const b of left.filter((_, k) => k % 7 === 0)) {
      expect(r.segmentInside(a, b)).toBe(false);
    }
  });

  it('the line minus 0: a segment from a positive point to a negative point always fails', () => {
    const r = REGIONS.line;
    for (let i = 1; i <= 20; i++) for (let k = 1; k <= 20; k++) expect(r.segmentInside([i, 0], [-k, 0])).toBe(false);
    expect(r.segmentInside([3, 0], [17, 0])).toBe(true);
  });

  it('snap returns grid vertices, puts the line preset on the axis, and never returns −0', () => {
    expect(snap(REGIONS.annulus, 0.149, -0.151)).toEqual([1, -2]);
    expect(snap(REGIONS.line, 0.7, 0.4)).toEqual([7, 0]);
    const v = snap(REGIONS.annulus, -0.04, -0.04);
    expect(Object.is(v[0], -0)).toBe(false);
    expect(Object.is(v[1], -0)).toBe(false);
    expect(snapY(-0.02)).toBe(0);
    expect(Object.is(snapY(-0.02), -0)).toBe(false);
  });
});

describe('evidence by sampling (the exact tests agree with a fine sampling)', () => {
  for (const id of ['annulus', 'punctured', 'two-discs'] as RegionId[]) {
    it(`${id}: the exact segment test agrees with 4001 sample points on 300 pseudo-random segments`, () => {
      const r = REGIONS[id];
      const vs = [...vertices(id.length * 7919, 600)];
      let agree = 0;
      for (let k = 0; k + 1 < vs.length; k += 2) {
        const [a, b] = [vs[k], vs[k + 1]];
        const exact = r.segmentInside(a, b);
        const sampled = sampledInside(id, a, b);
        // the sampling can only miss a short exit; when it says "outside", the exact test must agree
        if (!sampled) expect(exact).toBe(false);
        if (exact) expect(sampled).toBe(true);
        if (exact === sampled) agree++;
      }
      expect(agree).toBe(300);
    });
  }

  it('exitParam marks a point outside U (or the boundary), for segments that leave U', () => {
    for (const id of ['annulus', 'punctured', 'two-discs', 'line'] as RegionId[]) {
      const r = REGIONS[id];
      const t = exitParam(r, r.start, r.target);
      expect(t).not.toBeNull();
      const a = r.start;
      const b = r.target;
      const x = ((1 - t!) * a[0] + t! * b[0]) / GRID;
      const y = ((1 - t!) * a[1] + t! * b[1]) / GRID;
      // at the exit parameter the point is on the boundary: just after it, it is outside U
      const x2 = ((1 - (t! + 1e-6)) * a[0] + (t! + 1e-6) * b[0]) / GRID;
      const y2 = ((1 - (t! + 1e-6)) * a[1] + (t! + 1e-6) * b[1]) / GRID;
      expect(inU[id](x, y) && inU[id](x2, y2)).toBe(false);
    }
    expect(exitParam(REGIONS.annulus, [15, 0], [0, 15])).toBeNull();
  });
});

describe('analytic formulas (the topologist’s sine curve)', () => {
  it('peaks: sin(1/x) = ±1 at x = 1/(π/2 + πk), alternating signs, and the closed-form count matches the list', () => {
    for (const x0 of [1, 0.5, 0.3, 0.2122, 0.1, 0.05, 0.01, 0.003, 0.001]) {
      const ps = peaks(x0);
      expect(ps.length).toBe(peakCount(x0));
      ps.forEach((x, k) => {
        expect(Math.abs(sineG(x) - (k % 2 === 0 ? 1 : -1))).toBeLessThan(1e-12);
        expect(x).toBeGreaterThanOrEqual(x0);
      });
    }
    // the numbers the lesson quotes: 0 peaks on [1, 1] (1/1 < π/2); 1 peak (x = 2/π) down to 0.3; 32 down to 0.01
    expect(peakCount(1)).toBe(0);
    expect(peakCount(0.3)).toBe(1);
    expect(peakCount(0.01)).toBe(32);
  });

  it('approach(y, k) is a point of G at height y, and its distance to (0, y) is x_k → 0', () => {
    for (const y of [-1, -0.5, 0, 0.3, 0.5, 1]) {
      let prev = Infinity;
      for (let k = 1; k <= 40; k++) {
        const x = approach(y, k);
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThanOrEqual(1);
        expect(Math.abs(sineG(x) - y)).toBeLessThan(1e-9);
        expect(x).toBeLessThan(prev);
        prev = x;
        expect(relativeError(distToJ(x, sineG(x)), x)).toBeLessThan(1e-15);
      }
    }
  });

  it('firstK(y, tol) is the least k with x_k < tol (k = 16 for y = 0.5 and tol = 0.01)', () => {
    for (const y of [-1, -0.5, 0, 0.5, 1]) {
      for (const tol of [0.1, 0.05, 0.01]) {
        const k = firstK(y, tol);
        expect(approach(y, k)).toBeLessThan(tol);
        if (k > 1) expect(approach(y, k - 1)).toBeGreaterThanOrEqual(tol);
      }
    }
    expect(firstK(0.5, 0.01)).toBe(16);
    expect(firstK(0, 0.01)).toBe(16);
    expect(firstK(-1, 0.01)).toBe(17);
  });

  it('on every (0, x₀] the graph takes the values 1 and −1 (oscillation 2): probe for x₀ down to 10⁻⁶', () => {
    for (const x0 of [1, 0.1, 1e-3, 1e-6]) {
      // the first two peaks inside (0, x₀]: k₀ = the least k with 1/(π/2 + πk) ≤ x₀, then k₀ and k₀ + 1
      const k0 = Math.max(0, Math.ceil((1 / x0 - Math.PI / 2) / Math.PI));
      const xs = [k0, k0 + 1].map((k) => 1 / (Math.PI / 2 + Math.PI * k));
      for (const x of xs) expect(x).toBeLessThanOrEqual(x0);
      const vals = xs.map(sineG).sort((a, b) => a - b);
      expect(Math.abs(vals[0] + 1)).toBeLessThan(1e-6);
      expect(Math.abs(vals[1] - 1)).toBeLessThan(1e-6);
    }
  });
});
