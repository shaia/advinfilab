/**
 * Lessons 1.3–1.4: balls in the plane, and the test for an open set, drawn. The plane carries one of four
 * metrics (d₁, d₂, d∞, discrete), so the open ball B(x, r) is a diamond, a disc, a square, or in the discrete
 * metric a single point (r ≤ 1) or the whole plane (r > 1).
 *
 * Two modes.
 * - 'ball': the proof that an open ball is open. The ball B(a, 1) around the origin is the set; the student drags
 *   a point y inside it, and the figure draws B(y, s) for the radius rule chosen: s = 1 − d(a, y) (the proof's
 *   rule, always inside) or s = d(a, y) (a tempting mistake, outside once d(a, y) > ½).
 * - 'set': a rectangle whose edges are each in or out of the set (solid or dashed). The student drags a probe
 *   point and a radius r; the figure says whether B(p, r) lies on p's side (in the set if p is in it, in the
 *   complement if not) and the largest radius that does. A set is open when every point of it has such a ball,
 *   closed when every point of the complement has one.
 *
 * Every verdict comes from src/math/metric.ts, which holds exact formulas (not a search). The probe sits on a
 * 0.05 grid so that the edges ±1 can be reached exactly. A figure checks one point at a time: it is evidence,
 * and the caption says so; "every point" is the proof's job.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { SETS, ballInBall, dist, distToOtherSideSet, inSet, isAccumulation, pointKind, type MetricId, type PlaneSet, type Pt, type Rect, type SetId } from '~/math/metric';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { withAlpha } from './core/ink';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

type Mode = 'ball' | 'set';
type Rule = 'fit' | 'naive';

const TASK_LABEL: Record<string, string> = {
  'naive-out': 'בחרו את הרדיוס ⁦s = d(a,y)⁩ ומצאו נקודה y שהכדור סביבה בולט מחוץ ל-⁦B(a,1)⁩.',
  'fit-edge': 'בחרו את הרדיוס ⁦s = 1 − d(a,y)⁩ וקרבו את y לשפה, עד מרחק 0.1 ממנה או פחות: הכדור הקטן עדיין בפנים.',
  'edge-point': 'בריבוע הסגור, מצאו נקודה של הקבוצה שאין סביבה אף כדור שכולו בקבוצה.',
  'not-closed': 'בריבוע עם הצלע התחתונה, מצאו נקודה מחוץ לקבוצה שאין סביבה אף כדור שכולו מחוץ לקבוצה.',
  discrete: 'במטריקה הבדידה, שימו את הנקודה על צלע של הריבוע הסגור ומצאו רדיוס שהכדור שלו כולו בקבוצה.',
  'boundary-out': 'בריבוע עם נקודה בודדת, מצאו נקודת שפה שאינה שייכת לקבוצה.',
  isolated: 'בריבוע עם נקודה בודדת, מצאו נקודה של הקבוצה שאינה נקודת הצטברות שלה.',
  'segment-boundary': 'בקטע שעל הציר, מצאו נקודה של הקבוצה, לא בקצה, ובדקו שהיא נקודת שפה.',
};

const METRIC_LABEL: Record<MetricId, string> = { d1: 'd₁', d2: 'd₂', dinf: 'd∞', disc: 'בדידה' };
const SET_LABEL: Record<SetId, string> = {
  open: 'ריבוע בלי השפה',
  closed: 'ריבוע עם השפה',
  mixed: 'ריבוע עם הצלע התחתונה',
  half: 'חצי מישור',
  isolated: 'ריבוע ונקודה בודדת',
  segment: 'קטע על הציר',
};
const SET_TEX: Record<SetId, string> = {
  open: '(−1,1) × (−1,1)',
  closed: '[−1,1] × [−1,1]',
  mixed: '(−1,1) × [−1,1)',
  half: '{x₂ > 0}',
  isolated: '(−1,1) × (−1,1) ∪ {(1.5, 0)}',
  segment: '(0,1] × {0}',
};
const KIND_LABEL = { interior: 'נקודה פנימית', exterior: 'נקודה חיצונית', boundary: 'נקודת שפה' } as const;

const GRID = 0.05;
const X_HALF = 2;
const Y_HALF = 1.5;
const A: Pt = [0, 0];
const R_BIG = 1;
const snap = (v: number) => Math.round(v / GRID) * GRID;
const clampPt = (p: Pt): Pt => [Math.max(-X_HALF, Math.min(X_HALF, snap(p[0]))), Math.max(-Y_HALF, Math.min(Y_HALF, snap(p[1])))];
const fmt = (v: number) => sci(Math.round(v * 1e6) / 1e6, 3).replace(/^-/, '−');
const fmtPt = (p: Pt) => `(${fmt(p[0])}, ${fmt(p[1])})`;

interface State {
  metric: MetricId;
  set: SetId;
  p: Pt;
  r: number;
  rule: Rule;
}

export interface BallProbeProps {
  id: string;
  mode: Mode;
  metric?: MetricId;
  metrics?: MetricId[];
  set?: SetId;
  sets?: SetId[];
  /** lesson 1.4: also say whether the probe is an interior, exterior or boundary point, and an accumulation or isolated point */
  classify?: boolean;
  p?: [number, number];
  r?: number;
  rule?: Rule;
  tasks?: string[];
}

