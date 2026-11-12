/**
 * Lesson 4.5's figure: Bernstein polynomials (הגדרה 4.5.1).
 *
 * Top panel: a function f ∈ C[0,1] (the limit, in the --limit colour) and its Bernstein polynomial B_n f (the
 * sequence, in the --curve colour), with the tube {|y − f| < e} about f in the ε colours, where e is the sampled sup
 * error ‖B_n f − f‖∞; a dashed vertical line at the chosen point x, with B_n f(x) (filled) and f(x) (hollow).
 * Bottom panel: the binomial weights b_{n,k}(x), k = 0..n, as bars at k/n, with the δ-band (x − δ, x + δ) in the δ
 * colours: bars inside it are filled (--point-in), bars outside are hollow outlines (--point-out). The readout gives
 * the far weight Σ_{|k/n − x| ≥ δ} b_{n,k}(x) next to the bound x(1 − x)/(nδ²) of למה 4.5.3(ב), used in the proof of משפט 4.5.4.
 *
 * Every number comes from src/math/bernstein.ts; the sup error is a sampled probe and the caption says so.
 * No animation.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import {
  FN_IDS,
  PRESETS,
  chebyshevBound,
  describe,
  farMass,
  fmtNum,
  lipschitzBound,
  nodeValues,
  bernsteinAt,
  presetError,
  weights,
  type FnId,
} from '~/math/bernstein';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { drawAxes, insetBox, makePlot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

/** a left-to-right island inside Hebrew text (U+2066 … U+2069) */
const ltr = (s: string) => `⁦${s}⁩`;

const TASK_LABEL: Record<string, string> = {
  'square-n': `בפונקציה ${ltr('x²')}, מצאו ${ltr('n')} שבו השגיאה המרבית לכל היותר ${ltr('0.005')}.`,
  'far-mass': `בחרו ${ltr('x')} בין ${ltr('0.4')} ל-${ltr('0.6')} ו-${ltr('δ = 0.1')}, והגדילו את ${ltr('n')} עד שמשקל המוטות הרחוקים קטן מ-${ltr('0.05')}.`,
  'abs-quarter': `בפונקציה ${ltr('|x − 1/2|')}, הציגו שגיאה ב-${ltr('n')} כלשהו וב-${ltr('4n')}, והשוו.`,
  'osc-tenth': `בפונקציה ${ltr('sin(1/(x + 0.1))')}, מצאו ${ltr('n')} שבו השגיאה המרבית קטנה מ-${ltr('0.1')}.`,
};

const N_MAX = 600;
const clampN = (v: number) => Math.max(1, Math.min(N_MAX, Math.round(v)));
const clampX = (v: number) => Math.max(0, Math.min(1, Math.round(v * 100) / 100));
const clampD = (v: number) => Math.max(0.02, Math.min(0.3, Math.round(v * 100) / 100));

interface State {
  fn: FnId;
  n: number;
  x: number;
  delta: number;
}

export interface BernsteinFitProps {
  id: string;
  fn?: FnId;
  fns?: FnId[];
  n?: number;
  x?: number;
  delta?: number;
  tasks?: string[];
}

function fresh(p: BernsteinFitProps): State {
  return {
    fn: p.fn && p.fn in PRESETS ? p.fn : 'square',
    n: clampN(typeof p.n === 'number' ? p.n : 5),
    x: clampX(typeof p.x === 'number' ? p.x : 0.3),
    delta: clampD(typeof p.delta === 'number' ? p.delta : 0.1),
  };
}

const Qm = (p: { children: string }) => (
  <b class="q">
    <bdi dir="ltr">{p.children}</bdi>
  </b>
);

/** three significant figures, plain decimals down to 10⁻⁴ (the readouts compare errors like 0.005 and 0.05 by eye) */
const short = (v: number) => {
  if (v === 0 || Math.abs(v) < 1e-4) return fmtNum(v);
  return String(Number(v.toPrecision(3))).replace('-', '−');
};

