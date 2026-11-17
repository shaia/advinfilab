/**
 * src/math/pathlimit.ts, filed by accuracy category. Each test is named after the claim it checks.
 * The closed forms are the ones lesson 5.1 prints (טענות 5.1.8–5.1.11); evaluations at small t and dense scans of a
 * circle cross-check them. A finite number of paths or radii is evidence, never a proof: the limits are proved in the
 * lesson.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import {
  PRESETS,
  PRESET_IDS,
  alphaConst,
  gamma,
  parabolaOnCircle,
  pathThrough,
  pathValue,
  type Path,
  type Side,
} from '~/math/pathlimit';

const line = (m: number, side: Side = 1): Path => ({ kind: 'line', m, k: 0, side });
const parabola = (k: number, side: Side = 1): Path => ({ kind: 'parabola', m: 0, k, side });

/**
 * max over the circle of radius ρ of |f|: the best of N equally spaced angles, then a golden-section search on the
 * two grid cells around it (the sup is at a smooth interior maximum of θ ↦ |f|, so the search converges to it).
 */
function scanCircle(f: (x: number, y: number) => number, rho: number, N = 20_000): number {
  const g = (th: number) => Math.abs(f(rho * Math.cos(th), rho * Math.sin(th)));
  const h = (2 * Math.PI) / N;
  let iBest = 0;
  for (let i = 1; i < N; i++) if (g(i * h) > g(iBest * h)) iBest = i;
  let lo = (iBest - 1) * h;
  let hi = (iBest + 1) * h;
  const r = (Math.sqrt(5) - 1) / 2;
  for (let it = 0; it < 200; it++) {
    const a = hi - r * (hi - lo);
    const b = lo + r * (hi - lo);
    if (g(a) < g(b)) lo = a;
    else hi = b;
  }
  return Math.max(g(iBest * h), g((lo + hi) / 2));
}

describe('exact identities: the values the lesson quotes', () => {
  it('xy/(x²+y²) is constant m/(1+m²) on the line y = mx (טענה 5.1.8(א)); y = 2x gives 0.4', () => {
    const f = PRESETS.xy;
    for (const m of [-3, -0.5, 0, 0.5, 1, 2, 5])
      for (const t of [0.9, 0.3, 1e-3])
        for (const side of [1, -1] as Side[]) expect(Math.abs(pathValue(f, line(m, side), t, 1) - m / (1 + m * m))).toBeLessThan(1e-12);
    expect(relativeError(f.pathLimit(line(2), 1), 0.4)).toBeLessThan(1e-15);
    expect(relativeError(f.pathLimit(line(0.5), 1), 0.4)).toBeLessThan(1e-15);
  });

  it('x²y/(x⁴+y²) is constant k/(1+k²) on y = kx² (טענה 5.1.8(ב)); ½ on y = x²', () => {
    const g = PRESETS.parab;
    for (const k of [-2, -1, 0.5, 1, 3])
      for (const t of [0.8, 0.1, 1e-3]) expect(Math.abs(pathValue(g, parabola(k), t, 1) - k / (1 + k * k))).toBeLessThan(1e-12);
    expect(g.pathLimit(parabola(1), 1)).toBe(0.5);
  });

  it('|x|^α y/(x²+y²) with α = 1 is ±½ on y = x (טענה 5.1.11)', () => {
    const fa = PRESETS.alpha;
    for (const t of [0.5, 1e-4]) {
      expect(relativeError(pathValue(fa, line(1, 1), t, 1), 0.5)).toBeLessThan(1e-12);
      expect(relativeError(pathValue(fa, line(1, -1), t, 1), -0.5)).toBeLessThan(1e-12);
    }
  });

  it('M(α) = α^{α/2}/(1+α)^{(1+α)/2}: M(1) = ½, M(2) = 2/3^{3/2}', () => {
    expect(relativeError(alphaConst(1), 0.5)).toBeLessThan(1e-15);
    expect(relativeError(alphaConst(2), 2 / 3 ** 1.5)).toBeLessThan(1e-15);
  });

  it('the point of y = x² on the circle of radius ρ lies on both curves', () => {
    for (const rho of [1, 0.3, 1e-3]) {
      const [x, y] = parabolaOnCircle(rho);
      expect(relativeError(y, x * x)).toBeLessThan(1e-15);
      expect(relativeError(Math.hypot(x, y), rho)).toBeLessThan(1e-12);
    }
  });

  it('γ(t) is on its curve and on the chosen side, and pathThrough recovers m and k from a point', () => {
    const [x1, y1] = gamma(line(-2, -1), 0.25);
    expect([x1, y1]).toEqual([-0.25, 0.5]);
    const [x2, y2] = gamma(parabola(3, -1), 0.5);
    expect([x2, y2]).toEqual([-0.5, 0.75]);
    expect(pathThrough('line', 0.5, 1)).toEqual({ kind: 'line', side: 1, m: 2, k: 0 });
    expect(pathThrough('parabola', -0.5, 0.25)).toEqual({ kind: 'parabola', side: -1, m: 0, k: 1 });
    expect(pathThrough('line', 0.01, 1).m).toBe(5);
  });
});

