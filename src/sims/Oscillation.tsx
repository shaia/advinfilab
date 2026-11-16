/**
 * Lesson 2.7's figure, in two modes.
 *
 * mode 'osc' (fig-2-7a, הגדרה 2.7.8): the graph of f near a point a (ink), the δ-ball (a − δ, a + δ) as a vertical
 * strip in the δ colours, and the band of values of f on that ball, from inf to sup, in the ε colours; its height is
 * ω(f, a, δ). The value f(a) is a filled point. Shrinking δ shows ω settling to o(f, a): 2 for sgn at 0, 6 for
 * sin(1/x) with f(0) = 5, 1/4 for Thomae's T at 3/4, and ω → 0 for T at 1/√2. Graphs that cannot be drawn (dense
 * sets of values) are drawn as their two dense parts, dotted, and the caption says so.
 *
 * mode 'cone' (fig-2-7b, למה 2.7.20): a base f ∈ C[0,1] (the limit colour) with the sup-ball B(f, r) as a tube in the
 * ε colours, the polygonal line p through m + 1 equally spaced points of f (dashed), and g = p + φ (ink), φ the
 * sawtooth of height H = r/4 and slope ±L. At the chosen x ∈ [0, 1 − 1/n] the double cone {|y − g(x)| ≤ n(t − x)},
 * x < t < x + 1/n, is drawn in the δ colours: if the graph of g stays in it, x witnesses g ∈ Eₙ (filled point);
 * otherwise the worst escape is marked by a hollow point. A grid search over x is a probe, and the readout says so.
 *
 * Every number comes from src/math/oscillation.ts. No animation.
 */

import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  BASES,
  BASE_IDS,
  DELTAS,
  OSC,
  OSC_IDS,
  build,
  describeCone,
  describeOsc,
  fmtNum,
  goodPoint,
  hasGoodPoint,
  maxSlope,
  oscSup,
  sampledPolyError,
  thomaePoints,
  type BaseId,
  type OscId,
} from '~/math/oscillation';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { drawAxes, insetBox, makePlot, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

/** a left-to-right island inside Hebrew text (U+2066 … U+2069) */
const ltr = (s: string) => `⁦${s}⁩`;

const TASK_LABEL: Record<string, string> = {
  'sgn-two': `בפונקציית הסימן, הקטינו את δ עד ${ltr('δ ≤ 0.01')}. האם גובה רצועת הערכים יורד מתחת ל-2?`,
  'value-counts': `ב-${ltr('sin(1/x)')} עם ${ltr('f(0) = 5')}, הקטינו את δ עד ${ltr('δ ≤ 0.01')}, ושימו לב מאילו שני ערכים בנוי ההפרש.`,
  'thomae-rat': `בפונקציית תומה ב-${ltr('3/4')}, הקטינו את δ עד ${ltr('δ ≤ 0.05')}, וקראו את התנודה על הכדור. האם היא ממשיכה לרדת עם δ?`,
  'thomae-irr': `בפונקציית תומה ב-${ltr('1/√2')}, הקטינו את δ עד הערך הקטן ביותר במחוון. האם התנודה מתייצבת, כמו ב-${ltr('3/4')}?`,
  'polyline-close': `בפונקציה ${ltr('√x')}, הגדילו את m עד שהקו השבור p במרחק קטן מ-${ltr('r/2 = 0.1')} מ-f.`,
  'steep-near': `הגדילו את השיפוע של המסור ל-${ltr('L ≥ 100')}. האם g יוצאת מהצינור B(f, r)?`,
  escape: `בחרו n ו-L עם ${ltr('L > n + M')}, כך שבחיפוש על הרשת אין אף נקודה x שבה g נשארת בחרוט.`,
};

const R = 0.2;
const H = R / 4;
const clampM = (v: number) => Math.max(1, Math.min(40, Math.round(v)));
const clampL = (v: number) => Math.max(0, Math.min(200, Math.round(v)));
const clampN = (v: number) => Math.max(1, Math.min(6, Math.round(v)));
const clampX = (v: number, n: number) => Math.max(0, Math.min(1 - 1 / n, Math.round(v * 100) / 100));
const nearestDi = (d: number) => DELTAS.reduce((best, v, i) => (Math.abs(Math.log(v / d)) < Math.abs(Math.log(DELTAS[best] / d)) ? i : best), 0);

interface State {
  osc: OscId;
  di: number;
  base: BaseId;
  m: number;
  L: number;
  n: number;
  x: number;
}

export interface OscillationProps {
  id: string;
  mode?: 'osc' | 'cone';
  /** osc mode */
  osc?: OscId;
  oscs?: OscId[];
  delta?: number;
  /** cone mode */
  base?: BaseId;
  bases?: BaseId[];
  m?: number;
  L?: number;
  n?: number;
  x?: number;
  tasks?: string[];
}

function fresh(p: OscillationProps): State {
  const n = clampN(p.n ?? 3);
  return {
    osc: p.osc && p.osc in OSC ? p.osc : 'sgn',
    di: nearestDi(p.delta ?? 0.2),
    base: p.base && p.base in BASES ? p.base : 'sqrt',
    m: clampM(p.m ?? 4),
    L: clampL(p.L ?? 0),
    n,
    x: clampX(p.x ?? 0.2, n),
  };
}

const Qm = (p: { children: string }) => (
  <b class="q">
    <bdi dir="ltr">{p.children}</bdi>
  </b>
);

const short = (v: number) => (Number.isFinite(v) ? fmtNum(Number(v.toPrecision(4))) : '∞');

/** a filled (inside) or hollow (outside) point: shape, not only colour */
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, filled: boolean, color: string, p: Palette, r = 4.5) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.fillStyle = p.paper;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function line(ctx: CanvasRenderingContext2D, plot: Plot, pts: [number, number][], color: string, width: number, dash: number[] = []) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(plot.px(x), plot.py(y)) : ctx.moveTo(plot.px(x), plot.py(y))));
  ctx.setLineDash(dash);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.setLineDash([]);
}

