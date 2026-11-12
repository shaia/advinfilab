/**
 * Lesson 3.1's figure: the Bolzano–Weierstrass theorem in the plane, proved by quartering (the second proof of
 * משפט 3.1.7). The first N terms of a sequence are drawn as small ink dots. Q₀ = [−1, 1]² is cut into four quarters;
 * the construction keeps one and picks the first later index whose term lies in it, then cuts the kept quarter, and
 * so on. The kept squares Q₁ ⊇ Q₂ ⊇ … are drawn in the cool colour (the current one shaded), the picked terms
 * x_{n₁}, x_{n₂}, … as filled warm points joined in order. In the discrete metric the same picks are drawn hollow with
 * a ring (shape, not only colour): any two of them are at distance 1, so they form no Cauchy sequence. The unbounded
 * preset has no starting square at all.
 *
 * Every number comes from src/math/bolzano.ts. With finitely many terms the "infinitely many" of the proof is replaced
 * by "the most drawn terms": the figure is a probe, and the caption says so. No animation: every frame is a still state.
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
  DEPTH_MAX,
  N_CHOICES,
  Q0,
  SEQS,
  dInf,
  describeBolzano,
  fmtNum,
  quarter,
  quarterChain,
  sideAt,
  sub,
  terms,
  type SeqId,
  type Square,
} from '~/math/bolzano';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { drawAxes, insetBox, makePlot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

/** a left-to-right island inside Hebrew text (U+2066 … U+2069) */
const ltr = (s: string) => `⁦${s}⁩`;

const TASK_LABEL: Record<string, string> = {
  'small-square': `בסדרה חסומה, הגדילו את מספר החציות עד שצלע הריבוע האחרון קטנה מ-${ltr('0.05')}. אם האיור עוצר לפני כן, הגדילו את מספר האיברים המצוירים.`,
  escape: `בחרו בסדרה הלא חסומה והגדילו את מספר האיברים המצוירים ל-${ltr('200')} לפחות. האם יש ריבוע אחד שמכיל את כל איברי הסדרה?`,
  discrete: `בסדרה חסומה, עם ${ltr('3')} חציות לפחות, הדליקו את המטריקה הבדידה וקראו את המרחק בין שני האיברים האחרונים שנבחרו.`,
};

interface State {
  seq: SeqId;
  /** index into N_CHOICES */
  ni: number;
  depth: number;
  discrete: boolean;
  zoom: boolean;
}

export interface BolzanoBoxProps {
  id: string;
  seq?: SeqId;
  seqs?: SeqId[];
  N?: number;
  depth?: number;
  discrete?: boolean;
  zoom?: boolean;
  tasks?: string[];
}

const nearestN = (N: number) =>
  N_CHOICES.reduce((best, v, i) => (Math.abs(Math.log(v / N)) < Math.abs(Math.log(N_CHOICES[best] / N)) ? i : best), 0);
const clampDepth = (v: number) => Math.max(0, Math.min(DEPTH_MAX, Math.round(v)));

function fresh(p: BolzanoBoxProps): State {
  const seq: SeqId = p.seq && p.seq in SEQS ? p.seq : 'corners';
  return {
    seq,
    ni: nearestN(p.N ?? 1000),
    depth: clampDepth(p.depth ?? 0),
    discrete: p.discrete ?? false,
    zoom: p.zoom ?? false,
  };
}

const Q = (p: { children: ComponentChildren }) => (
  <b class="q">
    <bdi dir="ltr">{p.children}</bdi>
  </b>
);

