/**
 * Lesson 3.3's figure: ε-nets. Two modes.
 *
 * plane:  a set A in the plane (square, disc, thin strip, 12 points, or the 12 points with the discrete metric) with
 *         d₁, d₂ or d∞. The greedy ε-net (lemma 3.3.3א(ב): add a point of A that no chosen ball covers, here the
 *         farthest one) is drawn as filled points with their open ε-balls (a disc, a square or a diamond, by the
 *         metric) in the warm ε colour; the readout gives its size N. With "separated" on, the greedy 2ε-net is
 *         drawn as hollow rings: a 2ε-separated subset of A, so every ε-net of A has at least that many points
 *         (lemma 3.3.3א(א)). In the discrete metric a ball of radius ε ≤ 1 is one point, and for ε > 1 it is all of A;
 *         the readout names the ball only after the student has seen both nets (the discrete task asks for the
 *         threshold). The sandwich task needs equal sizes above 1 (a one-point net at large ε is trivial).
 * zigzag: the space (C[0,1], d∞). A function f (in L = {f(0) = 0, 1-Lipschitz}, or the tent t₁ outside L), the
 *         zigzag g of mesh h = 1/m chosen by the sign rule of טענה 3.3.10(א), the tube {|y − g| < h} around it in the
 *         ε colours, and the nodes x_j = j/m; a node value is filled when it lies in the open tube (distance < h).
 *         The readout gives ‖f − g‖∞ (sampled) next to h.
 *
 * Every number comes from src/math/epsnet.ts. A region is represented by its grid points of step 0.02: the net is a
 * net of those points, and the caption says that between them the figure is a probe. No animation.
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  CLOUD,
  FNS,
  SETS,
  describePlane,
  describeZig,
  fmtNum,
  metricName,
  metricOf,
  netFor,
  nodeError,
  supDistance,
  zigzagNodes,
  zigzagSigns,
  zigzagValue,
  type FnId,
  type Metric,
  type Pt,
  type SetId,
} from '~/math/epsnet';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { drawAxes, insetBox, makePlot, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

/** a left-to-right island inside Hebrew text (U+2066 … U+2069) */
const ltr = (s: string) => `⁦${s}⁩`;

const TASK_LABEL: Record<string, string> = {
  halve: `בריבוע, בחרו ${ltr('ε')} ואחר כך את חציו (באותה מטריקה), והשוו את גודל הרשת בשני המצבים.`,
  'strip-halve': `במלבן הדק, בחרו ${ltr('ε')} ואחר כך את חציו (באותה מטריקה). האם הרשת גדלה באותו יחס כמו בריבוע?`,
  discrete: `במטריקה הבדידה, מצאו ${ltr('ε')} שבו הרשת היא כל הקבוצה, ו-${ltr('ε')} שבו היא נקודה אחת.`,
  sandwich: `באחת הקבוצות הרציפות (ריבוע, עיגול או מלבן), הדליקו את הקבוצה המופרדת ומצאו מטריקה ו-${ltr('ε')} שבהם שני המספרים שווים וגדולים מ-${ltr('1')}.`,
  close: `בפונקציה מ-${ltr('L')}, בחרו ${ltr('m')} שבו הזיגזג קרוב אליה פחות מ-${ltr('0.1')} במרחק הסופרמום.`,
  sharp: `בפונקציית האפס, השוו את ${ltr('‖f − g‖∞')} ל-${ltr('h')} בשלושה ערכים שונים של ${ltr('m')}.`,
  'outside-L': `באוהל ${ltr('t₁')}, מצאו ${ltr('m')} שבו המרחק מהזיגזג גדול מ-${ltr('h')}.`,
};

const EPS_MIN = 0.05;
const EPS_MAX = 1.5;
const M_MAX = 16;
const roundEps = (v: number) => Math.min(EPS_MAX, Math.max(EPS_MIN, Math.round(v * 100) / 100));
const clampM = (v: number) => Math.max(1, Math.min(M_MAX, Math.round(v)));

interface State {
  set: SetId;
  metric: Metric;
  eps: number;
  showSep: boolean;
  fn: FnId;
  m: number;
}

export interface EpsNetProps {
  id: string;
  mode?: 'plane' | 'zigzag';
  set?: SetId;
  sets?: SetId[];
  metric?: Metric;
  eps?: number;
  showSep?: boolean;
  fn?: FnId;
  fns?: FnId[];
  m?: number;
  tasks?: string[];
}

