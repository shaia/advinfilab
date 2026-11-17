/**
 * src/math/tangent.ts, filed by accuracy category. Each test is named after the claim it checks.
 * The closed forms are the ones lesson 5.3 proves (טענה 5.3.9 and the Explore); direct evaluation of
 * f(a + h) − f(a) − T·h cross-checks them. A scan over directions is a probe, never a proof.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import {
  CUBIC_SUP,
  CUBIC_WORST,
  PRESETS,
  PRESET_IDS,
  angleGap,
  circleSupScan,
  deg,
  parabolaSin,
  ratio,
  ratioGrid,
  ratioPolar,
  remainder,
  rhoWorks,
  zoomedGraph,
  zoomedPlane,
} from '~/math/tangent';

const RHOS = [1, 0.3, 0.05, 0.01, 0.001];
const THETAS = Array.from({ length: 37 }, (_, k) => 0.013 + (k * 2 * Math.PI) / 37);

describe('exact identities: the closed forms the lesson proves', () => {
  it('the candidate J is the pair of partial derivatives at a (difference quotients on the axes)', () => {
    for (const id of PRESET_IDS) {
      const P = PRESETS[id];
      for (const t of [1e-4, -1e-4]) {
        const d1 = (P.f(P.a[0] + t, P.a[1]) - P.fa) / t;
        const d2 = (P.f(P.a[0], P.a[1] + t) - P.fa) / t;
        expect(Math.abs(d1 - P.J[0])).toBeLessThan(1e-3);
        expect(Math.abs(d2 - P.J[1])).toBeLessThan(1e-3);
      }
    }
  });

  it('the polar ratio agrees with |f(a + h) − f(a) − T·h| / ‖h‖ for every preset (absolute 1e-9, the ratios are O(1))', () => {
    for (const id of PRESET_IDS) {
      const P = PRESETS[id];
      for (const rho of RHOS)
        for (const t of THETAS) {
          const direct = ratioPolar(P, rho, t);
          const exact = P.ratioExact(rho, t);
          expect(Math.abs(direct - exact)).toBeLessThan(1e-9 * Math.max(1, exact));
        }
    }
  });

  it('x² + y² at (1, 1): r(h) = ‖h‖², so the ratio is ‖h‖ (דוגמה 5.3.4(ג))', () => {
    const P = PRESETS.paraboloid;
    for (const [h1, h2] of [[0.3, -0.1], [1e-3, 2e-3], [-0.5, 0.5]]) {
      expect(relativeError(remainder(P, h1, h2), h1 * h1 + h2 * h2)).toBeLessThan(1e-9);
    }
  });

  it('x³/(x² + y²): r(h) = −h₁h₂²/‖h‖², and D_v f(0) = v₁³ (27/125 for v = (3/5, 4/5), not Jv = 3/5)', () => {
    const P = PRESETS.cubic;
    for (const [h1, h2] of [[0.3, -0.1], [1e-3, 2e-3], [-0.5, 0.7]]) {
      expect(relativeError(remainder(P, h1, h2), (-h1 * h2 * h2) / (h1 * h1 + h2 * h2))).toBeLessThan(1e-9);
    }
    const t = 1e-6;
    expect(relativeError(P.f(0.6 * t, 0.8 * t) / t, 27 / 125)).toBeLessThan(1e-12);
    expect(Math.abs(27 / 125 - 0.216)).toBeLessThan(1e-15);
  });

  it('√|xy| on the diagonal: |r(t, t)| / ‖(t, t)‖₂ = 1/√2 for every t ≠ 0 (טענה 5.3.9(א))', () => {
    const P = PRESETS.sqrt;
    for (const t of [1, 0.1, -0.003, 1e-6]) expect(relativeError(ratio(P, t, t), Math.SQRT1_2)).toBeLessThan(1e-12);
  });

  it('x²y²/(x² + y²): |r(h)| ≤ ‖h‖²/4, with equality on the diagonals, so the ratio is at most ρ/4 (טענה 5.3.9(ה))', () => {
    const P = PRESETS.square;
    for (const rho of RHOS)
      for (const t of THETAS) expect(Math.abs(remainder(P, rho * Math.cos(t), rho * Math.sin(t)))).toBeLessThanOrEqual((rho ** 2 / 4) * (1 + 1e-12));
    expect(relativeError(ratioPolar(P, 0.2, Math.PI / 4), 0.05)).toBeLessThan(1e-12);
  });

  it('x²y/(x⁴ + y²) equals 1/2 on the parabola y = x², x ≠ 0 (טענה 5.1.8(ב))', () => {
    const P = PRESETS.parabola;
    for (const x of [1, 0.2, -0.01, 1e-4]) expect(relativeError(P.f(x, x * x), 0.5)).toBeLessThan(1e-12);
  });

  it('the sup on the circle is attained in the stated directions and nowhere larger (a scan of 7200 directions)', () => {
    for (const id of PRESET_IDS) {
      const P = PRESETS[id];
      for (const rho of RHOS) {
        const S = P.circleSup(rho);
        const ws = P.worst(rho) ?? [0.7];
        for (const w of ws) expect(relativeError(P.ratioExact(rho, w), S)).toBeLessThan(1e-12);
        const scan = circleSupScan(P, rho);
        expect(scan.sup).toBeLessThanOrEqual(S * (1 + 1e-9));
        // the parabola's peak has angular width about ρ: the scan of step 0.05° resolves it from ρ = 0.01 up
        if (!(id === 'parabola' && rho < 0.01)) expect(relativeError(scan.sup, S)).toBeLessThan(2e-3);
      }
    }
  });

  it('x³/(x² + y²): the worst direction has cos²θ = 1/3 (θ ≈ 54.74°) and the ratio there is 2/(3√3) ≈ 0.3849', () => {
    expect(relativeError(Math.cos(CUBIC_WORST) ** 2, 1 / 3)).toBeLessThan(1e-12);
    expect(Math.abs(deg(CUBIC_WORST) - 54.7356)).toBeLessThan(1e-4);
    expect(Math.abs(CUBIC_SUP - 0.3849)).toBeLessThan(1e-4);
  });

  it('x²y/(x⁴ + y²): the worst direction on the circle of radius ρ lies on the parabola |y| = x²', () => {
    for (const rho of RHOS) {
      const s = parabolaSin(rho);
      const c = Math.sqrt(1 - s * s);
      expect(relativeError(rho * s, (rho * c) ** 2)).toBeLessThan(1e-12);
    }
  });

  it('the grid of the 2D view is NaN outside the unit disk and the direct ratio inside', () => {
    const P = PRESETS.cubic;
    const n = 20;
    const g = ratioGrid(P, 0.5, n);
    expect(Number.isNaN(g[0])).toBe(true);
    const i = 13;
    const j = 7;
    const u1 = -1 + (2 * (i + 0.5)) / n;
    const u2 = 1 - (2 * (j + 0.5)) / n;
    expect(g[j * n + i]).toBe(ratio(P, 0.5 * u1, 0.5 * u2));
  });

  it('angle helpers: degrees wrap to [0, 360) and the gap is the short way round', () => {
    expect(deg(-Math.PI / 2)).toBeCloseTo(270, 12);
    expect(angleGap(359, 1)).toBeCloseTo(2, 12);
    expect(angleGap(54.7, 125.3)).toBeCloseTo(70.6, 9);
  });
});

describe('analytic limits: what zooming in shows', () => {
  it('differentiable presets: S(ρ) → 0 (ρ for x² + y², ρ/4 for x²y²/(x² + y²)), and ρ works as δ once ρ < ε (resp. 4ε)', () => {
    expect(PRESETS.paraboloid.circleSup(0.01)).toBe(0.01);
    expect(PRESETS.square.circleSup(0.04)).toBe(0.01);
    expect(rhoWorks(PRESETS.paraboloid, 0.049, 0.05)).toBe(true);
    expect(rhoWorks(PRESETS.paraboloid, 0.05, 0.05)).toBe(false);
    expect(rhoWorks(PRESETS.square, 0.039, 0.01)).toBe(true);
  });

  it('degree-1 homogeneous presets (√|xy|, x³/(x² + y²)): the ratio does not depend on ρ, so no ρ works for ε below its sup', () => {
    for (const id of ['sqrt', 'cubic'] as const) {
      const P = PRESETS[id];
      for (const t of THETAS) expect(relativeError(ratioPolar(P, 1, t), ratioPolar(P, 0.001, t))).toBeLessThan(1e-9);
      for (const rho of RHOS) expect(rhoWorks(P, rho, 0.38)).toBe(false);
    }
  });

  it('x²y/(x⁴ + y²): S(ρ) = 1/(2ρ) grows without bound, 10 at ρ = 0.05; the ratio exceeds 5 at θ = 3° there', () => {
    const P = PRESETS.parabola;
    expect(P.circleSup(0.05)).toBeCloseTo(10, 12);
    expect(P.ratioExact(0.05, (3 * Math.PI) / 180)).toBeGreaterThan(5);
    expect(P.ratioExact(0.05, (12 * Math.PI) / 180)).toBeLessThan(5);
    expect(rhoWorks(P, 0.001, 1e6)).toBe(false);
  });

  it('the zoomed graph minus the plane is r(ρu)/ρ, bounded by the disk sup D(ρ): it tends to 0 exactly for the differentiable presets', () => {
    for (const id of PRESET_IDS) {
      const P = PRESETS[id];
      for (const rho of [0.5, 0.01])
        for (const [u1, u2] of [[0.6, 0.8], [-0.3, 0.2], [0.05, -0.9]]) {
          const gap = zoomedGraph(P, rho, u1, u2) - zoomedPlane(P, u1, u2);
          expect(Math.abs(gap - remainder(P, rho * u1, rho * u2) / rho)).toBeLessThan(1e-9);
          expect(Math.abs(gap)).toBeLessThanOrEqual(P.diskSup(rho) * Math.hypot(u1, u2) + 1e-9);
        }
    }
    // degree-1 homogeneous: the zoomed picture is the same at every zoom
    for (const id of ['sqrt', 'cubic'] as const) {
      const P = PRESETS[id];
      expect(Math.abs(zoomedGraph(P, 1, 0.3, -0.7) - zoomedGraph(P, 0.001, 0.3, -0.7))).toBeLessThan(1e-12);
    }
  });
});

describe('convergence: task thresholds the figure checks', () => {
  it('x³/(x² + y²): within 3° of the worst direction the ratio is at least 0.99 of the sup, and 6° away it is not', () => {
    const P = PRESETS.cubic;
    for (const d of [-3, 3]) expect(P.ratioExact(1, CUBIC_WORST + (d * Math.PI) / 180)).toBeGreaterThan(0.99 * CUBIC_SUP);
    for (const d of [-6, 6]) expect(P.ratioExact(1, CUBIC_WORST + (d * Math.PI) / 180)).toBeLessThan(0.99 * CUBIC_SUP);
  });

  it('√|xy|: within 5° of 45° the ratio is at least 0.99 of 1/√2, and 8° away it is not', () => {
    const P = PRESETS.sqrt;
    for (const d of [40, 50]) expect(P.ratioExact(1, (d * Math.PI) / 180)).toBeGreaterThan(0.99 * Math.SQRT1_2);
    for (const d of [37, 53]) expect(P.ratioExact(1, (d * Math.PI) / 180)).toBeLessThan(0.99 * Math.SQRT1_2);
  });
});
