/**
 * src/math/contraction.ts, filed by accuracy category. Each test is named after the claim it checks.
 * Grid samples of a Lipschitz ratio are probes (evidence); the claims themselves are proved in the lesson.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import {
  MAPS,
  N_MAX,
  X_STAR_COS,
  aPosteriori,
  aPriori,
  describeContraction,
  firstNApriori,
  images,
  inX,
  intervalLength,
  orbit,
  snapX0,
  trueError,
  type MapDef,
  type MapId,
} from '~/math/contraction';

const grid = (lo: number, hi: number, n: number) => Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);
/** points of X to sample: the open endpoint of a half-open interval is replaced by a point just inside */
const sample = (m: MapDef, n = 120) => {
  const lo = m.X.loOpen ? m.X.lo + 1e-3 : m.X.lo;
  const hi = Number.isFinite(m.X.hi) ? m.X.hi : 50;
  return grid(lo, hi, n);
};
const WITH_Q = (Object.keys(MAPS) as MapId[]).filter((id) => MAPS[id].q !== null);

describe('exact values', () => {
  it('the fixed point of cos is 0.7390851332151607: iterating to |Δ| < 1e-16 reproduces the stored constant', () => {
    let x = 0.5;
    let steps = 0;
    for (; steps < 2000; steps++) {
      const next = Math.cos(x);
      const d = Math.abs(next - x);
      x = next;
      if (d < 1e-16) break;
    }
    expect(steps).toBeLessThan(2000);
    expect(relativeError(x, X_STAR_COS)).toBeLessThan(1e-15);
    expect(Math.abs(Math.cos(X_STAR_COS) - X_STAR_COS)).toBeLessThan(2.3e-16);
  });

  it('cos maps [0, 1] into [cos 1, 1] ⊆ [0, 1]', () => {
    const m = MAPS.cos;
    const im = m.image!(m.X);
    expect(im.lo).toBe(Math.cos(1));
    expect(im.hi).toBe(1);
    for (const x of grid(0, 1, 400)) {
      expect(m.f(x)).toBeGreaterThanOrEqual(Math.cos(1));
      expect(m.f(x)).toBeLessThanOrEqual(1);
    }
    expect(Math.cos(1)).toBeGreaterThan(0);
  });

  it('x/2 + 1/x maps [1, 2] into [√2, 3/2] with minimum √2 at √2', () => {
    const m = MAPS['newton-sqrt2'];
    const im = m.image!(m.X);
    expect(relativeError(im.lo, Math.SQRT2)).toBeLessThan(1e-15);
    expect(im.hi).toBe(1.5);
    for (const x of grid(1, 2, 400)) {
      expect(m.f(x)).toBeGreaterThanOrEqual(Math.SQRT2 - 1e-15);
      expect(m.f(x)).toBeLessThanOrEqual(1.5);
    }
    expect(relativeError(m.f(Math.SQRT2), Math.SQRT2)).toBeLessThan(1e-15);
  });

  it('the leaves map sends [0, 1] onto [1, 3/2], which is not inside [0, 1]', () => {
    const m = MAPS.leaves;
    const im = m.image!(m.X);
    expect(im).toMatchObject({ lo: 1, hi: 1.5 });
    expect(m.mapsInto).toBe(false);
  });

  it('the q of each preset is the one the lesson derives: sin 1, 1/2, 1/2, 1/2', () => {
    expect(MAPS.cos.q).toBe(Math.sin(1));
    expect(MAPS['newton-sqrt2'].q).toBe(0.5);
    expect(MAPS['half-open'].q).toBe(0.5);
    expect(MAPS.leaves.q).toBe(0.5);
    expect(MAPS['x-plus-inv'].q).toBeNull();
    expect(MAPS['cos-R'].q).toBeNull();
  });

  it('the fixed points are fixed: f(x*) = x* for cos and Newton, and 2 for x/2 + 1', () => {
    expect(Math.abs(MAPS.cos.f(MAPS.cos.fixed!) - MAPS.cos.fixed!)).toBeLessThan(2.3e-16);
    expect(relativeError(MAPS['newton-sqrt2'].f(Math.SQRT2), Math.SQRT2)).toBeLessThan(1e-15);
    expect(MAPS.leaves.f(2)).toBe(2);
    expect(MAPS['half-open'].f(0)).toBe(0);
  });
});