function fresh(p: EpsNetProps): State {
  return {
    set: p.set && p.set in SETS ? p.set : 'square',
    metric: p.metric && p.metric !== 'discrete' ? p.metric : 'd2',
    eps: roundEps(typeof p.eps === 'number' ? p.eps : 0.5),
    showSep: p.showSep ?? false,
    fn: p.fn && p.fn in FNS ? p.fn : 'wave',
    m: clampM(typeof p.m === 'number' ? p.m : 4),
  };
}

const Q = (p: { children: ComponentChildren }) => (
  <b class="q">
    <bdi dir="ltr">{p.children}</bdi>
  </b>
);

const METRIC_IDS: Metric[] = ['d1', 'd2', 'dinf'];

export default function EpsNet(props: EpsNetProps) {
  const zig = props.mode === 'zigzag';
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const plotRef = useRef<Plot | null>(null);
  /** what the student visited (tasks): "set|metric" → ε values; discrete sizes; zero-function m values */
  const visited = useRef<Map<string, Set<number>>>(new Map());
  const discreteSeen = useRef<Set<string>>(new Set());
  /** the student has seen both a net of all 12 points and a one-point net: only then the readout names the ball */
  const [discreteFound, setDiscreteFound] = useState(false);
  const zeroMs = useRef<Set<number>>(new Set());
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const has = (t: string) => props.tasks?.includes(t) ?? false;

  const metric = metricOf(s.set, s.metric);
  const nets = zig ? null : netFor(s.set, s.metric, s.eps);
  const F = FNS[s.fn];
  const signs = zig ? zigzagSigns(F.f, s.m) : [];
  const zdist = zig ? supDistance(F.f, signs, F.kinks) : 0;
  const nerr = zig ? nodeError(F.f, signs) : 0;
  const h = 1 / s.m;

  /** The student's own change: a text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    setS(next);
    const id = props.id;
    if (!zig) {
      const met = metricOf(next.set, next.metric);
      const key = `${next.set}|${met}`;
      const seen = visited.current.get(key) ?? new Set<number>();
      seen.add(Math.round(next.eps * 100));
      visited.current.set(key, seen);
      const halved = [...seen].some((e) => e % 2 === 0 && seen.has(e / 2));
      if (has('halve') && next.set === 'square' && halved) markTask(`${id}:halve`);
      if (has('strip-halve') && next.set === 'strip' && halved) markTask(`${id}:strip-halve`);
      const r = netFor(next.set, next.metric, next.eps);
      if (next.set === 'discrete') {
        if (r.net.length === CLOUD.length) discreteSeen.current.add('all');
        if (r.net.length === 1) discreteSeen.current.add('one');
        if (discreteSeen.current.size === 2) {
          setDiscreteFound(true);
          if (has('discrete')) markTask(`${id}:discrete`);
        }
      }
      // one point on each side (ε larger than the diameter) is a trivial equality, not the sandwich the task asks for
      if (has('sandwich') && next.showSep && SETS[next.set].kind === 'region' && r.net.length > 1 && r.net.length === r.separated.length)
        markTask(`${id}:sandwich`);
    } else {
      const G = FNS[next.fn];
      const sg = zigzagSigns(G.f, next.m);
      const e = supDistance(G.f, sg, G.kinks);
      if (has('close') && G.inL && next.fn !== 'zero' && e < 0.1) markTask(`${id}:close`);
      if (next.fn === 'zero') {
        zeroMs.current.add(next.m);
        if (has('sharp') && zeroMs.current.size >= 3) markTask(`${id}:sharp`);
      }
      if (has('outside-L') && !G.inL && e > 1 / next.m + 1e-9) markTask(`${id}:outside-L`);
    }
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.set === 'string' && st.set in SETS) next.set = st.set as SetId;
          if (typeof st.metric === 'string' && (METRIC_IDS as string[]).includes(st.metric)) next.metric = st.metric as Metric;
          if (typeof st.eps === 'number') next.eps = roundEps(st.eps);
          if (typeof st.showSep === 'boolean') next.showSep = st.showSep;
          if (typeof st.fn === 'string' && st.fn in FNS) next.fn = st.fn as FnId;
          if (typeof st.m === 'number') next.m = clampM(st.m);
          return next;
        });
      }),
    [props.id],
  );

  const describe = () => (zig ? describeZig({ fn: s.fn, m: s.m }) : describePlane(s));

  useEffect(() => {
    const t = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(t);
  }, [s]);

  const drawPlane = ({ ctx, view, palette: p }: FrameInfo) => {
    const set = SETS[s.set];
    const narrow = view.w < 420;
    const outer = insetBox({ x: 0, y: 0, w: view.w, h: view.h }, { l: narrow ? 36 : 44, r: 12, t: 14, b: 34 });
    const [wx0, wx1] = set.window.x;
    const [wy0, wy1] = set.window.y;
    // equal scales: a d₂-ball must look round, a d∞-ball square
    const sc = Math.min(outer.w / (wx1 - wx0), outer.h / (wy1 - wy0));
    const bw = sc * (wx1 - wx0);
    const bh = sc * (wy1 - wy0);
    const box = { x: outer.x + (outer.w - bw) / 2, y: outer.y + (outer.h - bh) / 2, w: bw, h: bh };
    const plot = makePlot(box, { min: wx0, max: wx1 }, { min: wy0, max: wy1 });
    plotRef.current = plot;
    drawAxes(ctx, plot, p);
    const X = (x: number) => plot.px(x);
    const Y = (y: number) => plot.py(y);

    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();

    // the set A
    if (set.kind === 'region') {
      ctx.beginPath();
      if (s.set === 'disc') ctx.arc(X(0.5), Y(0.5), 0.5 * sc, 0, 2 * Math.PI);
      else if (s.set === 'strip') ctx.rect(X(0), Y(0.1), 2 * sc, 0.1 * sc);
      else ctx.rect(X(0), Y(1), sc, sc);
      ctx.fillStyle = p.paper2;
      ctx.fill();
      ctx.strokeStyle = p.ink2;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    const net = nets!.net;
    const ballPath = (c: Pt, r: number) => {
      const [cx, cy] = [X(c[0]), Y(c[1])];
      const R = r * sc;
      ctx.beginPath();
      if (metric === 'd2') ctx.arc(cx, cy, R, 0, 2 * Math.PI);
      else if (metric === 'dinf') ctx.rect(cx - R, cy - R, 2 * R, 2 * R);
      else {
        ctx.moveTo(cx + R, cy);
        ctx.lineTo(cx, cy - R);
        ctx.lineTo(cx - R, cy);
        ctx.lineTo(cx, cy + R);
        ctx.closePath();
      }
    };

    if (metric === 'discrete') {
      if (s.eps > 1) {
        // one ball is the whole space
        const xs = CLOUD.map((q) => q[0]);
        const ys = CLOUD.map((q) => q[1]);
        const pad = 0.08;
        const x0 = X(Math.min(...xs) - pad);
        const y0 = Y(Math.max(...ys) + pad);
        ctx.beginPath();
        ctx.roundRect(x0, y0, X(Math.max(...xs) + pad) - x0, Y(Math.min(...ys) - pad) - y0, 14);
        ctx.fillStyle = p.epsBand;
        ctx.fill();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = p.eps;
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        for (const c of net) {
          ctx.beginPath();
          ctx.arc(X(c[0]), Y(c[1]), 11, 0, 2 * Math.PI);
          ctx.fillStyle = p.epsBand;
          ctx.fill();
          ctx.strokeStyle = p.eps;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      }
    } else {
      for (const c of net) {
        ballPath(c, s.eps);
        ctx.fillStyle = p.epsBand;
        ctx.fill();
      }
      ctx.strokeStyle = p.eps;
      ctx.lineWidth = net.length > 60 ? 0.8 : 1.3;
      for (const c of net) {
        ballPath(c, s.eps);
        ctx.stroke();
      }
    }

    // the points of a finite set
    if (set.kind === 'finite')
      for (const q of CLOUD) {
        ctx.beginPath();
        ctx.arc(X(q[0]), Y(q[1]), 3.2, 0, 2 * Math.PI);
        ctx.fillStyle = p.ink;
        ctx.fill();
      }

    // the 2ε-separated set: hollow rings
    if (s.showSep)
      for (const q of nets!.separated) {
        ctx.beginPath();
        ctx.arc(X(q[0]), Y(q[1]), 7.5, 0, 2 * Math.PI);
        ctx.strokeStyle = p.pointOut;
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }

    // the net: filled points
    const r = net.length > 120 ? 2.2 : net.length > 40 ? 3 : 4.5;
    for (const c of net) {
      ctx.beginPath();
      ctx.arc(X(c[0]), Y(c[1]), r, 0, 2 * Math.PI);
      ctx.fillStyle = p.pointIn;
      ctx.fill();
      ctx.strokeStyle = p.paper;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawZig = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const box = insetBox({ x: 0, y: 0, w: view.w, h: view.h }, { l: narrow ? 40 : 48, r: 14, t: 14, b: 34 });
    const plot = makePlot(box, { min: 0, max: 1, label: 'x' }, { min: -0.7, max: 1.1 });
    plotRef.current = plot;
    drawAxes(ctx, plot, p);
    const X = plot.px;
    const Y = plot.py;
    const N = 400;
    const g = (x: number) => zigzagValue(signs, x);

    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();

    // the tube {|y − g| < h}: the ball of radius h about the net point g
    ctx.beginPath();
    for (let i = 0; i <= N; i++) ctx.lineTo(X(i / N), Y(g(i / N) + h));
    for (let i = N; i >= 0; i--) ctx.lineTo(X(i / N), Y(g(i / N) - h));
    ctx.closePath();
    ctx.fillStyle = p.epsBand;
    ctx.fill();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = p.eps;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    // the nodes x_j
    ctx.strokeStyle = p.rule;
    ctx.lineWidth = 1;
    for (let j = 1; j < s.m; j++) {
      ctx.beginPath();
      ctx.moveTo(X(j / s.m), box.y);
      ctx.lineTo(X(j / s.m), box.y + box.h);
      ctx.stroke();
    }

    // the zigzag g
    const nodes = zigzagNodes(signs);
    ctx.strokeStyle = p.eps;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    nodes.forEach((v, j) => (j ? ctx.lineTo(X(j / s.m), Y(v)) : ctx.moveTo(X(0), Y(v))));
    ctx.stroke();

    // f
    ctx.strokeStyle = p.curve;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    const M = 800;
    for (let i = 0; i <= M; i++) {
      const x = i / M;
      if (i) ctx.lineTo(X(x), Y(F.f(x)));
      else ctx.moveTo(X(x), Y(F.f(x)));
    }
    ctx.stroke();

    // node values of f: filled when |f(x_j) − g(x_j)| < h (inside the open tube, the open ball of radius h about g),
    // hollow when not, including on its edge (distance exactly h, as for the zero function at x₁)
    nodes.forEach((v, j) => {
      const x = j / s.m;
      const ok = Math.abs(F.f(x) - v) < h - 1e-12;
      ctx.beginPath();
      ctx.arc(X(x), Y(F.f(x)), 4, 0, 2 * Math.PI);
      ctx.fillStyle = ok ? p.pointIn : p.paper;
      ctx.fill();
      ctx.strokeStyle = ok ? p.pointIn : p.pointOut;
      ctx.lineWidth = ok ? 1 : 2.2;
      ctx.stroke();
    });
    ctx.restore();

    // legend, LTR
    ctx.save();
    ctx.font = `600 ${narrow ? 12 : 13}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = p.curve;
    ctx.fillText(`f = ${F.formula}`, box.x + 8, box.y + 12);
    ctx.fillStyle = p.eps;
    ctx.fillText(`g, |y − g| < h = ${fmtNum(h)}`, box.x + 8, box.y + 30);
    ctx.restore();
  };

  const { canvasRef, invalidate } = useFigureCanvas(zig ? drawZig : drawPlane, { worldWidth: 1.25, worldHeight: 1, animate: false });
  useEffect(invalidate, [s]);

  const onKeyDown = (e: KeyboardEvent) => {
    const up = e.key === 'ArrowUp' || e.key === 'ArrowRight';
    const down = e.key === 'ArrowDown' || e.key === 'ArrowLeft';
    if (!up && !down) return;
    e.preventDefault();
    if (zig) userSet({ m: clampM(s.m + (up ? 1 : -1)) });
    else userSet({ eps: roundEps(s.eps + (up ? 0.01 : -0.01) * (e.shiftKey ? 10 : 1)) });
  };

  const offeredSets = (props.sets ?? []).filter((id) => id in SETS);
  const offeredFns = (props.fns ?? []).filter((id) => id in FNS);

  const readout = zig ? (
    <>
      <span data-readout="m">
        <Q>{`m = ${s.m}, h = 1/m = ${fmtNum(h)}`}</Q>
      </span>
      <span data-readout="count">
        מספר הזיגזגים: <Q>{`2^${s.m} = ${2 ** s.m}`}</Q>
      </span>
      <span data-readout="dist">
        המרחק: <Q>{`‖f − g‖∞ ≈ ${fmtNum(Number(zdist.toPrecision(4)))}`}</Q>
        {zdist <= h + 1e-9 ? (
          <>
            {' '}
            ≤ <Q>h</Q>
          </>
        ) : (
          <>
            {' '}
            &gt; <Q>h</Q>
          </>
        )}
      </span>
      <span data-readout="nodes">
        בנקודות הרשת: <Q>{`max |f(xⱼ) − g(xⱼ)| = ${fmtNum(Number(nerr.toPrecision(4)))}`}</Q>
      </span>
      <span data-readout="in-L">
        {F.inL ? (
          <>
            <Q>f ∈ L</Q>
          </>
        ) : (
          <>
            <Q>f ∉ L</Q>: השיפוע שלה <Q>{String(F.lip)}</Q>, גדול מ-<Q>1</Q>.
          </>
        )}
      </span>
    </>
  ) : (
    <>
      <span data-readout="eps">
        <Q>{`ε = ${fmtNum(s.eps)}`}</Q>, <Q>{metricName(metric)}</Q>
      </span>
      <span data-readout="net">
        ברשת החמדנית: <Q>{`N = ${nets!.net.length}`}</Q>
      </span>
      {s.showSep && (
        <span data-readout="sep">
          קבוצה <Q>{`${fmtNum(2 * s.eps)}`}</Q>-מופרדת בגודל <Q>{String(nets!.separated.length)}</Q>: לכל <Q>ε</Q>-רשת של <Q>A</Q> לפחות{' '}
          <Q>{String(nets!.separated.length)}</Q> נקודות.
        </span>
      )}
      {metric === 'discrete' && discreteFound && (
        <span data-readout="ball">
          {s.eps <= 1 ? (
            <>
              <Q>{`B(y, ε) = {y}`}</Q> לכל <Q>y</Q>.
            </>
          ) : (
            <>
              <Q>{`B(y, ε) = A`}</Q> לכל <Q>y</Q>.
            </>
          )}
        </span>
      )}
    </>
  );

  const controls = zig ? (
    <>
      {offeredFns.length > 1 && (
        <div class="group" role="group" aria-label="הפונקציה">
          {offeredFns.map((id) => (
            <Toggle key={id} label={<bdi dir="ltr">{FNS[id].formula}</bdi>} on={s.fn === id} onChange={() => userSet({ fn: id })} />
          ))}
        </div>
      )}
      <Slider label="m" value={s.m} min={1} max={M_MAX} step={1} format={(v) => String(Math.round(v))} onChange={(v) => userSet({ m: clampM(v) })} />
    </>
  ) : (
    <>
      {offeredSets.length > 1 && (
        <div class="group" role="group" aria-label="הקבוצה">
          {offeredSets.map((id) => (
            <Toggle key={id} label={SETS[id].label} on={s.set === id} onChange={() => userSet({ set: id })} />
          ))}
        </div>
      )}
      {SETS[s.set].fixedMetric === null && (
        <div class="group" role="group" aria-label="המטריקה">
          {METRIC_IDS.map((id) => (
            <Toggle key={id} label={<bdi dir="ltr">{metricName(id)}</bdi>} on={s.metric === id} onChange={() => userSet({ metric: id })} />
          ))}
        </div>
      )}
      <Slider label="ε" value={s.eps} min={EPS_MIN} max={EPS_MAX} step={0.01} format={(v) => fmtNum(roundEps(v))} onChange={(v) => userSet({ eps: roundEps(v) })} />
      <div class="group">
        <Toggle label="קבוצה מופרדת" on={s.showSep} onChange={(on) => userSet({ showSep: on })} />
      </div>
    </>
  );

  return (
    <SimShell
      fig={props.id}
      label={
        zig
          ? `איור חי: פונקציה f במרחב הפונקציות הרציפות על [0, 1], הזיגזג g שנבחר לה ברשת של שיפועים ±1, והרצועה ברוחב h סביב g. במקלדת: חצים משנים את m. ${describe()}`
          : `איור חי: קבוצה A במישור, הרשת החמדנית שלה והכדורים ברדיוס ε סביב נקודות הרשת. במקלדת: חצים משנים את ε. ${describe()}`
      }
      canvasRef={canvasRef}
      aspect={zig ? 1.5 : 1.25}
      live={live}
      tasks={tasks}
      onKeyDown={onKeyDown}
      onReset={() => {
        visited.current = new Map();
        discreteSeen.current = new Set();
        setDiscreteFound(false);
        zeroMs.current = new Set();
        setS(fresh(props));
        setLive('האיור אופס.');
      }}
      readout={readout}
      controls={controls}
    />
  );
}
