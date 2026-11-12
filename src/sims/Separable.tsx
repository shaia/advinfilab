/**
 * Lesson 4.4's figure: separability. Two modes.
 *
 * polygon:    the space (C[0,1], d∞). A function f (a preset), the ε-tube {|y − f| < ε} around it in the warm ε
 *             colours, and the polygon p of the countable set D of טענה 4.4.2(ג): equally spaced nodes i/m and
 *             rational node values k/Q. By default m is the mesh the proof guarantees (from a modulus of continuity of
 *             f, so ‖f − p‖∞ ≤ ω(1/m) + 1/(2Q) < ε); moving the m slider takes m by hand. The node values are
 *             filled points; the readout gives m, Q, the proof's bound and the sampled ‖f − p‖∞ (a probe).
 * indicators: the space (B([0,1]), d∞). Two indicators χ_[0,s], χ_[0,t] with the bands of radius r around their graphs
 *             (the open balls B(χ, r) drawn as tubes), the interval between s and t shaded; for r > 1/2 the midpoint
 *             function, which lies in both balls, is drawn dashed. Optionally the faint family χ_[0,u], u = 0.1 … 0.9.
 *
 * Every number comes from src/math/separable.ts. No animation.
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  FNS,
  ballsDisjoint,
  describeIndicators,
  describePolygon,
  fmtNum,
  polyValue,
  polygonFit,
  type FnId,
} from '~/math/separable';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { drawAxes, insetBox, makePlot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

/** a left-to-right island inside Hebrew text (U+2066 … U+2069) */
const ltr = (s: string) => `⁦${s}⁩`;

const TASK_LABEL: Record<string, string> = {
  compare: `בחרו ${ltr('ε')} אחד, והשוו את ${ltr('m')} שההוכחה מבטיחה ל-${ltr('√x')} ול-${ltr('0.5 + 0.35·sin 2πx')}.`,
  smaller: `הזיזו את ${ltr('m')} ביד ובדקו אם יש ${ltr('m')} קטן מזה שההוכחה מבטיחה, שבו הקו השבור עדיין בתוך רצועת ה-${ltr('ε')}.`,
  fail: `מצאו ${ltr('m')} שבו הקו השבור יוצא מרצועת ה-${ltr('ε')}.`,
  radius: `מצאו את הרדיוס ${ltr('r')} הגדול ביותר שבו שני הכדורים זרים: הגדילו את ${ltr('r')} עד שפונקציית האמצע מופיעה, ובדקו את הרדיוס האחרון שבו אינה מופיעה.`,
  close: `בחרו ${ltr('s ≠ t')} קרובים מאוד (הפרש ${ltr('0.02')} לכל היותר), ובדקו את המרחק בין שתי הפונקציות.`,
};

const EPS_MIN = 0.05;
const EPS_MAX = 0.5;
const M_HAND_MAX = 60;
const roundEps = (v: number) => Math.min(EPS_MAX, Math.max(EPS_MIN, Math.round(v * 100) / 100));
const clampM = (v: number) => Math.max(1, Math.min(M_HAND_MAX, Math.round(v)));
const round2 = (v: number) => Math.min(1, Math.max(0, Math.round(v * 100) / 100));
const roundR = (v: number) => Math.min(1, Math.max(0.05, Math.round(v * 100) / 100));

interface State {
  fn: FnId;
  eps: number;
  /** m by hand, or null for the guaranteed mesh */
  m: number | null;
  s: number;
  t: number;
  r: number;
  family: boolean;
}

export interface SeparableProps {
  id: string;
  mode?: 'polygon' | 'indicators';
  fn?: FnId;
  fns?: FnId[];
  eps?: number;
  m?: number | null;
  s?: number;
  t?: number;
  r?: number;
  family?: boolean;
  tasks?: string[];
}

function fresh(p: SeparableProps): State {
  return {
    fn: p.fn && p.fn in FNS ? p.fn : 'wave',
    eps: roundEps(typeof p.eps === 'number' ? p.eps : 0.2),
    m: typeof p.m === 'number' ? clampM(p.m) : null,
    s: round2(typeof p.s === 'number' ? p.s : 0.3),
    t: round2(typeof p.t === 'number' ? p.t : 0.6),
    r: roundR(typeof p.r === 'number' ? p.r : 0.3),
    family: p.family ?? false,
  };
}

const Q = (p: { children: ComponentChildren }) => (
  <b class="q">
    <bdi dir="ltr">{p.children}</bdi>
  </b>
);

