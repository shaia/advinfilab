/**
 * MODEL SPECIFICATION
 *
 * System:        the plane ℝ² with one of four metrics: d₁, d₂, d_∞ (from the 1-, 2- and ∞-norms) and the
 *                discrete metric (d(x,y) = 1 for x ≠ y). Subsets are rectangles I₁ × I₂, each Iᵢ an interval
 *                whose ends may be infinite and each finite end included or excluded, so a rectangle can be
 *                open, closed, both (the plane) or neither.
 * Dynamics:      none; these are exact formulas for balls, distances to a set and to its complement.
 * Boundary:      every function here is a closed formula, not a search: the distance from a point of a
 *                rectangle to its complement is min over i of the distance from xᵢ to the ends of Iᵢ (in every
 *                p-metric: leaving the rectangle means moving one coordinate that far, and moving only that
 *                coordinate costs exactly that much); the distance from a point outside to the rectangle is
 *                the p-norm of the coordinate gaps. In the discrete metric both are 1 (the sets are nonempty).
 * Ignored:       sets other than rectangles; IEEE rounding (inputs on the figure's 0.05 grid are compared with
 *                a 1e-12 slack where a boundary case must be exact: a point on an included edge).
 * Valid when:    the rectangle is nonempty and is not the whole plane (then the complement is empty and the
 *                distance to it is +∞, which the functions return).
 * Failure modes: none known for the stated sets; a non-rectangular set needs its own formula.
 *
 * The figures of lessons 1.3 and 1.4 (BallProbe) draw from here: which ball fits around a point, on which side,
 * and (the PlaneSet part, for 1.4) whether the point is interior, exterior or on the boundary.
 * A figure is evidence; the lemma "B(x,r) lies on x's side iff r ≤ the distance to the other side" is proved
 * in the lesson, and the tests below check the formulas against brute-force sampling.
 */

export type MetricId = 'd1' | 'd2' | 'dinf' | 'disc';
export type Pt = readonly [number, number];

/** the slack for "this coordinate is exactly on the edge" on the figure's grid */
const SLACK = 1e-12;

export function dist(m: MetricId, a: Pt, b: Pt): number {
  const dx = Math.abs(a[0] - b[0]);
  const dy = Math.abs(a[1] - b[1]);
  switch (m) {
    case 'd1':
      return dx + dy;
    case 'd2':
      return Math.hypot(dx, dy);
    case 'dinf':
      return Math.max(dx, dy);
    case 'disc':
      return dx === 0 && dy === 0 ? 0 : 1;
  }
}

/** y ∈ B(c, r), the open ball. */
export const inBall = (m: MetricId, c: Pt, r: number, y: Pt): boolean => dist(m, c, y) < r;

/** An interval with possibly infinite ends; a finite end is in the interval when its flag is true. */
export interface Interval {
  lo: number;
  hi: number;
  loIn: boolean;
  hiIn: boolean;
}

export interface Rect {
  x: Interval;
  y: Interval;
}

export function inInterval(I: Interval, t: number): boolean {
  if (t < I.lo - SLACK || t > I.hi + SLACK) return false;
  if (Math.abs(t - I.lo) <= SLACK) return I.loIn;
  if (Math.abs(t - I.hi) <= SLACK) return I.hiIn;
  return true;
}

export const inRect = (R: Rect, p: Pt): boolean => inInterval(R.x, p[0]) && inInterval(R.y, p[1]);

/** inf of |t − s| over s ∉ I, for t ∈ I: the gap to the nearer end (+∞ for I = ℝ). */
const gapOut = (I: Interval, t: number) => Math.max(0, Math.min(t - I.lo, I.hi - t));
/** inf of |t − s| over s ∈ I: 0 inside or on an end, else the gap to the nearer end. */
const gapIn = (I: Interval, t: number) => Math.max(0, I.lo - t, t - I.hi);

/**
 * The distance from p to the other side: to the complement when p ∈ R, to R when p ∉ R. This is the
 * largest r with B(p, r) on p's side (the open ball of radius exactly this distance still fits).
 */
export function distToOtherSide(m: MetricId, R: Rect, p: Pt): number {
  const inside = inRect(R, p);
  if (m === 'disc') {
    // the other side is nonempty unless R is the plane: every other point is at distance 1
    const whole = inside && R.x.lo === -Infinity && R.x.hi === Infinity && R.y.lo === -Infinity && R.y.hi === Infinity;
    return whole ? Infinity : 1;
  }
  if (inside) {
    const g = Math.min(gapOut(R.x, p[0]), gapOut(R.y, p[1]));
    return g <= SLACK ? 0 : g;
  }
  const gx = gapIn(R.x, p[0]);
  const gy = gapIn(R.y, p[1]);
  const d = m === 'd1' ? gx + gy : m === 'd2' ? Math.hypot(gx, gy) : Math.max(gx, gy);
  return d <= SLACK ? 0 : d;
}