function fresh(props: BallProbeProps): State {
  return {
    metric: props.metric ?? 'd2',
    set: props.set ?? 'open',
    p: clampPt(props.p ?? (props.mode === 'ball' ? [0.5, 0.3] : [0.5, 0.5])),
    r: props.r ?? 0.3,
    rule: props.rule ?? 'fit',
  };
}

/** The radius of the small ball in 'ball' mode. */
const smallRadius = (s: State) => (s.rule === 'fit' ? R_BIG - dist(s.metric, A, s.p) : dist(s.metric, A, s.p));

/** What the figure sees now: the set, the probe's side, the radius drawn, and whether that ball fits. */
function verdictOf(mode: Mode, s: State) {
  if (mode === 'ball') {
    const d = dist(s.metric, A, s.p);
    const inside = d < R_BIG;
    const rad = smallRadius(s);
    return { inside, d, rad, fits: inside && rad > 0 && ballInBall(s.metric, A, R_BIG, s.p, rad), best: inside ? R_BIG - d : 0 };
  }
  const S: PlaneSet = SETS[s.set];
  const inside = inSet(S, s.p);
  const best = distToOtherSideSet(s.metric, S, s.p);
  return { inside, d: 0, rad: s.r, fits: s.r <= best + 1e-12, best };
}

/** Lesson 1.4: is the probe an accumulation point of the set, an isolated point of it, or neither? */
function accText(s: State): string {
  const S = SETS[s.set];
  if (isAccumulation(s.metric, S, s.p)) return 'היא נקודת הצטברות: בכל כדור סביבה יש נקודה של הקבוצה ששונה ממנה.';
  if (inSet(S, s.p)) return 'היא נקודה מבודדת של הקבוצה: יש כדור סביבה שהנקודה היחידה של הקבוצה בו היא היא עצמה.';
  return 'היא אינה נקודת הצטברות ואינה שייכת לקבוצה.';
}

/** The outline of B(c, r) in a norm metric, in world coordinates. */
function ballPath(ctx: CanvasRenderingContext2D, m: MetricId, c: Pt, r: number, toS: (p: Pt) => [number, number], scale: number) {
  const [cx, cy] = toS(c);
  const R = r * scale;
  ctx.beginPath();
  if (m === 'd2') ctx.arc(cx, cy, R, 0, 2 * Math.PI);
  else if (m === 'dinf') ctx.rect(cx - R, cy - R, 2 * R, 2 * R);
  else {
    ctx.moveTo(cx + R, cy);
    ctx.lineTo(cx, cy - R);
    ctx.lineTo(cx - R, cy);
    ctx.lineTo(cx, cy + R);
    ctx.closePath();
  }
}