describe('the Lipschitz constant (a probe on a grid, not a proof)', () => {
  for (const id of WITH_Q) {
    it(`${id}: |f(x) − f(y)|/|x − y| ≤ q for all grid pairs in X`, () => {
      const m = MAPS[id];
      const xs = sample(m);
      let worst = 0;
      for (let i = 0; i < xs.length; i++)
        for (let j = i + 1; j < xs.length; j++) worst = Math.max(worst, Math.abs(m.f(xs[i]) - m.f(xs[j])) / Math.abs(xs[i] - xs[j]));
      expect(worst).toBeLessThanOrEqual(m.q! + 1e-12);
    });
  }

  it('cos on [0, 1]: the ratio approaches q = sin 1 near x = 1, so no smaller q works', () => {
    const r = Math.abs(Math.cos(1) - Math.cos(1 - 1e-6)) / 1e-6;
    expect(relativeError(r, Math.sin(1))).toBeLessThan(1e-5);
  });

  it('x + 1/x strictly shrinks distances on [1, ∞) and has no fixed point', () => {
    const f = MAPS['x-plus-inv'].f;
    const xs = [1, 1.01, 1.5, 2, 3, 7, 20, 100, 1000];
    for (let i = 0; i < xs.length; i++)
      for (let j = i + 1; j < xs.length; j++) expect(Math.abs(f(xs[i]) - f(xs[j]))).toBeLessThan(Math.abs(xs[i] - xs[j]));
    for (const x of grid(1, 1000, 500)) expect(f(x) - x).toBeGreaterThan(0);
  });

  it('x + 1/x has no q < 1: the ratio at x, x + 1 tends to 1 as x grows', () => {
    const f = MAPS['x-plus-inv'].f;
    const ratio = (x: number) => Math.abs(f(x + 1) - f(x));
    expect(ratio(1000)).toBeGreaterThan(0.999);
    expect(ratio(1e6)).toBeGreaterThan(0.999999);
  });

  it('cos on ℝ has Lipschitz ratio 1 (no q < 1): the ratio near π/2 is within 1e-5 of 1', () => {
    const h = 1e-3;
    const r = Math.abs(Math.cos(Math.PI / 2 - h) - Math.cos(Math.PI / 2 + h)) / (2 * h);
    expect(1 - r).toBeLessThan(1e-5);
  });

  it('cos∘cos has |derivative| sin(cos x)·sin x ≤ sin 1 on [−10, 10], while cos alone reaches 1', () => {
    const q2 = MAPS['cos-R'].q2!;
    expect(q2).toBe(Math.sin(1));
    for (const x of grid(-10, 10, 4000)) expect(Math.abs(Math.sin(Math.cos(x)) * Math.sin(x))).toBeLessThanOrEqual(q2 + 1e-12);
    // the same through finite differences of the composition itself
    const h = 1e-6;
    for (const x of grid(-10, 10, 400)) {
      const d = (Math.cos(Math.cos(x + h)) - Math.cos(Math.cos(x - h))) / (2 * h);
      expect(Math.abs(d)).toBeLessThanOrEqual(q2 + 1e-6);
    }
  });
});