export default function BernsteinFit(props: BernsteinFitProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  /** n values the student visited, per function (the abs-quarter task) */
  const visited = useRef<Map<FnId, Set<number>>>(new Map());
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const has = (t: string) => props.tasks?.includes(t) ?? false;

  const P = PRESETS[s.fn];
  const err = presetError(s.fn, s.n).err;
  const vals = nodeValues(P.f, s.n);
  const bx = bernsteinAt(vals, s.x);
  const far = farMass(s.n, s.x, s.delta);
  const bound = chebyshevBound(s.n, s.x, s.delta);

  /** The student's own change: a text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    setS(next);
    const id = props.id;
    const e = presetError(next.fn, next.n).err;
    const seen = visited.current.get(next.fn) ?? new Set<number>();
    seen.add(next.n);
    visited.current.set(next.fn, seen);
    if (has('square-n') && next.fn === 'square' && e <= 0.005 + 1e-12) markTask(`${id}:square-n`);
    if (has('osc-tenth') && next.fn === 'osc' && e < 0.1) markTask(`${id}:osc-tenth`);
    if (has('abs-quarter') && next.fn === 'abs' && [...seen].some((m) => seen.has(4 * m))) markTask(`${id}:abs-quarter`);
    if (
      has('far-mass') &&
      next.x >= 0.4 - 1e-9 &&
      next.x <= 0.6 + 1e-9 &&
      Math.abs(next.delta - 0.1) < 1e-9 &&
      farMass(next.n, next.x, next.delta) < 0.05
    )
      markTask(`${id}:far-mass`);
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.fn === 'string' && st.fn in PRESETS) next.fn = st.fn as FnId;
          if (typeof st.n === 'number') next.n = clampN(st.n);
          if (typeof st.x === 'number') next.x = clampX(st.x);
          if (typeof st.delta === 'number') next.delta = clampD(st.delta);
          return next;
        });
      }),
    [props.id],
  );

  useEffect(() => {
    const t = setTimeout(() => setLive(describe(s)), 300);
    return () => clearTimeout(t);
  }, [s]);

  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const outer = { x: 0, y: 0, w: view.w, h: view.h };
    const split = view.h * 0.6;
    const top = insetBox({ ...outer, h: split }, { l: narrow ? 40 : 48, r: 14, t: 12, b: 26 });
    const bot = insetBox({ x: 0, y: split, w: view.w, h: view.h - split }, { l: narrow ? 40 : 48, r: 14, t: 8, b: 26 });

    // ---- top: f, B_n f and the tube of radius = the sampled sup error
    const plot = makePlot(top, { min: 0, max: 1 }, { min: P.y[0], max: P.y[1] });
    drawAxes(ctx, plot, p);
    const X = plot.px;
    const Y = plot.py;
    const M = 400;
    const fx = Array.from({ length: M + 1 }, (_, i) => P.f(i / M));
    const bxs = Array.from({ length: M + 1 }, (_, i) => bernsteinAt(vals, i / M));

    ctx.save();
    ctx.beginPath();
    ctx.rect(top.x, top.y, top.w, top.h);
    ctx.clip();

    ctx.beginPath();
    for (let i = 0; i <= M; i++) ctx.lineTo(X(i / M), Y(fx[i] + err));
    for (let i = M; i >= 0; i--) ctx.lineTo(X(i / M), Y(fx[i] - err));
    ctx.closePath();
    ctx.fillStyle = p.epsBand;
    ctx.fill();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = p.eps;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    // the chosen point x
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = p.delta;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(X(s.x), top.y);
    ctx.lineTo(X(s.x), top.y + top.h);
    ctx.stroke();
    ctx.setLineDash([]);

    // f (the limit) and B_n f (the sequence)
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = p.limit;
    ctx.beginPath();
    fx.forEach((v, i) => (i ? ctx.lineTo(X(i / M), Y(v)) : ctx.moveTo(X(0), Y(v))));
    ctx.stroke();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = p.curve;
    ctx.beginPath();
    bxs.forEach((v, i) => (i ? ctx.lineTo(X(i / M), Y(v)) : ctx.moveTo(X(0), Y(v))));
    ctx.stroke();

    // B_n f(x): filled; f(x): hollow
    ctx.beginPath();
    ctx.arc(X(s.x), Y(bx), 4.5, 0, 2 * Math.PI);
    ctx.fillStyle = p.curve;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(X(s.x), Y(P.f(s.x)), 5, 0, 2 * Math.PI);
    ctx.fillStyle = p.paper;
    ctx.fill();
    ctx.strokeStyle = p.limit;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();

    // legend, LTR, in the corner of the panel that the curves and the tube cross least (sin(1/(x + 0.1)) fills the
    // top left, |x − 1/2| the top corners). The top right holds the figure's reset and full-screen buttons: never there.
    ctx.save();
    ctx.font = `600 ${narrow ? 12 : 13}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const legend = [`f = ${P.formula}`, `Bₙf, n = ${s.n}`];
    const lw = Math.max(...legend.map((t) => ctx.measureText(t).width)) + 4;
    const lh = 36;
    const lowY = top.y + top.h - lh - 2;
    const spots = [
      { x: top.x + 8, y: top.y + 3 },
      { x: top.x + (top.w - lw) / 2, y: top.y + 3 },
      { x: top.x + top.w - lw - 6, y: lowY },
      { x: top.x + 8, y: lowY },
      { x: top.x + (top.w - lw) / 2, y: lowY },
    ];
    const crossings = (b: { x: number; y: number }) => {
      let c = 0;
      for (let i = 0; i <= M; i++) {
        const cx = X(i / M);
        if (cx < b.x || cx > b.x + lw) continue;
        const hi = Math.min(Y(fx[i] + err), Y(bxs[i]));
        const lo = Math.max(Y(fx[i] - err), Y(bxs[i]));
        if (lo >= b.y && hi <= b.y + lh) c++;
      }
      return c;
    };
    let spot = spots[0];
    let best = Infinity;
    for (const b of spots) {
      const c = crossings(b);
      if (c < best) {
        best = c;
        spot = b;
      }
    }
    ctx.fillStyle = p.limit;
    ctx.fillText(legend[0], spot.x, spot.y + 9);
    ctx.fillStyle = p.curve;
    ctx.fillText(legend[1], spot.x, spot.y + 27);
    ctx.restore();

    // ---- bottom: the weights b_{n,k}(x) as bars at k/n
    const w = weights(s.n, s.x);
    const wmax = Math.max(...w);
    const bplot = makePlot(bot, { min: 0, max: 1 }, { min: 0, max: wmax * 1.12, ticks: [0, Number(wmax.toPrecision(2))] });
    drawAxes(ctx, bplot, p, { grid: false });
    ctx.save();
    ctx.beginPath();
    ctx.rect(bot.x, bot.y - 2, bot.w, bot.h + 4);
    ctx.clip();
    // the δ-band (x − δ, x + δ)
    ctx.fillStyle = p.deltaBand;
    ctx.fillRect(bplot.px(s.x - s.delta), bot.y, bplot.px(s.x + s.delta) - bplot.px(s.x - s.delta), bot.h);
    ctx.strokeStyle = p.delta;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    for (const e of [s.x - s.delta, s.x + s.delta]) {
      ctx.beginPath();
      ctx.moveTo(bplot.px(e), bot.y);
      ctx.lineTo(bplot.px(e), bot.y + bot.h);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    const bw = Math.max(1.5, Math.min(14, (bot.w / (s.n + 1)) * 0.7));
    for (let k = 0; k <= s.n; k++) {
      const h = bplot.py(0) - bplot.py(w[k]);
      if (h < 0.3) continue;
      const cx = bplot.px(k / s.n);
      const near = Math.abs(k / s.n - s.x) < s.delta - 1e-12;
      if (near) {
        ctx.fillStyle = p.pointIn;
        ctx.fillRect(cx - bw / 2, bplot.py(w[k]), bw, h);
      } else {
        ctx.strokeStyle = p.pointOut;
        ctx.lineWidth = Math.min(1.6, bw / 2);
        ctx.strokeRect(cx - bw / 2 + 0.5, bplot.py(w[k]) + 0.5, Math.max(0.5, bw - 1), Math.max(0.5, h - 1));
      }
    }
    ctx.restore();
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1.2, worldHeight: 1, animate: false });
  useEffect(invalidate, [s]);

  const onKeyDown = (e: KeyboardEvent) => {
    const up = e.key === 'ArrowUp' || e.key === 'ArrowRight';
    const down = e.key === 'ArrowDown' || e.key === 'ArrowLeft';
    if (!up && !down) return;
    e.preventDefault();
    userSet({ n: clampN(s.n + (up ? 1 : -1) * (e.shiftKey ? 10 : 1)) });
  };

  const offered = (props.fns ?? FN_IDS).filter((id) => id in PRESETS);

  const readout = (
    <>
      <span data-readout="err">
        השגיאה המרבית (בדגימה): <Qm>{`‖Bₙf − f‖∞ ≈ ${short(err)}`}</Qm>
      </span>
      <span data-readout="at-x">
        <Qm>{`Bₙf(${fmtNum(s.x)}) = ${short(bx)},  f(${fmtNum(s.x)}) = ${short(P.f(s.x))}`}</Qm>
      </span>
      <span data-readout="far">
        משקל המוטות הרחוקים, <Qm>{`|k/n − x| ≥ δ`}</Qm>: <Qm>{short(far)}</Qm>; החסם של למה 4.5.3(ב){' '}
        <Qm>{`x(1 − x)/(nδ²) = ${short(bound)}`}</Qm>
      </span>
      <span data-readout="lip">
        החסם של טענה 4.5.4א: <Qm>{`L/(2√n) = ${short(lipschitzBound(P.lip, s.n))}`}</Qm> עם <Qm>{`L = ${P.lip}`}</Qm>
      </span>
    </>
  );

  const controls = (
    <>
      {offered.length > 1 && (
        <div class="group" role="group" aria-label="הפונקציה">
          {offered.map((id) => (
            <Toggle key={id} label={<bdi dir="ltr">{PRESETS[id].formula}</bdi>} on={s.fn === id} onChange={() => userSet({ fn: id })} />
          ))}
        </div>
      )}
      <Slider label="n" value={s.n} min={1} max={N_MAX} step={1} format={(v) => String(clampN(v))} onChange={(v) => userSet({ n: clampN(v) })} />
      <Slider label="x" value={s.x} min={0} max={1} step={0.01} format={(v) => fmtNum(clampX(v))} onChange={(v) => userSet({ x: clampX(v) })} />
      <Slider label="δ" value={s.delta} min={0.02} max={0.3} step={0.01} format={(v) => fmtNum(clampD(v))} onChange={(v) => userSet({ delta: clampD(v) })} />
    </>
  );

  return (
    <SimShell
      fig={props.id}
      label={`איור חי: למעלה פונקציה f על הקטע [0, 1] ופולינום ברנשטיין שלה, עם רצועה ברוחב השגיאה המרבית סביב f; למטה המשקלות הבינומיים בנקודה x כמוטות, ורצועת δ סביב x. במקלדת: חצים משנים את n. ${describe(s)}`}
      canvasRef={canvasRef}
      aspect={1.2}
      live={live}
      tasks={tasks}
      onKeyDown={onKeyDown}
      onReset={() => {
        visited.current = new Map();
        setS(fresh(props));
        setLive('האיור אופס.');
      }}
      readout={readout}
      controls={controls}
    />
  );
}