export default function BallProbe(props: BallProbeProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const dragging = useRef(false);
  const geo = useRef<{ cx: number; cy: number; k: number } | null>(null);
  const mode = props.mode;
  const v = verdictOf(mode, s);

  /** The student's own change: a text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    setS(next);
    const has = (t: string) => props.tasks?.includes(t);
    const nv = verdictOf(mode, next);
    if (mode === 'ball') {
      if (has('naive-out') && next.rule === 'naive' && nv.inside && !nv.fits) markTask(`${props.id}:naive-out`);
      if (has('fit-edge') && next.rule === 'fit' && next.metric !== 'disc' && nv.inside && nv.best <= 0.1 + 1e-9) markTask(`${props.id}:fit-edge`);
      return;
    }
    const moved = patch.p !== undefined || patch.set !== undefined || patch.metric !== undefined;
    if (has('edge-point') && moved && next.set === 'closed' && next.metric !== 'disc' && nv.inside && nv.best === 0) markTask(`${props.id}:edge-point`);
    if (has('not-closed') && moved && next.set === 'mixed' && next.metric !== 'disc' && !nv.inside && nv.best === 0) markTask(`${props.id}:not-closed`);
    if (has('discrete') && next.metric === 'disc' && next.set === 'closed' && nv.inside && distToOtherSideSet('d2', SETS.closed, next.p) === 0 && nv.fits)
      markTask(`${props.id}:discrete`);
    const norm = next.metric !== 'disc';
    if (has('boundary-out') && moved && norm && next.set === 'isolated' && !nv.inside && nv.best === 0) markTask(`${props.id}:boundary-out`);
    if (has('isolated') && moved && norm && next.set === 'isolated' && nv.inside && !isAccumulation(next.metric, SETS.isolated, next.p)) markTask(`${props.id}:isolated`);
    if (has('segment-boundary') && moved && norm && next.set === 'segment' && nv.inside && next.p[0] < 1 - 1e-9 && nv.best === 0) markTask(`${props.id}:segment-boundary`);
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.metric === 'string' && st.metric in METRIC_LABEL) next.metric = st.metric as MetricId;
          if (typeof st.set === 'string' && st.set in SETS) next.set = st.set as SetId;
          if (Array.isArray(st.p) && st.p.length === 2) next.p = clampPt([Number(st.p[0]), Number(st.p[1])]);
          if (typeof st.r === 'number') next.r = st.r;
          if (st.rule === 'fit' || st.rule === 'naive') next.rule = st.rule;
          return next;
        });
      }),
    [props.id],
  );

  const describe = () => {
    const m = METRIC_LABEL[s.metric];
    if (mode === 'ball') {
      if (!v.inside) return `המטריקה ${m}. הנקודה y = ${fmtPt(s.p)} אינה בכדור B(a,1): המרחק שלה מ-a הוא ${fmt(v.d)}.`;
      return `המטריקה ${m}. y = ${fmtPt(s.p)}, d(a,y) = ${fmt(v.d)}, הרדיוס s = ${fmt(v.rad)}. ${v.fits ? 'הכדור B(y,s) כולו בתוך B(a,1).' : 'הכדור B(y,s) בולט מחוץ ל-B(a,1).'}`;
    }
    const side = v.inside ? 'בקבוצה' : 'מחוץ לקבוצה';
    const fits = v.fits ? `הכדור ברדיוס ${fmt(s.r)} כולו ${side}.` : `הכדור ברדיוס ${fmt(s.r)} אינו כולו ${side}.`;
    const best = v.best === 0 ? 'אין אף כדור סביב הנקודה שכולו באותו צד.' : `הרדיוס הגדול ביותר שמתאים: ${fmt(v.best)}.`;
    const kind = props.classify ? ` היא ${KIND_LABEL[pointKind(s.metric, SETS[s.set], s.p)]}. ${accText(s)}` : '';
    return `המטריקה ${m}, הקבוצה ${SET_TEX[s.set]}. הנקודה ${fmtPt(s.p)} ${side}. ${fits} ${best}${kind}`;
  };

  useEffect(() => {
    const t = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(t);
  }, [s]);

  const draw = ({ ctx, view, palette: pal }: FrameInfo) => {
    const k = Math.min(view.w / (2 * X_HALF + 0.3), view.h / (2 * Y_HALF + 0.3));
    const cx = view.w / 2;
    const cy = view.h / 2;
    geo.current = { cx, cy, k };
    const toS = (q: Pt): [number, number] => [cx + q[0] * k, cy - q[1] * k];
    const left = cx - X_HALF * k;
    const right = cx + X_HALF * k;
    const top = cy - Y_HALF * k;
    const bottom = cy + Y_HALF * k;

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, right - left, bottom - top);
    ctx.clip();

    // the set: a light ink wash; edges solid when in the set, dashed when out
    if (mode === 'ball') drawBigBall(ctx, pal, s.metric, toS, k, top, right);
    else drawSet(ctx, pal, SETS[s.set], toS, left, top, right, bottom);

    drawAxesLight(ctx, pal, cx, cy, k, left, top, right, bottom);

    // the probe's ball: warm (an ε-neighbourhood), dashed outline (an open ball does not contain its sphere)
    const rad = v.rad;
    if (rad > 0 && (mode === 'set' || v.inside)) {
      ctx.save();
      if (s.metric === 'disc') {
        if (rad > 1) {
          ctx.fillStyle = pal.epsBand;
          ctx.fillRect(left, top, right - left, bottom - top);
        }
      } else {
        ballPath(ctx, s.metric, s.p, rad, toS, k);
        ctx.fillStyle = pal.epsBand;
        ctx.fill();
        ctx.strokeStyle = pal.eps;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
      }
      ctx.restore();
    }

    // in 'ball' mode, the segment a–y with its length, and the centre a
    if (mode === 'ball') {
      const [ax, ay] = toS(A);
      const [yx, yy] = toS(s.p);
      ctx.save();
      ctx.strokeStyle = pal.ink2;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(yx, yy);
      ctx.stroke();
      ctx.fillStyle = pal.ink;
      ctx.beginPath();
      ctx.arc(ax, ay, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.font = `600 14px ${pal.fontUi}`;
      ctx.direction = 'ltr';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('a', ax - 6, ay + 4);
      ctx.restore();
    }

    // the probe point: filled when its ball fits, hollow with a ring when not (shape, not only colour)
    const [px, py] = toS(s.p);
    ctx.save();
    if (v.fits) {
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
    ctx.fillStyle = pal.ink;
    ctx.font = `700 14px ${pal.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(mode === 'ball' ? 'y' : 'x', px + 8, py - 6);
    ctx.restore();
    ctx.restore();
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 4, worldHeight: 3, animate: false });
  useEffect(invalidate, [s]);

  const ptFromPointer = (e: PointerEvent): Pt | null => {
    const g = geo.current;
    if (!g) return null;
    return clampPt([(e.offsetX - g.cx) / g.k, (g.cy - e.offsetY) / g.k]);
  };
  const same = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
  const onPointerDown = (e: PointerEvent) => {
    const q = ptFromPointer(e);
    if (!q) return;
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (!same(q, s.p)) userSet({ p: q });
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging.current) return;
    const q = ptFromPointer(e);
    if (q && !same(q, s.p)) userSet({ p: q });
  };
  const onPointerUp = () => {
    dragging.current = false;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const d: Record<string, Pt> = { ArrowLeft: [-GRID, 0], ArrowRight: [GRID, 0], ArrowUp: [0, GRID], ArrowDown: [0, -GRID] };
    const step = d[e.key];
    if (!step) return;
    e.preventDefault();
    userSet({ p: clampPt([s.p[0] + step[0], s.p[1] + step[1]]) });
  };

  const metrics = props.metrics ?? [];
  const sets = props.sets ?? [];
  const m = METRIC_LABEL[s.metric];
  return (
    <SimShell
      fig={props.id}
      label={
        mode === 'ball'
          ? `איור חי: הכדור הפתוח B(a,1) סביב הראשית במטריקה ${m}, נקודה y בתוכו וכדור קטן B(y,s) סביבה. גררו את y; במקלדת: החצים מזיזים אותה. ${describe()}`
          : `איור חי: קבוצה במישור, צלע בקבוצה מצוירת רציפה וצלע מחוץ לה מקווקוות. נקודה x וכדור B(x,r) סביבה במטריקה ${m}. גררו את x; במקלדת: החצים מזיזים אותה. ${describe()}`
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
        mode === 'ball' ? (
          <>
            <span>
              <b class="q" data-readout="point">y = {fmtPt(s.p)}</b>
            </span>
            <span data-readout="dist">
              <b class="q">d(a,y) = {fmt(v.d)}</b>
            </span>
            <span data-readout="verdict">
              {!v.inside ? (
                <>הנקודה y אינה בכדור: בחרו נקודה בתוכו.</>
              ) : (
                <>
                  הרדיוס <b class="q">s = {fmt(v.rad)}</b>: {v.fits ? 'הכדור הקטן כולו בתוך B(a,1).' : 'הכדור הקטן בולט מחוץ ל-B(a,1).'}
                </>
              )}
            </span>
          </>
        ) : (
          <>
            <span>
              <b class="q" data-readout="point">x = {fmtPt(s.p)}</b> {v.inside ? 'בקבוצה' : 'מחוץ לקבוצה'}
            </span>
            <span data-readout="verdict">
              הכדור ברדיוס <b class="q">r = {fmt(s.r)}</b> {v.fits ? 'כולו' : 'אינו כולו'} {v.inside ? 'בקבוצה' : 'מחוץ לקבוצה'}.
            </span>
            <span data-readout="best">
              {v.best === 0 ? (
                <>אין אף כדור סביב x שכולו {v.inside ? 'בקבוצה' : 'מחוץ לה'}.</>
              ) : (
                <>
                  הרדיוס הגדול ביותר שמתאים: <b class="q">{fmt(v.best)}</b>
                </>
              )}
            </span>
            {props.classify && (
              <>
                <span data-readout="kind">
                  x היא <b>{KIND_LABEL[pointKind(s.metric, SETS[s.set], s.p)]}</b> של הקבוצה.
                </span>
                <span data-readout="acc">{accText(s)}</span>
              </>
            )}
          </>
        )
      }
      controls={
        <>
          {metrics.length > 1 && (
            <div class="group" role="group" aria-label="המטריקה">
              {metrics.map((id) => (
                <Toggle key={id} label={<bdi dir="ltr">{METRIC_LABEL[id]}</bdi>} on={s.metric === id} onChange={() => userSet({ metric: id })} />
              ))}
            </div>
          )}
          {mode === 'set' && sets.length > 1 && (
            <div class="group" role="group" aria-label="הקבוצה">
              {sets.map((id) => (
                <Toggle key={id} label={SET_LABEL[id]} on={s.set === id} onChange={() => userSet({ set: id })} />
              ))}
            </div>
          )}
          {mode === 'ball' ? (
            <div class="group" role="group" aria-label="הרדיוס של הכדור הקטן">
              <Toggle label={<bdi dir="ltr">s = 1 − d(a,y)</bdi>} on={s.rule === 'fit'} onChange={() => userSet({ rule: 'fit' })} />
              <Toggle label={<bdi dir="ltr">s = d(a,y)</bdi>} on={s.rule === 'naive'} onChange={() => userSet({ rule: 'naive' })} />
            </div>
          ) : (
            <Slider label="הרדיוס r" value={s.r} min={0.05} max={1.5} step={0.05} format={fmt} onChange={(r) => userSet({ r: Math.round(r * 20) / 20 })} />
          )}
        </>
      }
    />
  );
}

function drawAxesLight(ctx: CanvasRenderingContext2D, pal: Palette, cx: number, cy: number, k: number, left: number, top: number, right: number, bottom: number) {
  ctx.save();
  ctx.strokeStyle = withAlpha(pal.ink3, 0.6);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, cy);
  ctx.lineTo(right, cy);
  ctx.moveTo(cx, top);
  ctx.lineTo(cx, bottom);
  ctx.stroke();
  ctx.font = `12px ${pal.fontUi}`;
  ctx.direction = 'ltr';
  ctx.lineJoin = 'round';
  // tick labels sit where the sets' edges are (±1): a paper halo keeps them readable on top of an edge
  const label = (t: string, x: number, y: number) => {
    ctx.strokeStyle = pal.paper;
    ctx.lineWidth = 4;
    ctx.strokeText(t, x, y);
    ctx.fillStyle = pal.ink3;
    ctx.fillText(t, x, y);
  };
  for (const t of [-1, 1]) {
    ctx.strokeStyle = withAlpha(pal.ink3, 0.6);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + t * k, cy - 4);
    ctx.lineTo(cx + t * k, cy + 4);
    ctx.moveTo(cx - 4, cy - t * k);
    ctx.lineTo(cx + 4, cy - t * k);
    ctx.stroke();
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  label('1', cx + k + 4, cy + 5);
  label('−1', cx - k + 4, cy + 5);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  label('1', cx - 6, cy - k - 3);
  ctx.textBaseline = 'top';
  label('−1', cx - 6, cy + k + 3);
  ctx.restore();
}

function drawBigBall(ctx: CanvasRenderingContext2D, pal: Palette, m: MetricId, toS: (p: Pt) => [number, number], k: number, top: number, right: number) {
  ctx.save();
  if (m === 'disc') {
    // B(a, 1) in the discrete metric is {a}: the set is one point, marked by a ring around a
    const [ax, ay] = toS(A);
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(ax, ay, 9, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();
    return;
  }
  ballPath(ctx, m, A, R_BIG, toS, k);
  ctx.fillStyle = withAlpha(pal.ink, 0.08);
  ctx.fill();
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.8;
  ctx.setLineDash([8, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = pal.ink2;
  ctx.font = `600 13px ${pal.fontUi}`;
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  const [lx, ly] = toS([0.72, 0.85]);
  if (lx < right - 60 && ly > top) ctx.fillText('B(a,1)', lx, ly);
  ctx.restore();
}

/** A set of the figure: its rectangle (a segment when one interval is a single number), then its extra points. */
function drawSet(ctx: CanvasRenderingContext2D, pal: Palette, S: PlaneSet, toS: (p: Pt) => [number, number], left: number, top: number, right: number, bottom: number) {
  const R = S.rect;
  if (R.y.lo === R.y.hi) drawSegment(ctx, pal, R, toS);
  else drawRect(ctx, pal, R, toS, left, top, right, bottom);
  ctx.save();
  for (const q of S.points) {
    const [qx, qy] = toS(q);
    ctx.fillStyle = pal.ink;
    ctx.beginPath();
    ctx.arc(qx, qy, 4.5, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.restore();
}

/** A horizontal segment [lo, hi] × {y}: a thick ink line, a filled dot at an end in the set and a hollow one at an end out of it. */
function drawSegment(ctx: CanvasRenderingContext2D, pal: Palette, R: Rect, toS: (p: Pt) => [number, number]) {
  const [x0, y0] = toS([R.x.lo, R.y.lo]);
  const [x1] = toS([R.x.hi, R.y.lo]);
  ctx.save();
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y0);
  ctx.stroke();
  for (const [x, inSetEnd] of [[x0, R.x.loIn], [x1, R.x.hiIn]] as [number, boolean][]) {
    ctx.beginPath();
    ctx.arc(x, y0, 4.5, 0, 2 * Math.PI);
    ctx.fillStyle = inSetEnd ? pal.ink : pal.paper;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawRect(ctx: CanvasRenderingContext2D, pal: Palette, R: Rect, toS: (p: Pt) => [number, number], left: number, top: number, right: number, bottom: number) {
  const [x0s] = toS([Number.isFinite(R.x.lo) ? R.x.lo : -99, 0]);
  const [x1s] = toS([Number.isFinite(R.x.hi) ? R.x.hi : 99, 0]);
  const [, y1s] = toS([0, Number.isFinite(R.y.hi) ? R.y.hi : 99]);
  const [, y0s] = toS([0, Number.isFinite(R.y.lo) ? R.y.lo : -99]);
  const L = Math.max(left - 5, x0s);
  const Rr = Math.min(right + 5, x1s);
  const T = Math.max(top - 5, y1s);
  const B = Math.min(bottom + 5, y0s);
  ctx.save();
  ctx.fillStyle = withAlpha(pal.ink, 0.08);
  ctx.fillRect(L, T, Rr - L, B - T);
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 2;
  const edge = (x1: number, y1: number, x2: number, y2: number, included: boolean, finite: boolean) => {
    if (!finite) return;
    ctx.setLineDash(included ? [] : [8, 5]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  edge(L, B, Rr, B, R.y.loIn, Number.isFinite(R.y.lo));
  edge(L, T, Rr, T, R.y.hiIn, Number.isFinite(R.y.hi));
  edge(L, T, L, B, R.x.loIn, Number.isFinite(R.x.lo));
  edge(Rr, T, Rr, B, R.x.hiIn, Number.isFinite(R.x.hi));
  // A corner is in the set only when both of its ends are. Where a solid edge ends at a corner that is not in
  // the set ((±1, −1) of (−1,1) × [−1,1)), a hollow dot says so: the solid line alone would claim the corner.
  ctx.setLineDash([]);
  const corners: [number, number, boolean, boolean, boolean][] = [
    [L, B, R.x.loIn && R.y.loIn, R.x.loIn || R.y.loIn, Number.isFinite(R.x.lo) && Number.isFinite(R.y.lo)],
    [Rr, B, R.x.hiIn && R.y.loIn, R.x.hiIn || R.y.loIn, Number.isFinite(R.x.hi) && Number.isFinite(R.y.lo)],
    [L, T, R.x.loIn && R.y.hiIn, R.x.loIn || R.y.hiIn, Number.isFinite(R.x.lo) && Number.isFinite(R.y.hi)],
    [Rr, T, R.x.hiIn && R.y.hiIn, R.x.hiIn || R.y.hiIn, Number.isFinite(R.x.hi) && Number.isFinite(R.y.hi)],
  ];
  for (const [cx, cy, inSet, solidEdge, finite] of corners) {
    if (!finite || inSet || !solidEdge) continue;
    ctx.fillStyle = pal.paper;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 4.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
