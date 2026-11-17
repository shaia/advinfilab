/**
 * Lesson 5.2's figure: partial and directional derivatives as derivatives of slices.
 *
 * Upper panel: level curves of f near the point a (exact curves from src/math/directional.ts), the point a, the
 * direction v as an arrow, the line a + t·v through a (dashed), and the two points a + t·v (filled) and a − t·v
 * (hollow) whose values the secants use. For the parabola indicator h the parabola y = x² is drawn (h = 1 on it), and
 * the one point where the line meets it away from a is ringed.
 *
 * Lower panel: the slice φ(t) = f(a + t·v) on [−T, T]; the right secant through (0, φ(0)) and (t, φ(t)) (solid, a
 * filled end) and the left secant through (−t, φ(−t)) (dashed, a hollow end); and, when D_v f(a) exists, the line
 * through (0, φ(0)) with slope D_v f(a) (green). A slice that jumps at 0 shows φ(0) filled and the one-sided limit
 * hollow; h's slice shows its single spike at t* = v₂/v₁².
 *
 * D_v f(a) is the exact closed form the lesson proves; the secant slopes at one t are a probe of the limit, and the
 * caption says so. No animation.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import {
  PRESETS,
  degOf,
  dirFromDeg,
  dv,
  fmtNum,
  levelCurves,
  oneSided,
  quotient,
  slice,
  sliceLimit,
  spikeT,
  type SliceId,
  type Vec,
} from '~/math/directional';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { arrow, withAlpha } from './core/ink';
import { drawAxes, insetBox, makePlot, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

/** a left-to-right island inside Hebrew text (U+2066 … U+2069), with no-break spaces so it never wraps */
const ltr = (s: string) => `⁦${s.replace(/ /g, '\u00a0')}⁩`;

const TASK_LABEL: Record<string, string> = {
  'poly-secant': `בפונקציה ${ltr('x² + 3xy')}, בכיוון שתבחרו: הקטינו את t עד ששיפועי שני המיתרים במרחק ${ltr('0.01')} לכל היותר מהנגזרת הכיוונית.`,
  'g-value': `בפונקציה ${ltr('x²y/(x⁴ + y²)')}: מצאו כיוון שבו הנגזרת הכיוונית בראשית היא ${ltr('9/20 = 0.45')} (בדיוק של ${ltr('0.005')}).`,
  'xy-jump': `בפונקציה ${ltr('xy/(x² + y²)')}: מצאו כיוון שבו הפרוסה קופצת ב-${ltr('t = 0')} בגובה ${ltr('0.4')} לפחות.`,
  'h-near': `בפונקציה h: מצאו כיוון שבו הקוץ של הפרוסה קרוב ל-${ltr('t = 0')} יותר מ-${ltr('0.1')}. האם הנגזרת הכיוונית השתנתה?`,
  'norm-sides': `בפונקציה ${ltr('‖x‖₂')}: הקטינו את t ל-${ltr('0.001')} לכל היותר, ובדקו מה קורה לשיפועי שני המיתרים.`,
};

const LOGT_MIN = -3;
const sig = (v: number, n = 4) => Number(v.toPrecision(n));
/** the secant step in plain decimals (0.001, not 1·10⁻³): it never goes below 10⁻³ */
const fmtT = (t: number) => String(sig(t, 3));
const num = (v: number) => (Number.isFinite(v) ? fmtNum(sig(v)) : v > 0 ? '∞' : '−∞');
const roundDeg = (d: number) => {
  const r = Math.round((((d % 360) + 360) % 360) * 10) / 10;
  return r >= 360 ? 0 : r;
};

interface State {
  preset: SliceId;
  /** the direction angle in degrees; a text step may set an exact value (atan2(4, 3)), the controls round to 0.1° */
  deg: number;
  /** the secant step t > 0 */
  t: number;
}

export interface DirectionalSliceProps {
  id: string;
  preset?: SliceId;
  presets?: SliceId[];
  deg?: number;
  t?: number;
  tasks?: string[];
}

const logTMax = (id: SliceId) => Math.log10(PRESETS[id].T);
const clampT = (id: SliceId, t: number) => Math.min(PRESETS[id].T, Math.max(10 ** LOGT_MIN, sig(t, 3)));

function fresh(p: DirectionalSliceProps): State {
  const preset: SliceId = p.preset && p.preset in PRESETS ? p.preset : 'poly';
  return { preset, deg: typeof p.deg === 'number' ? p.deg : 30, t: clampT(preset, typeof p.t === 'number' ? p.t : 0.3) };
}

