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
 *
 *                Lesson 3.4 (uniform continuity on a compact interval and its failure) adds four functions, each
 *                restricted to a closed bounded interval D that depends on one parameter. Here δ*_D(a, ε) is the
 *                largest δ with |f(x) − f(a)| < ε for every x ∈ D with |x − a| < δ, i.e. the distance from a to the
 *                nearest x ∈ D with |f(x) − f(a)| ≥ ε (that set is closed in the compact D, so the nearest point
 *                exists and is the witness the figure draws; +∞ when the set is empty). The uniform δ on D is
 *                inf over a ∈ D of δ*_D(a, ε) = inf{|x − y| : x, y ∈ D, |f(x) − f(y)| ≥ ε}.
 *                  recip     f = 1/x on [c, 1]     bad set left of a: x ≤ a/(1 + aε); right: x ≥ a/(1 − aε) (aε < 1)
 *                            uniform δ = c²ε/(1 − cε) when 1/c − 1 ≥ ε, else +∞ (reached at a = c and at
 *                            a = c/(1 − cε), both witnesses at the same distance)
 *                  sqrtc     f = √x on [c, 1]      with s = √a: left x ≤ (s − ε)² (s ≥ ε), right x ≥ (s + ε)²
 *                            uniform δ = 2ε√c + ε² when √c + ε ≤ 1, else +∞; → ε² as c → 0 (√x stays uniformly
 *                            continuous on (0, 1])
 *                  squareW   f = x² on [−W, W]     for a ≥ 0: x ≥ √(a² + ε) or |x| ≤ √(a² − ε) (a² ≥ ε); a < 0 by
 *                            symmetry; uniform δ = W − √(W² − ε) = ε/(W + √(W² − ε)) when W² ≥ ε, else +∞
 *                            (reached at a = ±W); → 0 as W → ∞
 *                  sinrecip  f = sin(1/x) on [c, 1]  in u = 1/x ∈ [1, 1/c], the bad set {sin u ≥ s + ε} ∪
 *                            {sin u ≤ s − ε} (s = sin(1/a)) is a periodic union of closed intervals with endpoints
 *                            from arcsin: the nearest endpoint on each side is found in closed form. The uniform δ
 *                            has no closed form: it is the minimum of δ* over 4000 values of a evenly spaced in u,
 *                            refined around the best one (an upper estimate of the infimum, checked in the tests
 *                            against a brute-force search over pairs).
 * Ignored:       IEEE rounding (formulas are evaluated in double precision).
 * Valid when:    ε > 0, W ≥ 0; for lesson 3.4, 0 < c < 1 (sqrtc also c = 0) and W > 0.
 * Failure modes: none for the stated presets; another function needs its own derivation. The sampled uniform δ of
 *                sinrecip can exceed the true infimum by a little; the figure says it is a probe.
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

/* ------------------------------------------------------------------ lesson 3.4: f restricted to a compact D */

export type DomainPresetId = 'recip' | 'sinrecip' | 'sqrtc' | 'squareW';

/** The nearest x ∈ D with |f(x) − f(a)| ≥ ε, and its distance δ*_D(a, ε) (dist = +∞, x = null when there is none). */
export interface NearestBad {
  dist: number;
  x: number | null;
}

export interface DomainPreset {
  f: (x: number) => number;
  /** which parameter fixes the domain: the left end c of [c, 1], or the half-width W of [−W, W] */
  param: 'c' | 'W';
  domain: (p: number) => [number, number];
  nearestBad: (a: number, eps: number, p: number) => NearestBad;
  /** inf over a ∈ D of δ*_D(a, ε): the largest δ that works at every point of D */
  uniformDelta: (eps: number, p: number) => number;
}

const NONE: NearestBad = { dist: Infinity, x: null };
const closer = (a: number, ...xs: (number | null)[]): NearestBad => {
  let best = NONE;
  for (const x of xs) if (x !== null && Math.abs(x - a) < best.dist) best = { dist: Math.abs(x - a), x };
  return best;
};

/** 1/x on [c, 1] */
const recip: DomainPreset = {
  f: (x) => 1 / x,
  param: 'c',
  domain: (c) => [c, 1],
  nearestBad: (a, e, c) => {
    // f decreases: 1/x − 1/a ≥ ε ⟺ x ≤ a/(1 + aε); 1/a − 1/x ≥ ε ⟺ x ≥ a/(1 − aε), possible only when aε < 1
    const left = a / (1 + a * e);
    const right = a * e < 1 ? a / (1 - a * e) : Infinity;
    return closer(a, left >= c - 1e-15 ? left : null, right <= 1 + 1e-15 ? right : null);
  },
  uniformDelta: (e, c) => (1 / c - 1 >= e - 1e-15 ? (c * c * e) / (1 - c * e) : Infinity),
};

