/**
 * Lesson 1.2's figure: unit balls of the p-norms in the plane, and the parallelogram law; lesson 3.5 adds the mode
 * 'equiv' (equivalence of norms).
 *
 * Three modes.
 * - 'balls': the closed unit ball {x : ‖x‖_p ≤ 1} for the p on the slider (1 to ∞; 1, 2 and ∞ exact), with an
 *   optional overlay of the 1-, 2- and ∞-balls (thin, each with its own dash pattern and label). The student drags a
 *   point x and reads its three norms; x is drawn filled when it lies in the current ball and hollow with a ring when
 *   it does not (shape, not only colour).
 * - 'par': two vectors x and y from the origin, the parallelogram they span and its diagonals x + y and x − y. The
 *   readout compares ‖x+y‖² + ‖x−y‖² with 2‖x‖² + 2‖y‖² in the current p-norm.
 *
 * - 'equiv' (lesson 3.5): the closed unit ball of a norm N on the plane (‖·‖₁, ‖·‖∞, a hexagon norm, or
 *   ‖(x₁+x₂, 2x₂)‖₂), and a closed Euclidean disc whose radius r the student sets. Two marks test the two inclusions:
 *   a = r·u on the disc, in the direction u where N/‖·‖₂ is largest (filled when it lies in the ball, hollow with a
 *   ring when it does not), and b = the point of the ball farthest from 0 (filled when it lies in the disc, hollow
 *   otherwise). With "best discs" on, the discs of radius 1/M and 1/m (dashed, green) and the numbers m, M are shown.
 *   They answer the tasks 'best-inner' and 'best-outer', so the student's toggle appears only once both are ticked, a
 *   student's change of norm switches discs set on by a text step off until then, the readout prints b's distance 1/m
 *   only once the disc contains b, and only a student's move of r ticks a task (never a norm click on an r left by a step).
 *   m and M come from a probe (sampling and refinement, src/math/norms.ts); the caption says so, and the lesson proves
 *   the exact values.
 * Every number comes from src/math/norms.ts (closed formulas). A pair of vectors is one check: evidence. That the law
 * holds for p = 2 and every pair is the lesson's proof; that it fails for p = 1 and p = ∞ needs only one pair.
 *
 * Tasks ask questions and never state their answer: 'square' (what shape is the ∞-ball?), 'corner' (a point in one
 * of the 2- and ∞-balls and not the other; only K∞ \ K₂ is non-empty), 'par-fails-inf' (a failing pair in the ∞-norm,
 * where many pairs, the initial one included, satisfy the law), 'par-holds-l1' (a pair off one line through 0 that
 * satisfies the law in the 1-norm, e.g. x = (1, 0), y = (1, b)). A text step sets state through subscribeSteps and
 * never ticks a task.
 */

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  PLANE_NORMS,
  P_VALUES,
  discContainsBall,
  discInsideBall,
  lawHolds,
  norm,
  normSphere,
  parallelogramSides,
  sphereExtremes,
  unitSphere,
  type PlaneNormId,
  type V2,
} from '~/math/norms';
import { markTask, progress } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useMounted } from '~/ui/useMounted';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { arrow, withAlpha } from './core/ink';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

type Mode = 'balls' | 'par' | 'equiv';

/** a left-to-right island inside Hebrew text (U+2066 … U+2069) */
/** an LTR-isolated formula that never wraps inside (no-break spaces) */
const ltr = (t: string) => `⁦${t.replace(/ /g, ' ')}⁩`;

