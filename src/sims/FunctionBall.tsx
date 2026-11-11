/**
 * Lesson 1.5's figure: convergence in the sup metric, drawn as a tube. The pointwise limit f of a sequence of
 * functions is drawn in green, the ball B(f, ε) of the sup metric as the open tube {|y − f(x)| < ε} around its graph,
 * and the graph of fₙ in ink. fₙ is in the ball exactly when sup |fₙ − f| < ε. The figure marks where that sup is
 * attained with a vertical segment from f to fₙ, ending in a filled point when fₙ is in the tube and a hollow ringed
 * point when it is not (shape, not only colour). For xⁿ on [0, 1] the sup 1 is not attained: the segment is drawn
 * dashed at x = 1, as the value approached from the left.
 *
 * Every number comes from src/math/funcseq.ts, exact formulas per preset. The figure shows n ≤ 60 only, so "from this
 * n on" is checked on a window (for these presets the sup decreases in n, which the lesson proves where it matters).
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { EPS, EPS_FINE, FINE_SEQS, SEQS, firstInTube, inTube, type SeqId } from '~/math/funcseq';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { sci } from './core/format';
import { drawAxes, drawCurve, insetBox, makePlot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

const TASK_LABEL: Record<string, string> = {
  'find-n': 'בסדרה x/n, עם ⁦ε = 0.1⁩ או קטן יותר, הזיזו את n אל ה-n הראשון שממנו fₙ בתוך הצינור.',
  never: 'בסדרה xⁿ על ⁦[0, 1]⁩, עם ⁦ε ≤ 0.5⁩, הגדילו את n עד 40 לפחות: fₙ לא נכנסת לצינור סביב הגבול הנקודתי.',
  'ramp-area': 'בסדרת הרמפות, הפעילו את הצגת השטח והגדילו את n עד 20 לפחות. מה קורה לשטח בין fₙ לגבול, ומה למרחק בסופרמום?',
  'm-test': 'בטור הקוסינוסים, עם ⁦ε ≤ 0.01⁩, הזיזו את n אל ה-n הראשון שממנו הסכום החלקי בתוך הצינור.',
  'smooth-corner': 'בערך המוחלט המוחלק, עם ⁦ε ≤ 0.05⁩, הזיזו את n אל ה-n הראשון שממנו fₙ בתוך הצינור.',
  bump: 'בגבעה הנודדת, עם ⁦ε ≤ 0.3⁩, הגדילו את n עד 30 לפחות: הגבעה מתכווצת לצד, אבל לא יורדת לתוך הצינור.',
};

const N_MAX = 60;
const fmt = (v: number) => sci(Math.round(v * 1e9) / 1e9, 3).replace(/^-/, '−');

interface State {
  seq: SeqId;
  n: number;
  /** index into EPS */
  ei: number;
  showFirst: boolean;
  showArea: boolean;
}

export interface FunctionBallProps {
  id: string;
  seq?: SeqId;
  seqs?: SeqId[];
  n?: number;
  eps?: number;
  showFirst?: boolean;
  showArea?: boolean;
  tasks?: string[];
}

/** the radii a preset offers: EPS for lesson 1.5's presets, EPS_FINE (EPS is its prefix) for the later ones */
const epsList = (id: SeqId): readonly number[] => (FINE_SEQS.includes(id) ? EPS_FINE : EPS);
const nearestEps = (e: number, list: readonly number[] = EPS) =>
  list.reduce((best, v, i) => (Math.abs(Math.log(v / e)) < Math.abs(Math.log(list[best] / e)) ? i : best), 0);

function fresh(p: FunctionBallProps): State {
  const seq = p.seq ?? 'x-over-n';
  return { seq, n: p.n ?? 1, ei: nearestEps(p.eps ?? 0.1, epsList(seq)), showFirst: p.showFirst ?? false, showArea: p.showArea ?? false };
}