/** √x on [c, 1] */
const sqrtc: DomainPreset = {
  f: (x) => Math.sqrt(x),
  param: 'c',
  domain: (c) => [c, 1],
  nearestBad: (a, e, c) => {
    const s = Math.sqrt(a);
    const right = (s + e) ** 2;
    const left = s >= e ? (s - e) ** 2 : null;
    return closer(a, left !== null && left >= c - 1e-15 ? left : null, right <= 1 + 1e-15 ? right : null);
  },
  uniformDelta: (e, c) => (Math.sqrt(c) + e <= 1 + 1e-15 ? 2 * e * Math.sqrt(c) + e * e : Infinity),
};

/** x² on [−W, W] */
const squareW: DomainPreset = {
  f: (x) => x * x,
  param: 'W',
  domain: (W) => [-W, W],
  nearestBad: (a, e, W) => {
    const b = Math.abs(a);
    const sgn = a < 0 ? -1 : 1;
    const out = Math.sqrt(b * b + e);
    const inn = b * b >= e ? Math.sqrt(b * b - e) : null;
    // the far branch −sgn·√(a² + ε) is never nearer than sgn·√(a² + ε), and exists exactly when it does
    return closer(a, out <= W + 1e-15 ? sgn * out : null, inn !== null ? sgn * inn : null);
  },
  uniformDelta: (e, W) => (W * W >= e - 1e-15 ? W - Math.sqrt(Math.max(0, W * W - e)) : Infinity),
};

const TAU = 2 * Math.PI;
/** the smallest point > t of ∪_k [p + 2πk, q + 2πk] (p ≤ q < p + 2π), given that t is in none of them */
const nextStart = (t: number, p: number) => p + TAU * Math.floor((t - p) / TAU + 1);
/** the largest point < t of ∪_k [p + 2πk, q + 2πk], given that t is in none of them */
const prevEnd = (t: number, q: number) => q + TAU * Math.ceil((t - q) / TAU - 1);

/**
 * In u = 1/x: the points u ≠ uₐ with |sin u − sin uₐ| ≥ ε nearest to uₐ on each side. {sin u ≥ v} (−1 < v ≤ 1) is
 * ∪ [α + 2πk, π − α + 2πk] with α = arcsin v; {sin u ≤ w} (−1 ≤ w < 1) is ∪ [π − β + 2πk, 2π + β + 2πk] with
 * β = arcsin w. uₐ itself is in neither set, since |sin uₐ − sin uₐ| = 0 < ε.
 */
export function sinBadNeighbours(ua: number, eps: number): { above: number; below: number } {
  const s = Math.sin(ua);
  let above = Infinity;
  let below = -Infinity;
  const v = s + eps;
  if (v <= 1) {
    const al = Math.asin(v);
    above = Math.min(above, nextStart(ua, al));
    below = Math.max(below, prevEnd(ua, Math.PI - al));
  }
  const w = s - eps;
  if (w >= -1) {
    const be = Math.asin(w);
    above = Math.min(above, nextStart(ua, Math.PI - be));
    below = Math.max(below, prevEnd(ua, TAU + be));
  }
  return { above, below };
}

const sinNearest = (a: number, e: number, c: number): NearestBad => {
  const { above, below } = sinBadNeighbours(1 / a, e);
  // u above uₐ is x below a, and must stay ≤ 1/c; u below uₐ is x above a, and must stay ≥ 1
  return closer(a, above <= 1 / c + 1e-12 ? 1 / above : null, below >= 1 - 1e-12 ? 1 / below : null);
};

/** min over a of δ*_D(a, ε), sampling a evenly in u = 1/a on [1, 1/c] and refining around the best sample */
function sampledUniform(nearest: (a: number) => NearestBad, c: number, n = 4000): number {
  const U = 1 / c;
  let best = Infinity;
  let at = -1;
  for (let i = 0; i <= n; i++) {
    const d = nearest(1 / (1 + ((U - 1) * i) / n)).dist;
    if (d < best) [best, at] = [d, i];
  }
  if (at < 0) return Infinity;
  const h = (U - 1) / n;
  const u0 = 1 + (U - 1) * (at / n);
  for (let j = -200; j <= 200; j++) {
    const u = Math.min(U, Math.max(1, u0 + (h * j) / 200));
    best = Math.min(best, nearest(1 / u).dist);
  }
  return best;
}

const sinUniformCache = new Map<string, number>();
/** sin(1/x) on [c, 1] */
const sinrecip: DomainPreset = {
  f: (x) => Math.sin(1 / x),
  param: 'c',
  domain: (c) => [c, 1],
  nearestBad: sinNearest,
  uniformDelta: (e, c) => {
    const key = `${e.toFixed(6)}|${c.toFixed(6)}`;
    let v = sinUniformCache.get(key);
    if (v === undefined) {
      v = sampledUniform((a) => sinNearest(a, e, c), c);
      sinUniformCache.set(key, v);
    }
    return v;
  },
};

export const DOMAIN_PRESETS: Record<DomainPresetId, DomainPreset> = { recip, sinrecip, sqrtc, squareW };

/** Does δ work at a ∈ D: every x ∈ D with |x − a| < δ has |f(x) − f(a)| < ε? */
export const deltaWorksOn = (id: DomainPresetId, a: number, eps: number, delta: number, p: number): boolean =>
  delta <= DOMAIN_PRESETS[id].nearestBad(a, eps, p).dist + 1e-12;