describe('the orbit', () => {
  it('stays in X for cos, Newton and x/2 on (0, 1] for every n up to N_MAX', () => {
    for (const id of ['cos', 'newton-sqrt2', 'half-open'] as MapId[]) {
      const m = MAPS[id];
      for (const x0 of grid(m.x0Range[0], m.x0Range[1], 20)) {
        const o = orbit(m, x0, N_MAX);
        expect(o.escapedAt).toBeNull();
        expect(o.xs.length).toBe(N_MAX + 1);
      }
    }
  });

  it('`leaves` leaves X at once: x₁ = x₀/2 + 1 > 1 for x₀ ∈ (0, 1], and x₂ = 3/2 for x₀ = 0', () => {
    const m = MAPS.leaves;
    for (const x0 of [0.01, 0.5, 1]) {
      const o = orbit(m, x0, 5);
      expect(o.escapedAt).toBe(1);
      expect(o.xs).toHaveLength(2);
      expect(inX(m, o.xs[1])).toBe(false);
    }
    const z = orbit(m, 0, 5);
    expect(z.xs).toEqual([0, 1, 1.5]);
    expect(z.escapedAt).toBe(2);
  });

  it('x + 1/x grows without bound: x_{n+1}² ≥ x_n² + 2, so x₄₀ ≥ √80', () => {
    const o = orbit(MAPS['x-plus-inv'], 1, 40);
    expect(o.escapedAt).toBeNull();
    for (let k = 0; k < 40; k++) expect(o.xs[k + 1] ** 2).toBeGreaterThanOrEqual(o.xs[k] ** 2 + 2 - 1e-9);
    expect(o.xs[40]).toBeGreaterThanOrEqual(Math.sqrt(80) - 1e-9);
  });

  it('x/2 on (0, 1] is x₀/2ⁿ exactly and never reaches 0', () => {
    const o = orbit(MAPS['half-open'], 0.8, 30);
    o.xs.forEach((x, k) => {
      expect(x).toBe(0.8 / 2 ** k);
      expect(x).toBeGreaterThan(0);
    });
  });

  it('x₀ is clamped and snapped: the open end of (0, 1] is not offered, values are on the 0.01 grid', () => {
    expect(snapX0(MAPS['half-open'], -3)).toBe(0.01);
    expect(snapX0(MAPS.cos, 7)).toBe(1);
    expect(snapX0(MAPS.cos, 0.3049)).toBe(0.3);
    expect(snapX0(MAPS['x-plus-inv'], 99)).toBe(10);
  });
});

describe('the error bounds (Banach, 2.3.4)', () => {
  const cases: [MapId, number][] = [
    ['cos', 0],
    ['newton-sqrt2', 0],
    ['half-open', 0],
  ];
  for (const [id] of cases) {
    it(`${id}: the a-priori bound qⁿ/(1−q)·|x₁−x₀| is ≥ the true error for 21 starts and every n ≤ ${N_MAX}`, () => {
      const m = MAPS[id];
      for (const x0 of grid(m.x0Range[0], m.x0Range[1], 20)) {
        for (let n = 0; n <= N_MAX; n++) {
          const b = aPriori(m, x0, n)!;
          const e = trueError(m, x0, n)!;
          expect(b).toBeGreaterThanOrEqual(e - 1e-15);
        }
      }
    });

    it(`${id}: the a-posteriori bound q/(1−q)·|xₙ−xₙ₋₁| is ≥ the true error for 21 starts and every 1 ≤ n ≤ ${N_MAX}`, () => {
      const m = MAPS[id];
      for (const x0 of grid(m.x0Range[0], m.x0Range[1], 20)) {
        for (let n = 1; n <= N_MAX; n++) {
          const b = aPosteriori(m, x0, n)!;
          const e = trueError(m, x0, n)!;
          expect(b).toBeGreaterThanOrEqual(e - 1e-15);
        }
      }
    });
  }

  it('the a-posteriori bound is never worse than the a-priori one for cos from x₀ = 0 (n ≥ 1): it uses the later information', () => {
    const m = MAPS.cos;
    for (let n = 1; n <= 20; n++) expect(aPosteriori(m, 0, n)!).toBeLessThanOrEqual(aPriori(m, 0, n)! + 1e-15);
  });

  it('for x/2 on (0, 1] the a-priori bound is the exact distance to 0: x₀/2ⁿ', () => {
    for (const n of [0, 1, 7, 30]) expect(relativeError(aPriori(MAPS['half-open'], 0.6, n)!, 0.6 / 2 ** n)).toBeLessThan(1e-14);
  });

  it('no bound is offered without q < 1 or when f(X) ⊄ X', () => {
    expect(aPriori(MAPS['x-plus-inv'], 2, 5)).toBeNull();
    expect(aPriori(MAPS['cos-R'], 0, 5)).toBeNull();
    expect(aPriori(MAPS.leaves, 0, 5)).toBeNull();
    expect(aPosteriori(MAPS.cos, 0.5, 0)).toBeNull();
  });

  it('the first n with a-priori bound < 10⁻³ from x₀ = 0.7 for cos is 35 (and 34 is not)', () => {
    expect(firstNApriori(MAPS.cos, 0.7)).toBe(35);
    expect(aPriori(MAPS.cos, 0.7, 34)!).toBeGreaterThanOrEqual(1e-3);
    expect(aPriori(MAPS.cos, 0.7, 35)!).toBeLessThan(1e-3);
    // from x₀ = 0 the bound needs n = 51 > N_MAX
    expect(firstNApriori(MAPS.cos, 0)).toBeNull();
  });
});

