/**
 * Lesson 4.6's figure: approximation from a subalgebra, degree by degree.
 *
 * Top panel:    the target f (green, the "limit" colour: it is what the approximants should converge to) on the
 *               interval, the least-squares approximant pₙ from the chosen algebra (ink), and the tube
 *               {|y − f| ≤ Eₙ} in the warm ε colours, where Eₙ = max |f − pₙ| over the grid. A hollow ring marks a
 *               grid point where Eₙ is attained.
 * Bottom panel: Eₙ against the degree n = 0 … 20 on a log axis (a probe of the sup distance; values below 10⁻⁴ sit
 *               on the floor). The current degree is ringed. Once the student has pushed the degree to 10 or more
 *               in a configuration where the lesson proves a lower bound (טענה 4.6.10, טענה 4.6.8א), that bound is
 *               drawn dashed: the dots can never go below it.
 *
 * Every number comes from src/math/algebra.ts. No animation. A text step sets state through subscribeSteps and
 * never ticks a task: only userSet (the controls and the keyboard) does.
 */

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  ALGEBRAS,
  N_MAX,
  TARGETS,
  dimension,
  fitAll,
  intervalOf,
  provedLowerBound,
  type AlgebraId,
  type IntervalId,
  type TargetId,
} from '~/math/algebra';
import { fmtNum } from '~/math/contraction';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { drawAxes, insetBox, makePlot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

/** a left-to-right island inside Hebrew text (U+2066 … U+2069) */
const ltr = (s: string) => `⁦${s}⁩`;

const TASK_LABEL: Record<string, string> = {
  'even-stall': `בפולינומים ב-${ltr('x²')} על ${ltr('[−1, 1]')} עם ${ltr('f(x) = x')}, הגדילו את המעלה ל-${ltr('12')} לפחות. האם השגיאה יורדת מתחת ל-${ltr('1')}?`,
  'even-half': `אותה אלגברה ואותה ${ltr('f')}, אבל על ${ltr('[0, 1]')}: מצאו מעלה שבה השגיאה קטנה מ-${ltr('0.05')}.`,
  'vanish-one': `בפולינומים עם ${ltr('p(0) = 0')} ועם ${ltr('f = 1')}, הגדילו את המעלה ל-${ltr('12')} לפחות, ושימו לב לשגיאה.`,
  'trig-x': `בפולינומים הטריגונומטריים על ${ltr('[−π, π]')} עם ${ltr('f(x) = x')}, הגדילו את המעלה ל-${ltr('12')} לפחות. איפה נמצאת הטבעת?`,
  'trig-abs': `בפולינומים הטריגונומטריים עם ${ltr('f(x) = |x|')}, מצאו מעלה שבה השגיאה קטנה מ-${ltr('0.05')}.`,
};

const ALG_IDS: AlgebraId[] = ['poly', 'even', 'vanish', 'trig'];
const TARGET_IDS: TargetId[] = ['x', 'abs', 'one', 'exp'];
const IV_LABEL: Record<IntervalId, string> = { sym: '[−1, 1]', half: '[0, 1]' };
const clampN = (v: number) => Math.max(0, Math.min(N_MAX, Math.round(v)));
const LOG_FLOOR = 1e-4;
const REVEAL_N = 10;

interface State {
  alg: AlgebraId;
  iv: IntervalId;
  target: TargetId;
  n: number;
}

export interface AlgebraFitProps {
  id: string;
  algebra?: AlgebraId;
  algebras?: AlgebraId[];
  interval?: IntervalId;
  intervals?: IntervalId[];
  target?: TargetId;
  targets?: TargetId[];
  n?: number;
  tasks?: string[];
}

function fresh(p: AlgebraFitProps): State {
  return {
    alg: p.algebra && ALG_IDS.includes(p.algebra) ? p.algebra : 'poly',
    iv: p.interval === 'half' ? 'half' : 'sym',
    target: p.target && TARGET_IDS.includes(p.target) ? p.target : 'x',
    n: clampN(typeof p.n === 'number' ? p.n : 4),
  };
}

const keyOf = (s: State) => `${s.alg}|${s.alg === 'trig' ? 'trig' : s.iv}|${s.target}`;
const intervalText = (s: State) => (s.alg === 'trig' ? '[−π, π]' : IV_LABEL[s.iv]);

const Q = (p: { children: string }) => (
  <b class="q">
    <bdi dir="ltr">{p.children}</bdi>
  </b>
);

export default function AlgebraFit(props: AlgebraFitProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  /** configurations in which the student pushed the degree to REVEAL_N or more: there the proved bound is drawn */
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const has = (t: string) => props.tasks?.includes(t) ?? false;

  const table = fitAll(s.alg, s.iv, s.target);
  const err = table.errors[s.n];
  const bound = provedLowerBound(s.alg, s.iv, s.target);
  const showBound = bound > 0 && revealed.has(keyOf(s));

  /** a y-window that does not jump with n: f and every fit, clipped to f's range widened by its span + 1 */
  const yWin = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of table.fx) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    const span = hi - lo + 1;
    let a = lo;
    let b = hi;
    for (const p of table.fits)
      for (const v of p) {
        a = Math.min(a, Math.max(v, lo - span));
        b = Math.max(b, Math.min(v, hi + span));
      }
    const pad = 0.08 * (b - a || 1);
    return { min: a - pad, max: b + pad };
  }, [table]);

  /** The student's own change: a text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    setS(next);
    const id = props.id;
    const e = fitAll(next.alg, next.iv, next.target).errors[next.n];
    if (next.n >= REVEAL_N && provedLowerBound(next.alg, next.iv, next.target) > 0 && !revealed.has(keyOf(next)))
      setRevealed(new Set([...revealed, keyOf(next)]));
    if (has('even-stall') && next.alg === 'even' && next.iv === 'sym' && next.target === 'x' && next.n >= 12) markTask(`${id}:even-stall`);
    if (has('even-half') && next.alg === 'even' && next.iv === 'half' && next.target === 'x' && e < 0.05) markTask(`${id}:even-half`);
    if (has('vanish-one') && next.alg === 'vanish' && next.target === 'one' && next.n >= 12) markTask(`${id}:vanish-one`);
    if (has('trig-x') && next.alg === 'trig' && next.target === 'x' && next.n >= 12) markTask(`${id}:trig-x`);
    if (has('trig-abs') && next.alg === 'trig' && next.target === 'abs' && e < 0.05) markTask(`${id}:trig-abs`);
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.algebra === 'string' && (ALG_IDS as string[]).includes(st.algebra)) next.alg = st.algebra as AlgebraId;
          if (st.interval === 'sym' || st.interval === 'half') next.iv = st.interval;
          if (typeof st.target === 'string' && (TARGET_IDS as string[]).includes(st.target)) next.target = st.target as TargetId;
          if (typeof st.n === 'number') next.n = clampN(st.n);
          return next;
        });
      }),
    [props.id],
  );

  const describe = () =>
    `${ALGEBRAS[s.alg].label} על ${ltr(intervalText(s))}, ${ltr(TARGETS[s.target].formula)}, מעלה ${ltr(String(s.n))}: השגיאה הגדולה ביותר על הרשת בערך ${ltr(fmtNum(Number(err.toPrecision(3))))}.`;

  useEffect(() => {
    const t = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(t);
  }, [s]);

  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const gap = 26;
    const topH = Math.round(view.h * 0.6);
    const [a, b] = intervalOf(s.alg, s.iv);
    const xs = table.xs;
    const fit = table.fits[s.n];

    // ---- top: f, pₙ and the tube of radius Eₙ about f. The legend sits in its own strip above the plot box, so no
    // curve or tube ever crosses it.
    const legendH = 24;
    const box = insetBox({ x: 0, y: 0, w: view.w, h: topH }, { l: narrow ? 38 : 46, r: 12, t: legendH + 6, b: 24 });
    const plot = makePlot(box, { min: a, max: b }, { min: yWin.min, max: yWin.max });
    drawAxes(ctx, plot, p);
    const X = plot.px;
    const Y = plot.py;
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();

    ctx.beginPath();
    for (let i = 0; i < xs.length; i++) ctx.lineTo(X(xs[i]), Y(table.fx[i] + err));
    for (let i = xs.length - 1; i >= 0; i--) ctx.lineTo(X(xs[i]), Y(table.fx[i] - err));
    ctx.closePath();
    ctx.fillStyle = p.epsBand;
    ctx.fill();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = p.eps;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    const line = (vals: Float64Array, color: string, w: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < xs.length; i++) {
        if (i) ctx.lineTo(X(xs[i]), Y(vals[i]));
        else ctx.moveTo(X(xs[i]), Y(vals[i]));
      }
      ctx.stroke();
    };
    line(table.fx, p.limit, 3);
    line(fit, p.curve, 2.2);

    // where the error is attained: a hollow ring on f, and a thin segment to pₙ
    const k = table.argmax[s.n];
    ctx.strokeStyle = p.pointOut;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(X(xs[k]), Y(table.fx[k]));
    ctx.lineTo(X(xs[k]), Y(fit[k]));
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(X(xs[k]), Y(table.fx[k]), 5.5, 0, 2 * Math.PI);
    ctx.fillStyle = p.paper;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.font = `600 ${narrow ? 12 : 13}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    // one row: a line swatch in each curve's colour and width, then its label (f first, then pₙ)
    const legendY = legendH / 2 + 2;
    const swatch = 16;
    let lx = box.x + 2;
    const item = (text: string, color: string, w: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(lx, legendY);
      ctx.lineTo(lx + swatch, legendY);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillText(text, lx + swatch + 5, legendY);
      lx += swatch + 5 + ctx.measureText(text).width + (narrow ? 14 : 20);
    };
    item(TARGETS[s.target].formula, p.limit, 3);
    item(`pₙ, n = ${s.n}`, p.curve, 2.2);
    ctx.restore();

    // ---- bottom: Eₙ against n, log scale
    const eBox = insetBox({ x: 0, y: topH + gap, w: view.w, h: view.h - topH - gap }, { l: narrow ? 38 : 46, r: 12, t: 8, b: 22 });
    // seven decade labels need ~16 px each; on a short panel (a phone) label every other decade so they do not overlap
    const yTicks = eBox.h / 6 < 16 ? [1e2, 1, 1e-2, 1e-4] : undefined;
    const ePlot = makePlot(eBox, { min: -0.5, max: N_MAX + 0.5, ticks: [0, 5, 10, 15, 20], format: (v) => String(v) }, { min: LOG_FLOOR, max: 100, scale: 'log', ticks: yTicks });
    drawAxes(ctx, ePlot, p);
    const EX = ePlot.px;
    const EY = (v: number) => ePlot.py(Math.max(LOG_FLOOR, v));
    if (showBound) {
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = p.eps;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(eBox.x, EY(bound));
      ctx.lineTo(eBox.x + eBox.w, EY(bound));
      ctx.stroke();
      ctx.restore();
    }
    for (let n = 0; n <= N_MAX; n++) {
      ctx.beginPath();
      ctx.arc(EX(n), EY(table.errors[n]), n === s.n ? 4.5 : 3, 0, 2 * Math.PI);
      ctx.fillStyle = p.curve;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(EX(s.n), EY(err), 8, 0, 2 * Math.PI);
    ctx.strokeStyle = p.eps;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    ctx.font = `600 ${narrow ? 11 : 12}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = p.ink2;
    ctx.fillText('max |f − pₙ|  vs  n', eBox.x + eBox.w - 4, eBox.y + 2);
    ctx.restore();
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1.4, worldHeight: 1, animate: false });
  useEffect(invalidate, [s, revealed]);

  const onKeyDown = (e: KeyboardEvent) => {
    const up = e.key === 'ArrowUp' || e.key === 'ArrowRight';
    const down = e.key === 'ArrowDown' || e.key === 'ArrowLeft';
    if (!up && !down) return;
    e.preventDefault();
    userSet({ n: clampN(s.n + (up ? 1 : -1)) });
  };

  const offeredAlgs = (props.algebras ?? []).filter((a) => ALG_IDS.includes(a));
  const offeredIvs = (props.intervals ?? []).filter((v) => v === 'sym' || v === 'half');
  const offeredTargets = (props.targets ?? []).filter((t) => TARGET_IDS.includes(t));

  const readout = (
    <>
      <span data-readout="space">
        {ALGEBRAS[s.alg].label} על <Q>{intervalText(s)}</Q>
      </span>
      <span data-readout="n">
        <Q>{`n = ${s.n}`}</Q>, מימד <Q>{String(dimension(s.alg, s.n))}</Q>
      </span>
      <span data-readout="err">
        על הרשת: <Q>{`max |f − pₙ| ≈ ${fmtNum(Number(err.toPrecision(3)))}`}</Q>
      </span>
      {showBound && (
        <span data-readout="bound">
          חסם מלרע מוכח לכל איבר של האלגברה: <Q>{fmtNum(Number(bound.toPrecision(4)))}</Q>
        </span>
      )}
    </>
  );

  const controls = (
    <>
      {offeredAlgs.length > 1 && (
        <div class="group" role="group" aria-label="האלגברה">
          {offeredAlgs.map((a) => (
            <Toggle key={a} label={ALGEBRAS[a].label} on={s.alg === a} onChange={() => userSet({ alg: a })} />
          ))}
        </div>
      )}
      {s.alg !== 'trig' && offeredIvs.length > 1 && (
        <div class="group" role="group" aria-label="הקטע">
          {offeredIvs.map((v) => (
            <Toggle key={v} label={<bdi dir="ltr">{IV_LABEL[v]}</bdi>} on={s.iv === v} onChange={() => userSet({ iv: v })} />
          ))}
        </div>
      )}
      {offeredTargets.length > 1 && (
        <div class="group" role="group" aria-label="הפונקציה">
          {offeredTargets.map((t) => (
            <Toggle key={t} label={<bdi dir="ltr">{TARGETS[t].formula}</bdi>} on={s.target === t} onChange={() => userSet({ target: t })} />
          ))}
        </div>
      )}
      <Slider label="n" value={s.n} min={0} max={N_MAX} step={1} format={(v) => String(Math.round(v))} onChange={(v) => userSet({ n: clampN(v) })} />
    </>
  );

  return (
    <SimShell
      fig={props.id}
      label={`איור חי: פונקציה f, הקירוב שלה בריבועים פחותים מתוך אלגברה של פונקציות במעלה n, הרצועה ברוחב השגיאה סביב f, ולמטה השגיאה כפונקציה של המעלה. במקלדת: חצים משנים את n. ${describe()}`}
      canvasRef={canvasRef}
      aspect={1.15}
      live={live}
      tasks={tasks}
      onKeyDown={onKeyDown}
      onReset={() => {
        setRevealed(new Set());
        setS(fresh(props));
        setLive('האיור אופס.');
      }}
      readout={readout}
      controls={controls}
    />
  );
}
