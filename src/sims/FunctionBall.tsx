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
 *
 * mode: 'set' (lesson 4.1, SetBall at the end of this file): one ball B(f, r) of C(K) against a set (the positive
 * functions P, or Z_p), probed by the shift g = f − c.
 */

import { Fragment } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  EPS,
  EPS_FINE,
  FINE_SEQS,
  RADII,
  SEQS,
  SET_CASES,
  firstInTube,
  inTube,
  largestBall,
  shiftInBall,
  shiftInSet,
  shiftKeyValue,
  type SeqId,
  type SetId,
} from '~/math/funcseq';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { sci } from './core/format';
import { drawAxes, drawCurve, insetBox, makePlot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

const TASK_LABEL: Record<string, string> = {
  'find-n': 'בסדרה x/n, עם ⁦ε = 0.1⁩ או קטן יותר, הזיזו את n אל ה-n הראשון שממנו fₙ בתוך הצינור.',
  never: 'בסדרה xⁿ על ⁦[0, 1]⁩, עם ⁦ε ≤ 0.5⁩, הגדילו את n עד 40 לפחות. האם fₙ נכנסת לצינור סביב הגבול הנקודתי?',
  'ramp-area': 'בסדרת הרמפות, הפעילו את הצגת השטח והגדילו את n עד 20 לפחות. מה קורה לשטח בין fₙ לגבול, ומה למרחק בסופרמום?',
  'm-test': 'בטור הקוסינוסים, עם ⁦ε ≤ 0.01⁩, הזיזו את n אל ה-n הראשון שממנו הסכום החלקי בתוך הצינור.',
  'smooth-corner': 'בערך המוחלט המוחלק, עם ⁦ε ≤ 0.05⁩, הזיזו את n אל ה-n הראשון שממנו fₙ בתוך הצינור.',
  bump: 'בגבעה הנודדת, עם ⁦ε ≤ 0.3⁩, הגדילו את n עד 30 לפחות. מה קורה לרוחב הגבעה ולגובה שלה? האם fₙ נכנסת לצינור?',
  taylor: 'בטור החזקות של eˣ, עם ⁦ε ≤ 0.01⁩, הזיזו את n אל ה-n הראשון שממנו פולינום טיילור בתוך הצינור סביב eˣ.',
  // set mode (lesson 4.1)
  'largest-ball': 'ב-P, עם הפונקציה החיובית, בחרו את הרדיוס r הגדול ביותר שעבורו כל הכדור B(f, r) נשאר בתוך P.',
  'leave-pos': 'ב-P, הגדילו את r מעבר לרדיוס הזה, והזיזו את c עד שהפונקציה g = f − c בתוך הכדור ומחוץ ל-P.',
  'open-fails': 'ב-P′ על ⁦(0, 1]⁩, עם ⁦r ≤ 0.1⁩, מצאו c שעבורו g = f − c בתוך הכדור ומחוץ ל-P′.',
  'leave-zero': 'ב-Zₚ, עם ⁦r ≤ 0.1⁩, מצאו c שעבורו g = f − c בתוך הכדור ומחוץ ל-Zₚ.',
};

/**
 * A picker name that mixes Hebrew words and math ("P′ על (0, 1]"). One LTR isolate around the whole name reversed the
 * Hebrew word against the math and broke the brackets on a phone; here the name reads RTL and each math run is its own
 * LTR island. Only elements are added: the text content, and so the button's accessible name, is the name itself.
 */
function MixedLabel({ text }: { text: string }) {
  const runs = text.split(/([֐-׿](?:[֐-׿\s]*[֐-׿])?)/);
  return (
    <bdi dir="rtl">
      {runs.map((run, i) => {
        if (i % 2 === 1 || !run.trim()) return run;
        const [, lead, body, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(run) as RegExpExecArray;
        return (
          <Fragment key={i}>
            {lead}
            <bdi dir="ltr">{body}</bdi>
            {trail}
          </Fragment>
        );
      })}
    </bdi>
  );
}

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
  /** 'tube' (default): a sequence and the tube around its limit; 'set': a ball around f against a set of C(K) (lesson 4.1) */
  mode?: 'tube' | 'set';
  /** set mode: the preset, the presets offered, the radius r and the shift c */
  setCase?: SetId;
  setCases?: SetId[];
  r?: number;
  c?: number;
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
  return props.mode === 'set' ? <SetBall {...props} /> : <TubeBall {...props} />;
}

function TubeBall(props: FunctionBallProps) {
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
    if (has('taylor') && moved && next.seq === 'exp-series' && e <= 0.01 && next.n === firstInTube(sq, e, N_MAX)) markTask(`${props.id}:taylor`);
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
                <Toggle key={id} label={<MixedLabel text={SEQS[id].name} />} on={s.seq === id} onChange={() => userSet({ seq: id, n: 1 })} />
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

/* ------------------------------------------------------------------ set mode (lesson 4.1) */

interface SetState {
  sc: SetId;
  /** index into RADII */
  ri: number;
  /** the shift: g = f − c */
  c: number;
}

const C_MAX = 0.5;
const nearestR = (r: number) => RADII.reduce((best, v, i) => (Math.abs(v - r) < Math.abs(RADII[best] - r) ? i : best), 0);
const clampC = (c: number) => Math.max(-C_MAX, Math.min(C_MAX, Math.round(c * 100) / 100));

function freshSet(p: FunctionBallProps): SetState {
  return { sc: p.setCase ?? 'pos', ri: nearestR(p.r ?? 0.1), c: clampC(p.c ?? 0) };
}

/**
 * The set mode: a centre f ∈ C(K) in green, the open ball B(f, r) of the sup norm as the tube around it, and one
 * function of the ball, g = f − c, in ink. The set is P (the positive functions; the shaded half-plane below the axis
 * is outside it) or Z_p (the functions vanishing at p; the dashed vertical line). The key point (the minimum of g for
 * P, the value g(p) for Z_p) is a filled point when g is in the set and a hollow ringed point when it is not. Every
 * number comes from src/math/funcseq.ts (set mode), exact formulas.
 */
function SetBall(props: FunctionBallProps) {
  const [s, setS] = useState<SetState>(() => freshSet(props));
  const [live, setLive] = useState('');
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const sc = SET_CASES[s.sc];
  const r = RADII[s.ri];
  const inBall = shiftInBall(s.c, r);
  const inSet = shiftInSet(sc, s.c);
  // P on the compact [0, 1]; P′ (claim 4.1.6(ג)) on (0, 1]; Z_p
  const setName = sc.set === 'pos' ? (sc.openLeft ? 'P′' : 'P') : 'Zₚ';
  const key = shiftKeyValue(sc, s.c);

  /** The student's own change: a text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<SetState>) => {
    const next = { ...s, ...patch };
    setS(next);
    const has = (t: string) => props.tasks?.includes(t);
    const moved = patch.ri !== undefined || patch.c !== undefined;
    if (!moved) return;
    const cs = SET_CASES[next.sc];
    const rr = RADII[next.ri];
    const outside = shiftInBall(next.c, rr) && !shiftInSet(cs, next.c);
    const R = largestBall(cs);
    if (has('largest-ball') && patch.ri !== undefined && next.sc === 'pos' && R !== null && rr === R) markTask(`${props.id}:largest-ball`);
    if (has('leave-pos') && next.sc === 'pos' && R !== null && rr > R && outside) markTask(`${props.id}:leave-pos`);
    if (has('open-fails') && next.sc === 'pos-open' && rr <= 0.1 && outside) markTask(`${props.id}:open-fails`);
    if (has('leave-zero') && next.sc === 'zero' && rr <= 0.1 && outside) markTask(`${props.id}:leave-zero`);
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.setCase === 'string' && st.setCase in SET_CASES) next.sc = st.setCase as SetId;
          if (typeof st.r === 'number') next.ri = nearestR(st.r);
          if (typeof st.c === 'number') next.c = clampC(st.c);
          return next;
        });
      }),
    [props.id],
  );

  const infText =
    sc.set === 'pos'
      ? sc.argInf === null
        ? `inf f = ${fmt(sc.inf)} (לא מתקבל)`
        : `min f = ${fmt(sc.inf)}, ב-x = ${fmt(sc.argInf)}`
      : `f(p) = 0, p = ${fmt(sc.p as number)}`;
  const keyText = sc.set === 'pos' ? (sc.argInf === null ? `inf g = ${fmt(key)}` : `min g = ${fmt(key)}`) : `g(p) = ${fmt(key)}`;
  const describe = () =>
    [
      `${sc.formula}. ${infText}.`,
      `g = f − c עם c = ${fmt(s.c)}: המרחק ‖g − f‖∞ = ${fmt(Math.abs(s.c))}, ולכן g ${inBall ? 'בתוך הכדור' : 'מחוץ לכדור'} B(f, r) עם r = ${fmt(r)}.`,
      `${keyText}, ולכן g ${inSet ? 'שייכת' : 'אינה שייכת'} ל-${setName}.`,
    ].join(' ');

  useEffect(() => {
    const t = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(t);
  }, [s]);

  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const box = insetBox({ x: 0, y: 0, w: view.w, h: view.h }, { l: narrow ? 40 : 50, r: 16, t: 44, b: 40 });
    const plot = makePlot(box, { min: sc.a, max: sc.b, label: 'x' }, { min: sc.y[0], max: sc.y[1], label: 'y' });
    // the open left end of (a, b] is drawn from a hair to its right
    const lo = sc.openLeft ? sc.a + 1e-9 : sc.a;
    const sub = makePlot({ ...box, x: plot.px(lo), w: box.x + box.w - plot.px(lo) }, { ...plot.x, min: lo }, plot.y);
    const g = (x: number) => sc.f(x) - s.c;

    // outside P: the half-plane y ≤ 0, shaded; the graph of a function of P stays above it
    if (sc.set === 'pos') {
      ctx.save();
      ctx.fillStyle = p.paper2;
      const y0 = plot.py(0);
      ctx.fillRect(box.x, y0, box.w, box.y + box.h - y0);
      ctx.restore();
    }
    // the ball B(f, r): the open tube f ± r, dashed edges
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    const N = 240;
    const xs = Array.from({ length: N + 1 }, (_, i) => lo + ((sc.b - lo) * i) / N);
    ctx.beginPath();
    xs.forEach((x, i) => (i ? ctx.lineTo(plot.px(x), plot.py(sc.f(x) + r)) : ctx.moveTo(plot.px(x), plot.py(sc.f(x) + r))));
    for (let i = N; i >= 0; i--) ctx.lineTo(plot.px(xs[i]), plot.py(sc.f(xs[i]) - r));
    ctx.closePath();
    ctx.fillStyle = p.epsBand;
    ctx.fill();
    ctx.restore();
    drawCurve(ctx, sub, (x) => sc.f(x) + r, { color: p.eps, width: 1.2, dash: [5, 4] });
    drawCurve(ctx, sub, (x) => sc.f(x) - r, { color: p.eps, width: 1.2, dash: [5, 4] });
    drawAxes(ctx, plot, p);

    // y = 0 (the edge of P), and for Z_p the vertical line x = p
    ctx.save();
    ctx.strokeStyle = p.ink2;
    ctx.lineWidth = sc.set === 'pos' ? 2 : 1.2;
    ctx.beginPath();
    ctx.moveTo(box.x, plot.py(0));
    ctx.lineTo(box.x + box.w, plot.py(0));
    ctx.stroke();
    if (sc.set === 'zero') {
      const xp = plot.px(sc.p as number);
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(xp, box.y);
      ctx.lineTo(xp, box.y + box.h);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();

    // the centre f (green) and the probe g = f − c (ink)
    drawCurve(ctx, sub, sc.f, { color: p.limit, width: 2.4 });
    drawCurve(ctx, sub, g, { color: p.curve, width: 2.2, samples: 300 });
    if (sc.openLeft) {
      // the open end at x = a: hollow points (the value there is not taken)
      ctx.save();
      ctx.fillStyle = p.paper;
      ctx.lineWidth = 2;
      const ends: [number, string][] = [
        [sc.f(sc.a), p.limit],
        [g(sc.a), p.curve],
      ];
      for (const [y, col] of ends) {
        ctx.strokeStyle = col;
        ctx.beginPath();
        ctx.arc(plot.px(sc.a), plot.py(y), 4.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // the key point: the lowest point of g (P), or g(p) (Z_p); on (0, 1] with c > 0, a point where g < 0
    const xk = sc.set === 'zero' ? (sc.p as number) : (sc.argInf ?? (s.c > 0 ? Math.min(s.c / 2, sc.b) : null));
    if (xk !== null) {
      const yk = sc.set === 'zero' ? key : g(xk);
      const sx = plot.px(xk);
      const sy = plot.py(yk);
      ctx.save();
      if (inSet) {
        ctx.fillStyle = p.pointIn;
        ctx.beginPath();
        ctx.arc(sx, sy, 5.5, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        ctx.fillStyle = p.paper;
        ctx.strokeStyle = p.pointOut;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(sx, sy, 5.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(sx, sy, 10, 0, 2 * Math.PI);
        ctx.stroke();
      }
      ctx.restore();
    }
    // labels f, g, x = p: LTR math names
    ctx.save();
    ctx.font = `600 ${narrow ? 12 : 13}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const label = (t: string, x: number, y: number, col: string) => {
      ctx.strokeStyle = p.paper;
      ctx.lineWidth = 4;
      ctx.strokeText(t, x, y);
      ctx.fillStyle = col;
      ctx.fillText(t, x, y);
    };
    const xl = sc.b - (sc.b - sc.a) * 0.06;
    const fAbove = sc.f(xl) >= g(xl);
    label('f', plot.px(xl) - 4, plot.py(sc.f(xl)) + (fAbove ? -12 : 12), p.limit);
    label('g', plot.px(xl) - 4, plot.py(g(xl)) + (fAbove ? 12 : -12), p.curve);
    if (sc.set === 'zero') label('x = p', plot.px(sc.p as number) + 6, box.y + 12, p.ink2);
    ctx.restore();
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1.5, worldHeight: 1, animate: false });
  useEffect(invalidate, [s]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      userSet({ c: clampC(s.c + (e.key === 'ArrowRight' ? 0.01 : -0.01)) });
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      userSet({ ri: Math.max(0, Math.min(RADII.length - 1, s.ri + (e.key === 'ArrowUp' ? 1 : -1))) });
    }
  };

  const offered = props.setCases ?? [];
  return (
    <SimShell
      fig={props.id}
      label={`איור חי: פונקציה f במרחב הפונקציות הרציפות, בירוק, הכדור B(f, r) בנורמת הסופרמום כצינור סביבה, ופונקציה g = f − c מהכדור. במקלדת: חץ ימינה ושמאלה משנה את c, חץ למעלה ולמטה משנה את r. ${describe()}`}
      canvasRef={canvasRef}
      aspect={1.5}
      live={live}
      tasks={tasks}
      onKeyDown={onKeyDown}
      onReset={() => {
        setS(freshSet(props));
        setLive('האיור אופס.');
      }}
      readout={
        <>
          <span data-readout="inf">
            <b class="q">{infText}</b>
          </span>
          <span data-readout="dist">
            המרחק: <b class="q">‖g − f‖∞ = {fmt(Math.abs(s.c))}</b>
          </span>
          <span data-readout="ball">
            {inBall ? 'g בתוך הכדור' : 'g מחוץ לכדור'} <b class="q">B(f, {fmt(r)})</b>.
          </span>
          <span data-readout="set">
            <b class="q">{keyText}</b>, ולכן <b class="q">{inSet ? `g ∈ ${setName}` : `g ∉ ${setName}`}</b>.
          </span>
        </>
      }
      controls={
        <>
          {offered.length > 1 && (
            <div class="group" role="group" aria-label="הקבוצה">
              {offered.map((id) => (
                <Toggle key={id} label={<MixedLabel text={SET_CASES[id].name} />} on={s.sc === id} onChange={() => userSet({ sc: id, c: 0 })} />
              ))}
            </div>
          )}
          <Slider label="r: רדיוס הכדור" value={s.ri} min={0} max={RADII.length - 1} step={1} format={(v) => fmt(RADII[Math.round(v)])} onChange={(v) => userSet({ ri: Math.round(v) })} />
          <Slider label="c: ההזזה, g = f − c" value={s.c} min={-C_MAX} max={C_MAX} step={0.01} format={(v) => fmt(v)} onChange={(v) => userSet({ c: clampC(v) })} />
        </>
      }
    />
  );
}