const TASK_LABEL: Record<string, string> = {
  square: 'הגדילו את p עד הקצה הימני של הפס, ⁦p = ∞⁩. איזו צורה מקבל כדור היחידה?',
  corner: 'האם יש נקודה x שנמצאת בכדור היחידה של אחת משתי הנורמות, ⁦p = 2⁩ ו-⁦p = ∞⁩, ולא בכדור של השנייה? גררו את x ומצאו נקודה כזו.',
  'par-fails-inf': 'עם ⁦p = ∞⁩, מצאו זוג x, y שעבורו חוק המקבילית נכשל.',
  'par-holds-l1': 'עם ⁦p = 1⁩, מצאו זוג x, y שאינם על ישר אחד דרך הראשית, ושעבורו חוק המקבילית בכל זאת מתקיים.',
  'best-inner': `בנורמה המשושה או בנורמה ${ltr('‖(x₁ + x₂, 2x₂)‖₂')}, מצאו את הרדיוס הגדול ביותר במחוון שבו העיגול עוד כולו בתוך כדור היחידה של הנורמה.`,
  'best-outer': `בנורמה המשושה או בנורמה ${ltr('‖(x₁ + x₂, 2x₂)‖₂')}, מצאו את הרדיוס הקטן ביותר במחוון שבו העיגול מכיל את כל כדור היחידה של הנורמה.`,
};

/** the radius slider of 'equiv': [R_MIN, R_MAX] in steps of R_STEP */
const R_MIN = 0.2;
const R_MAX = 1.6;
const R_STEP = 0.01;
const snapR = (r: number) => Math.round(Math.max(R_MIN, Math.min(R_MAX, r)) / R_STEP) / (1 / R_STEP);
const fmt3 = (v: number) => v.toFixed(3);
const NON_STANDARD: PlaneNormId[] = ['hex', 'linear'];

const GRID = 0.05;
const fmt = (v: number) => sci(Math.round(v * 1e6) / 1e6, 3).replace(/^-/, '−');
/** the parallelogram sides: 5 significant figures, so that a failing pair never shows two equal numbers */
const fmtSide = (v: number) => sci(Math.round(v * 1e6) / 1e6, 5).replace(/^-/, '−');
const fmtP = (p: number) => (p === Infinity ? '∞' : fmt(p));
const fmtPt = (q: V2) => `(${fmt(q[0])}, ${fmt(q[1])})`;
const snap = (v: number) => Math.round(v / GRID) * GRID;
const nearestP = (p: number) => {
  const i = P_VALUES.indexOf(p);
  if (i >= 0) return i;
  return P_VALUES.reduce((b, v, k) => (Math.abs(v - p) < Math.abs(P_VALUES[b] - p) ? k : b), 0);
};

interface State {
  pi: number;
  overlay: boolean;
  probe: V2;
  x: V2;
  y: V2;
  ni: PlaneNormId;
  r: number;
  showBest: boolean;
}

export interface UnitBallsProps {
  id: string;
  mode: Mode;
  p?: number;
  overlay?: boolean;
  probe?: [number, number];
  x?: [number, number];
  y?: [number, number];
  /** 'equiv': the norm shown first, the norms offered, the disc radius, and whether the best discs are drawn */
  norm?: PlaneNormId;
  norms?: PlaneNormId[];
  r?: number;
  showBest?: boolean;
  tasks?: string[];
}

function fresh(props: UnitBallsProps): State {
  return {
    pi: nearestP(props.p ?? 2),
    overlay: props.overlay ?? false,
    probe: props.probe ?? [0.6, 0.4],
    x: props.x ?? [1, 0],
    y: props.y ?? [0.5, 0],
    ni: props.norm && props.norm in PLANE_NORMS ? props.norm : 'hex',
    r: snapR(props.r ?? 0.5),
    showBest: props.showBest ?? false,
  };
}

/** x and y on one line through the origin (the law then holds in every norm) */
const collinear = (x: V2, y: V2) => Math.abs(x[0] * y[1] - x[1] * y[0]) < 1e-9;