/** Does B(p, r) lie entirely on p's side of R (in R if p ∈ R, in the complement if not)? */
export const ballFits = (m: MetricId, R: Rect, p: Pt, r: number): boolean => r <= distToOtherSide(m, R, p) + SLACK;

/**
 * Does B(y, s) ⊆ B(a, R)? For a norm metric this holds iff s ≤ R − d(a, y) (triangle inequality one way;
 * the point y + s·(y − a)/‖y − a‖ the other way). In the discrete metric a ball is {centre} for radius ≤ 1
 * and the whole plane for radius > 1.
 */
export function ballInBall(m: MetricId, a: Pt, R: number, y: Pt, s: number): boolean {
  if (m === 'disc') {
    if (R > 1) return true;
    return dist(m, a, y) === 0 && s <= 1;
  }
  return s <= R - dist(m, a, y) + SLACK;
}

/** The interval constructor the presets use: iv(-1, 1, true, false) = [−1, 1). */
export const iv = (lo: number, hi: number, loIn: boolean, hiIn: boolean): Interval => ({ lo, hi, loIn, hiIn });
const R_ = (x: Interval, y: Interval): Rect => ({ x, y });

/** The sets the figure offers. */
export const RECTS = {
  /** (−1, 1) × (−1, 1): open */
  open: R_(iv(-1, 1, false, false), iv(-1, 1, false, false)),
  /** [−1, 1] × [−1, 1]: closed */
  closed: R_(iv(-1, 1, true, true), iv(-1, 1, true, true)),
  /** (−1, 1) × [−1, 1): the bottom edge in, the top edge out: neither open nor closed */
  mixed: R_(iv(-1, 1, false, false), iv(-1, 1, true, false)),
  /** the upper half-plane y > 0: open */
  half: R_(iv(-Infinity, Infinity, false, false), iv(0, Infinity, false, false)),
} as const;
export type RectId = keyof typeof RECTS;

/* ---- Lesson 1.4: a rectangle together with finitely many extra points, and the kinds of points ---- */

/**
 * A rectangle (possibly a segment: one interval a single number) together with finitely many extra points
 * outside its closure. The complement of the rectangle has no isolated points, so adding the finite set
 * changes the distance to the complement only at the extra points themselves (there it is 0), and the extra
 * points are never accumulation points (a finite set has none).
 */
export interface PlaneSet {
  rect: Rect;
  points: Pt[];
}

const samePt = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]) <= SLACK && Math.abs(a[1] - b[1]) <= SLACK;

export const inSet = (S: PlaneSet, p: Pt): boolean => inRect(S.rect, p) || S.points.some((q) => samePt(p, q));

/** distToOtherSide for a PlaneSet: the largest r with B(p, r) on p's side of S. */
export function distToOtherSideSet(m: MetricId, S: PlaneSet, p: Pt): number {
  if (m === 'disc' || S.points.length === 0) return distToOtherSide(m, S.rect, p);
  if (inRect(S.rect, p)) return distToOtherSide(m, S.rect, p);
  // an extra point: the complement surrounds it
  if (S.points.some((q) => samePt(p, q))) return 0;
  return Math.min(distToOtherSide(m, S.rect, p), ...S.points.map((q) => dist(m, p, q)));
}

/** The closure of the rectangle contains p: the coordinate gaps to both intervals are 0. */
const inRectClosure = (R: Rect, p: Pt) => gapIn(R.x, p[0]) <= SLACK && gapIn(R.y, p[1]) <= SLACK;

/**
 * Is p an accumulation point of S (every ball around p holds a point of S other than p)? In the discrete
 * metric no point is (B(p, ½) = {p}). In a norm metric: exactly the points of the rectangle's closure,
 * since a rectangle with a nondegenerate interval has no isolated points and finitely many points
 * accumulate nowhere.
 */
export const isAccumulation = (m: MetricId, S: PlaneSet, p: Pt): boolean => m !== 'disc' && inRectClosure(S.rect, p);

/** interior: a ball inside S; exterior: a ball inside the complement; boundary: neither. */
export type PointKind = 'interior' | 'exterior' | 'boundary';
export function pointKind(m: MetricId, S: PlaneSet, p: Pt): PointKind {
  if (distToOtherSideSet(m, S, p) === 0) return 'boundary';
  return inSet(S, p) ? 'interior' : 'exterior';
}

const plain = (R: Rect): PlaneSet => ({ rect: R, points: [] });

/** Every set the figure offers: the rectangles of RECTS, and two sets for lesson 1.4. */
export const SETS = {
  open: plain(RECTS.open),
  closed: plain(RECTS.closed),
  mixed: plain(RECTS.mixed),
  half: plain(RECTS.half),
  /** the open square (−1, 1)² together with the point (1.5, 0): an isolated point of the set */
  isolated: { rect: RECTS.open, points: [[1.5, 0] as Pt] },
  /** the segment (0, 1] × {0} on the x-axis: no interior in the plane */
  segment: plain(R_(iv(0, 1, false, true), iv(0, 0, true, true))),
} satisfies Record<string, PlaneSet>;
export type SetId = keyof typeof SETS;
