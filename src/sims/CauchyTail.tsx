/**
 * The figure of lessons 2.1, 2.5 and 2.6: Cauchy sequences and nested sets.
 *
 * Tail mode: the sequence n ↦ xₙ as points, the tail {xₙ : n ≥ N} highlighted, and its exact spread
 * D_N = sup{|x_m − xₙ| : m, n ≥ N} as a band between the inf and the sup of the tail, against a reference interval of
 * length ε (drawn at the right edge, starting at the inf). The verdict marker is filled when D_N < ε and hollow with a
 * ring when it is not (shape, not only colour). The limit, when there is one, is a green line; its marker is filled when
 * the limit lies in the chosen space (ℝ, ℚ, (0, 1)) and hollow with a ring when it does not. An unbounded tail is drawn
 * to the top edge with an arrow.
 *
 * Nested mode: sets F₁ ⊇ F₂ ⊇ … ⊇ F_k of the line as stacked rows, closed ends filled, open ends hollow, a ray drawn to
 * the edge with an arrow; with the space ℚ the rows are dotted (the sets are F_j ∩ ℚ). The intersection of ALL the sets
 * (not only the k drawn) is read from the exact data of src/math/cauchy.ts.
 *
 * Every number comes from src/math/cauchy.ts. The figure shows n ≤ nMax only and a probe never proves: the lesson proves
 * the formulas of D_N and of the intersections.
 */

import { useEffect, useState } from 'preact/hooks';
import {
  EPS,
  K_MAX,
  NESTS,
  TAILS,
  gap,
  intersectionPoint,
  limitInSpace,
  missingPoint,
  smallestN,
  yWindow,
  type NestId,
  type Space,
  type TailSeqId,
} from '~/math/cauchy';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { sci } from './core/format';
import { drawAxes, insetBox, makePlot, niceTicks } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

const LRI = '⁦';
const PDI = '⁩';

const TASK_LABEL: Record<string, string> = {
  'find-N': `בסדרה 1/n או בסדרה ההרמונית המתחלפת, עם ${LRI}ε = 0.1${PDI} או קטן יותר, הזיזו את N אל ה-N הקטן ביותר שעבורו ${LRI}D_N < ε${PDI} (באיור N הוא האינדקס הראשון בזנב).`,
  'not-cauchy': `בסדרה ההרמונית או ב-${LRI}√n${PDI}, הזיזו את N עד 40 לפחות. האם יש N שעבורו הפיזור קטן מ-ε? למה?`,
  'bounded-not-cauchy': `בסדרה ${LRI}(−1)ⁿ${PDI}, עם ${LRI}ε ≤ 0.5${PDI}, הזיזו את N עד 30 לפחות. הסדרה חסומה; מה קורה לפיזור הזנב?`,
  'missing-limit': `בקטיעות העשרוניות של ${LRI}√2${PDI} או בסדרת ניוטון, במרחב ℚ ועם ${LRI}ε ≤ 0.01${PDI}, הזיזו את N אל N שעבורו ${LRI}D_N < ε${PDI}. היכן הגבול, והאם הוא במרחב?`,
  equivalent: `עם סדרה שנייה בהשוואה ועם ${LRI}ε ≤ 0.001${PDI}, הזיזו את N אל N שעבורו ${LRI}|x_N − y_N| < ε${PDI}.`,
  'shrink-to-point': 'בחציית הקטעים ל-√2, במרחב ℝ, הגדילו את k עד 10 לפחות. מה קורה לקוטר, ומה החיתוך של כל הקבוצות?',
  'lost-point': 'בחציית הקטעים ל-√2, במרחב ℚ, הגדילו את k עד 10 לפחות. מה השתנה לעומת ℝ?',
  'not-closed': `ב-${LRI}(0, 1/j]${PDI}, הגדילו את k עד 10 לפחות. האם החיתוך ריק? איזו הנחה של משפט החיתוך נכשלת?`,
  unbounded: `ב-${LRI}[j, ∞)${PDI}, הגדילו את k עד 10 לפחות. האם החיתוך ריק? איזו הנחה נכשלת הפעם?`,
};