export default function UnitBalls(props: UnitBallsProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const mode = props.mode;
  const half = mode === 'par' ? 2.6 : mode === 'equiv' ? 2.2 : 1.8;
  const dragging = useRef<'probe' | 'x' | 'y' | null>(null);
  const ext = useMemo(() => sphereExtremes(s.ni), [s.ni]);
  const offered: PlaneNormId[] = props.norms ?? ['l1', 'linf', 'hex', 'linear'];
  const geo = useRef<{ cx: number; cy: number; k: number } | null>(null);
  const p = P_VALUES[s.pi];
  const clamp = (q: V2): V2 => [Math.max(-half, Math.min(half, snap(q[0]))), Math.max(-half * 0.75, Math.min(half * 0.75, snap(q[1])))];

  /** 'equiv': the "best discs" toggle opens only once the figure's best-disc tasks are ticked (it shows their answers). */
  const mounted = useMounted();
  const bestTasks = ['best-inner', 'best-outer'].filter((t) => props.tasks?.includes(t));
  const bestUnlocked = bestTasks.every((t) => mounted && !!progress.value.tasks[`${props.id}:${t}`]);

  /** The student's own change: a text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    // a text step may have switched the best discs on; a student's change of norm switches them off until unlocked
    const next = { ...s, ...patch, ...(patch.ni !== undefined && !bestUnlocked ? { showBest: false } : {}) };
    setS(next);
    const has = (t: string) => props.tasks?.includes(t);
    const np = P_VALUES[next.pi];
    if (has('square') && patch.pi !== undefined && np === Infinity) markTask(`${props.id}:square`);
    if (has('corner') && patch.probe !== undefined && norm(next.probe, Infinity) <= 1 + 1e-12 && norm(next.probe, 2) > 1 + 1e-12) markTask(`${props.id}:corner`);
    const movedVec = patch.x !== undefined || patch.y !== undefined || patch.pi !== undefined;
    if (has('par-fails-inf') && movedVec && np === Infinity && !lawHolds(next.x, next.y, Infinity)) markTask(`${props.id}:par-fails-inf`);
    if (has('par-holds-l1') && movedVec && np === 1 && !collinear(next.x, next.y) && lawHolds(next.x, next.y, 1)) markTask(`${props.id}:par-holds-l1`);
    // only the student's own move of r ticks: an r left by a text step, then a click on a norm, must not (lesson 3.5)
    if (patch.r !== undefined && NON_STANDARD.includes(next.ni)) {
      const e = sphereExtremes(next.ni);
      if (has('best-inner') && discInsideBall(next.r, e.M) && !discInsideBall(next.r + R_STEP, e.M)) markTask(`${props.id}:best-inner`);
      if (has('best-outer') && discContainsBall(next.r, e.m) && !discContainsBall(next.r - R_STEP, e.m)) markTask(`${props.id}:best-outer`);
    }
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.p === 'number' || st.p === 'inf') next.pi = nearestP(st.p === 'inf' ? Infinity : (st.p as number));
          if (typeof st.overlay === 'boolean') next.overlay = st.overlay;
          const pt = (v: unknown): V2 | null => (Array.isArray(v) && v.length === 2 ? clamp([Number(v[0]), Number(v[1])]) : null);
          next.probe = pt(st.probe) ?? next.probe;
          next.x = pt(st.x) ?? next.x;
          next.y = pt(st.y) ?? next.y;
          if (typeof st.norm === 'string' && st.norm in PLANE_NORMS) next.ni = st.norm as PlaneNormId;
          if (typeof st.r === 'number') next.r = snapR(st.r);
          if (typeof st.showBest === 'boolean') next.showBest = st.showBest;
          return next;
        });
      }),
    [props.id],
  );

  const inBall = norm(s.probe, p) <= 1 + 1e-12;
  const sides = parallelogramSides(s.x, s.y, p);
  const holds = lawHolds(s.x, s.y, p);
  const Nq = PLANE_NORMS[s.ni];
  const inner = discInsideBall(s.r, ext.M);
  const outer = discContainsBall(s.r, ext.m);
  const ptA: V2 = [s.r * ext.argMax[0], s.r * ext.argMax[1]];
  const ptB: V2 = [ext.argMin[0] / ext.m, ext.argMin[1] / ext.m];
  const innerText = inner
    ? 'העיגול כולו בתוך כדור היחידה של N.'
    : `העיגול בולט מכדור היחידה של N: בנקודה a = ${fmtPt(ptA)} של העיגול, N(a) = ${fmt3(Nq.value(ptA))} > 1.`;
  // b's distance from 0 is 1/m, the answer to 'best-outer': it is printed only once the disc already contains b
  const outerText = outer
    ? `העיגול מכיל את כל כדור היחידה של N, וגם את b = ${fmtPt(ptB)}, הנקודה של הכדור הרחוקה ביותר מהראשית: מרחקה ${fmt3(1 / ext.m)} ≤ r.`
    : 'כדור היחידה של N בולט מהעיגול: הנקודה b של הכדור נמצאת מחוץ לעיגול.';

  const describe = () => {
    if (mode === 'equiv') {
      return `הנורמה N(x) = ${Nq.formula}, ורדיוס העיגול r = ${fmt3(s.r)}. ${innerText} ${outerText}${s.showBest ? ` לפי הדגימה m ≈ ${fmt3(ext.m)} ו-M ≈ ${fmt3(ext.M)}.` : ''}`;
    }
    if (mode === 'balls') {
      return `p = ${fmtP(p)}. הנקודה x = ${fmtPt(s.probe)}: נורמה 1 שלה ${fmt(norm(s.probe, 1))}, נורמה 2 ${fmt(norm(s.probe, 2))}, נורמת אינסוף ${fmt(norm(s.probe, Infinity))}. ${inBall ? 'היא בכדור היחידה של p.' : 'היא מחוץ לכדור היחידה של p.'}`;
    }
    return `p = ${fmtP(p)}. x = ${fmtPt(s.x)}, y = ${fmtPt(s.y)}. סכום ריבועי האלכסונים ${fmtSide(sides.lhs)}, ופעמיים סכום ריבועי הצלעות ${fmtSide(sides.rhs)}: ${holds ? 'חוק המקבילית מתקיים לזוג הזה.' : `חוק המקבילית נכשל לזוג הזה, ההפרש ${fmtSide(sides.lhs - sides.rhs)}.`}`;
  };

  useEffect(() => {
    const t = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(t);
  }, [s]);

  const draw = ({ ctx, view, palette: pal }: FrameInfo) => {
    const k = Math.min(view.w / (2 * half + 0.25), view.h / (1.5 * half + 0.25));
    const cx = view.w / 2;
    const cy = view.h / 2;
    geo.current = { cx, cy, k };
    const toS = (q: V2): [number, number] => [cx + q[0] * k, cy - q[1] * k];

    drawAxes(ctx, pal, cx, cy, k, view.w, view.h);

    if (mode === 'equiv') {
      const disc = (r: number) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r * k, 0, 2 * Math.PI);
      };
      // the closed unit ball of N: solid outline, light fill
      ctx.save();
      sphere(ctx, normSphere(s.ni), toS);
      ctx.fillStyle = withAlpha(pal.curve, 0.12);
      ctx.fill();
      ctx.strokeStyle = pal.curve;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.restore();
      // the best discs, radius 1/M inside and 1/m outside, with their touching points (small squares)
      if (s.showBest) {
        ctx.save();
        ctx.strokeStyle = pal.limit;
        ctx.lineWidth = 1.6;
        ctx.setLineDash([7, 5]);
        disc(1 / ext.M);
        ctx.stroke();
        disc(1 / ext.m);
        ctx.stroke();
        ctx.restore();
        const touch: V2[] = [
          [ext.argMax[0] / ext.M, ext.argMax[1] / ext.M],
          [ext.argMin[0] / ext.m, ext.argMin[1] / ext.m],
        ];
        for (const sg of [1, -1]) {
          for (const q of touch) {
            const [qx, qy] = toS([sg * q[0], sg * q[1]]);
            ctx.save();
            ctx.fillStyle = pal.limit;
            ctx.fillRect(qx - 4, qy - 4, 8, 8);
            ctx.restore();
          }
        }
      }
      // the student's disc
      ctx.save();
      disc(s.r);
      ctx.fillStyle = withAlpha(pal.eps, 0.07);
      ctx.fill();
      ctx.strokeStyle = pal.eps;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.restore();
      // the two test points: filled when the inclusion holds there, hollow with a ring when it fails
      const mark = (q: V2, ok: boolean, label: string) => {
        const [px, py] = toS(q);
        ctx.save();
        if (ok) {
          ctx.fillStyle = pal.pointIn;
          ctx.beginPath();
          ctx.arc(px, py, 6, 0, 2 * Math.PI);
          ctx.fill();
        } else {
          ctx.fillStyle = pal.paper;
          ctx.strokeStyle = pal.pointOut;
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.arc(px, py, 6, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(px, py, 11, 0, 2 * Math.PI);
          ctx.stroke();
        }
        ctx.restore();
        // label on the side facing the origin, so a point near a corner never puts it under the figure's buttons
        const [ox, oy] = toS([0, 0]);
        const right = px <= ox;
        const below = py <= oy;
        haloText(ctx, pal, label, px + (right ? 9 : -9), py + (below ? 7 : -7), right ? 'left' : 'right', below ? 'top' : 'bottom', pal.ink, 14);
      };
      mark(ptA, inner, 'a');
      mark(ptB, outer, 'b');
      haloText(ctx, pal, `N = ${Nq.formula}`, 8, 8, 'left', 'top', pal.curve, 13);
      return;
    }

    // the overlay: the 1-, 2- and ∞-balls, thin, told apart by dash pattern and label
    if (mode === 'balls' && s.overlay) {
      const ref: [number, number[], string, V2][] = [
        [1, [2, 3], '1', [0.5, 0.5]],
        [2, [7, 4], '2', [Math.SQRT1_2, Math.SQRT1_2]],
        [Infinity, [], '∞', [1, 1]],
      ];
      for (const [q, dash, lab, at] of ref) {
        ctx.save();
        ctx.strokeStyle = pal.ink3;
        ctx.lineWidth = 1.3;
        ctx.setLineDash(dash);
        sphere(ctx, unitSphere(q), toS);
        ctx.stroke();
        ctx.restore();
        const [lx, ly] = toS(at);
        haloText(ctx, pal, lab, lx + 5, ly - 5, 'left', 'bottom', pal.ink3, 13);
      }
    }
    // in 'par' mode the current unit sphere, faint: the norm whose law is being checked
    if (mode === 'par') {
      ctx.save();
      ctx.strokeStyle = withAlpha(pal.curve, 0.35);
      ctx.lineWidth = 1.3;
      sphere(ctx, unitSphere(p), toS);
      ctx.stroke();
      ctx.restore();
    }

    if (mode === 'balls') {
      // the current closed unit ball: solid outline (the sphere belongs to the closed ball)
      ctx.save();
      sphere(ctx, unitSphere(p), toS);
      ctx.fillStyle = withAlpha(pal.curve, 0.12);
      ctx.fill();
      ctx.strokeStyle = pal.curve;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.restore();
      const [lx, ly] = toS([-1, 1]);
      haloText(ctx, pal, `p = ${fmtP(p)}`, lx, ly - 6, 'left', 'bottom', pal.curve, 13);

      const [px, py] = toS(s.probe);
      ctx.save();
      if (inBall) {
        ctx.fillStyle = pal.pointIn;
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        ctx.fillStyle = pal.paper;
        ctx.strokeStyle = pal.pointOut;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(px, py, 11, 0, 2 * Math.PI);
        ctx.stroke();
      }
      ctx.restore();
      haloText(ctx, pal, 'x', px + 9, py - 7, 'left', 'bottom', pal.ink, 14);
      return;
    }

    // 'par': the parallelogram 0, x, x + y, y and its diagonals
    const sum: V2 = [s.x[0] + s.y[0], s.x[1] + s.y[1]];
    const O = toS([0, 0]);
    const X = toS(s.x);
    const Y = toS(s.y);
    const S = toS(sum);
    ctx.save();
    ctx.fillStyle = withAlpha(pal.ink, 0.05);
    ctx.beginPath();
    ctx.moveTo(...O);
    ctx.lineTo(...X);
    ctx.lineTo(...S);
    ctx.lineTo(...Y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.ink2;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(...O);
    ctx.lineTo(...S);
    ctx.moveTo(...Y);
    ctx.lineTo(...X);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = withAlpha(pal.ink3, 0.8);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(...X);
    ctx.lineTo(...S);
    ctx.lineTo(...Y);
    ctx.stroke();
    ctx.restore();
    arrow(ctx, O[0], O[1], X[0], X[1], { color: pal.curve, width: 2.6, head: 11 });
    arrow(ctx, O[0], O[1], Y[0], Y[1], { color: pal.curve2, width: 2.6, head: 11 });
    for (const [pt, col] of [[X, pal.curve], [Y, pal.curve2]] as [[number, number], string][]) {
      ctx.save();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], 5.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    }
    haloText(ctx, pal, 'x', X[0] + 8, X[1] - 6, 'left', 'bottom', pal.curve, 15);
    haloText(ctx, pal, 'y', Y[0] + 8, Y[1] - 6, 'left', 'bottom', pal.curve2, 15);
    haloText(ctx, pal, 'x+y', S[0] + 6, S[1] - 4, 'left', 'bottom', pal.ink2, 13);
    const mid: [number, number] = [(X[0] + Y[0]) / 2, (X[1] + Y[1]) / 2];
    haloText(ctx, pal, 'x−y', mid[0] + 6, mid[1] + 4, 'left', 'top', pal.ink2, 13);
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 4, worldHeight: 3, animate: false });
  useEffect(invalidate, [s, mode, ext]);

  const ptFrom = (e: PointerEvent): V2 | null => {
    const g = geo.current;
    if (!g) return null;
    return clamp([(e.offsetX - g.cx) / g.k, (g.cy - e.offsetY) / g.k]);
  };
  const same = (a: V2, b: V2) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
  const onPointerDown = (e: PointerEvent) => {
    if (mode === 'equiv') return;
    const q = ptFrom(e);
    if (!q) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (mode === 'balls') {
      dragging.current = 'probe';
      if (!same(q, s.probe)) userSet({ probe: q });
      return;
    }
    // grab the nearer of the two tips
    const dx = Math.hypot(q[0] - s.x[0], q[1] - s.x[1]);
    const dy = Math.hypot(q[0] - s.y[0], q[1] - s.y[1]);
    dragging.current = dx <= dy ? 'x' : 'y';
    const cur = dragging.current === 'x' ? s.x : s.y;
    if (!same(q, cur) && !(q[0] === 0 && q[1] === 0)) userSet(dragging.current === 'x' ? { x: q } : { y: q });
  };
  const onPointerMove = (e: PointerEvent) => {
    const which = dragging.current;
    if (!which) return;
    const q = ptFrom(e);
    if (!q) return;
    if (which === 'probe') {
      if (!same(q, s.probe)) userSet({ probe: q });
    } else if (!(q[0] === 0 && q[1] === 0)) {
      const cur = which === 'x' ? s.x : s.y;
      if (!same(q, cur)) userSet(which === 'x' ? { x: q } : { y: q });
    }
  };
  const onPointerUp = () => {
    dragging.current = null;
  };
  /** Arrows move the probe ('balls') or y ('par'), in steps of 0.05; [ and ] change p. */
  const onKeyDown = (e: KeyboardEvent) => {
    if (mode === 'equiv') {
      const dr: Record<string, number> = { ArrowRight: R_STEP, ArrowUp: R_STEP, ArrowLeft: -R_STEP, ArrowDown: -R_STEP };
      if (e.key === '[' || e.key === ']') {
        e.preventDefault();
        const i = offered.indexOf(s.ni);
        const j = Math.max(0, Math.min(offered.length - 1, (i < 0 ? 0 : i) + (e.key === ']' ? 1 : -1)));
        userSet({ ni: offered[j] });
        return;
      }
      if (dr[e.key] === undefined) return;
      e.preventDefault();
      userSet({ r: snapR(s.r + dr[e.key]) });
      return;
    }
    const d: Record<string, V2> = { ArrowLeft: [-GRID, 0], ArrowRight: [GRID, 0], ArrowUp: [0, GRID], ArrowDown: [0, -GRID] };
    if (e.key === '[' || e.key === ']') {
      e.preventDefault();
      userSet({ pi: Math.max(0, Math.min(P_VALUES.length - 1, s.pi + (e.key === ']' ? 1 : -1))) });
      return;
    }
    const step = d[e.key];
    if (!step) return;
    e.preventDefault();
    if (mode === 'balls') userSet({ probe: clamp([s.probe[0] + step[0], s.probe[1] + step[1]]) });
    else {
      const ny = clamp([s.y[0] + step[0], s.y[1] + step[1]]);
      if (!(ny[0] === 0 && ny[1] === 0)) userSet({ y: ny });
    }
  };

  return (
    <SimShell
      fig={props.id}
      label={
        mode === 'equiv'
          ? `איור חי: כדור היחידה הסגור של נורמה N במישור, ועיגול אוקלידי סגור סביב הראשית שאת הרדיוס שלו קובעים במחוון. ${describe()} במקלדת: החצים משנים את הרדיוס, והמקשים סוגר מרובע שמאלי וימני מחליפים נורמה.`
          : mode === 'balls'
          ? `איור חי: כדור היחידה הסגור של נורמת p במישור, ונקודה x שאפשר לגרור. ${describe()} גררו את x; במקלדת: החצים מזיזים אותה, והמקשים סוגר מרובע שמאלי וימני משנים את p.`
          : `איור חי: שני וקטורים x ו-y מהראשית, המקבילית שהם פורשים והאלכסונים x+y ו-x−y. ${describe()} גררו את קצה x או y; במקלדת: החצים מזיזים את y, והמקשים סוגר מרובע שמאלי וימני משנים את p.`
      }
      canvasRef={canvasRef}
      aspect={4 / 3}
      live={live}
      tasks={tasks}
      cursor="crosshair"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onReset={() => {
        setS(fresh(props));
        setLive('האיור אופס.');
      }}
      readout={
        mode === 'equiv' ? (
          <>
            <span data-readout="norm">
              <bdi dir="ltr" class="q">N(x) = {Nq.formula}</bdi>
            </span>
            <span data-readout="r">
              <b class="q">r = {fmt3(s.r)}</b>
            </span>
            <span data-readout="inner">{innerText}</span>
            <span data-readout="outer">{outerText}</span>
            {s.showBest && (
              <span data-readout="mM">
                לפי הדגימה: <bdi dir="ltr" class="q">m ≈ {fmt3(ext.m)}, M ≈ {fmt3(ext.M)}, 1/M ≈ {fmt3(1 / ext.M)}, 1/m ≈ {fmt3(1 / ext.m)}</bdi>
              </span>
            )}
          </>
        ) : mode === 'balls' ? (
          <>
            <span>
              <b class="q" data-readout="p">p = {fmtP(p)}</b>
            </span>
            <span data-readout="norms">
              <b class="q">x = {fmtPt(s.probe)}</b>: <bdi dir="ltr" class="q">‖x‖₁ = {fmt(norm(s.probe, 1))}, ‖x‖₂ = {fmt(norm(s.probe, 2))}, ‖x‖∞ = {fmt(norm(s.probe, Infinity))}</bdi>
            </span>
            <span data-readout="verdict">{inBall ? 'x בכדור היחידה של p.' : 'x מחוץ לכדור היחידה של p.'}</span>
          </>
        ) : (
          <>
            <span>
              <b class="q" data-readout="p">p = {fmtP(p)}</b>
            </span>
            <span data-readout="sides">
              <bdi dir="ltr" class="q">
                ‖x+y‖² + ‖x−y‖² = {fmtSide(sides.lhs)}, 2‖x‖² + 2‖y‖² = {fmtSide(sides.rhs)}
              </bdi>
            </span>
            <span data-readout="verdict">
              {holds ? 'חוק המקבילית מתקיים לזוג הזה.' : 'חוק המקבילית נכשל לזוג הזה'}
              {!holds && (
                <>
                  : ההפרש <bdi dir="ltr" class="q">{fmtSide(sides.lhs - sides.rhs)}</bdi>.
                </>
              )}
            </span>
          </>
        )
      }
      controls={
        mode === 'equiv' ? (
          <>
            <div class="group" role="group" aria-label="הנורמה N">
              {offered.map((id) => (
                <Toggle key={id} label={<bdi dir="ltr">{PLANE_NORMS[id].formula}</bdi>} on={s.ni === id} onChange={() => userSet({ ni: id })} />
              ))}
            </div>
            <Slider label="r" value={s.r} min={R_MIN} max={R_MAX} step={R_STEP} format={fmt3} onChange={(v) => userSet({ r: snapR(v) })} />
            <div class="group">
              {bestUnlocked ? (
                <Toggle label="העיגולים הטובים ביותר" on={s.showBest} onChange={(on) => userSet({ showBest: on })} />
              ) : (
                <span data-readout="best-locked">המתג "העיגולים הטובים ביותר" ייפתח אחרי ששתי המשימות יסומנו.</span>
              )}
            </div>
          </>
        ) : (
        <>
          <Slider label="p" value={s.pi} min={0} max={P_VALUES.length - 1} step={1} format={(v) => fmtP(P_VALUES[Math.round(v)])} onChange={(v) => userSet({ pi: Math.round(v) })} />
          <div class="group" role="group" aria-label="ערכי p מיוחדים">
            {[1, 2, Infinity].map((q) => (
              <Toggle key={q} label={<bdi dir="ltr">p = {fmtP(q)}</bdi>} on={p === q} onChange={() => userSet({ pi: P_VALUES.indexOf(q) })} />
            ))}
          </div>
          {mode === 'balls' && (
            <div class="group">
              <Toggle label="הראו את כדורי 1, 2 ואינסוף" on={s.overlay} onChange={(on) => userSet({ overlay: on })} />
            </div>
          )}
        </>
        )
      }
    />
  );
}

