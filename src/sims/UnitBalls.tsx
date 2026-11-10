/**
 * Lesson 1.2's figure: unit balls of the p-norms in the plane, and the parallelogram law.
 *
 * Two modes.
 * - 'balls': the closed unit ball {x : ‖x‖_p ≤ 1} for the p on the slider (1 to ∞; 1, 2 and ∞ exact), with an
 *   optional overlay of the 1-, 2- and ∞-balls (thin, each with its own dash pattern and label). The student drags a
 *   point x and reads its three norms; x is drawn filled when it lies in the current ball and hollow with a ring when
 *   it does not (shape, not only colour).
 * - 'par': two vectors x and y from the origin, the parallelogram they span and its diagonals x + y and x − y. The
 *   readout compares ‖x+y‖² + ‖x−y‖² with 2‖x‖² + 2‖y‖² in the current p-norm.
 *
 * Every number comes from src/math/norms.ts (closed formulas). A pair of vectors is one check: evidence. That the law
 * holds for p = 2 and every pair is the lesson's proof; that it fails for p = 1 and p = ∞ needs only one pair.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { P_VALUES, lawHolds, norm, parallelogramSides, unitSphere, type V2 } from '~/math/norms';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { arrow, withAlpha } from './core/ink';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

type Mode = 'balls' | 'par';

const TASK_LABEL: Record<string, string> = {
  square: 'הגדילו את p עד הקצה הימני של הפס, ⁦p = ∞⁩: שם כדור היחידה הוא ריבוע.',
  corner: 'מצאו נקודה x שנמצאת בכדור היחידה של נורמת אינסוף ואינה בכדור היחידה של הנורמה האוקלידית.',
  'par-fails': 'עם ⁦p = 1⁩, הזיזו את x או את y עד שחוק המקבילית נכשל.',
  'par-holds': 'עם ⁦p = 2⁩, הזיזו את y למקום שאינו על הישר של x, ובדקו שחוק המקבילית מתקיים.',
};

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
}

export interface UnitBallsProps {
  id: string;
  mode: Mode;
  p?: number;
  overlay?: boolean;
  probe?: [number, number];
  x?: [number, number];
  y?: [number, number];
  tasks?: string[];
}

function fresh(props: UnitBallsProps): State {
  return {
    pi: nearestP(props.p ?? 2),
    overlay: props.overlay ?? false,
    probe: props.probe ?? [0.6, 0.4],
    x: props.x ?? [1, 0],
    y: props.y ?? [0.5, 0],
  };
}

/** x and y on one line through the origin (the law then holds in every norm) */
const collinear = (x: V2, y: V2) => Math.abs(x[0] * y[1] - x[1] * y[0]) < 1e-9;

export default function UnitBalls(props: UnitBallsProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const mode = props.mode;
  const half = mode === 'par' ? 2.6 : 1.8;
  const dragging = useRef<'probe' | 'x' | 'y' | null>(null);
  const geo = useRef<{ cx: number; cy: number; k: number } | null>(null);
  const p = P_VALUES[s.pi];
  const clamp = (q: V2): V2 => [Math.max(-half, Math.min(half, snap(q[0]))), Math.max(-half * 0.75, Math.min(half * 0.75, snap(q[1])))];

  /** The student's own change: a text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    setS(next);
    const has = (t: string) => props.tasks?.includes(t);
    const np = P_VALUES[next.pi];
    if (has('square') && patch.pi !== undefined && np === Infinity) markTask(`${props.id}:square`);
    if (has('corner') && patch.probe !== undefined && norm(next.probe, Infinity) <= 1 + 1e-12 && norm(next.probe, 2) > 1 + 1e-12) markTask(`${props.id}:corner`);
    const movedVec = patch.x !== undefined || patch.y !== undefined || patch.pi !== undefined;
    if (has('par-fails') && movedVec && np === 1 && !lawHolds(next.x, next.y, 1)) markTask(`${props.id}:par-fails`);
    if (has('par-holds') && movedVec && np === 2 && !collinear(next.x, next.y) && lawHolds(next.x, next.y, 2)) markTask(`${props.id}:par-holds`);
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
          return next;
        });
      }),
    [props.id],
  );

  const inBall = norm(s.probe, p) <= 1 + 1e-12;
  const sides = parallelogramSides(s.x, s.y, p);
  const holds = lawHolds(s.x, s.y, p);

  const describe = () => {
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
  useEffect(invalidate, [s, mode]);

  const ptFrom = (e: PointerEvent): V2 | null => {
    const g = geo.current;
    if (!g) return null;
    return clamp([(e.offsetX - g.cx) / g.k, (g.cy - e.offsetY) / g.k]);
  };
  const same = (a: V2, b: V2) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
  const onPointerDown = (e: PointerEvent) => {
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
        mode === 'balls'
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
        mode === 'balls' ? (
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