const Q = (p: { children: string }) => (
  <b class="q">
    <bdi dir="ltr">{p.children}</bdi>
  </b>
);

/** whether a state completes a task (the student's own change only) */
function taskDone(task: string, s: State): boolean {
  const P = PRESETS[s.preset];
  const v = dirFromDeg(s.deg);
  const d = dv(P, v);
  switch (task) {
    case 'poly-secant':
      return (
        s.preset === 'poly' &&
        d.exists &&
        Math.abs(quotient(P, v, s.t) - d.value) <= 0.01 &&
        Math.abs(quotient(P, v, -s.t) - d.value) <= 0.01
      );
    case 'g-value':
      return s.preset === 'g' && d.exists && Math.abs(d.value - 0.45) <= 0.005;
    case 'xy-jump':
      return s.preset === 'xy' && Math.abs(v[0] * v[1]) >= 0.4;
    case 'h-near': {
      const ts = spikeT(v);
      return s.preset === 'h' && ts !== null && Math.abs(ts) < 0.1;
    }
    case 'norm-sides':
      return s.preset === 'norm' && s.t <= 0.001 + 1e-12;
    default:
      return false;
  }
}

export default function DirectionalSlice(props: DirectionalSliceProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const topRef = useRef<{ plot: Plot } | null>(null);
  const dragging = useRef(false);
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));

  const P = PRESETS[s.preset];
  const v = dirFromDeg(s.deg);
  const d = dv(P, v);
  const qR = quotient(P, v, s.t);
  const qL = quotient(P, v, -s.t);
  const ts = s.preset === 'h' ? spikeT(v) : null;

  /** The student's own change. A text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    if (patch.preset && patch.preset !== s.preset) next.t = clampT(patch.preset, next.t);
    setS(next);
    for (const t of props.tasks ?? []) if (taskDone(t, next)) markTask(`${props.id}:${t}`);
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.preset === 'string' && st.preset in PRESETS) next.preset = st.preset as SliceId;
          if (typeof st.deg === 'number') next.deg = st.deg;
          next.t = clampT(next.preset, typeof st.t === 'number' ? st.t : next.t);
          return next;
        });
      }),
    [props.id],
  );

  const vText = `v = (${num(v[0])}, ${num(v[1])})`;
  const dvText = d.exists ? `D_v f(a) = ${num(d.value)}` : 'D_v f(a) אינה קיימת';
  const describe = () =>
    `${P.formula} בנקודה (${P.a.join(', ')}), ${vText}. ${dvText}. שיפוע המיתר מימין ${num(qR)}, משמאל ${num(qL)}, עם t = ${fmtT(s.t)}.`;
  useEffect(() => {
    const id = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(id);
  }, [s]);

  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const splitY = view.h * 0.55;
    const toolsW = 3 * 34 + 2 * 6 + 8 + 8;

    // ---------------- upper panel: the plane, equal scales on both axes
    const box = insetBox({ x: 0, y: 0, w: view.w, h: splitY }, { l: narrow ? 30 : 38, r: 10, t: narrow ? 30 : 10, b: 22 });
    const wy = P.half;
    const wx = (wy * box.w) / box.h;
    const [a1, a2] = P.a;
    const plot = makePlot(box, { min: a1 - wx, max: a1 + wx, format: (x) => fmtNum(sig(x, 3)) }, { min: a2 - wy, max: a2 + wy, format: (y) => fmtNum(sig(y, 3)) });
    topRef.current = { plot };
    drawAxes(ctx, plot, p);
    const X = plot.px;
    const Y = plot.py;

    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();

    // level curves (for h: the parabola where h = 1)
    ctx.lineJoin = 'round';
    for (const line of levelCurves(P, wx, wy)) {
      const strong = line.level === null;
      ctx.strokeStyle = withAlpha(p.curve, strong ? 0.95 : line.level === 0 ? 0.6 : 0.38);
      ctx.lineWidth = strong ? 2.2 : 1.1;
      ctx.beginPath();
      line.pts.forEach(([x, y], k) => (k ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      ctx.stroke();
    }

    // the line a + t·v
    const R = Math.hypot(wx, wy) * 1.5;
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = p.ink2;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(X(a1 - R * v[0]), Y(a2 - R * v[1]));
    ctx.lineTo(X(a1 + R * v[0]), Y(a2 + R * v[1]));
    ctx.stroke();
    ctx.setLineDash([]);

    // the direction arrow (length 0.55 in world units)
    arrow(ctx, X(a1), Y(a2), X(a1 + 0.55 * v[0]), Y(a2 + 0.55 * v[1]), { color: p.ink, width: 2.4, head: 11 });

    // h: the one point of the line on the parabola, away from a
    if (ts !== null && Math.abs(ts) <= Math.hypot(wx, wy)) {
      ctx.beginPath();
      ctx.arc(X(ts * v[0]), Y(ts * v[1]), 6, 0, 2 * Math.PI);
      ctx.strokeStyle = p.pointOut;
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }

    // the points a ± t·v: filled on the right, hollow on the left
    const dot = (x: number, y: number, filled: boolean, color: string, r = 4.5) => {
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
    };
    dot(X(a1 + s.t * v[0]), Y(a2 + s.t * v[1]), true, p.delta);
    dot(X(a1 - s.t * v[0]), Y(a2 - s.t * v[1]), false, p.eps);
    dot(X(a1), Y(a2), true, p.ink, 4);
    ctx.restore();

    // legend, LTR
    ctx.save();
    ctx.font = `600 ${narrow ? 11 : 13}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = p.curve;
    const legend = `f = ${P.formula},  a = (${P.a.join(', ')})`;
    if (narrow) ctx.fillText(legend, 8, 14, Math.max(60, view.w - toolsW - 8));
    else ctx.fillText(legend, box.x + 8, box.y + 12);
    ctx.restore();

    // ---------------- lower panel: the slice and its secants
    const box2 = insetBox({ x: 0, y: splitY, w: view.w, h: view.h - splitY }, { l: narrow ? 30 : 38, r: 10, t: narrow ? 24 : 14, b: 22 });
    const [ylo, yhi] = P.yRange;
    const plot2 = makePlot(box2, { min: -P.T, max: P.T, format: (x) => fmtNum(sig(x, 3)) }, { min: ylo, max: yhi, format: (y) => fmtNum(sig(y, 3)) });
    drawAxes(ctx, plot2, p);
    const X2 = plot2.px;
    const Y2 = plot2.py;
    ctx.save();
    ctx.beginPath();
    ctx.rect(box2.x, box2.y, box2.w, box2.h);
    ctx.clip();

    const phi0 = slice(P, v, 0);
    // the graph of φ, each side of 0 separately (a jump at 0 is not joined)
    ctx.strokeStyle = p.curve;
    ctx.lineWidth = 2.2;
    const N = narrow ? 300 : 600;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let k = 0; k <= N; k++) {
        const t = side * P.T * (k === 0 ? 1e-9 : k / N);
        const y = P.id === 'h' ? 0 : slice(P, v, t);
        if (k) ctx.lineTo(X2(t), Y2(y));
        else ctx.moveTo(X2(t), Y2(y));
      }
      ctx.stroke();
    }
    // the tangent line, slope D_v f(a)
    const line = (slope: number, color: string, width: number, dash: number[]) => {
      ctx.setLineDash(dash);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(X2(-P.T), Y2(phi0 - slope * P.T));
      ctx.lineTo(X2(P.T), Y2(phi0 + slope * P.T));
      ctx.stroke();
      ctx.setLineDash([]);
    };
    if (d.exists) line(d.value, p.limit, 2.6, []);
    line(qR, p.delta, 1.6, []);
    line(qL, p.eps, 1.6, [6, 4]);

    // the slice's special points
    const lim = sliceLimit(P, v);
    if (lim !== phi0) dot(X2(0), Y2(lim), false, p.curve, 5);
    if (ts !== null && Math.abs(ts) <= P.T) {
      dot(X2(ts), Y2(0), false, p.curve, 4.5);
      dot(X2(ts), Y2(1), true, p.curve, 4.5);
    }
    dot(X2(0), Y2(phi0), true, p.curve, 4.5);
    // the secant ends
    const yR = slice(P, v, s.t);
    const yL = slice(P, v, -s.t);
    dot(X2(s.t), Y2(yR), true, p.delta);
    dot(X2(-s.t), Y2(yL), false, p.eps);
    ctx.restore();

    ctx.save();
    ctx.font = `600 ${narrow ? 11 : 12}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = p.curve;
    if (narrow) ctx.fillText('φ(t) = f(a + t·v)', box2.x, box2.y - 12);
    else ctx.fillText('φ(t) = f(a + t·v)', box2.x + 8, box2.y + 10);
    ctx.restore();
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 0.9, worldHeight: 1, animate: false });
  useEffect(invalidate, [s]);

  const degFromPointer = (e: PointerEvent) => {
    const top = topRef.current;
    if (!top) return null;
    const { plot } = top;
    if (e.offsetY > plot.box.y + plot.box.h + 10) return null;
    const x = plot.x.min + ((e.offsetX - plot.box.x) / plot.box.w) * (plot.x.max - plot.x.min);
    const y = plot.y.max - ((e.offsetY - plot.box.y) / plot.box.h) * (plot.y.max - plot.y.min);
    const w: Vec = [x - P.a[0], y - P.a[1]];
    if (Math.hypot(w[0], w[1]) < 1e-3) return null;
    return roundDeg(degOf(w));
  };
  const onPointerDown = (e: PointerEvent) => {
    const g = degFromPointer(e);
    if (g === null) return;
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    userSet({ deg: g });
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging.current) return;
    const g = degFromPointer(e);
    if (g !== null && g !== s.deg) userSet({ deg: g });
  };
  const onPointerUp = () => {
    dragging.current = false;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      userSet({ deg: roundDeg(s.deg + (e.key === 'ArrowRight' ? -1 : 1) * (e.shiftKey ? 10 : 1)) });
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const lg = Math.min(logTMax(s.preset), Math.max(LOGT_MIN, Math.log10(s.t) + (e.key === 'ArrowUp' ? 0.05 : -0.05)));
      userSet({ t: clampT(s.preset, 10 ** lg) });
    }
  };

  const offered = (props.presets ?? []).filter((id) => id in PRESETS);
  const [lR, lL] = oneSided(P, v);

  const readout = (
    <>
      <span data-readout="preset">
        <Q>{`f = ${P.formula}`}</Q> בנקודה <Q>{`a = (${P.a.join(', ')})`}</Q>
      </span>
      <span data-readout="direction">
        הכיוון <Q>{vText}</Q>, בזווית <Q>{`θ = ${fmtNum(sig(s.deg, 5))}°`}</Q>
      </span>
      <span data-readout="secants">
        עם <Q>{`t = ${fmtT(s.t)}`}</Q>: שיפוע המיתר מימין <Q>{num(qR)}</Q>, משמאל <Q>{num(qL)}</Q>
      </span>
      <span data-readout="dv">
        {d.exists ? (
          <>
            הנגזרת הכיוונית: <Q>{`D_v f(a) = ${num(d.value)}`}</Q>
          </>
        ) : d.reason === 'jump' ? (
          <>
            הנגזרת הכיוונית אינה קיימת: הפרוסה קופצת ב-<Q>t = 0</Q>, ושיפועי המיתרים אינם חסומים
          </>
        ) : (
          <>
            הנגזרת הכיוונית אינה קיימת: הגבול מימין <Q>{num(lR)}</Q> והגבול משמאל <Q>{num(lL)}</Q>
          </>
        )}
      </span>
      {s.preset === 'h' && (
        <span data-readout="spike">
          {ts === null ? (
            <>הישר אינו פוגש את הפרבולה מחוץ לראשית</>
          ) : (
            <>
              הישר פוגש את הפרבולה ב-<Q>{`t* = ${num(ts)}`}</Q>; בין <Q>{`−|t*|`}</Q> ל-<Q>{`|t*|`}</Q> הפרוסה היא 0
            </>
          )}
        </span>
      )}
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
      <Slider label="זווית הכיוון θ (במעלות)" value={s.deg} min={0} max={359.9} step={0.1} format={(x) => `${fmtNum(sig(x, 5))}°`} onChange={(x) => userSet({ deg: roundDeg(x) })} />
      <Slider
        label="t של המיתרים"
        value={Math.log10(s.t)}
        min={LOGT_MIN}
        max={logTMax(s.preset)}
        step={0.01}
        format={(x) => fmtT(clampT(s.preset, 10 ** x))}
        onChange={(x) => userSet({ t: clampT(s.preset, 10 ** x) })}
      />
    </>
  );

  return (
    <SimShell
      fig={props.id}
      label={`איור חי: קווי הגובה של פונקציה ליד נקודה a, כיוון v והישר דרך a בכיוון v; למטה, הפרוסה של הפונקציה לאורך הישר עם שני מיתרים ועם הנגזרת הכיוונית כשהיא קיימת. במקלדת: חצים ימינה ושמאלה מסובבים את הכיוון, למעלה ולמטה משנים את t. ${describe()}`}
      canvasRef={canvasRef}
      aspect={0.9}
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
