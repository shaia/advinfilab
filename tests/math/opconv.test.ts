/**
 * src/math/opconv.ts, filed by accuracy category. Each test is named after the claim it checks.
 */

import { describe, expect, it } from 'vitest';
import { relativeError } from '~/math/analysis';
import { opNorm } from '~/math/multivar';
import type { P } from '~/math/opnorm2d';
import {
  CONVERGES,
  FNS,
  Tk,
  entryErr,
  errNorm,
  seqMatrix,
  seqTarget,
  tailStart,
  witness,
  witnessSup,
  type FnId,
  type SeqId,
} from '~/math/opconv';

const PS: P[] = [1, 2, Infinity];
const KS = Array.from({ length: 60 }, (_, i) => i + 1);

describe('exact identities (closed forms against opNorm)', () => {
  it('shear and scale: ‖A_k − A‖_p = 1/k for p = 1, 2, ∞', () => {
    for (const seq of ['shear', 'scale'] as SeqId[])
      for (const p of PS) for (const k of KS) expect(relativeError(errNorm(seq, k, p), 1 / k)).toBeLessThan(1e-13);
  });

  it('rot: ‖A_k − I‖₂ = 2 sin(1/(2k)) and ‖A_k − I‖₁ = ‖A_k − I‖∞ = 1 − cos(1/k) + sin(1/k)', () => {
    for (const k of KS) {
      // 2 − 2cos θ loses digits to cancellation for small θ; the half-angle form 2 sin(θ/2) does not, so the
      // tolerance is the cancellation's: about 1e-16 / θ² relative, under 1e-11 for θ ≥ 1/60
      expect(relativeError(errNorm('rot', k, 2), 2 * Math.sin(1 / (2 * k)))).toBeLessThan(1e-11);
      const t = 1 / k;
      const one = 1 - Math.cos(t) + Math.sin(t);
      expect(relativeError(errNorm('rot', k, 1), one)).toBeLessThan(1e-13);
      expect(relativeError(errNorm('rot', k, Infinity), one)).toBeLessThan(1e-13);
    }
  });

  it('flip: ‖A_k − I‖_p = 2 for odd k and 0 for even k, while ‖A_k‖_p = ‖I‖_p = 1 for every k', () => {
    for (const p of PS)
      for (const k of KS) {
        const e = errNorm('flip', k, p);
        if (k % 2 === 1) expect(relativeError(e, 2)).toBeLessThan(1e-13);
        // A_k − I is the zero matrix for even k: every entry is 1 − 1 = 0 exactly in floating point
        else expect(e).toBe(0);
        expect(relativeError(opNorm(seqMatrix('flip', k), p), 1)).toBeLessThan(1e-13);
        expect(relativeError(opNorm(seqTarget('flip'), p), 1)).toBeLessThan(1e-13);
      }
  });

  it('the largest entry |a_ij^(k) − a_ij| is 1/k (shear, scale), sin(1/k) (rot) and 2 or 0 (flip)', () => {
    for (const k of KS) {
      expect(relativeError(entryErr('shear', k), 1 / k)).toBeLessThan(1e-13);
      expect(relativeError(entryErr('scale', k), 1 / k)).toBeLessThan(1e-13);
      // sin θ > 1 − cos θ on (0, 1], so the off-diagonal entry is the largest
      expect(relativeError(entryErr('rot', k), Math.sin(1 / k))).toBeLessThan(1e-13);
      expect(entryErr('flip', k)).toBe(k % 2 ? 2 : 0);
    }
  });

  it('the entry error and the operator norm of the error bound each other: max|e_ij| ≤ ‖E‖_p ≤ 2·max|e_ij| on 2×2', () => {
    for (const seq of ['shear', 'rot', 'scale', 'flip'] as SeqId[])
      for (const p of PS)
        for (const k of KS) {
          const m = entryErr(seq, k);
          const n = errNorm(seq, k, p);
          expect(m).toBeLessThanOrEqual(n * (1 + 1e-12));
          expect(n).toBeLessThanOrEqual(2 * m * (1 + 1e-12));
        }
  });

  it('the witness g_k is −1 at 0 and 1 at 1/k, so T_k g_k = 2, and ‖g_k‖∞ = 1', () => {
    for (const k of KS) {
      const g = witness(k);
      expect(g(0)).toBe(-1);
      expect(g(1 / k)).toBe(1);
      expect(g(1)).toBe(1);
      expect(Tk(g, k)).toBe(2);
      expect(witnessSup(k)).toBe(1);
    }
  });

  it('T_k on the sample functions: 1/√k, cos(3/k) − 1, 1/k², sin(π/k), and T_1 of sin πx is exactly 0', () => {
    const closed: Record<FnId, (k: number) => number> = {
      sqrt: (k) => 1 / Math.sqrt(k),
      cos3: (k) => Math.cos(3 / k) - 1,
      x2: (k) => 1 / (k * k),
      sinpi: (k) => Math.sin(Math.PI / k),
    };
    for (const id of Object.keys(FNS) as FnId[])
      for (const k of KS.slice(1)) expect(relativeError(Tk(FNS[id], k), closed[id](k))).toBeLessThan(1e-13);
    expect(Tk(FNS.sinpi, 1)).toBe(0);
    expect(relativeError(Tk(FNS.cos3, 1), Math.cos(3) - 1)).toBeLessThan(1e-15);
  });
});

