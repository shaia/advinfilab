/**
 * Lesson 4.2's figure: equicontinuity (רציפות במידה אחידה) of a family of functions.
 *
 * Upper panel: the first m members of a family on an interval D (shifts sin(x + c), sin(nx), sin(nx)/n, xⁿ, the
 * tents t_n), a point a ∈ D, the δ-window |x − a| < δ (cool, vertical) and, for every member, the ε-band around its
 * own value f(a) over the window (warm). A member stays when its graph over the window stays inside its band; it is
 * drawn in the curve colour with a filled point at (a, f(a)). A member that leaves is drawn in the "out" colour, with
 * a hollow ring where it first reaches the edge of its band (shape, not only colour). The band of the worst member is
 * filled.
 *
 * Lower panel: a ↦ δ*(a), the largest δ that works at a for all the drawn members (min over members of the exact
 * δ_f(a)), with the student's δ as a dashed line. One δ works at a for the drawn members exactly when the line is not
 * above the curve at a; one δ works at every point exactly when the line lies under the whole curve.
 *
 * Every number comes from src/math/equicont.ts (closed forms). A finite m is a probe of an infinite family, and the
 * profile is sampled on a grid of D: the caption says so. No animation.
 */

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  FAMILIES,
  clampM,
  deltaStar,
  describeFamily,
  escapePoint,
  escapees,
  fmtNum,
  members,
  profile,
  type FamilyId,
} from '~/math/equicont';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { withAlpha } from './core/ink';
import { drawAxes, insetBox, makePlot, niceTicks, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

/** a left-to-right island inside Hebrew text (U+2066 … U+2069) */
const ltr = (s: string) => `⁦${s}⁩`;

const TASK_LABEL: Record<string, string> = {
  'shift-one': `בהזזות ${ltr('sin(x + c)')}, עם לפחות ${ltr('8')} איברים: בחרו δ אחד שמתאים בכל נקודה של התחום לכל האיברים שבאיור, ושאינו קטן מ-ε.`,
  'power-fails': `במשפחה ${ltr('xⁿ')} עם ${ltr('ε ≥ 0.4')}: מצאו נקודה a ומספר איברים שבהם ה-δ הגדול ביותר שמתאים בנקודה קטן מ-${ltr('0.03')}.`,
  'power-inside': `במשפחה ${ltr('xⁿ')} עם לפחות ${ltr('30')} איברים: מצאו נקודה ${ltr('a ≤ 0.7')} ו-${ltr('δ ≥ 0.1')} שמתאים בה לכל האיברים שבאיור.`,
  'freq-zero': `במשפחה ${ltr('sin(nx)')} עם ${ltr('ε ≥ 0.4')}: מצאו נקודה ${ltr('a ≤ 0.05')} ומספר איברים שבהם ה-δ הגדול ביותר שמתאים בנקודה קטן מ-${ltr('0.02')}.`,
  'tent-away': `באוהלים ${ltr('tₙ')} עם כל ${ltr('12')} האיברים: מצאו נקודה ${ltr('a ≥ 0.25')} ו-${ltr('δ ≥ 0.05')} שמתאים בה לכל האוהלים.`,
};

const EPS_MIN = 0.05;
const EPS_MAX = 1.5;
const LOGD_MIN = -3.5;
const LOGD_MAX = Math.log10(0.8);
const roundEps = (v: number) => Math.min(EPS_MAX, Math.max(EPS_MIN, Math.round(v * 100) / 100));
const sig3 = (v: number) => Number(v.toPrecision(3));
const clampDelta = (v: number) => Math.min(10 ** LOGD_MAX, Math.max(10 ** LOGD_MIN, sig3(v)));

interface State {
  family: FamilyId;
  m: number;
  a: number;
  eps: number;
  delta: number;
}

export interface EquicontinuityProps {
  id: string;
  family?: FamilyId;
  families?: FamilyId[];
  m?: number;
  a?: number;
  eps?: number;
  delta?: number;
  tasks?: string[];
}

const aStep = (fam: FamilyId) => (FAMILIES[fam].domain[1] - FAMILIES[fam].domain[0]) / 1000;
function clampA(fam: FamilyId, a: number) {
  const [lo, hi] = FAMILIES[fam].domain;
  const st = aStep(fam);
  return Math.min(hi, Math.max(lo, Math.round((a - lo) / st) * st + lo));
}

function fresh(p: EquicontinuityProps): State {
  const family: FamilyId = p.family && p.family in FAMILIES ? p.family : 'shift';
  return {
    family,
    m: clampM(FAMILIES[family], typeof p.m === 'number' ? p.m : 8),
    a: clampA(family, typeof p.a === 'number' ? p.a : FAMILIES[family].domain[0]),
    eps: roundEps(typeof p.eps === 'number' ? p.eps : 0.5),
    delta: clampDelta(typeof p.delta === 'number' ? p.delta : 0.1),
  };
}

const Q = (p: { children: string }) => (
  <b class="q">
    <bdi dir="ltr">{p.children}</bdi>
  </b>
);

const num = (v: number) => (Number.isFinite(v) ? fmtNum(sig3(v)) : '∞');

export default function Equicontinuity(props: EquicontinuityProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const topRef = useRef<Plot | null>(null);
  const dragging = useRef(false);
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const has = (t: string) => props.tasks?.includes(t) ?? false;

  const fam = FAMILIES[s.family];
  const prof = useMemo(() => profile(fam, s.m, s.eps), [s.family, s.m, s.eps]);
  const star = deltaStar(fam, s.m, s.a, s.eps);
  const out = escapees(fam, s.m, s.a, s.eps, s.delta);
  const ms = members(fam, s.m);

  /** The student's own change. A text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    if (patch.family && patch.family !== s.family) {
      const F = FAMILIES[patch.family];
      next.m = clampM(F, next.m);
      next.a = clampA(patch.family, next.a);
    }
    setS(next);
    const id = props.id;
    const F = FAMILIES[next.family];
    const ds = deltaStar(F, next.m, next.a, next.eps).delta;
    const works = next.delta <= ds;
    if (has('shift-one') && next.family === 'shift' && next.m >= 8 && next.delta >= next.eps - 1e-9 && next.delta <= profile(F, next.m, next.eps).min)
      markTask(`${id}:shift-one`);
    if (has('power-fails') && next.family === 'power' && next.eps >= 0.4 - 1e-9 && ds < 0.03) markTask(`${id}:power-fails`);
    if (has('power-inside') && next.family === 'power' && next.m >= 30 && next.a <= 0.7 + 1e-9 && next.delta >= 0.1 - 1e-9 && works)
      markTask(`${id}:power-inside`);
    if (has('freq-zero') && next.family === 'freq' && next.eps >= 0.4 - 1e-9 && next.a <= 0.05 + 1e-9 && ds < 0.02) markTask(`${id}:freq-zero`);
    if (has('tent-away') && next.family === 'tent' && next.m >= 12 && next.a >= 0.25 - 1e-9 && next.delta >= 0.05 - 1e-9 && works)
      markTask(`${id}:tent-away`);
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.family === 'string' && st.family in FAMILIES) next.family = st.family as FamilyId;
          const F = FAMILIES[next.family];
          next.m = clampM(F, typeof st.m === 'number' ? st.m : next.m);
          next.a = clampA(next.family, typeof st.a === 'number' ? st.a : next.a);
          if (typeof st.eps === 'number') next.eps = roundEps(st.eps);
          if (typeof st.delta === 'number') next.delta = clampDelta(st.delta);
          return next;
        });
      }),
    [props.id],
  );

  const describe = () => describeFamily(fam, s.m, s.a, s.eps, s.delta);
  useEffect(() => {
    const t = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(t);
  }, [s]);

  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const [lo, hi] = fam.domain;
    const splitY = view.h * 0.62;
    const sine = s.family === 'shift' || s.family === 'freq' || s.family === 'lip';
    // fewer y-ticks on a phone: five labels in a short panel crowd each other
    const yr = sine
      ? { min: -1.25, max: 1.25, ticks: narrow ? [-1, 0, 1] : undefined }
      : { min: -0.2, max: 1.2, ticks: narrow ? [0, 0.5, 1] : undefined };
    const xFmt = (v: number) => (sine ? (Math.abs(v - Math.PI) < 1e-9 ? 'π' : Math.abs(v - Math.PI / 2) < 1e-9 ? 'π/2' : fmtNum(v)) : fmtNum(v));
    const xTicks = sine ? [0, Math.PI / 2, Math.PI] : [0, 0.25, 0.5, 0.75, 1];
    // the round tool buttons (reset, still, full screen) sit over the top-right corner of the canvas: 3 × 34 px,
    // two 6 px gaps, 8 px from the edge, 8 px to 42 px from the top. On a phone the legend goes in a strip above
    // the plot, left of the buttons, so it covers neither the curves nor the buttons.
    const toolsW = 3 * 34 + 2 * 6 + 8 + 8;
    const legendTop = narrow ? 46 : 12;

    // ---------------- upper panel: the members, the window, the bands
    const box = insetBox({ x: 0, y: 0, w: view.w, h: splitY }, { l: narrow ? 34 : 42, r: 12, t: legendTop, b: 26 });
    const plot = makePlot(box, { min: lo, max: hi, ticks: xTicks, format: xFmt }, yr);
    topRef.current = plot;
    drawAxes(ctx, plot, p);
    const X = plot.px;
    const Y = plot.py;
    const wl = Math.max(lo, s.a - s.delta);
    const wr = Math.min(hi, s.a + s.delta);

    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();

    // the δ-window
    ctx.fillStyle = p.deltaBand;
    ctx.fillRect(X(wl), box.y, Math.max(1, X(wr) - X(wl)), box.h);
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = p.delta;
    ctx.lineWidth = 1.2;
    for (const xv of [wl, wr]) {
      ctx.beginPath();
      ctx.moveTo(X(xv), box.y);
      ctx.lineTo(X(xv), box.y + box.h);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // the ε-band of every member over the window; the worst member's band filled
    const worst = star.worst;
    ms.forEach((mb, i) => {
      const v = mb.f(s.a);
      if (i === worst) {
        ctx.fillStyle = p.epsBand;
        ctx.fillRect(X(wl), Y(v + s.eps), X(wr) - X(wl), Y(v - s.eps) - Y(v + s.eps));
      }
      ctx.strokeStyle = withAlpha(p.eps, i === worst ? 1 : 0.45);
      ctx.lineWidth = i === worst ? 1.6 : 0.9;
      for (const lv of [v - s.eps, v + s.eps]) {
        ctx.beginPath();
        ctx.moveTo(X(wl), Y(lv));
        ctx.lineTo(X(wr), Y(lv));
        ctx.stroke();
      }
    });

    // the graphs: members that stay in ink, members that leave in the "out" colour (drawn last, on top)
    const outSet = new Set(out);
    const N = narrow ? 500 : 900;
    const graph = (i: number) => {
      const mb = ms[i];
      const xs: number[] = [];
      for (let k = 0; k <= N; k++) xs.push(lo + ((hi - lo) * k) / N);
      if (mb.kinks) xs.push(...mb.kinks.filter((x) => x > lo && x < hi));
      xs.sort((u, w) => u - w);
      ctx.beginPath();
      xs.forEach((x, k) => (k ? ctx.lineTo(X(x), Y(mb.f(x))) : ctx.moveTo(X(x), Y(mb.f(x)))));
      ctx.stroke();
    };
    ctx.lineJoin = 'round';
    ms.forEach((_, i) => {
      if (outSet.has(i)) return;
      ctx.strokeStyle = withAlpha(p.curve, ms.length > 12 ? 0.55 : 0.85);
      ctx.lineWidth = 1.3;
      graph(i);
    });
    for (const i of out) {
      ctx.strokeStyle = p.pointOut;
      ctx.lineWidth = i === worst ? 2.4 : 1.6;
      graph(i);
    }

    // the points (a, f(a)): filled for members that stay; a hollow ring where a leaving member first meets its band edge
    ms.forEach((mb, i) => {
      const v = mb.f(s.a);
      ctx.beginPath();
      ctx.arc(X(s.a), Y(v), 3.2, 0, 2 * Math.PI);
      ctx.fillStyle = outSet.has(i) ? p.pointOut : p.pointIn;
      ctx.fill();
      if (outSet.has(i)) {
        const xe = escapePoint(mb, s.a, s.eps, lo, hi);
        if (xe !== null) {
          ctx.beginPath();
          ctx.arc(X(xe), Y(mb.f(xe)), 5.5, 0, 2 * Math.PI);
          ctx.fillStyle = p.paper;
          ctx.fill();
          ctx.strokeStyle = p.pointOut;
          ctx.lineWidth = 2.2;
          ctx.stroke();
        }
      }
    });
    ctx.restore();

    // legend, LTR
    ctx.save();
    ctx.font = `600 ${narrow ? 11 : 13}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const legend1 = `${fam.formula},  ${fam.param === 'c' ? `c = 2πj/${ms.length}, j = 1…${ms.length}` : `n = 1…${ms.length}`}`;
    const legend2 = `|x − a| < δ = ${fmtNum(s.delta)}`;
    if (narrow) {
      // the strip above the plot, left of the tool buttons
      const lx = 8;
      const room = Math.max(60, view.w - toolsW - lx);
      ctx.fillStyle = p.curve;
      ctx.fillText(legend1, lx, 14, room);
      ctx.fillStyle = p.delta;
      ctx.fillText(legend2, lx, 31, room);
    } else {
      ctx.fillStyle = p.curve;
      ctx.fillText(legend1, box.x + 8, box.y + 12);
      ctx.fillStyle = p.delta;
      ctx.fillText(legend2, box.x + 8, box.y + 30);
    }
    ctx.restore();

    // ---------------- lower panel: a ↦ δ*(a) and the student's δ
    // on a phone the panel's title sits above its plot (not over the curve) and the y-axis gets three labels
    const box2 = insetBox({ x: 0, y: splitY, w: view.w, h: view.h - splitY }, { l: narrow ? 34 : 42, r: 12, t: narrow ? 22 : 10, b: 24 });
    const finite = prof.d.filter((v) => Number.isFinite(v));
    const top = Math.max(s.delta * 1.25, Math.min(...[finite.length ? Math.max(...finite) * 1.1 : 1, (hi - lo) / 2]), 0.02);
    const plot2 = makePlot(
      box2,
      { min: lo, max: hi, ticks: xTicks, format: xFmt },
      { min: 0, max: top, ticks: narrow ? niceTicks(0, top, 2) : undefined },
    );
    drawAxes(ctx, plot2, p);
    const X2 = plot2.px;
    const Y2 = (v: number) => plot2.py(Math.min(top, v));
    ctx.save();
    ctx.beginPath();
    ctx.rect(box2.x, box2.y - 2, box2.w, box2.h + 4);
    ctx.clip();
    // where the line is above the curve, shade
    ctx.fillStyle = withAlpha(p.pointOut, 0.18);
    prof.a.forEach((av, k) => {
      if (k === 0) return;
      const dk = Math.min(prof.d[k], prof.d[k - 1]);
      if (s.delta > dk) ctx.fillRect(X2(prof.a[k - 1]), Y2(s.delta), X2(av) - X2(prof.a[k - 1]) + 0.5, Y2(Math.min(dk, top)) - Y2(s.delta));
    });
    ctx.strokeStyle = p.curve;
    ctx.lineWidth = 2;
    ctx.beginPath();
    prof.a.forEach((av, k) => (k ? ctx.lineTo(X2(av), Y2(prof.d[k])) : ctx.moveTo(X2(av), Y2(prof.d[k]))));
    ctx.stroke();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = p.delta;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(box2.x, Y2(s.delta));
    ctx.lineTo(box2.x + box2.w, Y2(s.delta));
    ctx.stroke();
    ctx.setLineDash([]);
    // the current a: filled when δ works there, hollow when not
    const ok = s.delta <= star.delta;
    ctx.beginPath();
    ctx.arc(X2(s.a), Y2(star.delta), 5, 0, 2 * Math.PI);
    ctx.fillStyle = ok ? p.pointIn : p.paper;
    ctx.fill();
    ctx.strokeStyle = ok ? p.pointIn : p.pointOut;
    ctx.lineWidth = ok ? 1 : 2.2;
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.font = `600 ${narrow ? 11 : 12}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = p.curve;
    if (narrow) ctx.fillText('δ*(a)', box2.x, box2.y - 11);
    else ctx.fillText('δ*(a)', box2.x + 8, box2.y + 10);
    ctx.restore();
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1.15, worldHeight: 1, animate: false });
  useEffect(invalidate, [s, prof]);

  const aFromPointer = (e: PointerEvent) => {
    const plot = topRef.current;
    if (!plot) return null;
    if (e.offsetY > plot.box.y + plot.box.h + 20) return null;
    const x = plot.x.min + ((e.offsetX - plot.box.x) / plot.box.w) * (plot.x.max - plot.x.min);
    return clampA(s.family, x);
  };
  const onPointerDown = (e: PointerEvent) => {
    const a = aFromPointer(e);
    if (a === null) return;
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (Math.abs(a - s.a) > 1e-12) userSet({ a });
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging.current) return;
    const a = aFromPointer(e);
    if (a !== null && Math.abs(a - s.a) > 1e-12) userSet({ a });
  };
  const onPointerUp = () => {
    dragging.current = false;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      userSet({ a: clampA(s.family, s.a + (e.key === 'ArrowRight' ? 1 : -1) * aStep(s.family) * (e.shiftKey ? 20 : 2)) });
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const lg = Math.min(LOGD_MAX, Math.max(LOGD_MIN, Math.log10(s.delta) + (e.key === 'ArrowUp' ? 0.05 : -0.05)));
      userSet({ delta: clampDelta(10 ** lg) });
    }
  };

  const offered = (props.families ?? []).filter((id) => id in FAMILIES);
  const [lo, hi] = fam.domain;
  const worstLabel = star.worst >= 0 ? ms[star.worst].label : '';

  const readout = (
    <>
      <span data-readout="family">
        <Q>{fam.formula}</Q>, <Q>{`${ms.length}`}</Q> איברים באיור
      </span>
      <span data-readout="delta-star">
        בנקודה <Q>{`a = ${fmtNum(sig3(s.a))}`}</Q>:{' '}
        {Number.isFinite(star.delta) ? (
          <>
            ה-δ הגדול ביותר שמתאים לכל האיברים שבאיור הוא <Q>{`δ*(a) ≈ ${num(star.delta)}`}</Q> (הקובע: <Q>{worstLabel}</Q>)
          </>
        ) : (
          <>כל δ מתאים לכל האיברים שבאיור</>
        )}
      </span>
      <span data-readout="ok">
        {out.length === 0 ? (
          <>
            <Q>{`δ = ${fmtNum(s.delta)}`}</Q> מתאים בנקודה הזו לכל האיברים שבאיור.
          </>
        ) : (
          <>
            <Q>{`δ = ${fmtNum(s.delta)}`}</Q> אינו מתאים: <Q>{String(out.length)}</Q> איברים יוצאים מרצועת ה-ε שלהם.
          </>
        )}
      </span>
      <span data-readout="uniform">
        על כל התחום (ברשת של נקודות): <Q>{`min δ*(a) ≈ ${num(prof.min)}`}</Q>
      </span>
    </>
  );

  const controls = (
    <>
      {offered.length > 1 && (
        <div class="group" role="group" aria-label="המשפחה">
          {offered.map((id) => (
            <Toggle key={id} label={<bdi dir="ltr">{FAMILIES[id].formula}</bdi>} on={s.family === id} onChange={() => userSet({ family: id })} />
          ))}
        </div>
      )}
      <Slider label="מספר האיברים" value={s.m} min={1} max={fam.maxM} step={1} format={(v) => String(Math.round(v))} onChange={(v) => userSet({ m: clampM(fam, v) })} />
      <Slider label="a" value={s.a} min={lo} max={hi} step={aStep(s.family)} format={(v) => fmtNum(sig3(v))} onChange={(v) => userSet({ a: clampA(s.family, v) })} />
      <Slider label="ε" value={s.eps} min={EPS_MIN} max={EPS_MAX} step={0.01} format={(v) => fmtNum(roundEps(v))} onChange={(v) => userSet({ eps: roundEps(v) })} />
      <Slider
        label="δ"
        value={Math.log10(s.delta)}
        min={LOGD_MIN}
        max={LOGD_MAX}
        step={0.005}
        format={(v) => fmtNum(clampDelta(10 ** v))}
        onChange={(v) => userSet({ delta: clampDelta(10 ** v) })}
      />
    </>
  );

  return (
    <SimShell
      fig={props.id}
      label={`איור חי: איברים של משפחת פונקציות, חלון δ סביב נקודה a ורצועת ε סביב הערך של כל איבר ב-a; למטה, ה-δ הגדול ביותר שמתאים בכל נקודה. במקלדת: חצים ימינה ושמאלה מזיזים את a, למעלה ולמטה משנים את δ. ${describe()}`}
      canvasRef={canvasRef}
      aspect={1.15}
      live={live}
      tasks={tasks}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      cursor="ew-resize"
      onReset={() => {
        setS(fresh(props));
        setLive('האיור אופס.');
      }}
      readout={readout}
      controls={controls}
    />
  );
}