const SPACE_NAME: Record<Space, string> = { R: 'ℝ', Q: 'ℚ', open01: '(0, 1)', 'R-arctan': 'ℝ עם המטריקה ρ' };
const ALL_SPACES: Space[] = ['R', 'Q', 'open01', 'R-arctan'];

const fmt = (v: number) => (Number.isFinite(v) ? sci(v, 3).replace(/^-/, '−') : '∞');

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n: number) =>
  String(n)
    .split('')
    .map((c) => SUB[Number(c)])
    .join('');

interface State {
  seq: TailSeqId;
  N: number;
  /** index into EPS */
  ei: number;
  space: Space;
  compare: TailSeqId | null;
  nest: NestId;
  k: number;
}

export interface CauchyTailProps {
  id: string;
  mode?: 'tail' | 'nested';
  seq?: TailSeqId;
  seqs?: TailSeqId[];
  N?: number;
  eps?: number;
  space?: Space;
  spaces?: Space[];
  compare?: TailSeqId | null;
  nest?: NestId;
  nests?: NestId[];
  k?: number;
  tasks?: string[];
}

const nearestEps = (e: number) => EPS.reduce((best, v, i) => (Math.abs(Math.log(v / e)) < Math.abs(Math.log(EPS[best] / e)) ? i : best), 0);
const isSeq = (v: unknown): v is TailSeqId => typeof v === 'string' && v in TAILS;
const isNest = (v: unknown): v is NestId => typeof v === 'string' && v in NESTS;
const isSpace = (v: unknown): v is Space => typeof v === 'string' && ALL_SPACES.includes(v as Space);

/** the largest N the figure offers: the preset's nMax, or the smaller one of the two sequences when one is compared */
const nLimit = (seq: TailSeqId, compare: TailSeqId | null) => Math.min(TAILS[seq].nMax, compare ? TAILS[compare].nMax : Infinity);
const clampInt = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

function fresh(p: CauchyTailProps): State {
  const nested = p.mode === 'nested';
  const seq = isSeq(p.seq) ? p.seq : 'inv-n';
  const compare = isSeq(p.compare) && p.compare !== seq ? p.compare : null;
  const space: Space = isSpace(p.space) ? (nested && p.space !== 'Q' ? 'R' : p.space) : 'R';
  return {
    seq,
    N: clampInt(p.N ?? 1, 1, nLimit(seq, compare)),
    ei: nearestEps(p.eps ?? 0.1),
    space,
    compare,
    nest: isNest(p.nest) ? p.nest : 'bisect',
    k: clampInt(p.k ?? 1, 1, K_MAX),
  };
}

