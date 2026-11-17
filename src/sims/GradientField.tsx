/**
 * Lesson 5.4's figure: the gradient on a map of level curves.
 *
 * Upper panel: the level curves of a C¹ function f on a square window (ink, thin), the level curve through the point a
 * (ink, bold), the point a (draggable, snapped to a 0.1 grid), the gradient arrow ∇f(a) (warm, drawn at a fixed scale
 * per function so that it fits), the tangent line of the level curve at a (green, dashed: the directions orthogonal to
 * ∇f(a)), and a unit direction v (cool, drawn at a fixed length).
 *
 * Lower panel: θ ↦ D_v f(a) = ∇f(a)·v for v = (cos θ, sin θ), θ in degrees: a cosine of amplitude ‖∇f(a)‖₂, between
 * the dashed bounds ±‖∇f(a)‖₂ of Cauchy–Schwarz. The current θ is a point on the curve: filled when v is within 3° of
 * the gradient direction, a hollow ring otherwise (shape, not only colour).
 *
 * Every number comes from the closed forms of src/math/gradient2d.ts. The level curves are traced by marching squares
 * on a grid (src/sims/core/contour.ts); the caption says so. No animation.
 */

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  PRESETS,
  ZERO,
  describe as describeState,
  fmtNum,
  gapDeg,
  norm2,
  rate,
  snap,
  steepestDeg,
  tangentDir,
  unit,
  verdict,
  type PresetId,
  type V2,
} from '~/math/gradient2d';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { contourLines } from './core/contour';
import { arrow, withAlpha } from './core/ink';
import { drawAxes, insetBox, makePlot, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

/** a left-to-right island inside Hebrew text (U+2066 … U+2069), with no-break spaces so it never wraps */
const ltr = (s: string) => `⁦${s.replace(/ /g, '\u00a0')}⁩`;

const TASK_LABEL: Record<string, string> = {
  steepest: `סובבו את v עד שהנגזרת הכיוונית ${ltr('D_v f(a)')} הגדולה ביותר (בטווח של ${ltr('3°')}), בנקודה שבה הגרדיאנט אינו אפס.`,
  level: `מצאו כיוון v שבו ${ltr('D_v f(a) = 0')} (בטווח של ${ltr('3°')}), בנקודה שבה הגרדיאנט אינו אפס, וראו שהוא על הקו המשיק לקו הגובה.`,
  'rate-5': `בפונקציה ${ltr('f = xy')}, הזיזו את a לנקודה ${ltr('(4, 3)')} וסובבו את v לכיוון העלייה המהירה ביותר. קראו את הקצב.`,
  'zero-grad': `הזיזו את a לנקודה שבה הגרדיאנט מתאפס. מה קורה לגרף שלמטה?`,
  descent: `סובבו את v לכיוון הירידה המהירה ביותר (בטווח של ${ltr('3°')}).`,
  'wave-level': `בפונקציה ${ltr('f = y − sin x')}, בחרו נקודה a, ומצאו בה כיוון v שמשיק לקו הגובה (${ltr('D_v f(a) = 0')}).`,
};

interface State {
  preset: PresetId;
  a: V2;
  /** the direction of v, whole degrees in [0, 360) */
  deg: number;
}

export interface GradientFieldProps {
  id: string;
  preset?: PresetId;
  presets?: PresetId[];
  a?: [number, number];
  deg?: number;
  tasks?: string[];
}

const normDeg = (d: number) => ((Math.round(d) % 360) + 360) % 360;
// cos 90° is 6·10⁻¹⁷ in floating point: the readouts print such noise as 0 (every value here is of order 1)
const r4 = (v: number) => fmtNum(Math.abs(v) < 1e-12 ? 0 : Number(v.toPrecision(4)));

function fresh(p: GradientFieldProps): State {
  const preset: PresetId = p.preset && p.preset in PRESETS ? p.preset : 'ellipse';
  const h = PRESETS[preset].half;
  const a = p.a ?? [2, 1];
  return { preset, a: [snap(a[0], h), snap(a[1], h)], deg: normDeg(p.deg ?? 0) };
}

const Q = (p: { children: string }) => (
  <b class="q">
    <bdi dir="ltr">{p.children}</bdi>
  </b>
);

export default function GradientField(props: GradientFieldProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const planeRef = useRef<Plot | null>(null);
  const dragging = useRef(false);
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const has = (t: string) => props.tasks?.includes(t) ?? false;

  const P = PRESETS[s.preset];
  const g = P.grad(s.a[0], s.a[1]);
  const gn = norm2(g);
  const D = rate(P, s.a, s.deg);
  const phi = steepestDeg(g);
  const vd = verdict(g, s.deg);
  const v = unit(s.deg);

  /** The student's own change. A text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next: State = { ...s, ...patch };
    if (patch.preset && patch.preset !== s.preset) {
      const h = PRESETS[patch.preset].half;
      next.a = [snap(next.a[0], h), snap(next.a[1], h)];
    }
    setS(next);
    const id = props.id;
    const NP = PRESETS[next.preset];
    const ng = NP.grad(next.a[0], next.a[1]);
    const nv = verdict(ng, next.deg);
    if (has('steepest') && nv === 'steepest') markTask(`${id}:steepest`);
    if (has('level') && nv === 'level') markTask(`${id}:level`);
    if (has('rate-5') && next.preset === 'xy' && next.a[0] === 4 && next.a[1] === 3 && nv === 'steepest') markTask(`${id}:rate-5`);
    if (has('zero-grad') && patch.a !== undefined && norm2(ng) < ZERO) markTask(`${id}:zero-grad`);
    if (has('descent') && nv === 'descent') markTask(`${id}:descent`);
    if (has('wave-level') && next.preset === 'wave' && nv === 'level') markTask(`${id}:wave-level`);
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.preset === 'string' && st.preset in PRESETS) next.preset = st.preset as PresetId;
          const h = PRESETS[next.preset].half;
          const ax = typeof st.ax === 'number' ? st.ax : next.a[0];
          const ay = typeof st.ay === 'number' ? st.ay : next.a[1];
          next.a = [snap(ax, h), snap(ay, h)];
          if (typeof st.deg === 'number') next.deg = normDeg(st.deg);
          return next;
        });
      }),
    [props.id],
  );

  useEffect(() => {
    const t = setTimeout(() => setLive(describeState(P, s.a, s.deg)), 300);
    return () => clearTimeout(t);
  }, [s]);

  // the level curves of the whole window depend only on the function: computed once per preset
  const levels = useMemo(() => {
    const h = PRESETS[s.preset].half * 1.6;
    return contourLines(PRESETS[s.preset].f, { xmin: -h, xmax: h, ymin: -h, ymax: h }, { nx: 140, ny: 140, step: PRESETS[s.preset].step, offset: 0.5 });
  }, [s.preset]);
  const fa = P.f(s.a[0], s.a[1]);
  const through = useMemo(() => {
    const h = PRESETS[s.preset].half * 1.6;
    const F = PRESETS[s.preset].f;
    // one level only: with a step far above the range of f − f(a) on the window, the only level is k = 0
    return contourLines((x, y) => F(x, y) - fa, { xmin: -h, xmax: h, ymin: -h, ymax: h }, { nx: 200, ny: 200, step: 1e9, offset: 0 });
  }, [s.preset, fa]);

  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const splitY = view.h * 0.7;
    const toolsW = 3 * 34 + 2 * 6 + 8 + 8;

    // ---------------- upper panel: the plane, equal scales on both axes
    const box = insetBox({ x: 0, y: 0, w: view.w, h: splitY }, { l: narrow ? 30 : 36, r: 10, t: narrow ? 46 : 10, b: 22 });
    const k = Math.min(box.w, box.h) / (2 * P.half);
    const hx = box.w / (2 * k);
    const hy = box.h / (2 * k);
    const plane = makePlot(box, { min: -hx, max: hx, format: (t) => fmtNum(t) }, { min: -hy, max: hy, format: (t) => fmtNum(t) });
    planeRef.current = plane;
    drawAxes(ctx, plane, p);
    const X = plane.px;
    const Y = plane.py;

    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();

    // the coordinate axes
    ctx.strokeStyle = withAlpha(p.ink3, 0.6);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(X(-hx), Y(0));
    ctx.lineTo(X(hx), Y(0));
    ctx.moveTo(X(0), Y(-hy));
    ctx.lineTo(X(0), Y(hy));
    ctx.stroke();

    const poly = (pts: readonly (readonly [number, number])[]) => {
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1]))));
      ctx.stroke();
    };
    // all level curves, thin
    ctx.strokeStyle = withAlpha(p.curve, 0.32);
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    for (const L of levels) poly(L.points);
    // the level curve through a, bold
    ctx.strokeStyle = p.curve;
    ctx.lineWidth = 2.2;
    for (const L of through) poly(L.points);

    const A: [number, number] = [X(s.a[0]), Y(s.a[1])];
    // the tangent line of the level curve at a: green, dashed
    const t = tangentDir(g);
    if (t) {
      const L = 3 * P.half;
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = p.limit;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(X(s.a[0] - L * t[0]), Y(s.a[1] - L * t[1]));
      ctx.lineTo(X(s.a[0] + L * t[0]), Y(s.a[1] + L * t[1]));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // ∇f(a): warm, thick, at a fixed scale
    if (gn >= ZERO) {
      arrow(ctx, A[0], A[1], X(s.a[0] + P.scale * g[0]), Y(s.a[1] + P.scale * g[1]), { color: p.eps, width: 3, head: 13 });
    }
    // v: cool, thinner, fixed length
    const vl = 0.3 * P.half;
    arrow(ctx, A[0], A[1], X(s.a[0] + vl * v[0]), Y(s.a[1] + vl * v[1]), { color: p.delta, width: 2, head: 10 });
    // the point a
    ctx.beginPath();
    ctx.arc(A[0], A[1], 5.5, 0, 2 * Math.PI);
    ctx.fillStyle = p.ink;
    ctx.fill();
    ctx.strokeStyle = p.paper;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // labels next to the arrows (LTR), outlined in paper colour
    ctx.font = `700 ${narrow ? 12 : 14}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const label = (txt: string, x: number, y: number, color: string, align: CanvasTextAlign) => {
      ctx.textAlign = align;
      ctx.strokeStyle = p.paper;
      ctx.lineWidth = 4;
      ctx.strokeText(txt, x, y);
      ctx.fillStyle = color;
      ctx.fillText(txt, x, y);
    };
    // ∇f(a) is labelled beyond its tip; v beside its tip, on the side away from ∇f(a), so the two labels never meet
    // (on a phone both arrows are short and a fixed offset put them on top of each other)
    let gs: [number, number] = [0, 0];
    if (gn >= ZERO) {
      const ex = X(s.a[0] + P.scale * g[0]);
      const ey = Y(s.a[1] + P.scale * g[1]);
      const L = Math.hypot(ex - A[0], ey - A[1]) || 1;
      gs = [(ex - A[0]) / L, (ey - A[1]) / L];
      const align: CanvasTextAlign = Math.abs(gs[0]) < 0.4 ? 'center' : gs[0] > 0 ? 'left' : 'right';
      label('∇f(a)', ex + gs[0] * 10, ey + gs[1] * 12, p.eps, align);
    }
    const vx = X(s.a[0] + vl * v[0]);
    const vy = Y(s.a[1] + vl * v[1]);
    const vs = [v[0], -v[1]]; // v on the screen (y down)
    let nrm = [-vs[1], vs[0]];
    if (nrm[0] * gs[0] + nrm[1] * gs[1] > 0) nrm = [-nrm[0], -nrm[1]];
    label('v', vx + nrm[0] * 13, vy + nrm[1] * 13, p.delta, 'center');
    label('a', A[0] - 8, A[1] + 12, p.ink, 'right');
    ctx.restore();

    // legend: the function, LTR; on a phone in the strip above the plot, left of the tool buttons
    ctx.save();
    ctx.font = `600 ${narrow ? 11 : 13}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = p.curve;
    if (narrow) ctx.fillText(P.formula, 8, 16, Math.max(60, view.w - toolsW - 8));
    else {
      ctx.strokeStyle = p.paper;
      ctx.lineWidth = 4;
      ctx.strokeText(P.formula, box.x + 8, box.y + 14);
      ctx.fillText(P.formula, box.x + 8, box.y + 14);
    }
    ctx.restore();

    // ---------------- lower panel: θ ↦ D_v f(a)
    // room on the left for tick labels such as −2.24, on the right for half of 360°
    const box2 = insetBox({ x: 0, y: splitY, w: view.w, h: view.h - splitY }, { l: narrow ? 40 : 44, r: 16, t: narrow ? 22 : 12, b: 22 });
    const top = Math.max(gn * 1.2, 0.5);
    const plot2 = makePlot(
      box2,
      { min: 0, max: 360, ticks: [0, 90, 180, 270, 360], format: (d) => `${d}°` },
      { min: -top, max: top, ticks: gn >= ZERO ? [-Number(gn.toPrecision(3)), 0, Number(gn.toPrecision(3))] : [0], format: (y) => fmtNum(y) },
    );
    drawAxes(ctx, plot2, p);
    const X2 = plot2.px;
    const Y2 = plot2.py;
    ctx.save();
    ctx.beginPath();
    // wide enough for the whole point at θ = 0° and 360°
    ctx.rect(box2.x - 8, box2.y - 2, box2.w + 16, box2.h + 4);
    ctx.clip();
    // the Cauchy–Schwarz bounds ±‖∇f(a)‖₂
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = p.limit;
    ctx.lineWidth = 1.4;
    for (const yv of [gn, -gn]) {
      ctx.beginPath();
      ctx.moveTo(box2.x, Y2(yv));
      ctx.lineTo(box2.x + box2.w, Y2(yv));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // the curve
    ctx.strokeStyle = p.curve;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let d = 0; d <= 360; d += 1) {
      const yv = rate(P, s.a, d);
      if (d === 0) ctx.moveTo(X2(d), Y2(yv));
      else ctx.lineTo(X2(d), Y2(yv));
    }
    ctx.stroke();
    // the current θ: a vertical guide and the point, filled at the steepest direction, hollow with a ring elsewhere
    ctx.strokeStyle = withAlpha(p.delta, 0.7);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(X2(s.deg), box2.y);
    ctx.lineTo(X2(s.deg), box2.y + box2.h);
    ctx.stroke();
    const best = vd === 'steepest';
    ctx.beginPath();
    ctx.arc(X2(s.deg), Y2(D), 5.5, 0, 2 * Math.PI);
    ctx.fillStyle = best ? p.pointIn : p.paper;
    ctx.fill();
    ctx.strokeStyle = best ? p.pointIn : p.pointOut;
    ctx.lineWidth = best ? 1 : 2.2;
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.font = `600 ${narrow ? 11 : 12}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = p.curve;
    if (narrow) ctx.fillText('θ ↦ D_v f(a)', box2.x, box2.y - 11);
    else {
      // outlined in paper colour: it sits on the dashed bound line
      ctx.strokeStyle = p.paper;
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.strokeText('θ ↦ D_v f(a)', box2.x + 8, box2.y + 10);
      ctx.fillText('θ ↦ D_v f(a)', box2.x + 8, box2.y + 10);
    }
    ctx.restore();
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1, worldHeight: 1.1, animate: false });
  useEffect(invalidate, [s, levels, through]);

  const aFromPointer = (e: PointerEvent): V2 | null => {
    const pl = planeRef.current;
    if (!pl) return null;
    const { box } = pl;
    if (e.offsetY > box.y + box.h + 8 || e.offsetY < box.y - 8) return null;
    const x = pl.x.min + ((e.offsetX - box.x) / box.w) * (pl.x.max - pl.x.min);
    const y = pl.y.max - ((e.offsetY - box.y) / box.h) * (pl.y.max - pl.y.min);
    return [snap(x, P.half), snap(y, P.half)];
  };
  const same = (u: V2, w: V2) => u[0] === w[0] && u[1] === w[1];
  const onPointerDown = (e: PointerEvent) => {
    const a = aFromPointer(e);
    if (a === null) return;
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (!same(a, s.a)) userSet({ a });
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging.current) return;
    const a = aFromPointer(e);
    if (a !== null && !same(a, s.a)) userSet({ a });
  };
  const onPointerUp = () => {
    dragging.current = false;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const big = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const dx = e.key === 'ArrowRight' ? 0.1 : e.key === 'ArrowLeft' ? -0.1 : 0;
      const dy = e.key === 'ArrowUp' ? 0.1 : e.key === 'ArrowDown' ? -0.1 : 0;
      userSet({ a: [snap(s.a[0] + dx * big, P.half), snap(s.a[1] + dy * big, P.half)] });
    } else if (e.key === '[' || e.key === ']') {
      e.preventDefault();
      userSet({ deg: normDeg(s.deg + (e.key === ']' ? 1 : -1) * big) });
    }
  };

  const offered = (props.presets ?? []).filter((id) => id in PRESETS);
  const verdictText =
    vd === 'zero'
      ? 'הגרדיאנט מתאפס ב-a: הנגזרת הכיוונית 0 בכל כיוון, והגרף שלמטה הוא הקו האפס.'
      : vd === 'steepest'
        ? 'v בכיוון הגרדיאנט: זו העלייה המהירה ביותר, והקצב הוא ‖∇f(a)‖.'
        : vd === 'descent'
          ? 'v נגד הגרדיאנט: זו הירידה המהירה ביותר.'
          : vd === 'level'
            ? 'v ניצב לגרדיאנט: הנגזרת הכיוונית 0, ו-v על הקו המשיק לקו הגובה.'
            : `הזווית בין v לגרדיאנט: ${Math.round(gapDeg(s.deg, phi ?? 0))}°.`;

  const readout = (
    <>
      <span data-readout="point">
        <Q>{P.formula}</Q>, <Q>{`a = (${r4(s.a[0])}, ${r4(s.a[1])})`}</Q>, <Q>{`f(a) = ${r4(fa)}`}</Q>
      </span>
      <span data-readout="grad">
        <Q>{`∇f(a) = (${r4(g[0])}, ${r4(g[1])})`}</Q>, <Q>{`‖∇f(a)‖₂ = ${r4(gn)}`}</Q>
        {gn >= ZERO && P.scale !== 1 ? <> (החץ מצויר בקנה מידה <Q>{`${fmtNum(P.scale)} : 1`}</Q>)</> : null}
      </span>
      <span data-readout="rate">
        <Q>{`v = (${r4(v[0])}, ${r4(v[1])})`}</Q> בזווית <Q>{`${s.deg}°`}</Q>, <Q>{`D_v f(a) = ∇f(a)·v = ${r4(D)}`}</Q>
      </span>
      <span data-readout="verdict">{verdictText}</span>
    </>
  );

  const controls = (
    <>
      {offered.length > 1 && (
        <div class="group" role="group" aria-label="הפונקציה">
          {offered.map((id) => (
            <Toggle key={id} label={<bdi dir="ltr">{PRESETS[id].formula}</bdi>} on={s.preset === id} onChange={() => userSet({ preset: id })} />
          ))}
        </div>
      )}
      <Slider label="הכיוון של v (מעלות)" value={s.deg} min={0} max={359} step={1} format={(d) => `${Math.round(d)}°`} onChange={(d) => userSet({ deg: normDeg(d) })} />
      <Slider label="a₁" value={s.a[0]} min={-P.half} max={P.half} step={0.1} format={r4} onChange={(x) => userSet({ a: [snap(x, P.half), s.a[1]] })} />
      <Slider label="a₂" value={s.a[1]} min={-P.half} max={P.half} step={0.1} format={r4} onChange={(y) => userSet({ a: [s.a[0], snap(y, P.half)] })} />
    </>
  );

  return (
    <SimShell
      fig={props.id}
      label={`איור חי: קווי הגובה של פונקציה, נקודה a, הגרדיאנט בה, הקו המשיק לקו הגובה דרך a, וכיוון v; למטה, הנגזרת הכיוונית כפונקציה של הזווית של v. גררו כדי להזיז את a; במקלדת: החצים מזיזים את a, ומקשי הסוגריים המרובעים מסובבים את v. ${describeState(P, s.a, s.deg)}`}
      canvasRef={canvasRef}
      aspect={1 / 1.1}
      live={live}
      tasks={tasks}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      cursor="crosshair"
      onReset={() => {
        setS(fresh(props));
        setLive('האיור אופס.');
      }}
      readout={readout}
      controls={controls}
    />
  );
}