describe('analytic limits: the limit along each path, against f(γ(t)) at small t', () => {
  const paths: Path[] = [line(0), line(1), line(-2, -1), line(0.5, -1), parabola(1), parabola(-2, -1), parabola(0.5)];

  it('the closed-form path limits of xy, x²y/(x⁴+y²), x³ and x²y² agree with f(γ(10⁻⁶)) to 10⁻⁵', () => {
    for (const id of ['xy', 'parab', 'x3', 'x2y2'] as const)
      for (const p of paths) {
        const pr = PRESETS[id];
        expect(Math.abs(pathValue(pr, p, 1e-6, 1) - pr.pathLimit(p, 1))).toBeLessThan(1e-5);
      }
  });

  it('x²y/(x⁴+y²) tends to 0 along every line, although its sup on every circle is ½ (טענה 5.1.10)', () => {
    const g = PRESETS.parab;
    for (const m of [-5, -1, -0.05, 0.05, 1, 5]) {
      expect(g.pathLimit(line(m), 1)).toBe(0);
      expect(Math.abs(pathValue(g, line(m), 1e-7, 1))).toBeLessThan(1e-5);
    }
  });

  it('f_α: limit 0 on every path for α > 1; ±½-type constants for α = 1; ±∞ on y = x for α < 1', () => {
    const fa = PRESETS.alpha;
    for (const p of paths) expect(fa.pathLimit(p, 1.5)).toBe(0);
    expect(fa.pathLimit(line(1), 1)).toBe(0.5);
    expect(fa.pathLimit(line(1, -1), 1)).toBe(-0.5);
    expect(fa.pathLimit(line(1), 0.5)).toBe(Infinity);
    expect(fa.pathLimit(line(1, -1), 0.5)).toBe(-Infinity);
    // α = 1/2 on y = x, x > 0: f = ½ x^{−1/2}, which at x = 10⁻⁶ is 500
    expect(relativeError(pathValue(fa, line(1), 1e-6, 0.5), 500)).toBeLessThan(1e-9);
    // on y = kx² the value is k t^α/(1 + k²t²) exactly, which → 0 for every α > 0
    for (const a of [0.5, 1, 2])
      for (const t of [0.5, 1e-6]) expect(relativeError(pathValue(fa, parabola(2), t, a), (2 * t ** a) / (1 + 4 * t * t))).toBeLessThan(1e-12);
  });
});

describe('convergence: the sup on a circle, closed form against a dense scan', () => {
  it('S(ρ) for all five presets matches a refined scan of the circle to 10⁻¹⁰ (relative), and is attained', () => {
    for (const id of PRESET_IDS)
      for (const a of id === 'alpha' ? [0.5, 1, 1.5, 3] : [1])
        for (const rho of [1, 0.4, 0.05]) {
          const pr = PRESETS[id];
          const f = (x: number, y: number) => pr.f(x, y, a);
          const S = pr.circleSup(rho, a);
          expect(relativeError(scanCircle(f, rho), S)).toBeLessThan(1e-10);
          const [x, y] = pr.circleArgmax(rho, a);
          expect(relativeError(Math.hypot(x, y), rho)).toBeLessThan(1e-12);
          expect(relativeError(Math.abs(f(x, y)), S)).toBeLessThan(1e-12);
        }
  });

  it('S(ρ) → 0 for x³, x²y² and f_α with α > 1; S(ρ) = ½ for every ρ for xy and x²y/(x⁴+y²)', () => {
    expect(PRESETS.x3.circleSup(0.04, 1)).toBeLessThan(0.05);
    expect(PRESETS.x2y2.circleSup(0.1, 1)).toBeCloseTo(0.0025, 15);
    expect(PRESETS.alpha.circleSup(0.1, 2)).toBeLessThan(0.05);
    expect(PRESETS.alpha.circleSup(1e-6, 1)).toBe(0.5);
    for (const rho of [1, 1e-3, 1e-9]) {
      expect(PRESETS.xy.circleSup(rho, 1)).toBe(0.5);
      expect(PRESETS.parab.circleSup(rho, 1)).toBe(0.5);
    }
  });
});