export default function Separable(props: SeparableProps) {
  const ind = props.mode === 'indicators';
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  /** compare task: "eps" → the presets visited with the guaranteed mesh at that ε */
  const visited = useRef<Map<number, Set<FnId>>>(new Map());
  const radii = useRef<{ half: boolean; above: boolean }>({ half: false, above: false });
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const has = (t: string) => props.tasks?.includes(t) ?? false;

  const F = FNS[s.fn];
  const fit = ind ? null : polygonFit(s.fn, s.eps, s.m ?? undefined);

  /** The student's own change: a text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    setS(next);
    const id = props.id;
    if (!ind) {
      const f = polygonFit(next.fn, next.eps, next.m ?? undefined);
      if (next.m === null) {
        const key = Math.round(next.eps * 100);
        const seen = visited.current.get(key) ?? new Set<FnId>();
        seen.add(next.fn);
        visited.current.set(key, seen);
        if (has('compare') && seen.has('sqrt') && seen.has('wave')) markTask(`${id}:compare`);
      } else {
        if (has('smaller') && next.m < f.mAuto && f.err < next.eps) markTask(`${id}:smaller`);
        if (has('fail') && f.err >= next.eps) markTask(`${id}:fail`);
      }
    } else {
      if (next.s !== next.t) {
        if (Math.abs(next.r - 0.5) < 1e-9) radii.current.half = true;
        if (next.r > 0.5 && next.r <= 0.6 + 1e-9) radii.current.above = true;
        if (has('radius') && radii.current.half && radii.current.above) markTask(`${id}:radius`);
        if (has('close') && Math.abs(next.s - next.t) <= 0.02 + 1e-9) markTask(`${id}:close`);
      }
    }
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.fn === 'string' && st.fn in FNS) next.fn = st.fn as FnId;
          if (typeof st.eps === 'number') next.eps = roundEps(st.eps);
          if (st.m === null) next.m = null;
          if (typeof st.m === 'number') next.m = clampM(st.m);
          if (typeof st.s === 'number') next.s = round2(st.s);
          if (typeof st.t === 'number') next.t = round2(st.t);
          if (typeof st.r === 'number') next.r = roundR(st.r);
          if (typeof st.family === 'boolean') next.family = st.family;
          return next;
        });
      }),
    [props.id],
  );

  const describe = () => (ind ? describeIndicators(s.s, s.t, s.r) : describePolygon(s.fn, s.eps, fit!, s.m === null));

  useEffect(() => {
    const t = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(t);
  }, [s]);

  const drawPolygon = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const box = insetBox({ x: 0, y: 0, w: view.w, h: view.h }, { l: narrow ? 36 : 44, r: 12, t: 14, b: 34 });
    // headroom above 1.2 keeps the two legend lines (top left) clear of the ε-tube at the default ε
    const plot = makePlot(box, { min: 0, max: 1, label: 'x' }, { min: -0.15, max: 1.45 });
    drawAxes(ctx, plot, p);
    const X = plot.px;
    const Y = plot.py;
    const N = 600;
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();

    // the ε-tube {|y − f| < ε}: the open ball of radius ε about f
    ctx.beginPath();
    for (let i = 0; i <= N; i++) ctx.lineTo(X(i / N), Y(F.f(i / N) + s.eps));
    for (let i = N; i >= 0; i--) ctx.lineTo(X(i / N), Y(F.f(i / N) - s.eps));
    ctx.closePath();
    ctx.fillStyle = p.epsBand;
    ctx.fill();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = p.eps;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    // f
    ctx.strokeStyle = p.curve;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const x = i / N;
      if (i) ctx.lineTo(X(x), Y(F.f(x)));
      else ctx.moveTo(X(x), Y(F.f(x)));
    }
    ctx.stroke();

    // the rational polygon p
    const vals = fit!.vals;
    const m = vals.length - 1;
    ctx.strokeStyle = p.delta;
    ctx.lineWidth = m > 200 ? 1.4 : 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (m <= 2000) vals.forEach((v, i) => (i ? ctx.lineTo(X(i / m), Y(v)) : ctx.moveTo(X(0), Y(v))));
    else for (let i = 0; i <= N; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(i / N), Y(polyValue(vals, i / N)));
    ctx.stroke();

    // its nodes (t_i, k_i/Q): filled points, drawn while they can be told apart
    if (m <= 60)
      vals.forEach((v, i) => {
        ctx.beginPath();
        ctx.arc(X(i / m), Y(v), 3.6, 0, 2 * Math.PI);
        ctx.fillStyle = p.pointIn;
        ctx.fill();
        ctx.strokeStyle = p.paper;
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    ctx.restore();

    ctx.save();
    ctx.font = `600 ${narrow ? 12 : 13}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = p.curve;
    ctx.fillText(`f = ${F.formula}`, box.x + 8, box.y + 12);
    ctx.fillStyle = p.delta;
    ctx.fillText(`p: m = ${m}, values k/${fit!.Q}`, box.x + 8, box.y + 30);
    ctx.restore();
  };

  const drawIndicators = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const box = insetBox({ x: 0, y: 0, w: view.w, h: view.h }, { l: narrow ? 36 : 44, r: 12, t: 14, b: 34 });
    const plot = makePlot(box, { min: 0, max: 1, label: 'x' }, { min: -1.1, max: 2.1 });
    drawAxes(ctx, plot, p);
    const X = plot.px;
    const Y = plot.py;
    const [a, b] = s.s <= s.t ? [s.s, s.t] : [s.t, s.s];
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();

    // the interval (a, b] where the two functions differ
    if (a < b) {
      ctx.fillStyle = p.paper2;
      ctx.fillRect(X(a), box.y, X(b) - X(a), box.h);
    }

    // the faint family χ_[0,u]
    if (s.family) {
      ctx.strokeStyle = p.ink3;
      ctx.lineWidth = 1;
      for (let k = 1; k <= 9; k++) {
        const u = k / 10;
        ctx.beginPath();
        ctx.moveTo(X(0), Y(1));
        ctx.lineTo(X(u), Y(1));
        ctx.moveTo(X(u), Y(0));
        ctx.lineTo(X(1), Y(0));
        ctx.stroke();
      }
    }

    // the band of radius r about the graph of χ_[0,u]: |y − 1| < r on [0,u], |y| < r on (u,1]
    const band = (u: number) => {
      ctx.fillStyle = p.epsBand;
      ctx.fillRect(X(0), Y(1 + s.r), X(u) - X(0), Y(1 - s.r) - Y(1 + s.r));
      ctx.fillRect(X(u), Y(s.r), X(1) - X(u), Y(-s.r) - Y(s.r));
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = p.eps;
      ctx.lineWidth = 1;
      ctx.strokeRect(X(0), Y(1 + s.r), X(u) - X(0), Y(1 - s.r) - Y(1 + s.r));
      ctx.strokeRect(X(u), Y(s.r), X(1) - X(u), Y(-s.r) - Y(s.r));
      ctx.setLineDash([]);
    };
    band(s.s);
    if (s.t !== s.s) band(s.t);

    // the graphs: 1 up to and including u (filled endpoint), 0 after (hollow endpoint)
    const graph = (u: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(X(0), Y(1));
      ctx.lineTo(X(u), Y(1));
      ctx.moveTo(X(u), Y(0));
      ctx.lineTo(X(1), Y(0));
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(X(u), Y(1), 4, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      if (u < 1) {
        ctx.beginPath();
        ctx.arc(X(u), Y(0), 4, 0, 2 * Math.PI);
        ctx.fillStyle = p.paper;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
    };
    graph(s.s, p.curve);
    if (s.t !== s.s) graph(s.t, p.curve2);

    // for r > 1/2 the midpoint function lies in both balls
    if (a < b && !ballsDisjoint(s.r)) {
      ctx.strokeStyle = p.pointOut;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 4]);
      ctx.beginPath();
      ctx.moveTo(X(0), Y(1));
      ctx.lineTo(X(a), Y(1));
      ctx.moveTo(X(a), Y(0.5));
      ctx.lineTo(X(b), Y(0.5));
      ctx.moveTo(X(b), Y(0));
      ctx.lineTo(X(1), Y(0));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();

    ctx.save();
    ctx.font = `600 ${narrow ? 12 : 13}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = p.curve;
    ctx.fillText(`χ[0, ${fmtNum(s.s)}]`, box.x + 8, box.y + 12);
    ctx.fillStyle = p.curve2;
    ctx.fillText(`χ[0, ${fmtNum(s.t)}]`, box.x + 8, box.y + 30);
    ctx.restore();
  };

  const { canvasRef, invalidate } = useFigureCanvas(ind ? drawIndicators : drawPolygon, { worldWidth: 1.25, worldHeight: 1, animate: false });
  useEffect(invalidate, [s]);

  const onKeyDown = (e: KeyboardEvent) => {
    const up = e.key === 'ArrowUp' || e.key === 'ArrowRight';
    const down = e.key === 'ArrowDown' || e.key === 'ArrowLeft';
    if (!up && !down) return;
    e.preventDefault();
    if (ind) userSet({ r: roundR(s.r + (up ? 0.01 : -0.01) * (e.shiftKey ? 10 : 1)) });
    else userSet({ eps: roundEps(s.eps + (up ? 0.01 : -0.01) * (e.shiftKey ? 10 : 1)) });
  };

  const offeredFns = (props.fns ?? []).filter((id) => id in FNS);

  const readout = ind ? (
    <>
      <span data-readout="dist">
        <Q>{`‖χ[0, ${fmtNum(s.s)}] − χ[0, ${fmtNum(s.t)}]‖∞ = ${s.s === s.t ? 0 : 1}`}</Q>
      </span>
      <span data-readout="balls">
        {s.s === s.t ? (
          <>אותה פונקציה: בחרו שתי פונקציות שונות.</>
        ) : ballsDisjoint(s.r) ? (
          <>
            הכדורים ברדיוס <Q>{`r = ${fmtNum(s.r)}`}</Q> זרים.
          </>
        ) : (
          <>
            הכדורים ברדיוס <Q>{`r = ${fmtNum(s.r)}`}</Q> נחתכים: פונקציית האמצע במרחק <Q>1/2</Q> משתיהן.
          </>
        )}
      </span>
    </>
  ) : (
    <>
      <span data-readout="eps">
        <Q>{`ε = ${fmtNum(s.eps)}`}</Q>, <Q>{`Q = ${fit!.Q}`}</Q>
      </span>
      <span data-readout="m">
        <Q>{`m = ${fit!.m}`}</Q>
        {s.m === null ? ' (מה שההוכחה מבטיחה)' : <> (ביד; ההוכחה מבטיחה <Q>{String(fit!.mAuto)}</Q>)</>}
      </span>
      {s.m === null && (
        <span data-readout="bound">
          חסם ההוכחה: <Q>{`ω(1/m) + 1/(2Q) ≈ ${fmtNum(Number(fit!.bound.toPrecision(3)))} < ε`}</Q>
        </span>
      )}
      <span data-readout="err">
        במדגם: <Q>{`‖f − p‖∞ ≈ ${fmtNum(Number(fit!.err.toPrecision(3)))}`}</Q>
        {fit!.err < s.eps ? (
          <>
            {' '}
            &lt; <Q>ε</Q>
          </>
        ) : (
          <>
            {' '}
            ≥ <Q>ε</Q>: יוצא מהרצועה
          </>
        )}
      </span>
      <span data-readout="lip">
        {F.lip === null ? (
          <>
            <Q>f</Q> אינה ליפשיצית; ההוכחה משתמשת ב-<Q>{'|√s − √t| ≤ √|s − t|'}</Q>.
          </>
        ) : (
          <>
            <Q>f</Q> ליפשיצית עם קבוע <Q>{fmtNum(Number(F.lip.toPrecision(4)))}</Q>.
          </>
        )}
      </span>
    </>
  );

  const controls = ind ? (
    <>
      <Slider label="s" value={s.s} min={0} max={1} step={0.01} format={(v) => fmtNum(round2(v))} onChange={(v) => userSet({ s: round2(v) })} />
      <Slider label="t" value={s.t} min={0} max={1} step={0.01} format={(v) => fmtNum(round2(v))} onChange={(v) => userSet({ t: round2(v) })} />
      <Slider label="r" value={s.r} min={0.05} max={1} step={0.01} format={(v) => fmtNum(roundR(v))} onChange={(v) => userSet({ r: roundR(v) })} />
      <div class="group">
        <Toggle label="כל המשפחה" on={s.family} onChange={(on) => userSet({ family: on })} />
      </div>
    </>
  ) : (
    <>
      {offeredFns.length > 1 && (
        <div class="group" role="group" aria-label="הפונקציה">
          {offeredFns.map((id) => (
            <Toggle key={id} label={<bdi dir="ltr">{FNS[id].formula}</bdi>} on={s.fn === id} onChange={() => userSet({ fn: id })} />
          ))}
        </div>
      )}
      <Slider label="ε" value={s.eps} min={EPS_MIN} max={EPS_MAX} step={0.01} format={(v) => fmtNum(roundEps(v))} onChange={(v) => userSet({ eps: roundEps(v) })} />
      <Slider
        label="m ביד"
        value={s.m ?? Math.min(M_HAND_MAX, fit!.mAuto)}
        min={1}
        max={M_HAND_MAX}
        step={1}
        format={(v) => String(Math.round(v))}
        onChange={(v) => userSet({ m: clampM(v) })}
      />
      <div class="group">
        <Toggle label="m של ההוכחה" on={s.m === null} onChange={() => userSet({ m: null })} />
      </div>
    </>
  );

  return (
    <SimShell
      fig={props.id}
      label={
        ind
          ? `איור חי: שתי פונקציות מציינות של קטעים במרחב הפונקציות החסומות על [0, 1], והכדורים ברדיוס r סביבן, מצוירים כרצועות סביב הגרפים. במקלדת: חצים משנים את r. ${describe()}`
          : `איור חי: פונקציה רציפה f על [0, 1], רצועת ה-ε סביבה, וקו שבור עם נקודות שבירה במרווחים שווים וערכים רציונליים. במקלדת: חצים משנים את ε. ${describe()}`
      }
      canvasRef={canvasRef}
      aspect={1.4}
      live={live}
      tasks={tasks}
      onKeyDown={onKeyDown}
      onReset={() => {
        visited.current = new Map();
        radii.current = { half: false, above: false };
        setS(fresh(props));
        setLive('האיור אופס.');
      }}
      readout={readout}
      controls={controls}
    />
  );
}