export default function FunctionBall(props: FunctionBallProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const seq = SEQS[s.seq];
  const epsOf = epsList(s.seq);
  const eps = epsOf[Math.min(s.ei, epsOf.length - 1)];
  const area = s.showArea && seq.l1 ? seq.l1(s.n) : null;
  const sup = seq.sup(s.n);
  const inside = inTube(seq, s.n, eps);
  const first = firstInTube(seq, eps, N_MAX);
  const at = seq.argSup(s.n);

  /** The student's own change: a text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    next.ei = Math.min(next.ei, epsList(next.seq).length - 1);
    setS(next);
    const has = (t: string) => props.tasks?.includes(t);
    const moved = patch.n !== undefined || patch.ei !== undefined;
    const e = epsList(next.seq)[next.ei];
    const sq = SEQS[next.seq];
    if (has('find-n') && moved && next.seq === 'x-over-n' && e <= 0.1 && next.n === firstInTube(sq, e, N_MAX)) markTask(`${props.id}:find-n`);
    if (has('never') && moved && next.seq === 'xn' && e <= 0.5 && next.n >= 40) markTask(`${props.id}:never`);
    if (has('bump') && moved && next.seq === 'bump' && e <= 0.3 && next.n >= 30) markTask(`${props.id}:bump`);
    const own = moved || patch.showArea !== undefined;
    if (has('ramp-area') && own && next.seq === 'ramp' && next.showArea && next.n >= 20) markTask(`${props.id}:ramp-area`);
    if (has('m-test') && moved && next.seq === 'cos-series' && e <= 0.01 && next.n === firstInTube(sq, e, N_MAX)) markTask(`${props.id}:m-test`);
    if (has('smooth-corner') && moved && next.seq === 'smooth-abs' && e <= 0.05 && next.n === firstInTube(sq, e, N_MAX)) markTask(`${props.id}:smooth-corner`);
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.seq === 'string' && st.seq in SEQS) next.seq = st.seq as SeqId;
          if (typeof st.n === 'number') next.n = Math.max(1, Math.min(N_MAX, Math.round(st.n)));
          if (typeof st.eps === 'number') next.ei = nearestEps(st.eps, epsList(next.seq));
          if (typeof st.showFirst === 'boolean') next.showFirst = st.showFirst;
          if (typeof st.showArea === 'boolean') next.showArea = st.showArea;
          next.ei = Math.min(next.ei, epsList(next.seq).length - 1);
          return next;
        });
      }),
    [props.id],
  );

  const supText = at === null ? `sup = ${fmt(sup)} (לא מתקבל)` : `sup = ${fmt(sup)}`;
  const describe = () => {
    const parts = [`${seq.formula}, n = ${s.n}. המרחק במטריקת הסופרמום מהגבול: ${supText}${at === null ? '' : `, ב-x = ${fmt(at)}`}.`];
    parts.push(inside ? `fₙ בתוך הצינור ברדיוס ε = ${fmt(eps)}.` : `fₙ אינה בתוך הצינור ברדיוס ε = ${fmt(eps)}.`);
    if (area !== null) parts.push(`∫|fₙ − f| = ${fmt(area)}.`);
    if (s.showFirst) parts.push(first === null ? `עד n = ${N_MAX} אין n שממנו fₙ בצינור.` : `fₙ בצינור מ-n = ${first} והלאה.`);
    return parts.join(' ');
  };

  useEffect(() => {
    const t = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(t);
  }, [s]);

  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    // the top margin keeps the plot (and a sup marker at its top corner) clear of the reset and fullscreen buttons
    const box = insetBox({ x: 0, y: 0, w: view.w, h: view.h }, { l: narrow ? 40 : 50, r: 16, t: 44, b: 40 });
    // the symmetric interval [−π, π] (cos-series): ticks at multiples of π/2, since 1, 2, 3 are not landmarks there
    const piAxis = seq.b === Math.PI && seq.a === -Math.PI;
    const xAxis = piAxis
      ? { min: seq.a, max: seq.b, label: 'x', ticks: [-Math.PI, -Math.PI / 2, 0, Math.PI / 2, Math.PI], format: (v: number) => ['−π', '−π/2', '0', 'π/2', 'π'][Math.round(v / (Math.PI / 2)) + 2] }
      : { min: seq.a, max: seq.b, label: 'x' };
    const plot = makePlot(box, xAxis, { min: seq.y[0], max: seq.y[1], label: 'y' });
    const lim = seq.limit;
    const xEnd = seq.jump ?? Infinity;

    // the tube B(f, ε): the band between f − ε and f + ε, dashed edges (it is open)
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    const N = 240;
    const xs = Array.from({ length: N + 1 }, (_, i) => seq.a + ((Math.min(seq.b, xEnd) - seq.a) * i) / N);
    ctx.beginPath();
    xs.forEach((x, i) => (i ? ctx.lineTo(plot.px(x), plot.py(lim(x - (x === xEnd ? 1e-12 : 0)) + eps)) : ctx.moveTo(plot.px(x), plot.py(lim(x) + eps))));
    for (let i = N; i >= 0; i--) ctx.lineTo(plot.px(xs[i]), plot.py(lim(xs[i] - (xs[i] === xEnd ? 1e-12 : 0)) - eps));
    ctx.closePath();
    ctx.fillStyle = p.epsBand;
    ctx.fill();
    if (seq.jump !== undefined) {
      // at the jump the tube is the interval (f(x₀) − ε, f(x₀) + ε) above that one point
      const xj = plot.px(seq.jump);
      ctx.fillRect(xj - 3, plot.py(lim(seq.jump) + eps), 6, plot.py(lim(seq.jump) - eps) - plot.py(lim(seq.jump) + eps));
    }
    const rightPiece = seq.jump !== undefined && seq.jump < seq.b;
    if (rightPiece) {
      // the limit goes on after the jump: its own band on (jump, b]
      const x0 = seq.jump as number;
      const xr = Array.from({ length: N + 1 }, (_, i) => x0 + ((seq.b - x0) * i) / N);
      const limR = (x: number) => lim(x === x0 ? x + 1e-12 : x);
      ctx.beginPath();
      xr.forEach((x, i) => (i ? ctx.lineTo(plot.px(x), plot.py(limR(x) + eps)) : ctx.moveTo(plot.px(x), plot.py(limR(x) + eps))));
      for (let i = N; i >= 0; i--) ctx.lineTo(plot.px(xr[i]), plot.py(limR(xr[i]) - eps));
      ctx.closePath();
      ctx.fillStyle = p.epsBand;
      ctx.fill();
    }
    ctx.restore();
    const lowEdge = (x: number) => lim(x === xEnd ? x - 1e-12 : x) - eps;
    const highEdge = (x: number) => lim(x === xEnd ? x - 1e-12 : x) + eps;
    // the limit's continuous piece: up to the jump, if there is one
    const plotLeft = makePlot({ ...box, w: plot.px(Math.min(seq.b, xEnd)) - box.x }, { ...plot.x, max: Math.min(seq.b, xEnd) }, plot.y);
    drawCurve(ctx, plotLeft, highEdge, { color: p.eps, width: 1.2, dash: [5, 4] });
    drawCurve(ctx, plotLeft, lowEdge, { color: p.eps, width: 1.2, dash: [5, 4] });

    const plotRight = rightPiece ? makePlot({ ...box, x: plot.px(seq.jump as number), w: box.x + box.w - plot.px(seq.jump as number) }, { ...plot.x, min: seq.jump as number }, plot.y) : null;
    if (plotRight) {
      const x0 = seq.jump as number;
      drawCurve(ctx, plotRight, (x) => lim(x === x0 ? x + 1e-12 : x) + eps, { color: p.eps, width: 1.2, dash: [5, 4] });
      drawCurve(ctx, plotRight, (x) => lim(x === x0 ? x + 1e-12 : x) - eps, { color: p.eps, width: 1.2, dash: [5, 4] });
    }

    drawAxes(ctx, plot, p);

    // the area between fₙ and the limit, piece by piece (the limit is not continuous across a jump)
    if (area !== null) {
      const pieces: [number, number, number][] =
        seq.jump === undefined ? [[seq.a, seq.b, 0]] : [[seq.a, Math.min(seq.b, seq.jump), -1e-12], ...(rightPiece ? ([[seq.jump, seq.b, 1e-12]] as [number, number, number][]) : [])];
      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, box.h);
      ctx.clip();
      ctx.fillStyle = p.eps;
      ctx.globalAlpha = 0.4;
      for (const [lo, hi, side] of pieces) {
        const xa = Array.from({ length: 401 }, (_, i) => lo + ((hi - lo) * i) / 400);
        const limAt = (x: number) => lim(side !== 0 && (x === lo || x === hi) ? x + side : x);
        ctx.beginPath();
        xa.forEach((x, i) => (i ? ctx.lineTo(plot.px(x), plot.py(seq.f(s.n, x))) : ctx.moveTo(plot.px(x), plot.py(seq.f(s.n, x)))));
        for (let i = 400; i >= 0; i--) ctx.lineTo(plot.px(xa[i]), plot.py(limAt(xa[i])));
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // the limit f, in green; at a jump, a filled point for the value and a hollow one where the line ends
    drawCurve(ctx, plotLeft, (x) => lim(x === xEnd ? x - 1e-12 : x), { color: p.limit, width: 2.4 });
    if (seq.jump !== undefined) {
      const xj = plot.px(seq.jump);
      ctx.save();
      ctx.fillStyle = p.paper;
      ctx.strokeStyle = p.limit;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(xj, plot.py(lim(seq.jump - 1e-9)), 4.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = p.limit;
      ctx.beginPath();
      ctx.arc(xj, plot.py(lim(seq.jump)), 4.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    }

    if (plotRight) {
      const x0 = seq.jump as number;
      drawCurve(ctx, plotRight, (x) => lim(x === x0 ? x + 1e-12 : x), { color: p.limit, width: 2.4 });
      // where the right piece starts the limit's value is not the piece's: a hollow point (open end)
      ctx.save();
      ctx.fillStyle = p.paper;
      ctx.strokeStyle = p.limit;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(plot.px(x0), plot.py(lim(x0 + 1e-9)), 4.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // fₙ, in ink
    drawCurve(ctx, plot, (x) => seq.f(s.n, x), { color: p.curve, width: 2.2, samples: 400 });

    // the sup distance: a segment from f to fₙ where it is attained (dashed at x = 1⁻ when it is not)
    const fromRight = at === null && rightPiece;
    const xs0 = at ?? seq.jump ?? seq.b;
    const yF = at === null ? lim(xs0 + (fromRight ? 1e-9 : -1e-9)) : lim(xs0);
    const yG = at === null ? (fromRight ? yF - sup : yF + sup) : seq.f(s.n, xs0);
    const sx = plot.px(xs0) + (at === null ? (fromRight ? 6 : -6) : 0);
    ctx.save();
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 1.6;
    ctx.setLineDash(at === null ? [4, 3] : []);
    ctx.beginPath();
    ctx.moveTo(sx, plot.py(yF));
    ctx.lineTo(sx, plot.py(yG));
    ctx.stroke();
    ctx.setLineDash([]);
    if (inside) {
      ctx.fillStyle = p.pointIn;
      ctx.beginPath();
      ctx.arc(sx, plot.py(yG), 5.5, 0, 2 * Math.PI);
      ctx.fill();
    } else {
      ctx.fillStyle = p.paper;
      ctx.strokeStyle = p.pointOut;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(sx, plot.py(yG), 5.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(sx, plot.py(yG), 10, 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.font = `600 ${narrow ? 12 : 13}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textBaseline = 'middle';
    const label = 'sup';
    const right = sx + 14 + 30 < box.x + box.w;
    ctx.textAlign = right ? 'left' : 'right';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = p.paper;
    ctx.lineWidth = 4;
    const ly = plot.py((yF + yG) / 2);
    ctx.strokeText(label, right ? sx + 8 : sx - 8, ly);
    ctx.fillStyle = p.ink;
    ctx.fillText(label, right ? sx + 8 : sx - 8, ly);
    ctx.restore();
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1.5, worldHeight: 1, animate: false });
  useEffect(invalidate, [s]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      userSet({ n: Math.max(1, Math.min(N_MAX, s.n + (e.key === 'ArrowRight' ? 1 : -1))) });
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      userSet({ ei: Math.max(0, Math.min(epsOf.length - 1, s.ei + (e.key === 'ArrowDown' ? 1 : -1))) });
    }
  };

  const offered = props.seqs ?? [];
  return (
    <SimShell
      fig={props.id}
      label={`איור חי: הגבול הנקודתי f בירוק, צינור ברוחב ε סביבו, והגרף של fₙ. קטע אנכי מסמן את המרחק הגדול ביותר בין fₙ ל-f. במקלדת: חץ ימינה ושמאלה משנה את n, חץ למטה מצמצם את הצינור. ${describe()}`}
      canvasRef={canvasRef}
      aspect={1.5}
      live={live}
      tasks={tasks}
      onKeyDown={onKeyDown}
      onReset={() => {
        setS(fresh(props));
        setLive('האיור אופס.');
      }}
      readout={
        <>
          <span>
            <b class="q" data-readout="n">
              n = {s.n}
            </b>
          </span>
          <span data-readout="sup">
            המרחק מהגבול: <b class="q">{supText}</b>
          </span>
          <span data-readout="verdict">
            {inside ? (
              <>
                fₙ בתוך הצינור ברדיוס <b class="q">ε = {fmt(eps)}</b>.
              </>
            ) : (
              <>
                fₙ אינה בתוך הצינור ברדיוס <b class="q">ε = {fmt(eps)}</b>.
              </>
            )}
          </span>
          {area !== null && (
            <span data-readout="area">
              <b class="q">∫|fₙ − f| = {fmt(area)}</b>
            </span>
          )}
          {s.showFirst && (
            <span data-readout="first">
              {first === null ? (
                <>
                  עד <b class="q">n = {N_MAX}</b> אין n שממנו fₙ בצינור.
                </>
              ) : (
                <>
                  fₙ בצינור מ-<b class="q">n = {first}</b> והלאה.
                </>
              )}
            </span>
          )}
        </>
      }
      controls={
        <>
          {offered.length > 1 && (
            <div class="group" role="group" aria-label="הסדרה">
              {offered.map((id) => (
                <Toggle key={id} label={<bdi dir="ltr">{SEQS[id].name}</bdi>} on={s.seq === id} onChange={() => userSet({ seq: id, n: 1 })} />
              ))}
            </div>
          )}
          <Slider label="n" value={s.n} min={1} max={N_MAX} step={1} format={(v) => String(Math.round(v))} onChange={(v) => userSet({ n: Math.round(v) })} />
          <Slider
            label="ε: רוחב הצינור"
            value={s.ei}
            min={0}
            max={epsOf.length - 1}
            step={1}
            format={(v) => fmt(epsOf[Math.round(v)])}
            onChange={(v) => userSet({ ei: Math.round(v) })}
          />
          <div class="group">
            <Toggle label="מאיזה n והלאה בצינור?" on={s.showFirst} onChange={(on) => userSet({ showFirst: on })} />
            {seq.l1 && <Toggle label="השטח בין fₙ לגבול" on={s.showArea} onChange={(on) => userSet({ showArea: on })} />}
          </div>
        </>
      }
    />
  );
}