/** the open-or-closed ends of a nested row: a dot, filled when closed and hollow when open */
function endDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, paper: string, isClosed: boolean) {
  ctx.save();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fillStyle = isClosed ? color : paper;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/** a marker that is filled when `on` and a hollow ringed point when not */
function statusDot(ctx: CanvasRenderingContext2D, x: number, y: number, on: boolean, fill: string, stroke: string, paper: string, r = 6) {
  ctx.save();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  if (on) {
    ctx.fillStyle = fill;
    ctx.fill();
  } else {
    ctx.fillStyle = paper;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, r + 4.5, 0, 2 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}

function arrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, dir: 'up' | 'right', color: string, size = 7) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  if (dir === 'up') {
    ctx.moveTo(x, y);
    ctx.lineTo(x - size * 0.7, y + size);
    ctx.lineTo(x + size * 0.7, y + size);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x - size, y - size * 0.7);
    ctx.lineTo(x - size, y + size * 0.7);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function haloText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, ink: string, paper: string) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = paper;
  ctx.lineWidth = 4;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = ink;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export default function CauchyTail(props: CauchyTailProps) {
  const nested = props.mode === 'nested';
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));

  const seq = TAILS[s.seq];
  const cmp = s.compare ? TAILS[s.compare] : null;
  const eps = EPS[s.ei];
  const nm = nLimit(s.seq, s.compare);
  const D = seq.spread(s.N);
  const within = D < eps;
  const nestDef = NESTS[s.nest];
  const nSpace: 'R' | 'Q' = s.space === 'Q' ? 'Q' : 'R';
  const diam = nestDef.diam(s.k);
  const inter = intersectionPoint(nestDef, nSpace);
  const missing = missingPoint(nestDef, nSpace);

  /** The student's own change: a text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    next.N = clampInt(next.N, 1, nLimit(next.seq, next.compare));
    setS(next);
    const has = (t: string) => props.tasks?.includes(t);
    const t = TAILS[next.seq];
    const e = EPS[next.ei];
    const d = t.spread(next.N);
    if (!nested) {
      if (has('find-N') && (next.seq === 'inv-n' || next.seq === 'alt-harm') && e <= 0.1 && next.N === smallestN(t, e)) markTask(`${props.id}:find-N`);
      if (has('not-cauchy') && (next.seq === 'harmonic' || next.seq === 'sqrt-n') && next.N >= 40) markTask(`${props.id}:not-cauchy`);
      if (has('bounded-not-cauchy') && next.seq === 'alt-sign' && e <= 0.5 && next.N >= 30) markTask(`${props.id}:bounded-not-cauchy`);
      if (has('missing-limit') && (next.seq === 'sqrt2-dec' || next.seq === 'newton') && next.space === 'Q' && e <= 0.01 && d < e) markTask(`${props.id}:missing-limit`);
      if (has('equivalent') && next.compare && e <= 0.001 && gap(t, TAILS[next.compare], next.N) < e) markTask(`${props.id}:equivalent`);
    } else {
      const sp = next.space === 'Q' ? 'Q' : 'R';
      if (has('shrink-to-point') && next.nest === 'bisect' && sp === 'R' && next.k >= 10) markTask(`${props.id}:shrink-to-point`);
      if (has('lost-point') && next.nest === 'bisect' && sp === 'Q' && next.k >= 10) markTask(`${props.id}:lost-point`);
      if (has('not-closed') && next.nest === 'half-open' && next.k >= 10) markTask(`${props.id}:not-closed`);
      if (has('unbounded') && next.nest === 'rays' && next.k >= 10) markTask(`${props.id}:unbounded`);
    }
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (isSeq(st.seq)) next.seq = st.seq;
          if (st.compare === null) next.compare = null;
          else if (isSeq(st.compare)) next.compare = st.compare;
          if (next.compare === next.seq) next.compare = null;
          if (isSpace(st.space)) next.space = nested && st.space !== 'Q' ? 'R' : st.space;
          if (typeof st.eps === 'number') next.ei = nearestEps(st.eps);
          if (isNest(st.nest)) next.nest = st.nest;
          if (typeof st.k === 'number') next.k = clampInt(st.k, 1, K_MAX);
          if (typeof st.N === 'number') next.N = Math.round(st.N);
          next.N = clampInt(next.N, 1, nLimit(next.seq, next.compare));
          return next;
        });
      }),
    [props.id],
  );

  const spaceWord = SPACE_NAME[s.space];
  const tailSentence = () => {
    const parts = [`${seq.formula}, N = ${s.N}, ε = ${fmt(eps)}.`];
    parts.push(Number.isFinite(D) ? `פיזור הזנב D_N = ${fmt(D)}${seq.attained(s.N) ? ' (מתקבל)' : ' (לא מתקבל)'}.` : 'פיזור הזנב D_N = ∞.');
    parts.push(within ? 'D_N < ε: כן.' : 'D_N < ε: לא.');
    if (seq.limit === null) parts.push('אין גבול.');
    else if (seq.limitNever) parts.push(`מפלס הגבול ${seq.limitLabel} אינו נקודה של המרחב.`);
    else parts.push(limitInSpace(seq, s.space) ? `הגבול ${seq.limitLabel} נמצא במרחב ${spaceWord}.` : `הגבול ${seq.limitLabel} אינו נמצא במרחב ${spaceWord}.`);
    if (cmp) parts.push(`|x_N − y_N| = ${fmt(gap(seq, cmp, s.N))}.`);
    return parts.join(' ');
  };
  const nestSentence = () => {
    const parts = [`${nestDef.formula}, k = ${s.k}, המרחב ${SPACE_NAME[nSpace]}.`];
    parts.push(`diam F_k = ${fmt(diam)}.`);
    if (inter !== null) parts.push(`החיתוך של כל הקבוצות F_j הוא הנקודה ${nestDef.pointLabel}, והיא נמצאת במרחב.`);
    else if (missing !== null) parts.push(`החיתוך של כל הקבוצות F_j ריק: הנקודה ${nestDef.pointLabel} אינה במרחב ${SPACE_NAME[nSpace]}.`);
    else parts.push('החיתוך של כל הקבוצות F_j ריק.');
    return parts.join(' ');
  };
  const describe = () => (nested ? nestSentence() : tailSentence());

  useEffect(() => {
    const t = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(t);
  }, [s]);

  const drawTail = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const [y0, y1] = yWindow(seq, cmp);
    const box = insetBox({ x: 0, y: 0, w: view.w, h: view.h }, { l: narrow ? 44 : 52, r: narrow ? 28 : 34, t: 44, b: 42 });
    const plot = makePlot(box, { min: 0, max: nm + 1, label: 'n' }, { min: y0, max: y1, label: seq.yLabel });
    const rPt = narrow || nm > 30 ? 2.6 : 3.6;
    const inf = seq.tailInf(s.N);
    const sup = seq.tailSup(s.N);
    const unbounded = !Number.isFinite(sup);
    const yTop = unbounded ? box.y : Math.max(box.y, plot.py(sup));
    const yBot = Math.min(box.y + box.h, plot.py(inf));
    const xN = plot.px(s.N - 0.5);

    // the tail band: between the inf and the sup of {xₙ : n ≥ N}
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    ctx.fillStyle = p.deltaBand;
    ctx.fillRect(xN, yTop, box.x + box.w - xN, yBot - yTop);
    ctx.restore();
    drawAxes(ctx, plot, p, { grid: false });
    ctx.save();
    ctx.strokeStyle = p.delta;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(xN, yBot);
    ctx.lineTo(box.x + box.w, yBot);
    if (!unbounded) {
      ctx.moveTo(xN, yTop);
      ctx.lineTo(box.x + box.w, yTop);
    }
    ctx.stroke();
    ctx.restore();

    // N guide
    ctx.save();
    ctx.strokeStyle = p.ink3;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(plot.px(s.N), box.y);
    ctx.lineTo(plot.px(s.N), box.y + box.h);
    ctx.stroke();
    ctx.restore();

    // the limit (or the limit level), in green
    if (seq.limit !== null) {
      const yl = plot.py(seq.limit);
      ctx.save();
      ctx.strokeStyle = p.limit;
      ctx.lineWidth = 2;
      ctx.setLineDash(seq.limitNever ? [7, 5] : []);
      ctx.beginPath();
      ctx.moveTo(box.x, yl);
      ctx.lineTo(box.x + box.w, yl);
      ctx.stroke();
      ctx.restore();
    }

    // the points: before the tail small and light, in the tail ink; the second sequence hollow
    ctx.save();
    for (let n = 1; n <= nm; n++) {
      const x = plot.px(n);
      const y = plot.py(seq.x(n));
      ctx.beginPath();
      ctx.arc(x, y, n >= s.N ? rPt : rPt - 0.6, 0, 2 * Math.PI);
      ctx.fillStyle = n >= s.N ? p.curve : p.ink3;
      ctx.globalAlpha = n >= s.N ? 1 : 0.6;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (cmp) {
      ctx.strokeStyle = p.curve2;
      ctx.lineWidth = 1.6;
      ctx.fillStyle = p.paper;
      for (let n = 1; n <= nm; n++) {
        ctx.beginPath();
        ctx.arc(plot.px(n), plot.py(cmp.x(n)), rPt + 0.6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(plot.px(s.N), plot.py(seq.x(s.N)));
      ctx.lineTo(plot.px(s.N), plot.py(cmp.x(s.N)));
      ctx.stroke();
    }
    ctx.restore();

    // the unbounded tail runs to the top edge, with an arrow
    ctx.save();
    ctx.font = `600 13px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textBaseline = 'middle';
    if (unbounded) {
      const ax = (xN + box.x + box.w) / 2;
      ctx.strokeStyle = p.delta;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ax, box.y + 24);
      ctx.lineTo(ax, box.y + 6);
      ctx.stroke();
      arrowHead(ctx, ax, box.y + 1, 'up', p.delta, 8);
      ctx.textAlign = 'left';
      haloText(ctx, '∞', ax + 8, box.y + 14, p.ink, p.paper);
    }

    // ε: a reference interval of length ε starting at the inf of the tail, at the right edge
    const xB = box.x + box.w + (narrow ? 12 : 15);
    const eTop = Math.max(box.y, plot.py(inf + eps));
    ctx.fillStyle = p.epsBand;
    ctx.fillRect(xB - 4, eTop, 8, Math.max(0, yBot - eTop));
    ctx.strokeStyle = p.eps;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(xB - 6, eTop);
    ctx.lineTo(xB + 6, eTop);
    ctx.moveTo(xB - 6, yBot);
    ctx.lineTo(xB + 6, yBot);
    ctx.moveTo(xB, eTop);
    ctx.lineTo(xB, yBot);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = `600 12px ${p.fontUi}`;
    haloText(ctx, 'ε', xB, Math.max(box.y + 8, eTop - 9), p.ink, p.paper);

    // the limit's marker (left end of the line): filled iff the limit is a point of the space
    if (seq.limit !== null) {
      const mx = box.x + 14;
      const my = plot.py(seq.limit);
      statusDot(ctx, mx, my, limitInSpace(seq, s.space), p.limit, p.limit, p.paper, 5.5);
      ctx.textAlign = 'left';
      ctx.font = `600 ${narrow ? 12 : 13}px ${p.fontUi}`;
      haloText(ctx, seq.limitLabel, mx + 14, my - 12, p.ink, p.paper);
    }

    // the verdict: filled when D_N < ε, a hollow ringed point when not
    statusDot(ctx, box.x + 10, box.y - 22, within, p.pointIn, p.pointOut, p.paper, 6);
    ctx.textAlign = 'left';
    ctx.font = `600 ${narrow ? 12 : 13}px ${p.fontUi}`;
    ctx.fillStyle = p.ink;
    ctx.fillText(within ? `D_N < ε` : `D_N ≥ ε`, box.x + 26, box.y - 22);
    if (s.seq === 'arctan-n') {
      ctx.textAlign = 'right';
      ctx.font = `11px ${p.fontUi}`;
      ctx.fillStyle = p.ink2;
      ctx.fillText('ρ(x, y) = |arctan x − arctan y|', box.x + box.w, box.y - 8);
    }
    ctx.restore();
  };

  const drawNested = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const box = insetBox({ x: 0, y: 0, w: view.w, h: view.h }, { l: narrow ? 34 : 42, r: 18, t: 40, b: 40 });
    const [w0, w1] = nestDef.window;
    const px = (v: number) => box.x + ((v - w0) / (w1 - w0)) * box.w;
    const rowH = box.h / K_MAX;
    const rowY = (j: number) => box.y + (j - 0.5) * rowH;
    const rQ = nSpace === 'Q';
    const rad = Math.min(4.4, rowH * 0.36);

    // x axis
    ctx.save();
    ctx.strokeStyle = p.ink2;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(box.x, box.y + box.h);
    ctx.lineTo(box.x + box.w, box.y + box.h);
    ctx.stroke();
    ctx.fillStyle = p.ink2;
    ctx.font = `11px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.strokeStyle = p.rule;
    ctx.lineWidth = 1;
    for (const v of niceTicks(w0, w1, narrow ? 5 : 7)) {
      ctx.beginPath();
      ctx.moveTo(px(v), box.y + box.h);
      ctx.lineTo(px(v), box.y + box.h + 4);
      ctx.stroke();
      ctx.fillText(fmt(v), px(v), box.y + box.h + 6);
    }
    ctx.font = `600 12px ${p.fontUi}`;
    ctx.fillStyle = p.ink;
    ctx.fillText('x', box.x + box.w / 2, box.y + box.h + 22);

    // the point of the intersection (if any): a vertical guide, filled when in the space, hollow when it is missing
    const pt = nestDef.point;
    if (pt !== null) {
      ctx.strokeStyle = p.limit;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(px(pt), box.y);
      ctx.lineTo(px(pt), box.y + box.h);
      ctx.stroke();
      ctx.setLineDash([]);
      statusDot(ctx, px(pt), box.y + box.h, inter !== null, p.limit, p.limit, p.paper, 5.5);
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'left';
      ctx.font = `600 ${narrow ? 12 : 13}px ${p.fontUi}`;
      haloText(ctx, nestDef.pointLabel, px(pt) + 10, box.y + box.h - 10, p.ink, p.paper);
    }

    // the rows F₁ … F_k
    ctx.textBaseline = 'middle';
    for (let j = 1; j <= s.k; j++) {
      const set = nestDef.set(j);
      const y = rowY(j);
      const x0 = px(Math.max(set.lo, w0));
      const x1 = set.ray ? box.x + box.w - 9 : px(Math.min(set.hi, w1));
      ctx.save();
      ctx.globalAlpha = j === s.k ? 1 : 0.6;
      ctx.strokeStyle = p.curve;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.setLineDash(rQ ? [0.1, 6] : []);
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
      ctx.setLineDash([]);
      endDot(ctx, x0, y, rad, p.curve, p.paper, set.loClosed);
      if (set.ray) arrowHead(ctx, box.x + box.w, y, 'right', p.curve, 8);
      else endDot(ctx, x1, y, rad, p.curve, p.paper, set.hiClosed);
      ctx.restore();
      ctx.fillStyle = j === s.k ? p.ink : p.ink2;
      ctx.font = `${j === s.k ? 600 : 400} 11px ${p.fontUi}`;
      ctx.textAlign = 'right';
      ctx.fillText(`F${sub(j)}`, box.x - 6, y);
    }
    if (rQ) {
      ctx.textAlign = 'right';
      ctx.font = `11px ${p.fontUi}`;
      ctx.fillStyle = p.ink2;
      ctx.fillText('F_j ∩ ℚ', box.x + box.w, box.y - 14);
    }
    ctx.restore();
  };

  const { canvasRef, invalidate } = useFigureCanvas(nested ? drawNested : drawTail, { worldWidth: 1.5, worldHeight: 1, animate: false });
  useEffect(invalidate, [s]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const d = e.key === 'ArrowRight' ? 1 : -1;
      if (nested) userSet({ k: clampInt(s.k + d, 1, K_MAX) });
      else userSet({ N: clampInt(s.N + d, 1, nm) });
    } else if (!nested && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      userSet({ ei: clampInt(s.ei + (e.key === 'ArrowDown' ? 1 : -1), 0, EPS.length - 1) });
    }
  };

  const seqsOffered = props.seqs ?? [];
  const nestsOffered = props.nests ?? [];
  const spacesOffered = (props.spaces ?? []).filter((sp) => (nested ? sp === 'R' || sp === 'Q' : true));

  const spacePicker =
    spacesOffered.length > 1 ? (
      <div class="group" role="group" aria-label="המרחב">
        {spacesOffered.map((sp) => (
          <Toggle key={sp} label={<bdi dir="ltr">{SPACE_NAME[sp]}</bdi>} on={s.space === sp} onChange={() => userSet({ space: sp })} />
        ))}
      </div>
    ) : null;

  const tailReadout = (
    <>
      <span data-readout="N">
        <b class="q">N = {s.N}</b>, <b class="q">ε = {fmt(eps)}</b>
      </span>
      <span data-readout="D">
        פיזור הזנב: <b class="q">D_N = {fmt(D)}</b>
        {Number.isFinite(D) ? (seq.attained(s.N) ? ' (מתקבל)' : ' (לא מתקבל)') : ''}
      </span>
      <span data-readout="verdict">
        {within ? (
          <>
            <b class="q">D_N &lt; ε</b>: כן.
          </>
        ) : (
          <>
            <b class="q">D_N &lt; ε</b>: לא.
          </>
        )}
      </span>
      <span data-readout="limit">
        {seq.limit === null ? (
          'אין גבול.'
        ) : seq.limitNever ? (
          <>
            מפלס הגבול <b class="q">{seq.limitLabel}</b> אינו נקודה של המרחב.
          </>
        ) : limitInSpace(seq, s.space) ? (
          <>
            הגבול <b class="q">{seq.limitLabel}</b> נמצא במרחב {spaceWord}.
          </>
        ) : (
          <>
            הגבול <b class="q">{seq.limitLabel}</b> אינו נמצא במרחב {spaceWord}.
          </>
        )}
      </span>
      {cmp && (
        <span data-readout="gap">
          <b class="q">|x_N − y_N| = {fmt(gap(seq, cmp, s.N))}</b>
        </span>
      )}
    </>
  );

  const nestReadout = (
    <>
      <span data-readout="k">
        <b class="q">k = {s.k}</b>
      </span>
      <span data-readout="diam">
        הקוטר: <b class="q">diam F_k = {fmt(diam)}</b>
      </span>
      <span data-readout="intersection">
        {inter !== null ? (
          <>
            החיתוך של כל הקבוצות F_j: הנקודה <b class="q">{nestDef.pointLabel}</b>, והיא נמצאת במרחב.
          </>
        ) : missing !== null ? (
          <>
            החיתוך של כל הקבוצות F_j: <b class="q">ריק</b>, כי הנקודה {nestDef.pointLabel} אינה במרחב {SPACE_NAME[nSpace]}.
          </>
        ) : (
          <>
            החיתוך של כל הקבוצות F_j: <b class="q">ריק</b>.
          </>
        )}
      </span>
    </>
  );

  const tailLabel = `איור חי: הסדרה xₙ כנקודות, הזנב מ-N והלאה כפס בין האינפימום לסופרמום שלו, ומקטע ברוחב ε להשוואה. במקלדת: חץ ימינה ושמאלה משנה את N, חץ למטה מצמצם את ε. ${tailSentence()}`;
  const nestLabel = `איור חי: קבוצות מקוננות F₁ ⊇ F₂ ⊇ … על הישר, כל קבוצה בשורה. קצה סגור מלא, קצה פתוח חלול, קרן מסתיימת בחץ. במקלדת: חץ ימינה ושמאלה משנה את k. ${nestSentence()}`;

  return (
    <SimShell
      fig={props.id}
      label={nested ? nestLabel : tailLabel}
      canvasRef={canvasRef}
      aspect={nested ? 1.3 : 1.5}
      live={live}
      tasks={tasks}
      onKeyDown={onKeyDown}
      onReset={() => {
        setS(fresh(props));
        setLive('האיור אופס.');
      }}
      readout={nested ? nestReadout : tailReadout}
      controls={
        nested ? (
          <>
            {nestsOffered.length > 1 && (
              <div class="group" role="group" aria-label="הקבוצות">
                {nestsOffered.filter(isNest).map((id) => (
                  <Toggle key={id} label={<bdi dir="ltr">{NESTS[id].name}</bdi>} on={s.nest === id} onChange={() => userSet({ nest: id, k: 1 })} />
                ))}
              </div>
            )}
            {spacePicker}
            <Slider label="k" value={s.k} min={1} max={K_MAX} step={1} format={(v) => String(Math.round(v))} onChange={(v) => userSet({ k: Math.round(v) })} />
          </>
        ) : (
          <>
            {seqsOffered.length > 1 && (
              <div class="group" role="group" aria-label="הסדרה">
                {seqsOffered.filter(isSeq).map((id) => (
                  <Toggle key={id} label={<bdi dir="ltr">{TAILS[id].name}</bdi>} on={s.seq === id} onChange={() => userSet({ seq: id, N: 1, compare: s.compare === id ? null : s.compare })} />
                ))}
              </div>
            )}
            {spacePicker}
            <Slider label="N" value={s.N} min={1} max={nm} step={1} format={(v) => String(Math.round(v))} onChange={(v) => userSet({ N: Math.round(v) })} />
            <Slider
              label="ε"
              value={s.ei}
              min={0}
              max={EPS.length - 1}
              step={1}
              format={(v) => fmt(EPS[Math.round(v)])}
              onChange={(v) => userSet({ ei: Math.round(v) })}
            />
          </>
        )
      }
    />
  );
}

