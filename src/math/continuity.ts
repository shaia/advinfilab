/**
 * MODEL SPECIFICATION
 *
 * System:        four functions f: ℝ → ℝ with the usual metric on both sides (the presets of lesson 1.6's
 *                figure), and the ratios between the 1-, 2- and ∞-norms on ℝ².
 * Dynamics:      none; closed formulas.
 * Boundary:      δ*(a, ε) is the largest δ with |f(x) − f(a)| < ε for every |x − a| < δ, i.e. the supremum of the
 *                δ that work; because the δ-interval is open, δ works iff δ ≤ δ*(a, ε). Each preset carries its own
 *                formula, derived in the comment beside it (no search):
 *                  line   f = 2x          δ* = ε/2
 *                  square f = x²          δ* = √(a² + ε) − |a|
 *                  sqrt   f = √|x|        δ* = 2ε√|a| − ε² if √|a| ≥ ε, else 2ε√|a| + ε²
 *                  jump   f = 0 (x<0), 1 (x≥0)   δ* = |a| if ε ≤ 1 (so 0 at a = 0), +∞ if ε > 1
 *                The uniform δ on the window |a| ≤ W is inf over a of δ*(a, ε): ε/2, √(W² + ε) − W, ε², 0 (the √|x|
 *                infimum ε² is reached at a = 0, so it holds for every W ≥ 0).
 *                normRatio(p, q) = max over v ≠ 0 of ‖v‖_p / ‖v‖_q on ℝ²: 2^(1/p − 1/q) when p < q, else 1, so
 *                ‖v‖_p ≤ normRatio(p, q)·‖v‖_q, with equality at (1, 1) or at (1, 0).
 * Ignored:       IEEE rounding (formulas are evaluated in double precision).
 * Valid when:    ε > 0, W ≥ 0.
 * Failure modes: none for the stated presets; another function needs its own derivation.
 *
 * The figure EpsDelta draws from here. Tests check every formula against brute-force sampling (evidence),
 * and the lesson proves the claims the figure illustrates.
 */

export type PresetId = 'line' | 'square' | 'sqrt' | 'jump';

export interface Preset {
  f: (x: number) => number;
  /** the largest δ that works at a for ε */
  deltaStar: (a: number, eps: number) => number;
  /** the largest δ that works at every a with |a| ≤ W */
  uniformDelta: (eps: number, W: number) => number;
}

export const PRESETS: Record<PresetId, Preset> = {
  // |2x − 2a| < ε ⟺ |x − a| < ε/2
  line: { f: (x) => 2 * x, deltaStar: (_a, e) => e / 2, uniformDelta: (e) => e / 2 },
  // the worst x in (a − δ, a + δ) is |a| + δ: the rise (|a| + δ)² − a² = 2|a|δ + δ² always beats the drop toward 0,
  // which is min(2|a|δ − δ², a²); (|a| + δ)² − a² = ε gives δ; it decreases in |a|, so the window's edge gives the
  // uniform δ
  square: {
    f: (x) => x * x,
    deltaStar: (a, e) => Math.sqrt(a * a + e) - Math.abs(a),
    uniformDelta: (e, W) => Math.sqrt(W * W + e) - W,
  },
  // with s = √|a|: moving away from 0 raises √|x| to s + ε at |x| = (s + ε)², distance 2εs + ε²; moving toward 0
  // drops it to s − ε at |x| = (s − ε)², distance 2εs − ε², possible only when s ≥ ε (else the drop stops at 0,
  // short of ε, and past 0 the value rises again, reaching s + ε only farther away); the minimum over a of the
  // resulting δ* is ε², at a = 0 and at |a| = ε²
  sqrt: {
    f: (x) => Math.sqrt(Math.abs(x)),
    deltaStar: (a, e) => {
      const s = Math.sqrt(Math.abs(a));
      return s >= e ? 2 * e * s - e * e : 2 * e * s + e * e;
    },
    uniformDelta: (e) => e * e,
  },
  // a jump of height 1 at 0: an interval around a ≠ 0 is fine until it reaches the other side of 0 (0 itself
  // belongs to the right side); at a = 0 every interval contains negative x, where f differs by 1
  jump: {
    f: (x) => (x < 0 ? 0 : 1),
    deltaStar: (a, e) => (e > 1 ? Infinity : Math.abs(a)),
    uniformDelta: (e) => (e > 1 ? Infinity : 0),
  },
};

/** Does δ work at a: f((a − δ, a + δ)) ⊆ (f(a) − ε, f(a) + ε)? (1e-12 slack for a δ that equals δ* on the grid.) */
export const deltaWorks = (id: PresetId, a: number, eps: number, delta: number): boolean =>
  delta <= PRESETS[id].deltaStar(a, eps) + 1e-12;

export type NormP = 1 | 2 | typeof Infinity;

/** max ‖v‖_p / ‖v‖_q over v ≠ 0 in ℝ²: the constant C in ‖v‖_p ≤ C‖v‖_q. */
export function normRatio(p: NormP, q: NormP): number {
  if (p >= q) return 1;
  const ip = 1 / p;
  const iq = q === Infinity ? 0 : 1 / q;
  return 2 ** (ip - iq);
}

/**
 * B_q(x, ρ) ⊆ B_p(x, r) iff ρ·normRatio(p, q) ≤ r: a point at q-distance < ρ is at p-distance < C·ρ ≤ r, and the
 * extremal direction of the ratio, scaled to q-length just under ρ, reaches p-length just under C·ρ.
 */
export const innerFits = (p: NormP, r: number, q: NormP, rho: number): boolean => rho * normRatio(p, q) <= r + 1e-12;
