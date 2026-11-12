/**
 * src/math/epsnet.ts, filed by accuracy category. Each test is named after the claim it checks.
 * The plane tests run on finite sets (grid samples of a region, or the 12-point cloud): there the claims are exact;
 * about the region itself they are evidence. The theorems are proved in lesson 3.3.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import {
  CLOUD,
  FNS,
  SETS,
  allSigns,
  arctanNet,
  coversAll,
  dist,
  greedyNet,
  isSeparated,
  minNetOpenSegment,
  minNetSegment,
  netFor,
  samplePoints,
  segmentNet,
  supDistance,
  tent,
  xPowL1,
  xPowSupDistance,
  zigzagNodes,
  zigzagSigns,
  zigzagValue,
  type Metric,
  type Pt,
  type SetId,
} from '~/math/epsnet';

const METRICS: Metric[] = ['d1', 'd2', 'dinf'];
const EPS_LIST = [1.2, 0.8, 0.5, 0.4, 0.25, 0.2, 0.1];

describe('exact values (closed forms the lesson states)', () => {
  it('the smallest ε-net of [0,1] has ⌊1/(2ε)⌋ + 1 points: 6 for ε = 0.1, 4 for ε = 0.15, 3 for ε = 1/4, 2 for ε = 0.3', () => {
    expect(minNetSegment(1, 0.1)).toBe(6);
    expect(minNetSegment(1, 0.15)).toBe(4);
    expect(minNetSegment(1, 0.25)).toBe(3);
    expect(minNetSegment(1, 0.3)).toBe(2);
    expect(minNetSegment(4, 1)).toBe(3); // [0,4] with ε = 1: the bank question on {c x²} ⊆ C[0,2]
    expect(minNetSegment(3, 0.25)).toBe(7); // [0,3] with ε = 1/4: the bank question Q-3.3-net-count
    expect(minNetSegment(2, 0.1)).toBe(11); // [0,2], the "how many points" paragraph after 3.3.6: 11 → 21
    expect(minNetSegment(2, 0.05)).toBe(21);
  });

  it('(ℝ, ρ) with ε = 0.1: the smallest net has 16 points (arctan is an isometry onto an open interval of length π); the lesson construction gives 31', () => {
    expect(minNetOpenSegment(Math.PI, 0.1)).toBe(16);
    expect(arctanNet(0.1).length).toBe(31);
    // 16 angles (i − ½)π/16 − π/2 cover (−π/2, π/2) within π/32 < 0.1 …
    const c = Array.from({ length: 16 }, (_, i) => -Math.PI / 2 + ((i + 0.5) * Math.PI) / 16);
    expect(Math.PI / 32).toBeLessThan(0.1);
    const ts = Array.from({ length: 20001 }, (_, i) => -Math.PI / 2 + (Math.PI * (i + 0.5)) / 20001);
    expect(ts.every((t) => c.some((u) => Math.abs(t - u) < 0.1))).toBe(true);
    // … and 16 angles −π/2 + 0.07 + 0.2 i lie in the open interval and are 0.2-separated (lemma 3.3.3א(א): ≥ 16)
    const sep = Array.from({ length: 16 }, (_, i) => -Math.PI / 2 + 0.07 + 0.2 * i);
    expect(sep[15]).toBeLessThan(Math.PI / 2);
    for (let i = 0; i < 15; i++) expect(sep[i + 1] - sep[i]).toBeGreaterThanOrEqual(0.2 - 1e-12);
    // the open interval needs one more point than len/(2ε) when that is an integer: (0, 1) with ε = 0.1 needs 6
    expect(minNetOpenSegment(1, 0.1)).toBe(6);
  });

  it('the centres (i − ½)·len/m of segmentNet cover a fine grid of [0, len], and m − 1 points cannot (a 2ε-separated set of size m exists)', () => {
    for (const [len, eps] of [
      [1, 0.1],
      [1, 0.15],
      [1, 0.25],
      [4, 1],
      [1, 0.07],
    ] as const) {
      const c = segmentNet(len, eps);
      const grid = Array.from({ length: 4001 }, (_, i) => (len * i) / 4000);
      expect(grid.every((x) => c.some((y) => Math.abs(x - y) < eps))).toBe(true);
      // 0, 2ε, 4ε, …, 2kε ≤ len: k + 1 = m points pairwise ≥ 2ε apart, so every ε-net has ≥ m points (lemma 3.3.3א(א))
      const k = Math.floor(len / (2 * eps) + 1e-12);
      expect(k + 1).toBe(c.length);
    }
  });

  it('‖xⁿ − x²ⁿ‖∞ = 1/4 on [0,1] for every n, and ‖x − x³‖∞ = 2/(3√3)', () => {
    for (const n of [1, 2, 3, 5, 8, 16, 100]) expect(relativeError(xPowSupDistance(n, 2 * n), 0.25)).toBeLessThan(1e-12);
    expect(relativeError(xPowSupDistance(1, 3), 2 / (3 * Math.sqrt(3)))).toBeLessThan(1e-12);
  });

  it('‖tₙ − tₘ‖∞ = 1 for n ≠ m (the tents have disjoint open supports and height 1)', () => {
    for (const [n, m] of [
      [1, 2],
      [2, 5],
      [3, 4],
    ]) {
      const xs = Array.from({ length: 20001 }, (_, i) => i / 20000);
      const d = Math.max(...xs.map((x) => Math.abs(tent(n, x) - tent(m, x))));
      expect(d).toBe(1);
      expect(xs.every((x) => tent(n, x) === 0 || tent(m, x) === 0)).toBe(true);
    }
  });

  it('‖xⁿ‖₁ = 1/(n+1): Simpson on [0,1] agrees', () => {
    for (const n of [1, 2, 5, 10]) {
      const N = 2000;
      let s = 0;
      for (let i = 0; i <= N; i++) s += (i === 0 || i === N ? 1 : i % 2 ? 4 : 2) * (i / N) ** n;
      expect(relativeError((s * (1 / N)) / 3, xPowL1(n))).toBeLessThan(1e-9);
    }
  });
});

describe('exact claims on finite sets (the greedy net of lemma 3.3.3א(ב))', () => {
  const ids: SetId[] = ['square', 'disc', 'strip', 'cloud'];

  it('the greedy ε-net covers the sample with open ε-balls and is ε-separated, for every set, metric and ε', () => {
    for (const id of ids)
      for (const m of METRICS)
        for (const eps of [0.8, 0.4, 0.25]) {
          const pts = samplePoints(id);
          const net = greedyNet(pts, eps, m).map((i) => pts[i]);
          expect(coversAll(pts, net, eps, m)).toBe(true);
          expect(isSeparated(net, eps, m)).toBe(true);
        }
  });

  it('a 2ε-separated set is never larger than an ε-net (lemma 3.3.3א(א)): |greedy(2ε)| ≤ |greedy(ε)|', () => {
    for (const id of ids)
      for (const m of METRICS)
        for (const eps of EPS_LIST) {
          const r = netFor(id, m, eps);
          expect(isSeparated(r.separated, 2 * eps, m)).toBe(true);
          expect(r.separated.length).toBeLessThanOrEqual(r.net.length);
        }
  });

  it('the square in d∞ with ε = 1/4: greedy net and a ½-separated set both have 9 points, so 9 is the minimum', () => {
    const r = netFor('square', 'dinf', 0.25);
    expect(r.net.length).toBe(9);
    expect(r.separated.length).toBe(9);
    // the explicit net of worked example 1: centres (1/6, 1/2, 5/6)² cover a fine grid of [0,1]² in d∞
    const c = [1 / 6, 1 / 2, 5 / 6];
    const centres: Pt[] = c.flatMap((a) => c.map((b) => [a, b] as Pt));
    const grid: Pt[] = [];
    for (let i = 0; i <= 120; i++) for (let j = 0; j <= 120; j++) grid.push([i / 120, j / 120]);
    expect(coversAll(grid, centres, 0.25, 'dinf')).toBe(true);
    const sep: Pt[] = [0, 0.5, 1].flatMap((a) => [0, 0.5, 1].map((b) => [a, b] as Pt));
    expect(isSeparated(sep, 0.5, 'dinf')).toBe(true);
  });

  it('the discrete metric: the greedy net is all 12 points for ε ≤ 1 and one point for ε > 1', () => {
    for (const eps of [0.05, 0.3, 0.99, 1]) expect(netFor('discrete', 'd2', eps).net.length).toBe(CLOUD.length);
    for (const eps of [1.01, 1.2, 1.5]) expect(netFor('discrete', 'd2', eps).net.length).toBe(1);
  });

  it('halving ε multiplies the greedy net of the square by about 4 and of the thin strip by about 2 (d₂, ε from 0.2 to 0.1): evidence of dimension', () => {
    const sq = netFor('square', 'd2', 0.1).net.length / netFor('square', 'd2', 0.2).net.length;
    const st = netFor('strip', 'd2', 0.05).net.length / netFor('strip', 'd2', 0.1).net.length;
    expect(sq).toBeGreaterThan(3);
    expect(st).toBeLessThan(2.5);
  });

  it('the numbers of the "how many points" paragraph: square d₂ 25 → 81 → 272, d∞ 81 → 277, strip d₂ 28 → 64 and d₂ with ε = 0.2 9 vs 5', () => {
    expect(netFor('square', 'd2', 0.2).net.length).toBe(25);
    expect(netFor('square', 'd2', 0.1).net.length).toBe(81);
    expect(netFor('square', 'd2', 0.05).net.length).toBe(272);
    expect(netFor('square', 'dinf', 0.1).net.length).toBe(81);
    expect(netFor('square', 'dinf', 0.05).net.length).toBe(277);
    expect(netFor('strip', 'd2', 0.1).net.length).toBe(28);
    expect(netFor('strip', 'd2', 0.05).net.length).toBe(64);
    const s = netFor('strip', 'd2', 0.2);
    expect([s.net.length, s.separated.length]).toEqual([9, 5]);
  });

  it('the greedy net of the square in d∞ lies between the smallest ε-net (⌊1/2ε⌋+1)² and the smallest ε/2-net (⌊1/ε⌋+1)²', () => {
    for (const eps of [0.4, 0.25, 0.2, 0.1, 0.05]) {
      const lo = minNetSegment(1, eps) ** 2;
      const hi = minNetSegment(1, eps / 2) ** 2;
      const n = netFor('square', 'dinf', eps).net.length;
      expect(n).toBeGreaterThanOrEqual(lo);
      expect(n).toBeLessThanOrEqual(hi);
    }
    expect([minNetSegment(1, 0.1) ** 2, minNetSegment(1, 0.05) ** 2, minNetSegment(1, 0.025) ** 2]).toEqual([36, 121, 441]);
  });

  it('a thin strip in d∞ behaves like a segment when its width w < 2ε: centres (yᵢ, w/2) cover it with ⌊ℓ/2ε⌋ + 1 points', () => {
    for (const eps of [0.06, 0.1, 0.25, 0.4]) {
      const ys = segmentNet(2, eps);
      expect(ys.length).toBe(Math.floor(2 / (2 * eps) + 1e-12) + 1);
      const centres: Pt[] = ys.map((y) => [y, 0.05] as Pt);
      expect(coversAll(samplePoints('strip'), centres, eps, 'dinf')).toBe(true);
      // the points (2iε, 0), i = 0 … n, are 2ε-separated in d∞ and lie in the strip
      const sep: Pt[] = Array.from({ length: ys.length }, (_, i) => [2 * i * eps, 0] as Pt);
      expect(isSeparated(sep, 2 * eps - 1e-12, 'dinf')).toBe(true);
      expect(sep.every((p) => SETS.strip.contains(p))).toBe(true);
    }
    const r = netFor('strip', 'dinf', 0.25);
    expect([r.net.length, r.separated.length]).toEqual([5, 5]);
  });

  it('the sandwich task has non-trivial solutions (equal sizes above 1): square d∞ ε = 0.25 (9) and strip d∞ ε = 0.25 (5)', () => {
    const hits: string[] = [];
    for (const id of ['square', 'disc', 'strip'] as SetId[])
      for (const m of METRICS)
        for (let e = 5; e <= 150; e++) {
          const r = netFor(id, m, e / 100);
          if (r.net.length > 1 && r.net.length === r.separated.length) hits.push(`${id}|${m}|${e / 100}|${r.net.length}`);
        }
    expect(hits).toContain('square|dinf|0.25|9');
    expect(hits).toContain('strip|dinf|0.25|5');
  });

  it('the sample of a region is a subset of the region (its points are points of A)', () => {
    for (const id of ['square', 'disc', 'strip'] as SetId[]) expect(samplePoints(id).every((p) => SETS[id].contains(p))).toBe(true);
  });

  it('dist is a metric on the cloud for each of the four metrics (M1–M3 on all triples)', () => {
    for (const m of [...METRICS, 'discrete'] as Metric[])
      for (const p of CLOUD)
        for (const q of CLOUD) {
          expect(dist(m, p, q)).toBe(dist(m, q, p));
          expect(dist(m, p, q) === 0).toBe(p === q);
          for (const r of CLOUD) expect(dist(m, p, r)).toBeLessThanOrEqual(dist(m, p, q) + dist(m, q, r) + 1e-15);
        }
  });
});

describe('analytic bounds (zigzags, טענה 3.3.10)', () => {
  it('every zigzag has g(0) = 0 and slope ±1, so it lies in L; there are 2^m of them', () => {
    for (const m of [1, 3, 6]) {
      const all = allSigns(m);
      expect(all.length).toBe(2 ** m);
      for (const s of all) {
        expect(zigzagValue(s, 0)).toBe(0);
        const nodes = zigzagNodes(s);
        for (let j = 0; j < m; j++) expect(Math.abs(Math.abs(nodes[j + 1] - nodes[j]) - 1 / m)).toBeLessThan(1e-15);
      }
    }
  });

  it('the sign rule gives ‖f − g‖∞ ≤ h = 1/m for f ∈ L (presets and random 1-Lipschitz broken lines)', () => {
    const fns: ((x: number) => number)[] = [FNS.wave.f, FNS.abs.f, FNS.zero.f];
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let k = 0; k < 20; k++) {
      // a broken line with 25 pieces and slopes in [−1, 1], f(0) = 0: in L
      const slopes = Array.from({ length: 25 }, () => 2 * rnd() - 1);
      fns.push((x) => {
        let v = 0;
        for (let i = 0; i < 25; i++) v += slopes[i] * Math.max(0, Math.min(1 / 25, x - i / 25));
        return v;
      });
    }
    for (const f of fns)
      for (const m of [1, 2, 3, 5, 8, 11, 16]) {
        const s = zigzagSigns(f, m);
        expect(supDistance(f, s, [], 3000)).toBeLessThanOrEqual(1 / m + 1e-12);
      }
  });

  it('the bound h is sharp: for f = 0 every one of the 2^m zigzags is at distance ≥ h, and the alternating one at exactly h', () => {
    for (const m of [1, 2, 5, 10]) {
      const best = Math.min(...allSigns(m).map((s) => supDistance(() => 0, s, [], 200)));
      expect(relativeError(best, 1 / m)).toBeLessThan(1e-12);
    }
  });

  it('for ε = 0.1 the zigzags of mesh 1/m form a 0.1-net of L exactly when m ≥ 11 (h < ε; f = 0 shows m = 10 fails)', () => {
    expect(1 / 11).toBeLessThan(0.1);
    const s10 = zigzagSigns(() => 0, 10);
    expect(supDistance(() => 0, s10)).toBeGreaterThanOrEqual(0.1 - 1e-12);
  });

  it('the tent t₁ (slope 4, not in L) breaks the bound: at m = 4 its zigzag is 3/4 away, more than h = 1/4', () => {
    const s = zigzagSigns(FNS.tent.f, 4);
    expect(supDistance(FNS.tent.f, s, FNS.tent.kinks)).toBeCloseTo(0.75, 12);
  });
});

describe('convergence and covering (other claims of the lesson)', () => {
  it('the powers x^{2^j}, j = 0 … 10, are pairwise ≥ 1/4 apart in d∞ (an infinite 1/4-separated set)', () => {
    for (let i = 0; i <= 10; i++) for (let j = i + 1; j <= 10; j++) expect(xPowSupDistance(2 ** i, 2 ** j)).toBeGreaterThanOrEqual(0.25 - 1e-15);
  });

  it('(ℝ, ρ = |arctan x − arctan y|): the points tan(−π/2 + jπ/m) are an ε-net, for ε = 0.5, 0.1, 0.01', () => {
    for (const eps of [0.5, 0.1, 0.01]) {
      const c = arctanNet(eps).map(Math.atan);
      const ts = Array.from({ length: 20001 }, (_, i) => -Math.PI / 2 + (Math.PI * (i + 0.5)) / 20001);
      expect(ts.every((t) => c.some((u) => Math.abs(t - u) < eps))).toBe(true);
    }
  });
});