describe('analytic limits (evidence for the limits the lesson proves)', () => {
  it('each convergent sequence has ‖A_k − A‖_p decreasing in k and ≤ 1.5/k, so it tends to 0', () => {
    for (const seq of (['shear', 'rot', 'scale'] as SeqId[]).filter((s) => CONVERGES[s]))
      for (const p of PS) {
        for (const k of KS.slice(1)) expect(errNorm(seq, k, p)).toBeLessThan(errNorm(seq, k - 1, p));
        // ‖A_k − A‖ ≤ C/k: 1 − cos θ + sin θ ≤ θ²/2 + θ ≤ 1.5θ, and 2 sin(θ/2) ≤ θ
        for (const k of KS) expect(errNorm(seq, k, p) * k).toBeLessThan(1.5);
        expect(errNorm(seq, 10 ** 6, p)).toBeLessThan(1.5e-6);
      }
  });

  it('the flip sequence has no limit: ‖A_k − A_{k+1}‖_p = 2 for every k (not even Cauchy)', () => {
    for (const p of PS)
      for (const k of KS) {
        const A = seqMatrix('flip', k);
        const B = seqMatrix('flip', k + 1);
        expect(opNorm([[A[0][0] - B[0][0], A[0][1] - B[0][1]], [A[1][0] - B[1][0], A[1][1] - B[1][1]]], p)).toBe(2);
      }
  });

  it('T_k f → 0 for each sample function, and |T_k f| decreases in k (from k = 2 for sin πx)', () => {
    for (const id of Object.keys(FNS) as FnId[]) {
      const from = id === 'sinpi' ? 3 : 2;
      for (let k = from; k <= 200; k++) expect(Math.abs(Tk(FNS[id], k))).toBeLessThan(Math.abs(Tk(FNS[id], k - 1)));
      expect(Math.abs(Tk(FNS[id], 10 ** 6))).toBeLessThan(1.1e-3);
    }
  });

  it('|T_k f| ≤ 2‖f‖∞ on the samples, with ‖f‖∞ ≤ 1 on [0,1]: the bound ‖T_k‖ ≤ 2 that the witness attains', () => {
    for (const id of Object.keys(FNS) as FnId[]) for (const k of KS) expect(Math.abs(Tk(FNS[id], k))).toBeLessThanOrEqual(2);
  });

  it('the witness is continuous at its kink: |g_k(1/k ± h) − 1| ≤ 2kh', () => {
    for (const k of KS) {
      const g = witness(k);
      for (const h of [1e-3, 1e-6, 1e-9]) {
        expect(Math.abs(g(1 / k - h) - 1)).toBeLessThanOrEqual(2 * k * h * (1 + 1e-6) + 1e-12);
        expect(g(1 / k + h)).toBe(1);
      }
    }
  });
});

describe('the first k below ε (the task thresholds at the default ε = 0.2)', () => {
  it('shear and scale enter at k = 6 (1/k < 0.2 ⇔ k > 5; at k = 5 it is a tie, not below)', () => {
    for (const p of PS) {
      expect(tailStart((k) => errNorm('shear', k, p), 0.2)).toBe(6);
      expect(tailStart((k) => errNorm('scale', k, p), 0.2)).toBe(6);
    }
  });

  it('rot enters at k = 5 in the 2-norm (2 sin(1/10) = 0.19967 < 0.2 < 2 sin(1/8) = 0.24935) and at k = 6 in the 1- and ∞-norms', () => {
    expect(tailStart((k) => errNorm('rot', k, 2), 0.2)).toBe(5);
    expect(relativeError(errNorm('rot', 5, 2), 2 * Math.sin(0.1))).toBeLessThan(1e-11);
    expect(tailStart((k) => errNorm('rot', k, 1), 0.2)).toBe(6);
    expect(tailStart((k) => errNorm('rot', k, Infinity), 0.2)).toBe(6);
  });

  it('flip has no tail below ε < 2: every window [K, K′] with K′ odd contains a k with ‖A_k − I‖ = 2', () => {
    for (const p of PS)
      for (const kMax of [1, 3, 59, 61]) {
        expect(tailStart((k) => errNorm('flip', k, p), 0.2, kMax)).toBeNull();
        expect(tailStart((k) => errNorm('flip', k, p), 1.95, kMax)).toBeNull();
      }
  });

  it('T_k f enters |·| < 0.2 at k = 26 (√x), 5 (cos 3x), 3 (x²), 16 (sin πx)', () => {
    const at = (id: FnId) => tailStart((k) => Math.abs(Tk(FNS[id], k)), 0.2);
    expect(at('sqrt')).toBe(26);
    expect(at('cos3')).toBe(5);
    expect(at('x2')).toBe(3);
    expect(at('sinpi')).toBe(16);
  });

  it('sin πx at k = 1 is below every ε yet is not the tail: T_2 = 1', () => {
    expect(tailStart((k) => Math.abs(Tk(FNS.sinpi, k)), 0.5)).toBe(7);
  });

  it('√x needs k > 1/ε²: unreachable within k ≤ 60 for ε ≤ 0.1, reached at k = 17 for ε = 0.25', () => {
    expect(tailStart((k) => Math.abs(Tk(FNS.sqrt, k)), 0.1)).toBeNull();
    expect(tailStart((k) => Math.abs(Tk(FNS.sqrt, k)), 0.25)).toBe(17);
  });
});
