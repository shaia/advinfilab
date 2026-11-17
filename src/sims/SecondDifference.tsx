/**
 * Lesson 5.7's figure: the second-difference quotient Q(h, k) = Δ(h, k)/(hk) near a point (a, b).
 *
 * Upper panel: the square [−r, r]² of (h, k), shaded by Q − c (c the centre of the scale: the common mixed partial for
 * a smooth f, 0 for the counterexample), warm above c and cool below, with the level curves Q = c, c ± 0.4, c ± 0.8
 * (shape, not only colour) and, for a smooth f, the dashed ε-band lines Q = c ± 0.01. A probe point (h, k) = (u·r, v·r),
 * dragged or set by the sliders, carries the two iterated paths of the lesson: path 1 sends h to 0 first (horizontal,
 * then down the k-axis), path 2 sends k to 0 first (vertical, then along the h-axis).
 *
 * Lower panel: the inner limits as functions of the remaining variable s ∈ [−r, r]:
 *   1: A(s) = lim_{h→0} Q(h, s) = (∂ₓf(a, b + s) − ∂ₓf(a, b))/s, whose limit at 0 is ∂²f/∂y∂x(a, b) (filled point);
 *   2: B(s) = lim_{k→0} Q(s, k) = (∂_y f(a + s, b) − ∂_y f(a, b))/s, whose limit at 0 is ∂²f/∂x∂y(a, b) (hollow point);
 *   and the diagonal Q(s, s), the path of the proof.
 *
 * Every number comes from src/math/mixed.ts (closed-form partial derivatives). The square is sampled on a grid: the
 * caption says the readout of the whole square is a probe. No animation.
 */

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  PRESETS,
  diagonal,
  fmtSig,
  innerH,
  innerK,
  quotient,
  squareStats,
  type Preset,
  type PresetId,
} from '~/math/mixed';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { contourLines } from './core/contour';
import { chevron, mix, withAlpha } from './core/ink';
import { drawAxes, drawCurve, insetBox, makePlot, niceTicks, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

/** a left-to-right island inside Hebrew text (U+2066 … U+2069), with no-break spaces so it never wraps */
const ltr = (s: string) => `⁦${s.replace(/ /g, '\u00a0')}⁩`;

const TASK_LABEL: Record<string, string> = {
  settle: `בפונקציה חלקה: הקטינו את הריבוע עד שכל ערכי המנה בו במרחק פחות מ-${ltr('0.01')} מהנגזרת המעורבת (הקווים המקווקווים יוצאים מהריבוע).`,
  'minus-one': `בדוגמה הנגדית, בריבוע ברדיוס ${ltr('r ≤ 0.01')}: מצאו נקודה שבה המנה קטנה מ-${ltr('−0.98')}.`,
  'plus-one': `בדוגמה הנגדית, בריבוע ברדיוס ${ltr('r ≤ 0.01')}: מצאו נקודה שבה המנה גדולה מ-${ltr('0.98')}.`,
  half: `בדוגמה הנגדית, בריבוע ברדיוס ${ltr('r ≤ 0.001')}: מצאו נקודה שבה המנה במרחק לכל היותר ${ltr('0.02')} מ-${ltr('0.5')}.`,
};

const LOGR_MIN = -4;
const LOGR_MAX = 0;
const BAND = 0.01;
const clampLog = (v: number) => Math.min(LOGR_MAX, Math.max(LOGR_MIN, Math.round(v * 100) / 100));
const clampUnit = (v: number) => Math.min(1, Math.max(-1, Math.round(v * 100) / 100));

interface State {
  preset: PresetId;
  logr: number;
  u: number;
  v: number;
}

export interface SecondDifferenceProps {
  id: string;
  preset?: PresetId;
  presets?: PresetId[];
  /** the half-width r of the square (10⁻⁴ ≤ r ≤ 1) */
  r?: number;
  /** the probe as fractions of r */
  u?: number;
  v?: number;
  tasks?: string[];
}

function fresh(p: SecondDifferenceProps): State {
  const preset: PresetId = p.preset && p.preset in PRESETS ? p.preset : 'x3y2';
  return {
    preset,
    logr: clampLog(Math.log10(typeof p.r === 'number' && p.r > 0 ? p.r : 1)),
    u: clampUnit(typeof p.u === 'number' ? p.u : 0.6),
    v: clampUnit(typeof p.v === 'number' ? p.v : 0.3),
  };
}

const Q = (p: { children: string }) => (
  <b class="q">
    <bdi dir="ltr">{p.children}</bdi>
  </b>
);

const rOf = (s: State) => 10 ** s.logr;
const fmtR = (logr: number) => fmtSig(10 ** logr, 3);

/** Which tasks a state completes. A text step never calls this: only the student's own changes do. */
function completed(s: State, tasks: string[]): string[] {
  const P = PRESETS[s.preset];
  const r = rOf(s);
  const q = quotient(P, s.u * r, s.v * r);
  const done: string[] = [];
  if (tasks.includes('settle') && P.smooth && squareStats(P, r).dev < BAND) done.push('settle');
  if (!P.smooth && Number.isFinite(q)) {
    if (tasks.includes('minus-one') && r <= 0.01 * (1 + 1e-9) && q <= -0.98) done.push('minus-one');
    if (tasks.includes('plus-one') && r <= 0.01 * (1 + 1e-9) && q >= 0.98) done.push('plus-one');
    if (tasks.includes('half') && r <= 0.001 * (1 + 1e-9) && Math.abs(q - 0.5) <= 0.02) done.push('half');
  }
  return done;
}

export default function SecondDifference(props: SecondDifferenceProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const squareRef = useRef<Plot | null>(null);
  const dragging = useRef(false);
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));

  const P: Preset = PRESETS[s.preset];
  const r = rOf(s);
  const h0 = s.u * r;
  const k0 = s.v * r;
  const q0 = quotient(P, h0, k0);
  const stats = useMemo(() => squareStats(P, r), [s.preset, s.logr]);

  /** The student's own change. A text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    setS(next);
    for (const t of completed(next, props.tasks ?? [])) markTask(`${props.id}:${t}`);
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.preset === 'string' && st.preset in PRESETS) next.preset = st.preset as PresetId;
          if (typeof st.r === 'number' && st.r > 0) next.logr = clampLog(Math.log10(st.r));
          if (typeof st.u === 'number') next.u = clampUnit(st.u);
          if (typeof st.v === 'number') next.v = clampUnit(st.v);
          return next;
        });
      }),
    [props.id],
  );

  const describe = () => {
    const qs = Number.isFinite(q0) ? `המנה ${ltr(`Δ(h,k)/(hk) = ${fmtSig(q0)}`)}` : 'הנקודה על ציר, והמנה אינה מוגדרת בה';
    const sq = P.smooth
      ? `בריבוע כולו (ברשת של נקודות) המרחק הגדול ביותר מ-${ltr(fmtSig(P.centre))} הוא ${ltr(fmtSig(stats.dev))}`
      : `בריבוע כולו (ברשת של נקודות) המנה בין ${ltr(fmtSig(stats.min))} ל-${ltr(fmtSig(stats.max))}`;
    return `${ltr(P.formula)} סביב ${ltr(P.pointLabel)}, ריבוע ברדיוס ${ltr(fmtR(s.logr))}. בנקודה ${ltr(`(h, k) = (${fmtSig(h0, 3)}, ${fmtSig(k0, 3)})`)}: ${qs}. ${sq}.`;
  };
  useEffect(() => {
    const t = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(t);
  }, [s]);

  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const splitY = view.h * 0.6;
    const c = P.centre;
    // the round tool buttons (reset, full screen) sit over the top-right corner: keep the legend left of them
    const toolsW = 2 * 34 + 6 + 8 + 8;
    const fmtTick = (v: number) => (v === 0 ? '0' : fmtSig(v, 2));

    // ---------------- legend strip
    ctx.save();
    ctx.font = `600 ${narrow ? 11 : 13}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = p.curve;
    const room = Math.max(60, view.w - toolsW - 8);
    ctx.fillText(`${P.formula},  (a, b) = ${P.pointLabel}`, 8, 14, room);
    ctx.fillStyle = p.ink2;
    ctx.fillText(`Q(h, k) = Δ(h, k)/(hk),  |h|, |k| ≤ r = ${fmtR(s.logr)}`, 8, 32, room);
    ctx.restore();

    // ---------------- upper panel: the square of (h, k)
    const outer = insetBox({ x: 0, y: 0, w: view.w, h: splitY }, { l: narrow ? 40 : 48, r: 14, t: 46, b: 24 });
    const side = Math.max(40, Math.min(outer.w, outer.h));
    const sq = { x: outer.x + (outer.w - side) / 2, y: outer.y, w: side, h: side };
    const plot = makePlot(sq, { min: -r, max: r, ticks: [-r, 0, r], format: fmtTick }, { min: -r, max: r, ticks: [-r, 0, r], format: fmtTick });
    squareRef.current = plot;
    const X = plot.px;
    const Y = plot.py;

    // the shading: cell centres never fall on an axis (an even number of cells)
    const C = narrow ? 64 : 100;
    const cw = side / C;
    for (let i = 0; i < C; i++) {
      const hv = -r + ((i + 0.5) * 2 * r) / C;
      for (let j = 0; j < C; j++) {
        const kv = -r + ((j + 0.5) * 2 * r) / C;
        const t = Math.max(-1, Math.min(1, quotient(P, hv, kv) - c));
        ctx.fillStyle = t >= 0 ? mix(p.paper, p.pos, 0.7 * t) : mix(p.paper, p.neg, -0.7 * t);
        ctx.fillRect(sq.x + i * cw, sq.y + sq.h - (j + 1) * cw, cw + 0.6, cw + 0.6);
      }
    }
    drawAxes(ctx, plot, p, { grid: false });

    ctx.save();
    ctx.beginPath();
    ctx.rect(sq.x, sq.y, sq.w, sq.h);
    ctx.clip();
    // the axes h = 0 and k = 0, where Q is not defined
    ctx.strokeStyle = p.ink3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(X(0), sq.y);
    ctx.lineTo(X(0), sq.y + sq.h);
    ctx.moveTo(sq.x, Y(0));
    ctx.lineTo(sq.x + sq.w, Y(0));
    ctx.stroke();

    // level curves of Q (odd node count: no node on an axis)
    const box = { xmin: -r, xmax: r, ymin: -r, ymax: r };
    const nodes = narrow ? 61 : 91;
    const stroke = (pts: readonly (readonly [number, number])[]) => {
      ctx.beginPath();
      pts.forEach(([hv, kv], i) => (i ? ctx.lineTo(X(hv), Y(kv)) : ctx.moveTo(X(hv), Y(kv))));
      ctx.stroke();
    };
    const levels = contourLines((hv, kv) => Math.max(-0.9, Math.min(0.9, quotient(P, hv, kv) - c)), box, {
      nx: nodes,
      ny: nodes,
      step: 0.4,
      offset: 0,
    });
    ctx.strokeStyle = withAlpha(p.curve, 0.55);
    ctx.lineWidth = 1;
    for (const L of levels) stroke(L.points);
    if (P.smooth) {
      const band = contourLines((hv, kv) => Math.max(-2 * BAND, Math.min(2 * BAND, quotient(P, hv, kv) - c)), box, {
        nx: nodes,
        ny: nodes,
        step: 2 * BAND,
        offset: 0.5,
      });
      ctx.strokeStyle = p.eps;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([6, 4]);
      for (const L of band) stroke(L.points);
      ctx.setLineDash([]);
    }

    // the two iterated paths from the probe
    const px = X(h0);
    const py = Y(k0);
    const path = (pts: [number, number][], dash: number[], color: string) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash(dash);
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.restore();
      for (let i = 1; i < pts.length; i++) {
        const [x1, y1] = pts[i - 1];
        const [x2, y2] = pts[i];
        const L = Math.hypot(x2 - x1, y2 - y1);
        if (L > 14) chevron(ctx, (x1 + x2) / 2, (y1 + y2) / 2, (x2 - x1) / L, (y2 - y1) / L, 5, color);
      }
    };
    path([[px, py], [X(0), py], [X(0), Y(0)]], [7, 4], p.delta);
    path([[px, py], [px, Y(0)], [X(0), Y(0)]], [2, 3], p.curve2);
    ctx.font = `700 12px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = p.delta;
    ctx.fillText('1', (px + X(0)) / 2, py + (k0 >= 0 ? -10 : 10));
    ctx.fillStyle = p.curve2;
    ctx.fillText('2', px + (h0 >= 0 ? 10 : -10), (py + Y(0)) / 2);

    // the probe: filled when Q is defined there (and, for a smooth f, inside the band), hollow otherwise
    const inBand = Number.isFinite(q0) && (!P.smooth || Math.abs(q0 - c) < BAND);
    ctx.beginPath();
    ctx.arc(px, py, 5.5, 0, 2 * Math.PI);
    ctx.fillStyle = inBand ? p.pointIn : p.paper;
    ctx.fill();
    ctx.strokeStyle = inBand ? p.paper : p.pointOut;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // axis names
    ctx.save();
    ctx.font = `italic 600 12px ${p.fontUi}`;
    ctx.fillStyle = p.ink;
    ctx.direction = 'ltr';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('h', sq.x + sq.w + 4, Y(0));
    // inside the square, beside the top of the k-axis: above the square the legend strip may reach the centre
    ctx.fillText('k', X(0) + 6, sq.y + 10);
    ctx.restore();

    // ---------------- lower panel: the inner limits and the diagonal against s
    const box2 = insetBox({ x: 0, y: splitY, w: view.w, h: view.h - splitY }, { l: narrow ? 40 : 48, r: 14, t: 22, b: 24 });
    let dev = 0;
    for (let i = 0; i <= 40; i++) {
      const sv = -r + (2 * r * (i + 0.5)) / 41;
      for (const v of [innerH(P, sv), innerK(P, sv), diagonal(P, sv)]) if (Number.isFinite(v)) dev = Math.max(dev, Math.abs(v - c));
    }
    for (const v of [P.dyx, P.dxy]) dev = Math.max(dev, Math.abs(v - c));
    const W = Math.min(25, Math.max(1.2, dev * 1.15));
    const plot2 = makePlot(
      box2,
      { min: -r, max: r, ticks: [-r, 0, r], format: fmtTick },
      { min: c - W, max: c + W, ticks: niceTicks(c - W, c + W, narrow ? 3 : 4), format: (v) => fmtSig(v, 3) },
    );
    drawAxes(ctx, plot2, p);
    // the diagonal is a thin solid line: path 1 is dashed and path 2 dotted, so shape alone tells the three apart
    drawCurve(ctx, plot2, (sv) => diagonal(P, sv), { color: p.ink3, width: 1.2, samples: 161 });
    drawCurve(ctx, plot2, (sv) => innerK(P, sv), { color: p.curve2, width: 2, dash: [2, 3], samples: 161 });
    drawCurve(ctx, plot2, (sv) => innerH(P, sv), { color: p.delta, width: 2, dash: [7, 4], samples: 161 });
    // the limits at s = 0: filled for path 1 (∂²f/∂y∂x), hollow for path 2 (∂²f/∂x∂y)
    const x0 = plot2.px(0);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x0, plot2.py(P.dyx), 5, 0, 2 * Math.PI);
    ctx.fillStyle = p.limit;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x0, plot2.py(P.dxy), 8, 0, 2 * Math.PI);
    ctx.strokeStyle = p.limit;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.font = `600 ${narrow ? 11 : 12}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const ly = box2.y - 11;
    ctx.fillStyle = p.delta;
    ctx.fillText('1:  h → 0 ⇒ k → 0', box2.x, ly);
    ctx.fillStyle = p.curve2;
    ctx.fillText('2:  k → 0 ⇒ h → 0', box2.x + (narrow ? 112 : 140), ly);
    ctx.fillStyle = p.ink2;
    ctx.fillText('Q(s, s)', box2.x + (narrow ? 224 : 280), ly);
    ctx.restore();
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1, worldHeight: 1.1, animate: false });
  useEffect(invalidate, [s, stats]);

  const fromPointer = (e: PointerEvent) => {
    const plot = squareRef.current;
    if (!plot) return null;
    const { box } = plot;
    if (e.offsetY > box.y + box.h + 12 || e.offsetY < box.y - 12 || e.offsetX < box.x - 12 || e.offsetX > box.x + box.w + 12) return null;
    return {
      u: clampUnit(((e.offsetX - box.x) / box.w) * 2 - 1),
      v: clampUnit(1 - ((e.offsetY - box.y) / box.h) * 2),
    };
  };
  const onPointerDown = (e: PointerEvent) => {
    const at = fromPointer(e);
    if (!at) return;
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    userSet(at);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging.current) return;
    const at = fromPointer(e);
    if (at && (at.u !== s.u || at.v !== s.v)) userSet(at);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const d = e.shiftKey ? 0.1 : 0.02;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      userSet({ u: clampUnit(s.u + (e.key === 'ArrowRight' ? d : -d)) });
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      userSet({ v: clampUnit(s.v + (e.key === 'ArrowUp' ? d : -d)) });
    } else if (e.key === '+' || e.key === '-' || e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      userSet({ logr: clampLog(s.logr + (e.key === '+' || e.key === 'PageUp' ? 0.1 : -0.1)) });
    }
  };

  const offered = (props.presets ?? []).filter((id) => id in PRESETS);

  const readout = (
    <>
      <span data-readout="fn">
        <Q>{P.formula}</Q> סביב הנקודה <Q>{P.pointLabel}</Q>, בריבוע ברדיוס <Q>{`r = ${fmtR(s.logr)}`}</Q>
      </span>
      <span data-readout="probe">
        בנקודה <Q>{`(h, k) = (${fmtSig(h0, 3)}, ${fmtSig(k0, 3)})`}</Q>:{' '}
        {Number.isFinite(q0) ? <Q>{`Δ(h, k)/(hk) = ${fmtSig(q0)}`}</Q> : <>הנקודה על ציר, ושם המנה אינה מוגדרת</>}
      </span>
      <span data-readout="iterated">
        מסלול 1 (קודם <Q>h → 0</Q>, אחר כך <Q>k → 0</Q>): <Q>{`∂²f/∂y∂x(a, b) = ${fmtSig(P.dyx)}`}</Q>; מסלול 2 (קודם{' '}
        <Q>k → 0</Q>): <Q>{`∂²f/∂x∂y(a, b) = ${fmtSig(P.dxy)}`}</Q>
      </span>
      <span data-readout="square">
        {P.smooth ? (
          <>
            בכל הריבוע (ברשת של נקודות): <Q>{`max |Q − ${fmtSig(P.centre)}| ≈ ${fmtSig(stats.dev)}`}</Q>
            {stats.dev < BAND ? <>, כלומר כל הריבוע בתוך הרצועה.</> : <>.</>}
          </>
        ) : (
          <>
            בכל הריבוע (ברשת של נקודות) המנה בין <Q>{fmtSig(stats.min, 3)}</Q> ל-<Q>{fmtSig(stats.max, 3)}</Q>, בכל רדיוס.
          </>
        )}
      </span>
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
      <Slider label="הרדיוס r" value={s.logr} min={LOGR_MIN} max={LOGR_MAX} step={0.05} format={fmtR} onChange={(v) => userSet({ logr: clampLog(v) })} />
      <Slider label="h/r" value={s.u} min={-1} max={1} step={0.01} format={(v) => fmtSig(clampUnit(v), 2)} onChange={(v) => userSet({ u: clampUnit(v) })} />
      <Slider label="k/r" value={s.v} min={-1} max={1} step={0.01} format={(v) => fmtSig(clampUnit(v), 2)} onChange={(v) => userSet({ v: clampUnit(v) })} />
    </>
  );

  return (
    <SimShell
      fig={props.id}
      label={`איור חי: מנת ההפרש השני של פונקציה בשני משתנים, צבועה על ריבוע של הזזות (h, k), עם קווי גובה, נקודה נבחרת ושני מסלולי הגבול הנשנה; למטה, הגבולות הפנימיים כפונקציה של המשתנה הנותר. במקלדת: חצים מזיזים את הנקודה, פלוס ומינוס משנים את הרדיוס. ${describe()}`}
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
