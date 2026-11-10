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
import { EPS, SEQS, firstInTube, inTube, type SeqId } from '~/math/funcseq';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { sci } from './core/format';
import { drawAxes, drawCurve, insetBox, makePlot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

const TASK_LABEL: Record<string, string> = {
  'find-n': 'בסדרה x/n, עם ⁦ε = 0.1⁩ או קטן יותר, הזיזו את n אל ה-n הראשון שממנו fₙ בתוך הצינור.',
  never: 'בסדרה xⁿ על ⁦[0, 1]⁩, עם ⁦ε ≤ 0.5⁩, הגדילו את n עד 40 לפחות: fₙ לא נכנסת לצינור סביב הגבול הנקודתי.',
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
}

export interface FunctionBallProps {
  id: string;
  seq?: SeqId;
  seqs?: SeqId[];
  n?: number;
  eps?: number;
  showFirst?: boolean;
  tasks?: string[];
}

const nearestEps = (e: number) => EPS.reduce((best, v, i) => (Math.abs(Math.log(v / e)) < Math.abs(Math.log(EPS[best] / e)) ? i : best), 0);

function fresh(p: FunctionBallProps): State {
  return { seq: p.seq ?? 'x-over-n', n: p.n ?? 1, ei: nearestEps(p.eps ?? 0.1), showFirst: p.showFirst ?? false };
}

export default function FunctionBall(props: FunctionBallProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const seq = SEQS[s.seq];
  const eps = EPS[s.ei];
  const sup = seq.sup(s.n);
  const inside = inTube(seq, s.n, eps);
  const first = firstInTube(seq, eps, N_MAX);
  const at = seq.argSup(s.n);

  /** The student's own change: a text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    setS(next);
    const has = (t: string) => props.tasks?.includes(t);
    const moved = patch.n !== undefined || patch.ei !== undefined;
    const e = EPS[next.ei];
    const sq = SEQS[next.seq];
    if (has('find-n') && moved && next.seq === 'x-over-n' && e <= 0.1 && next.n === firstInTube(sq, e, N_MAX)) markTask(`${props.id}:find-n`);
    if (has('never') && moved && next.seq === 'xn' && e <= 0.5 && next.n >= 40) markTask(`${props.id}:never`);
    if (has('bump') && moved && next.seq === 'bump' && e <= 0.3 && next.n >= 30) markTask(`${props.id}:bump`);
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.seq === 'string' && st.seq in SEQS) next.seq = st.seq as SeqId;
          if (typeof st.n === 'number') next.n = Math.max(1, Math.min(N_MAX, Math.round(st.n)));
          if (typeof st.eps === 'number') next.ei = nearestEps(st.eps);
          if (typeof st.showFirst === 'boolean') next.showFirst = st.showFirst;
          return next;
        });
      }),
    [props.id],
  );

  const supText = at === null ? `sup = ${fmt(sup)} (לא מתקבל)` : `sup = ${fmt(sup)}`;
  const describe = () => {
    const parts = [`${seq.formula}, n = ${s.n}. המרחק במטריקת הסופרמום מהגבול: ${supText}${at === null ? '' : `, ב-x = ${fmt(at)}`}.`];
    parts.push(inside ? `fₙ בתוך הצינור ברדיוס ε = ${fmt(eps)}.` : `fₙ אינה בתוך הצינור ברדיוס ε = ${fmt(eps)}.`);
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
    const plot = makePlot(box, { min: seq.a, max: seq.b, label: 'x' }, { min: seq.y[0], max: seq.y[1], label: 'y' });
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
    ctx.restore();
    const lowEdge = (x: number) => lim(x === xEnd ? x - 1e-12 : x) - eps;
    const highEdge = (x: number) => lim(x === xEnd ? x - 1e-12 : x) + eps;
    // the limit's continuous piece: up to the jump, if there is one
    const plotLeft = makePlot({ ...box, w: plot.px(Math.min(seq.b, xEnd)) - box.x }, { ...plot.x, max: Math.min(seq.b, xEnd) }, plot.y);
    drawCurve(ctx, plotLeft, highEdge, { color: p.eps, width: 1.2, dash: [5, 4] });
    drawCurve(ctx, plotLeft, lowEdge, { color: p.eps, width: 1.2, dash: [5, 4] });

    drawAxes(ctx, plot, p);

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

    // fₙ, in ink
    drawCurve(ctx, plot, (x) => seq.f(s.n, x), { color: p.curve, width: 2.2, samples: 400 });

    // the sup distance: a segment from f to fₙ where it is attained (dashed at x = 1⁻ when it is not)
    const xs0 = at ?? seq.jump ?? seq.b;
    const yF = at === null ? lim(xs0 - 1e-9) : lim(xs0);
    const yG = at === null ? yF + sup : seq.f(s.n, xs0);
    const sx = plot.px(xs0) - (at === null ? 6 : 0);
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
      userSet({ ei: Math.max(0, Math.min(EPS.length - 1, s.ei + (e.key === 'ArrowDown' ? 1 : -1))) });
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
            max={EPS.length - 1}
            step={1}
            format={(v) => fmt(EPS[Math.round(v)])}
            onChange={(v) => userSet({ ei: Math.round(v) })}
          />
          <div class="group">
            <Toggle label="מאיזה n והלאה בצינור?" on={s.showFirst} onChange={(on) => userSet({ showFirst: on })} />
          </div>
        </>
      }
    />
  );
}