export default function Oscillation(props: OscillationProps) {
  const mode = props.mode ?? 'osc';
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const has = (t: string) => props.tasks?.includes(t) ?? false;

  const delta = DELTAS[s.di];
  const P = OSC[s.osc];
  const omega = P.omega(delta);
  const sup = oscSup(s.osc, delta);

  const cone = useMemo(() => {
    const f = BASES[s.base].f;
    const b = build(f, s.m, H, s.L);
    const M = maxSlope(b.v);
    const polyErr = sampledPolyError(f, b.v, 2000);
    const gp = goodPoint(b, s.x, s.n);
    const firstGood = hasGoodPoint(b, s.n, 200);
    return { f, b, M, polyErr, gp, firstGood };
  }, [s.base, s.m, s.L, s.n, s.x]);

  /** The student's own change. Text steps set state through subscribeSteps, which never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    next.x = clampX(next.x, next.n);
    setS(next);
    const id = props.id;
    const d = DELTAS[next.di];
    if (mode === 'osc') {
      if (has('sgn-two') && next.osc === 'sgn' && d <= 0.01) markTask(`${id}:sgn-two`);
      if (has('value-counts') && next.osc === 'sin5' && d <= 0.01) markTask(`${id}:value-counts`);
      if (has('thomae-rat') && next.osc === 'thomae-rat' && d <= 0.05) markTask(`${id}:thomae-rat`);
      if (has('thomae-irr') && next.osc === 'thomae-irr' && d === DELTAS[DELTAS.length - 1]) markTask(`${id}:thomae-irr`);
      return;
    }
    const f = BASES[next.base].f;
    const b = build(f, next.m, H, next.L);
    const M = maxSlope(b.v);
    const err = sampledPolyError(f, b.v, 2000);
    if (has('polyline-close') && next.base === 'sqrt' && err < R / 2) markTask(`${id}:polyline-close`);
    if (has('steep-near') && next.L >= 100 && err + H < R) markTask(`${id}:steep-near`);
    if (has('escape') && next.L > next.n + M && hasGoodPoint(b, next.n, 200) === null) markTask(`${id}:escape`);
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.osc === 'string' && st.osc in OSC) next.osc = st.osc as OscId;
          if (typeof st.delta === 'number') next.di = nearestDi(st.delta);
          if (typeof st.base === 'string' && st.base in BASES) next.base = st.base as BaseId;
          if (typeof st.m === 'number') next.m = clampM(st.m);
          if (typeof st.L === 'number') next.L = clampL(st.L);
          if (typeof st.n === 'number') next.n = clampN(st.n);
          if (typeof st.x === 'number') next.x = st.x;
          next.x = clampX(next.x, next.n);
          return next;
        });
      }),
    [props.id],
  );

  useEffect(() => {
    const t = setTimeout(
      () => setLive(mode === 'osc' ? describeOsc(s.osc, delta) : describeCone({ base: s.base, m: s.m, L: s.L, n: s.n, x: s.x, H })),
      300,
    );
    return () => clearTimeout(t);
  }, [s]);

  const drawOsc = (ctx: CanvasRenderingContext2D, plot: Plot, p: Palette) => {
    const a = P.a;
    const lo = a - P.halfWidth;
    const hi = a + P.halfWidth;
    const box = plot.box;
    // the δ-ball as a vertical strip
    const x0 = plot.px(Math.max(lo, a - delta));
    const x1 = plot.px(Math.min(hi, a + delta));
    ctx.fillStyle = p.deltaBand;
    ctx.fillRect(x0, box.y, x1 - x0, box.h);
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = p.delta;
    ctx.lineWidth = 1;
    for (const e of [a - delta, a + delta]) {
      if (e < lo || e > hi) continue;
      ctx.beginPath();
      ctx.moveTo(plot.px(e), box.y);
      ctx.lineTo(plot.px(e), box.y + box.h);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // the band of values on the ball: from inf to sup
    const inf = sup - omega;
    ctx.fillStyle = p.epsBand;
    ctx.fillRect(x0, plot.py(sup), x1 - x0, plot.py(inf) - plot.py(sup));
    ctx.strokeStyle = p.eps;
    ctx.lineWidth = 1.4;
    for (const v of [sup, inf]) {
      ctx.beginPath();
      ctx.moveTo(x0, plot.py(v));
      ctx.lineTo(x1, plot.py(v));
      ctx.stroke();
    }

    // the graph
    const ink = p.curve;
    const K = 1600;
    switch (s.osc) {
      case 'sgn':
        line(ctx, plot, [[lo, -1], [0, -1]], ink, 2.4);
        line(ctx, plot, [[0, 1], [hi, 1]], ink, 2.4);
        dot(ctx, plot.px(0), plot.py(-1), false, ink, p);
        dot(ctx, plot.px(0), plot.py(1), false, ink, p);
        dot(ctx, plot.px(0), plot.py(0), true, ink, p);
        break;
      case 'chi0':
        line(ctx, plot, [[lo, 0], [hi, 0]], ink, 2.4);
        dot(ctx, plot.px(0), plot.py(0), false, ink, p);
        dot(ctx, plot.px(0), plot.py(1), true, ink, p);
        break;
      case 'sin5': {
        // |x| < w: the graph fills [−1, 1] densely; drawn as a shaded block, outside as a curve
        const w = 0.025;
        ctx.fillStyle = ink;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(plot.px(-w), plot.py(1), plot.px(w) - plot.px(-w), plot.py(-1) - plot.py(1));
        ctx.globalAlpha = 1;
        for (const side of [-1, 1]) {
          const pts: [number, number][] = [];
          for (let i = 0; i <= K; i++) {
            const x = side * (w + ((P.halfWidth - w) * i) / K);
            pts.push([x, Math.sin(1 / x)]);
          }
          line(ctx, plot, pts, ink, 1.6);
        }
        dot(ctx, plot.px(0), plot.py(5), true, ink, p);
        break;
      }
      case 'thomae-rat':
      case 'thomae-irr': {
        line(ctx, plot, [[lo, 0], [hi, 0]], ink, 1.2, [2, 3]);
        const pts = thomaePoints(lo, hi, 60);
        ctx.fillStyle = ink;
        for (const [x, y] of pts) {
          ctx.beginPath();
          ctx.arc(plot.px(x), plot.py(y), y > 0.05 ? 2.6 : 1.3, 0, 2 * Math.PI);
          ctx.fill();
        }
        dot(ctx, plot.px(a), plot.py(P.value), true, p.limit, p, 5.5);
        break;
      }
      case 'xchiq-0':
      case 'xchiq-half':
        line(ctx, plot, [[lo, lo], [hi, hi]], ink, 1.6, [2, 3]);
        line(ctx, plot, [[lo, 0], [hi, 0]], ink, 1.6, [2, 3]);
        dot(ctx, plot.px(a), plot.py(P.value), true, p.limit, p, 5.5);
        break;
    }
  };

  const drawCone = (ctx: CanvasRenderingContext2D, plot: Plot, p: Palette) => {
    const { f, b, gp } = cone;
    const K = 1200;
    const ts = Array.from({ length: K + 1 }, (_, i) => i / K);
    // the tube B(f, r)
    ctx.beginPath();
    ts.forEach((t, i) => (i ? ctx.lineTo(plot.px(t), plot.py(f(t) + R)) : ctx.moveTo(plot.px(t), plot.py(f(t) + R))));
    for (let i = K; i >= 0; i--) ctx.lineTo(plot.px(ts[i]), plot.py(f(ts[i]) - R));
    ctx.closePath();
    ctx.fillStyle = p.epsBand;
    ctx.fill();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = p.eps;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
    // the cone at x
    const x = s.x;
    const gx = b.g(x);
    const e = x + 1 / s.n;
    ctx.beginPath();
    ctx.moveTo(plot.px(x), plot.py(gx));
    ctx.lineTo(plot.px(e), plot.py(gx + 1));
    ctx.lineTo(plot.px(e), plot.py(gx - 1));
    ctx.closePath();
    ctx.fillStyle = p.deltaBand;
    ctx.fill();
    ctx.strokeStyle = p.delta;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    // f, p and g; g sampled on its breakpoints so that the sawtooth is exact
    line(ctx, plot, ts.map((t) => [t, f(t)]), p.limit, 2.4);
    line(
      ctx,
      plot,
      b.v.map((v, i) => [i / (b.v.length - 1), v]),
      p.curve2,
      1.6,
      [6, 4],
    );
    const gts = [...new Set([0, ...b.breaks(0, 1), 1])].sort((u, v) => u - v);
    const dense = gts.length > 3000 ? ts : gts;
    line(ctx, plot, dense.map((t) => [t, b.g(t)]), p.curve, 1.6);
    // the verdict at x
    if (gp.good) dot(ctx, plot.px(x), plot.py(gx), true, p.pointIn, p, 5.5);
    else {
      dot(ctx, plot.px(x), plot.py(gx), true, p.curve, p, 3.5);
      dot(ctx, plot.px(x + gp.worstH), plot.py(b.g(x + gp.worstH)), false, p.pointOut, p, 5.5);
    }
  };

  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const box = insetBox({ x: 0, y: 0, w: view.w, h: view.h }, { l: narrow ? 40 : 48, r: 14, t: 12, b: 26 });
    let plot: Plot;
    if (mode === 'osc') {
      plot = makePlot(box, { min: P.a - P.halfWidth, max: P.a + P.halfWidth }, { min: P.y[0], max: P.y[1] });
    } else {
      const f = BASES[s.base].f;
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i <= 200; i++) {
        lo = Math.min(lo, f(i / 200));
        hi = Math.max(hi, f(i / 200));
      }
      plot = makePlot(box, { min: 0, max: 1 }, { min: lo - R - 0.08, max: hi + R + 0.08 });
    }
    drawAxes(ctx, plot, p);
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    ctx.lineJoin = 'round';
    if (mode === 'osc') drawOsc(ctx, plot, p);
    else drawCone(ctx, plot, p);
    ctx.restore();
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1.4, worldHeight: 1, animate: false });
  useEffect(invalidate, [s]);

  const onKeyDown = (e: KeyboardEvent) => {
    const up = e.key === 'ArrowUp' || e.key === 'ArrowRight';
    const down = e.key === 'ArrowDown' || e.key === 'ArrowLeft';
    if (!up && !down) return;
    e.preventDefault();
    if (mode === 'osc') userSet({ di: Math.max(0, Math.min(DELTAS.length - 1, s.di + (up ? 1 : -1))) });
    else userSet({ L: clampL(s.L + (up ? 1 : -1) * (e.shiftKey ? 10 : 1)) });
  };

  const oscOffered = (props.oscs ?? OSC_IDS).filter((id) => id in OSC);
  const baseOffered = (props.bases ?? BASE_IDS).filter((id) => id in BASES);

  const readout =
    mode === 'osc' ? (
      <>
        <span data-readout="ball">
          הכדור: <Qm>{`(${P.aText} − ${fmtNum(delta)}, ${P.aText} + ${fmtNum(delta)})`}</Qm>
        </span>
        <span data-readout="omega">
          התנודה על הכדור: <Qm>{`ω = sup − inf = ${short(omega)}`}</Qm>
        </span>
        <span data-readout="osc">
          כש-δ שואף ל-0: <Qm>{`o(f, ${P.aText}) = ${short(P.osc)}`}</Qm> ({P.osc === 0 ? 'רציפה בנקודה' : 'אינה רציפה בנקודה'})
        </span>
      </>
    ) : (
      <>
        <span data-readout="slopes">
          השיפוע המרבי של הקו השבור: <Qm>{`M = ${short(cone.M)}`}</Qm>; <Qm>{`n + M = ${short(s.n + cone.M)}`}</Qm>,{' '}
          <Qm>{`L = ${s.L}`}</Qm> ({s.L > s.n + cone.M ? 'L גדול מ-n + M' : 'L אינו גדול מ-n + M'})
        </span>
        <span data-readout="dist">
          המרחקים (בדגימה): <Qm>{`‖f − p‖∞ ≈ ${short(cone.polyErr)}`}</Qm>, <Qm>{`‖φ‖∞ = ${s.L > 0 ? fmtNum(H) : '0'}`}</Qm>,{' '}
          <Qm>{`r = ${fmtNum(R)}`}</Qm>
        </span>
        <span data-readout="at-x">
          בנקודה <Qm>{`x = ${fmtNum(s.x)}`}</Qm>:{' '}
          {cone.gp.good ? 'הגרף של g נשאר בחרוט, ו-x מעידה ש-g שייכת ל-Eₙ' : `הגרף יוצא מהחרוט, למשל ב-h = ${short(cone.gp.worstH)}`}
        </span>
        <span data-readout="grid">
          חיפוש על רשת של 201 נקודות (בדיקה מספרית, לא הוכחה):{' '}
          {cone.firstGood === null ? 'אף נקודה אינה נשארת בחרוט' : `הנקודה x = ${fmtNum(Number(cone.firstGood.toPrecision(3)))} נשארת בחרוט`}
        </span>
      </>
    );

  const controls =
    mode === 'osc' ? (
      <>
        {oscOffered.length > 1 && (
          <div class="group" role="group" aria-label="הפונקציה והנקודה">
            {oscOffered.map((id) => (
              <Toggle key={id} label={<bdi dir="ltr">{OSC[id].formula}</bdi>} on={s.osc === id} onChange={() => userSet({ osc: id })} />
            ))}
          </div>
        )}
        <Slider
          label="δ"
          value={s.di}
          min={0}
          max={DELTAS.length - 1}
          step={1}
          format={(v) => fmtNum(DELTAS[Math.round(v)])}
          onChange={(v) => userSet({ di: Math.round(v) })}
        />
      </>
    ) : (
      <>
        {baseOffered.length > 1 && (
          <div class="group" role="group" aria-label="הפונקציה f">
            {baseOffered.map((id) => (
              <Toggle key={id} label={<bdi dir="ltr">{BASES[id].formula}</bdi>} on={s.base === id} onChange={() => userSet({ base: id })} />
            ))}
          </div>
        )}
        <Slider label="m" value={s.m} min={1} max={40} step={1} format={(v) => String(clampM(v))} onChange={(v) => userSet({ m: clampM(v) })} />
        <Slider label="L" value={s.L} min={0} max={200} step={1} format={(v) => String(clampL(v))} onChange={(v) => userSet({ L: clampL(v) })} />
        <Slider label="n" value={s.n} min={1} max={6} step={1} format={(v) => String(clampN(v))} onChange={(v) => userSet({ n: clampN(v) })} />
        <Slider label="x" value={s.x} min={0} max={1 - 1 / s.n} step={0.01} format={(v) => fmtNum(clampX(v, s.n))} onChange={(v) => userSet({ x: clampX(v, s.n) })} />
      </>
    );

  const label =
    mode === 'osc'
      ? `איור חי: גרף של פונקציה ליד נקודה, כדור ברדיוס δ סביב הנקודה כרצועה אנכית, ורצועת הערכים של הפונקציה על הכדור. במקלדת: חצים משנים את δ. ${describeOsc(s.osc, delta)}`
      : `איור חי: פונקציה f על הקטע [0, 1] עם הצינור B(f, r), קו שבור p קרוב אליה, והפונקציה g שהיא p ועוד מסור, עם חרוט בשיפוע n בנקודה x. במקלדת: חצים משנים את L. ${describeCone({ base: s.base, m: s.m, L: s.L, n: s.n, x: s.x, H })}`;

  return (
    <SimShell
      fig={props.id}
      label={label}
      canvasRef={canvasRef}
      aspect={1.4}
      live={live}
      tasks={tasks}
      onKeyDown={onKeyDown}
      onReset={() => {
        setS(fresh(props));
        setLive('האיור אופס.');
      }}
      readout={readout}
      controls={controls}
    />
  );
}
