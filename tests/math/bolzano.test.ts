/**
 * src/math/bolzano.ts, filed by accuracy category. Each test is named after the claim it checks.
 * The quartering probe runs on finitely many terms: it is evidence for the proof of משפט 3.1.7, never the proof.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import {
  DEPTH_MAX,
  N_CHOICES,
  N_MAX,
  Q0,
  SEQS,
  SEQ_IDS,
  d2,
  dDiscrete,
  dInf,
  describeBolzano,
  inSquare,
  quarter,
  quarterChain,
  quarterOf,
  sideAt,
  tailSpread,
  terms,
  type SeqId,
} from '~/math/bolzano';

const BOUNDED = SEQ_IDS.filter((id) => SEQS[id].bounded);

describe('exact identities', () => {
  it('the side of Q_j is 2·2^(−j); at j = 6 it is 1/32 < 0.05 and at j = 5 it is 1/16 > 0.05', () => {
    for (let j = 0; j <= DEPTH_MAX; j++) expect(sideAt(j)).toBe(2 / 2 ** j);
    expect(sideAt(6)).toBe(1 / 32);
    expect(sideAt(6)).toBeLessThan(0.05);
    expect(sideAt(5)).toBeGreaterThan(0.05);
  });

  it('the four quarters of a square have half its side and tile it: every point is assigned to a quarter that contains it', () => {
    const Q = { x: -0.75, y: 0.25, side: 0.5 };
    for (let q = 0; q < 4; q++) expect(quarter(Q, q).side).toBe(0.25);
    const grid = Array.from({ length: 21 }, (_, i) => Q.x + (Q.side * i) / 20);
    for (const x of grid)
      for (const y of grid.map((v) => v - Q.x + Q.y)) {
        const p = { x, y };
        expect(inSquare(p, quarter(Q, quarterOf(p, Q)), 1e-15)).toBe(true);
      }
  });

  it('the escape preset has d₂(x_n, 0) = n/20 exactly (up to rounding), so no bounded square holds all its terms', () => {
    for (const n of [1, 7, 20, 400, 20000]) expect(relativeError(d2(SEQS.escape.term(n), { x: 0, y: 0 }), n / 20)).toBeLessThan(1e-14);
    expect(quarterChain(SEQS.escape, 1000, 3)).toBeNull();
  });

  it('every term of a bounded preset lies in Q₀ = [−1, 1]²', () => {
    for (const id of BOUNDED) for (const p of terms(SEQS[id], 5000)) expect(inSquare(p, Q0)).toBe(true);
  });

  it('the terms of every preset are pairwise distinct, so their discrete distances are all 1 (first 400 terms)', () => {
    for (const id of SEQ_IDS) {
      const pts = terms(SEQS[id], 400);
      for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) expect(dDiscrete(pts[a], pts[b])).toBe(1);
    }
  });

  it('corners: the four classes n mod 4 sit near the four points (±½, ±½), at d∞-distance 1/(2n) from them', () => {
    for (const n of [1, 2, 3, 4, 101, 1002]) {
      const p = SEQS.corners.term(n);
      const target = { x: n % 2 === 0 ? 0.5 : -0.5, y: Math.floor(n / 2) % 2 === 0 ? 0.5 : -0.5 };
      // an absolute bound: |p| − ½ cancels ½, so the relative error of the difference grows like n·1e-16
      expect(Math.abs(dInf(p, target) - 1 / (2 * n))).toBeLessThan(1e-15);
    }
  });
});

describe('construction invariants (the proof of משפט 3.1.7 by quartering)', () => {
  for (const id of BOUNDED)
    for (const N of N_CHOICES)
      it(`${id}, N = ${N}: the squares are nested, the indices increase, and x_{n_j} lies in Q_j`, () => {
        const seq = SEQS[id];
        const ch = quarterChain(seq, N, DEPTH_MAX)!;
        const J = ch.picks.length;
        expect(ch.squares.length).toBe(J + 1);
        for (let j = 1; j <= J; j++) {
          const Q = ch.squares[j];
          const P = ch.squares[j - 1];
          expect(Q.side).toBe(sideAt(j));
          expect(Q.x >= P.x && Q.y >= P.y && Q.x + Q.side <= P.x + P.side && Q.y + Q.side <= P.y + P.side).toBe(true);
          expect(inSquare(seq.term(ch.picks[j - 1]), Q)).toBe(true);
          if (j >= 2) expect(ch.picks[j - 1]).toBeGreaterThan(ch.picks[j - 2]);
          expect(ch.picks[j - 1]).toBeLessThanOrEqual(N);
        }
        // the counts at each level add up to the terms still in play (all N at level 0; the kept quarter's count less
        // the picked term after that), and the kept quarter has the largest count
        const sum = (c: number[]) => c.reduce((a, b) => a + b, 0);
        expect(sum(ch.counts[0])).toBe(N);
        let inPlay = N;
        for (let j = 0; j < J; j++) {
          const kept = [0, 1, 2, 3].find((q) => {
            const s = quarter(ch.squares[j], q);
            return s.x === ch.squares[j + 1].x && s.y === ch.squares[j + 1].y;
          })!;
          expect(sum(ch.counts[j])).toBe(inPlay);
          expect(ch.counts[j][kept]).toBe(Math.max(...ch.counts[j]));
          inPlay = ch.counts[j][kept] - 1;
        }
        if (ch.ranOut) expect(sum(ch.counts[J])).toBe(inPlay);
        else expect(ch.remaining).toBe(inPlay);
        expect(ch.ranOut || J === DEPTH_MAX).toBe(true);
      });

  it('with N ≥ 4^j drawn terms the probe reaches level j (each level keeps at least a quarter of the remaining terms)', () => {
    for (const id of BOUNDED)
      for (const N of N_CHOICES) {
        const reach = Math.min(DEPTH_MAX, Math.floor(Math.log(N) / Math.log(4)));
        expect(quarterChain(SEQS[id], N, DEPTH_MAX)!.picks.length).toBeGreaterThanOrEqual(reach);
      }
  });

  it('the figure task "side < 0.05" (level 6) is reachable on every bounded preset with 1000 terms or more', () => {
    for (const id of BOUNDED) for (const N of [1000, 5000, N_MAX]) expect(quarterChain(SEQS[id], N, 6)!.picks.length).toBe(6);
  });

  it('irrational: no drawn term that the construction sorts lies within 1e-12 of a cut, down to level 7', () => {
    const seq = SEQS.irrational;
    const ch = quarterChain(seq, N_MAX, 7)!;
    const pts = terms(seq, N_MAX);
    for (let j = 0; j < ch.picks.length; j++) {
      const Q = ch.squares[j];
      const mx = Q.x + Q.side / 2;
      const my = Q.y + Q.side / 2;
      for (const p of pts) if (inSquare(p, Q)) expect(Math.min(Math.abs(p.x - mx), Math.abs(p.y - my))).toBeGreaterThan(1e-12);
    }
  });

  it('values the e2e spec reads: corners with 1000 terms keeps the lower-left corner, n₁, n₂, n₃ = 3, 7, 11', () => {
    const ch = quarterChain(SEQS.corners, 1000, 3)!;
    expect(ch.picks).toEqual([3, 7, 11]);
    expect(ch.counts[0]).toEqual([250, 250, 250, 250]);
    expect(ch.squares[3]).toEqual({ x: -0.75, y: -0.75, side: 0.25 });
  });
});

describe('convergence (probe of the Cauchy step)', () => {
  for (const id of BOUNDED)
    it(`${id}: from level j on, the picked terms are within d∞-distance 2^(1−j) of each other`, () => {
      const seq = SEQS[id];
      const ch = quarterChain(seq, N_MAX, DEPTH_MAX)!;
      for (let j = 1; j <= ch.picks.length; j++) expect(tailSpread(seq, ch.picks, j)).toBeLessThanOrEqual(sideAt(j));
    });

  it('corners: the picked subsequence approaches (−½, −½), the limit of the class n ≡ 3 (mod 4)', () => {
    const seq = SEQS.corners;
    const ch = quarterChain(seq, N_MAX, DEPTH_MAX)!;
    for (const n of ch.picks) expect(n % 4).toBe(3);
    const last = seq.term(ch.picks[ch.picks.length - 1]);
    expect(dInf(last, { x: -0.5, y: -0.5 })).toBeLessThanOrEqual(sideAt(DEPTH_MAX));
  });
});

describe('readouts', () => {
  it('the screen-reader text names the indices, and says when the drawn terms ran out', () => {
    const t = describeBolzano({ seq: 'corners', N: 1000, depth: 3, discrete: true });
    expect(t).toContain('3, 7, 11');
    expect(t).toContain('הבדידה');
    const out = describeBolzano({ seq: 'irrational' as SeqId, N: 50, depth: 10, discrete: false });
    expect(out).toContain('צריך לצייר יותר איברים');
    expect(describeBolzano({ seq: 'escape', N: 200, depth: 3, discrete: false })).toContain('אינה חסומה');
  });

  it('while the escape task is open the unbounded preset states the distance 200/20 = 10 but not the conclusion', () => {
    const open = describeBolzano({ seq: 'escape', N: 200, depth: 0, discrete: false, verdict: false });
    expect(open).toContain('200/20 = 10');
    expect(open).not.toContain('אינה חסומה');
    expect(open).not.toContain('אין ריבוע');
    expect(describeBolzano({ seq: 'escape', N: 200, depth: 0, discrete: false, verdict: true })).toContain('אין ריבוע חסום');
  });

  it('corners with 1000 terms and 10 halvings (the Explore answer): picks 3, 7, …, 259, all ≡ 3 (mod 4), and Q₁₀ = [−½ − 2⁻⁹, −½]²', () => {
    const ch = quarterChain(SEQS.corners, 1000, 10)!;
    expect(ch.picks).toEqual([3, 7, 11, 15, 19, 23, 35, 67, 131, 259]);
    expect(ch.squares[10]).toEqual({ x: -0.5 - 2 ** -9, y: -0.5 - 2 ** -9, side: 2 ** -9 });
  });
});