export default function BolzanoBox(props: BolzanoBoxProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  /** the student's own change has done the escape task; until then the readout does not answer its question */
  const [escapeDone, setEscapeDone] = useState(false);
  const verdict = !props.tasks?.includes('escape') || escapeDone;
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));

  const seq = SEQS[s.seq];
  const N = N_CHOICES[s.ni];
  const pts = terms(seq, N);
  const ch = quarterChain(seq, N, s.depth);
  const J = ch ? ch.picks.length : 0;
  const picked = ch ? ch.picks.map((n) => seq.term(n)) : [];

  /** The student's own change: a text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    setS(next);
    const has = (t: string) => props.tasks?.includes(t);
    const sq = SEQS[next.seq];
    const nextN = N_CHOICES[next.ni];
    if (has('escape') && !sq.bounded && nextN >= 200 && (patch.seq !== undefined || patch.ni !== undefined)) {
      markTask(`${props.id}:escape`);
      setEscapeDone(true);
    }
    if (!sq.bounded) return;
    const reached = quarterChain(sq, nextN, next.depth)!.picks.length;
    if (has('small-square') && (patch.depth !== undefined || patch.ni !== undefined || patch.seq !== undefined) && sideAt(reached) < 0.05)
      markTask(`${props.id}:small-square`);
    if (has('discrete') && patch.discrete === true && reached >= 3) markTask(`${props.id}:discrete`);
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.seq === 'string' && st.seq in SEQS) next.seq = st.seq as SeqId;
          if (typeof st.N === 'number') next.ni = nearestN(st.N);
          if (typeof st.depth === 'number') next.depth = clampDepth(st.depth);
          if (typeof st.discrete === 'boolean') next.discrete = st.discrete;
          if (typeof st.zoom === 'boolean') next.zoom = st.zoom;
          return next;
        });
      }),
    [props.id],
  );

  const describe = () => describeBolzano({ seq: s.seq, N, depth: s.depth, discrete: s.discrete, verdict });

  useEffect(() => {
    const t = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(t);
  }, [s, verdict]);

  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const outer = insetBox({ x: 0, y: 0, w: view.w, h: view.h }, { l: narrow ? 40 : 48, r: 14, t: 14, b: 30 });
    // the window: a square in the plane, [cx − h, cx + h] × [cy − h, cy + h]
    let cx = 0;
    let cy = 0;
    let h = 1.12;
    if (!seq.bounded) {
      const R = Math.max(1.2, ...pts.map((q) => Math.max(Math.abs(q.x), Math.abs(q.y))));
      h = R * 1.06;
    } else if (s.zoom && ch && J >= 2) {
      const Z: Square = ch.squares[J - 2];
      cx = Z.x + Z.side / 2;
      cy = Z.y + Z.side / 2;
      h = Z.side * 0.56;
    }
    const sc = Math.min(outer.w, outer.h) / (2 * h);
    const bw = 2 * h * sc;
    const box = { x: outer.x + (outer.w - bw) / 2, y: outer.y + (outer.h - bw) / 2, w: bw, h: bw };
    const plot = makePlot(box, { min: cx - h, max: cx + h }, { min: cy - h, max: cy + h });
    drawAxes(ctx, plot, p);

    const rectOf = (Qs: Square) => [plot.px(Qs.x), plot.py(Qs.y + Qs.side), plot.px(Qs.x + Qs.side) - plot.px(Qs.x), plot.py(Qs.y) - plot.py(Qs.y + Qs.side)] as const;
    const halo = (txt: string, x: number, y: number, color: string) => {
      ctx.save();
      ctx.font = `600 ${narrow ? 12 : 13}px ${p.fontUi}`;
      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = p.paper;
      ctx.lineWidth = 4;
      ctx.strokeText(txt, x, y);
      ctx.fillStyle = color;
      ctx.fillText(txt, x, y);
      ctx.restore();
    };

    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();

    // Q₀: the starting square (for the unbounded preset only a dashed reference)
    {
      const [x, y, w, hh] = rectOf(Q0);
      ctx.strokeStyle = p.ink2;
      ctx.lineWidth = 1.4;
      ctx.setLineDash(seq.bounded ? [] : [6, 4]);
      ctx.strokeRect(x, y, w, hh);
      ctx.setLineDash([]);
    }

    // the kept squares Q₁ ⊇ Q₂ ⊇ … : outlines, the current one shaded, and the cuts that will split it next
    if (ch) {
      const cur = ch.squares[J];
      const [x, y, w, hh] = rectOf(cur);
      ctx.fillStyle = p.deltaBand;
      ctx.fillRect(x, y, w, hh);
      ctx.strokeStyle = p.delta;
      for (let j = 1; j <= J; j++) {
        const [a, b, c, d] = rectOf(ch.squares[j]);
        ctx.lineWidth = j === J ? 2.4 : 1.3;
        ctx.strokeRect(a, b, c, d);
      }
      if (J < DEPTH_MAX && !ch.ranOut) {
        ctx.setLineDash([3, 4]);
        ctx.lineWidth = 1;
        const m = quarter(cur, 3);
        ctx.beginPath();
        ctx.moveTo(plot.px(m.x), plot.py(cur.y));
        ctx.lineTo(plot.px(m.x), plot.py(cur.y + cur.side));
        ctx.moveTo(plot.px(cur.x), plot.py(m.y));
        ctx.lineTo(plot.px(cur.x + cur.side), plot.py(m.y));
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // all drawn terms: small ink dots
    ctx.fillStyle = p.ink3;
    const r = N > 5000 ? 1 : N > 1000 ? 1.3 : 1.8;
    for (const q of pts) ctx.fillRect(plot.px(q.x) - r, plot.py(q.y) - r, 2 * r, 2 * r);

    // the picked subsequence, joined in order
    if (picked.length) {
      ctx.strokeStyle = s.discrete ? p.pointOut : p.eps;
      ctx.lineWidth = 1.3;
      ctx.setLineDash(s.discrete ? [4, 3] : []);
      ctx.beginPath();
      picked.forEach((q, i) => (i ? ctx.lineTo(plot.px(q.x), plot.py(q.y)) : ctx.moveTo(plot.px(q.x), plot.py(q.y))));
      ctx.stroke();
      ctx.setLineDash([]);
      picked.forEach((q, i) => {
        const X = plot.px(q.x);
        const Y = plot.py(q.y);
        const last = i === picked.length - 1;
        ctx.beginPath();
        ctx.arc(X, Y, last ? 5.5 : 4, 0, 2 * Math.PI);
        if (s.discrete) {
          ctx.fillStyle = p.paper;
          ctx.fill();
          ctx.strokeStyle = p.pointOut;
          ctx.lineWidth = 2.2;
          ctx.stroke();
          if (last) {
            ctx.beginPath();
            ctx.arc(X, Y, 10, 0, 2 * Math.PI);
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        } else {
          ctx.fillStyle = p.eps;
          ctx.fill();
          ctx.strokeStyle = p.paper;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      });
    }
    ctx.restore();

    // labels outside the clip: the current square and the last picked term
    if (ch && J >= 1) {
      const cur = ch.squares[J];
      halo(`Q${sub(J)}`, Math.min(box.x + box.w - 30, plot.px(cur.x + cur.side) + 5), Math.max(box.y + 10, plot.py(cur.y + cur.side) + 2), p.delta);
      const lp = picked[picked.length - 1];
      halo(`x${sub(ch.picks[J - 1])}`, Math.min(box.x + box.w - 40, plot.px(lp.x) + 10), Math.max(box.y + 10, plot.py(lp.y) - 12), s.discrete ? p.pointOut : p.ink);
    } else if (seq.bounded) {
      halo('Q₀', plot.px(Q0.x + Q0.side) - 24, plot.py(Q0.y + Q0.side) + 12, p.ink2);
    }
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1, worldHeight: 1, animate: false });
  useEffect(invalidate, [s]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      userSet({ depth: clampDepth(s.depth + (e.key === 'ArrowUp' ? 1 : -1)) });
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      userSet({ ni: Math.max(0, Math.min(N_CHOICES.length - 1, s.ni + (e.key === 'ArrowRight' ? 1 : -1))) });
    }
  };

  const offered = (props.seqs ?? []).filter((id) => id in SEQS);
  const lastTwo = ch && J >= 2 ? [picked[J - 2], picked[J - 1]] : null;
  const showPicks = (ns: number[]) => (ns.length <= 8 ? ns.join(', ') : `${ns.slice(0, 8).join(', ')}, …`);
  return (
    <SimShell
      fig={props.id}
      label={`איור חי: האיברים הראשונים של סדרה במישור, והחציות של הוכחת בולצאנו-ויירשטראס: ריבועים מקוננים ותת-סדרה שנבחרת מתוכם. במקלדת: חץ למעלה ולמטה משנה את מספר החציות, חץ ימינה ושמאלה את מספר האיברים המצוירים. ${describe()}`}
      canvasRef={canvasRef}
      aspect={1}
      live={live}
      tasks={tasks}
      onKeyDown={onKeyDown}
      onReset={() => {
        setS(fresh(props));
        setLive('האיור אופס.');
      }}
      readout={
        <>
          <span data-readout="seq">
            <Q>{seq.formula}</Q>
          </span>
          <span data-readout="N">
            איברים מצוירים: <Q>N = {N}</Q>
          </span>
          {!ch ? (
            <>
              <span data-readout="escape">
                המרחק מהראשית של האיבר האחרון המצויר: <Q>{`d₂(x${sub(N)}, 0) = ${N}/20 = ${fmtNum(N / 20)}`}</Q>. הריבוע המקווקו הוא <Q>Q₀ = [−1, 1]²</Q>.
              </span>
              {verdict && (
                <span data-readout="escape-verdict">
                  הסדרה אינה חסומה: <Q>d₂(xₙ, 0) = n/20</Q> גדל בלי חסם, ולכן אין ריבוע חסום שמכיל את כל איבריה, וההוכחה בחציות אינה יכולה להתחיל.
                </span>
              )}
            </>
          ) : (
            <>
              <span data-readout="depth">
                חציות: <Q>j = {J}</Q>
                {J < s.depth && <> (מתוך {s.depth} שהתבקשו)</>}
              </span>
              {J >= 1 && (
                <span data-readout="picks">
                  האינדקסים שנבחרו: <Q>{`n₁, …, n${sub(J)} = ${showPicks(ch.picks)}`}</Q>
                </span>
              )}
              <span data-readout="side">
                הצלע של <Q>{`Q${sub(J)}`}</Q>: <Q>{fmtNum(sideAt(J))}</Q>
              </span>
              <span data-readout="left">
                איברים מצוירים בתוך <Q>{`Q${sub(J)}`}</Q> עם אינדקס גדול מ-<Q>{J === 0 ? 'n₀ = 0' : `n${sub(J)}`}</Q>: <Q>{ch.remaining}</Q>
              </span>
              {ch.ranOut && (
                <span data-readout="ran-out">
                  ברבע שנבחר אין עוד איבר מצויר עם אינדקס מתאים, והבנייה נעצרה: הגדילו את <Q>N</Q>. בהוכחה יש אינסוף איברים, ושם זה לא קורה.
                </span>
              )}
              {lastTwo && (
                <span data-readout="gap">
                  {s.discrete ? (
                    <>
                      במטריקה הבדידה: <Q>{`d(x${sub(ch.picks[J - 2])}, x${sub(ch.picks[J - 1])}) = 1`}</Q>, כמו בין כל שני איברים שונים.
                    </>
                  ) : (
                    <>
                      <Q>{`d∞(x${sub(ch.picks[J - 2])}, x${sub(ch.picks[J - 1])}) = ${fmtNum(dInf(lastTwo[0], lastTwo[1]))}`}</Q>, לכל היותר הצלע של{' '}
                      <Q>{`Q${sub(J - 1)}`}</Q>
                    </>
                  )}
                </span>
              )}
            </>
          )}
        </>
      }
      controls={
        <>
          {offered.length > 1 && (
            <div class="group" role="group" aria-label="הסדרה">
              {offered.map((id) => (
                <Toggle key={id} label={SEQS[id].name} on={s.seq === id} onChange={() => userSet({ seq: id })} />
              ))}
            </div>
          )}
          <Slider label="N" value={s.ni} min={0} max={N_CHOICES.length - 1} step={1} format={(v) => String(N_CHOICES[Math.round(v)])} onChange={(v) => userSet({ ni: Math.round(v) })} />
          <Slider label="חציות" value={s.depth} min={0} max={DEPTH_MAX} step={1} format={(v) => String(Math.round(v))} onChange={(v) => userSet({ depth: clampDepth(v) })} />
          <div class="group">
            <Toggle label="מטריקה בדידה" on={s.discrete} onChange={(on) => userSet({ discrete: on })} />
            <Toggle label="התקרבות" on={s.zoom} onChange={(on) => userSet({ zoom: on })} />
          </div>
        </>
      }
    />
  );
}