function sphere(ctx: CanvasRenderingContext2D, pts: V2[], toS: (q: V2) => [number, number]) {
  ctx.beginPath();
  pts.forEach((q, i) => {
    const [x, y] = toS(q);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

/** Text with a paper halo, so it stays readable on top of a line. */
function haloText(ctx: CanvasRenderingContext2D, pal: Palette, t: string, x: number, y: number, align: CanvasTextAlign, base: CanvasTextBaseline, color: string, size: number) {
  ctx.save();
  ctx.font = `600 ${size}px ${pal.fontUi}`;
  ctx.direction = 'ltr';
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = pal.paper;
  ctx.lineWidth = 4;
  ctx.strokeText(t, x, y);
  ctx.fillStyle = color;
  ctx.fillText(t, x, y);
  ctx.restore();
}

function drawAxes(ctx: CanvasRenderingContext2D, pal: Palette, cx: number, cy: number, k: number, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = withAlpha(pal.ink3, 0.6);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(w, cy);
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, h);
  for (const t of [-1, 1]) {
    ctx.moveTo(cx + t * k, cy - 4);
    ctx.lineTo(cx + t * k, cy + 4);
    ctx.moveTo(cx - 4, cy - t * k);
    ctx.lineTo(cx + 4, cy - t * k);
  }
  ctx.stroke();
  ctx.restore();
  haloText(ctx, pal, '1', cx + k + 4, cy + 5, 'left', 'top', pal.ink3, 12);
  haloText(ctx, pal, '−1', cx - k + 4, cy + 5, 'left', 'top', pal.ink3, 12);
  haloText(ctx, pal, '1', cx - 6, cy - k - 3, 'right', 'bottom', pal.ink3, 12);
  haloText(ctx, pal, '−1', cx - 6, cy + k + 3, 'right', 'top', pal.ink3, 12);
}