describe('the images fⁿ(X)', () => {
  for (const id of ['cos', 'newton-sqrt2', 'half-open'] as MapId[]) {
    it(`${id}: the images are nested and length(fⁿ(X)) ≤ qⁿ·length(X)`, () => {
      const m = MAPS[id];
      const im = images(m, N_MAX)!;
      expect(im).toHaveLength(N_MAX + 1);
      for (let k = 0; k <= N_MAX; k++) {
        expect(intervalLength(im[k])).toBeLessThanOrEqual(m.q! ** k * intervalLength(m.X) + 1e-15);
        if (k > 0) {
          expect(im[k].lo).toBeGreaterThanOrEqual(im[k - 1].lo - 1e-15);
          expect(im[k].hi).toBeLessThanOrEqual(im[k - 1].hi + 1e-15);
        }
      }
    });
  }

  it('cos: fⁿ([0, 1]) is the interval spanned by the iterates fⁿ(0) and fⁿ(1), and matches a sampled image', () => {
    const m = MAPS.cos;
    const im = images(m, 6)!;
    const it_ = (x: number, n: number) => orbit(m, x, n).xs[n];
    for (let n = 0; n <= 6; n++) {
      expect(im[n].lo).toBeCloseTo(Math.min(it_(0, n), it_(1, n)), 14);
      expect(im[n].hi).toBeCloseTo(Math.max(it_(0, n), it_(1, n)), 14);
      const vals = grid(0, 1, 2000).map((x) => it_(x, n));
      expect(Math.min(...vals)).toBeGreaterThanOrEqual(im[n].lo - 1e-14);
      expect(Math.max(...vals)).toBeLessThanOrEqual(im[n].hi + 1e-14);
      expect(Math.min(...vals) - im[n].lo).toBeLessThan(1e-3 * Math.max(1, intervalLength(im[n])));
    }
  });

  it('images shrink to the fixed point: f⁴⁰([0, 1]) contains x* and is shorter than q⁴⁰', () => {
    const I = images(MAPS.cos, 40)![40];
    expect(I.lo).toBeLessThanOrEqual(X_STAR_COS + 1e-15);
    expect(I.hi).toBeGreaterThanOrEqual(X_STAR_COS - 1e-15);
    expect(intervalLength(I)).toBeLessThan(Math.sin(1) ** 40);
  });

  it('half-open: fⁿ((0, 1]) = (0, 1/2ⁿ] keeps its open end at 0', () => {
    const im = images(MAPS['half-open'], 5)!;
    expect(im[5]).toEqual({ lo: 0, hi: 1 / 32, loOpen: true, hiOpen: false });
  });

  it('leaves: f(X) ⊄ X, so the images stop after f¹(X)', () => {
    const im = images(MAPS.leaves, 4)!;
    expect(im).toHaveLength(2);
  });

  it('no images for an unbounded X', () => {
    expect(images(MAPS['x-plus-inv'], 3)).toBeNull();
    expect(images(MAPS['cos-R'], 3)).toBeNull();
  });
});

describe('the live-region sentence', () => {
  it('cos, x₀ = 0, n = 5, bounds on, is this exact string (the e2e spec matches it)', () => {
    expect(describeContraction({ map: 'cos', x0: 0, n: 5, showBound: true, showImages: false })).toBe(
      'f(x) = cos x על X = [0, 1], x₀ = 0, n = 5. x₅ = 0.79348. d(x₄, x₅) = 0.139191. נקודת השבת x* = 0.739085. השגיאה |x₅ − x*| = 0.054395. q = 0.841471. החסם האפריורי: 2.66126. החסם האפוסטריורי: 0.738823.',
    );
  });
});
