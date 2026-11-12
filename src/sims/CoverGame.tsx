/**
 * Lesson 3.2's figure: covering a subset X of the line by open intervals and choosing finitely many of them.
 * X sits on the axis (an interval as a thick bar with filled / hollow ends, the sequence set {1/n} ∪ {0} as dots).
 * The chosen sets are bars above it in ink, each in its own row, with hollow ends (they are open); in the finite
 * family W₁…W₅ the sets not chosen are dashed and faint. What is left uncovered is drawn hollow in the "outside" colour.
 * With the probe on, a point x (triangle) and the open ball B_X(x, δ) of the space X are drawn as a cool band; when
 * the ball lies in a chosen set, that set turns green and the band is filled, otherwise the band is dashed and hollow.
 * With the Lebesgue toggle on, the readout gives the largest Lebesgue number of the chosen sets and its worst point.
 *
 * Every decision comes from src/math/cover.ts in exact rational arithmetic. The figure holds finitely many sets: it
 * shows, it does not prove, and the caption says so. No animation: every frame is a still state.
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  BLOCKS,
  GRID_DEN,
  PRESETS,
  ballHome,
  covers,
  describeCover,
  eq,
  fewestBlocks,
  fmtRat,
  largestLebesgue,
  minPrefixN,
  onGrid,
  pointIv,
  selected,
  toNumber,
  uncoveredInterval,
  uncoveredSeq,
  uncoveredText,
  type CoverState,
  type IntervalSet,
  type OpenIv,
  type PresetId,
  type SeqSet,
} from '~/math/cover';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

/** a left-to-right island inside Hebrew text (U+2066 … U+2069) */
const ltr = (s: string) => `⁦${s}⁩`;

const TASK_LABEL: Record<string, string> = {
  'inner-min': `ב-${ltr('X = [0.03, 0.97]')} עם הקטעים ${ltr('U_n = (1/n, 1)')}: מצאו את ה-N הקטן ביותר שבו ${ltr('U₂, …, U_N')} מכסים את X.`,
  'open-gap': `ב-${ltr('X = (0, 1)')} עם אותם קטעים: הגדילו את N עד ${ltr('N = 200')}. האם יש N שבו ${ltr('U₂, …, U_N')} מכסים את X?`,
  'K-min': `ב-${ltr('K = {0} ∪ {1/n}')} עם ${ltr('V₀')} דלוקה: מצאו את ה-N הקטן ביותר שבו ${ltr('V₀, V₁, …, V_N')} מכסות את K.`,
  fewest: `ב-${ltr('[0, 1]')}: בחרו מבין ${ltr('W₁, …, W₅')} תת-כיסוי עם כמה שפחות קטעים.`,
  lebesgue: `כשכל חמשת הקטעים ${ltr('W₁, …, W₅')} נבחרו, ובלי להדליק את מספר לבג: העבירו את δ אל ה-δ הגדול ביותר שעבורו כל כדור ${ltr('B(x, δ)')} של ${ltr('[0, 1]')} נכנס לאחד מהם.`,
};

const PRESET_LABEL = (id: PresetId) => `${PRESETS[id].setText}: ${PRESETS[id].familyText}`;

export interface CoverGameProps {
  id: string;
  preset?: PresetId;
  presets?: PresetId[];
  /** prefix families: the last index N */
  n?: number;
  v0?: boolean;
  /** blocks: the chosen W_j, 1-based */
  picks?: number[];
  x?: number;
  delta?: number;
  showProbe?: boolean;
  showL?: boolean;
  /** the probe controls are offered at all */
  probe?: boolean;
  tasks?: string[];
}

interface State {
  preset: PresetId;
  n: number;
  v0: boolean;
  picks: boolean[];
  x: number;
  delta: number;
  showProbe: boolean;
  showL: boolean;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const toPicks = (a: number[] | undefined) => BLOCKS.map((_, i) => (a ?? [1, 2, 3, 4, 5]).includes(i + 1));
const DELTA_MIN = 1 / GRID_DEN;
const DELTA_MAX = 0.5;

/** the x-range of the probe: X itself, one grid step inside an open end */
function xRange(id: PresetId): [number, number] {
  const X = PRESETS[id].set;
  if (X.kind !== 'interval') return [0, 1];
  return [toNumber(X.lo) + (X.loOpen ? 1 / GRID_DEN : 0), toNumber(X.hi) - (X.hiOpen ? 1 / GRID_DEN : 0)];
}
const snapX = (id: PresetId, v: number) => {
  const [a, b] = xRange(id);
  return toNumber(onGrid(clamp(v, a, b)));
};
const snapD = (v: number) => toNumber(onGrid(clamp(v, DELTA_MIN, DELTA_MAX)));
const defaultN = (id: PresetId) => (PRESETS[id].family === 'tail' ? 5 : PRESETS[id].family === 'points' ? 3 : 0);

function fresh(p: CoverGameProps): State {
  const preset: PresetId = p.preset && p.preset in PRESETS ? p.preset : 'tail-inner';
  const pr = PRESETS[preset];
  return {
    preset,
    n: clamp(Math.round(p.n ?? defaultN(preset)), pr.nMin, Math.max(pr.nMin, pr.nMax)),
    v0: p.v0 ?? pr.allowV0,
    picks: toPicks(p.picks),
    x: snapX(preset, p.x ?? 0.5),
    delta: snapD(p.delta ?? 0.1),
    showProbe: p.showProbe ?? false,
    showL: p.showL ?? false,
  };
}

const Q = (p: { children: ComponentChildren }) => (
  <b class="q">
    <bdi dir="ltr">{p.children}</bdi>
  </b>
);

export default function CoverGame(props: CoverGameProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const geo = useRef<{ px: (v: number) => number; wx: (sx: number) => number; base: number; rows: { iv: OpenIv; y: number; idx: number }[] } | null>(null);
  const dragging = useRef(false);
  /** the picks array the last text step set: a selection that is exactly this object is not the student's */
  const stepPicks = useRef<boolean[] | null>(null);
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));

  const pr = PRESETS[s.preset];
  const sel = { n: s.n, v0: s.v0, picks: s.picks };
  const ivs = selected(pr, sel);
  const ok = covers(pr.set, ivs);
  const isIv = pr.set.kind === 'interval';
  const X = pr.set as IntervalSet;
  const xR = onGrid(s.x);
  const dR = onGrid(s.delta);
  const probeOn = isIv && s.showProbe && props.probe !== false;
  const home = probeOn ? ballHome(X, ivs, xR, dR) : null;
  const leb = isIv ? largestLebesgue(X, ivs) : null;

  const cs = (): CoverState => ({ preset: s.preset, sel, x: s.x, delta: s.delta, showProbe: probeOn, showL: s.showL && isIv });

  /**
   * The student's own change: a text step sets state through subscribeSteps and never ticks a task. Each task ticks
   * only on a patch that moves the quantity it asks about (N, V₀, the picks, δ), so dragging x or switching the probe
   * on over a state a step produced ticks nothing; `fewest` also skips exactly the picks object a step set.
   */
  const userSet = (patch: Partial<State>) => {
    const next: State = { ...s, ...patch };
    if (patch.preset !== undefined && patch.preset !== s.preset) {
      const p2 = PRESETS[next.preset];
      next.n = defaultN(next.preset);
      next.v0 = p2.allowV0;
      next.x = snapX(next.preset, next.x);
      if (patch.picks === undefined) next.picks = toPicks(undefined);
    }
    setS(next);
    const has = (t: string) => props.tasks?.includes(t);
    const p2 = PRESETS[next.preset];
    const sel2 = selected(p2, { n: next.n, v0: next.v0, picks: next.picks });
    const ok2 = covers(p2.set, sel2);
    const movedN = patch.n !== undefined;
    const ownPicks = patch.picks !== undefined && next.picks !== stepPicks.current;
    if (has('inner-min') && movedN && next.preset === 'tail-inner' && ok2 && next.n === minPrefixN(p2, false)) markTask(`${props.id}:inner-min`);
    if (has('open-gap') && movedN && next.preset === 'tail-open' && next.n === p2.nMax) markTask(`${props.id}:open-gap`);
    if (has('K-min') && (movedN || patch.v0 !== undefined) && next.preset === 'points-K' && next.v0 && ok2 && next.n === minPrefixN(p2, true)) markTask(`${props.id}:K-min`);
    if (has('fewest') && ownPicks && next.preset === 'blocks' && ok2 && sel2.length === fewestBlocks(p2).count) markTask(`${props.id}:fewest`);
    if (has('lebesgue') && next.preset === 'blocks' && sel2.length === BLOCKS.length && !next.showL && patch.delta !== undefined) {
      const L = largestLebesgue(p2.set as IntervalSet, sel2);
      if (L && L.value !== null && eq(onGrid(next.delta), L.value)) markTask(`${props.id}:lebesgue`);
    }
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.preset === 'string' && st.preset in PRESETS) {
            next.preset = st.preset as PresetId;
            next.n = defaultN(next.preset);
            next.v0 = PRESETS[next.preset].allowV0;
          }
          const p2 = PRESETS[next.preset];
          if (typeof st.n === 'number') next.n = clamp(Math.round(st.n), p2.nMin, Math.max(p2.nMin, p2.nMax));
          if (typeof st.v0 === 'boolean') next.v0 = st.v0 && p2.allowV0;
          if (Array.isArray(st.picks)) {
            next.picks = toPicks(st.picks as number[]);
            stepPicks.current = next.picks;
          }
          if (typeof st.x === 'number') next.x = snapX(next.preset, st.x);
          else next.x = snapX(next.preset, next.x);
          if (typeof st.delta === 'number') next.delta = snapD(st.delta);
          if (typeof st.showProbe === 'boolean') next.showProbe = st.showProbe;
          if (typeof st.showL === 'boolean') next.showL = st.showL;
          return next;
        });
      }),
    [props.id],
  );

  useEffect(() => {
    const t = setTimeout(() => setLive(describeCover(cs())), 300);
    return () => clearTimeout(t);
  }, [s]);

  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const padL = narrow ? 14 : 24;
    const padR = narrow ? 14 : 24;
    const [w0, w1] = pr.window;
    const px = (v: number) => padL + ((v - w0) / (w1 - w0)) * (view.w - padL - padR);
    const wx = (sx: number) => w0 + ((sx - padL) / (view.w - padL - padR)) * (w1 - w0);
    const base = view.h - 40;
    const font = (sz: number, bold = false) => `${bold ? '600 ' : ''}${sz}px ${p.fontUi}`;

    const halo = (txt: string, x: number, y: number, align: CanvasTextAlign, color: string, sz = narrow ? 11 : 12) => {
      ctx.save();
      ctx.font = font(sz, true);
      ctx.direction = 'ltr';
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = p.paper;
      ctx.lineWidth = 4;
      ctx.strokeText(txt, x, y);
      ctx.fillStyle = color;
      ctx.fillText(txt, x, y);
      ctx.restore();
    };
    const dot = (x: number, y: number, r: number, filled: boolean, color: string) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = filled ? color : p.paper;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = filled ? 1.2 : 2;
      ctx.stroke();
      ctx.restore();
    };
    const seg = (a: number, b: number, y: number, color: string, width: number, dash: number[] = []) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'butt';
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(px(a), y);
      ctx.lineTo(Math.max(px(b), px(a) + 3), y);
      ctx.stroke();
      ctx.restore();
    };

    // the line: axis with ticks at 0, 1/4, …, 1
    ctx.save();
    ctx.strokeStyle = p.ink3;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(px(w0), base);
    ctx.lineTo(px(w1), base);
    ctx.stroke();
    ctx.fillStyle = p.ink2;
    ctx.font = font(11);
    ctx.direction = 'ltr';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      ctx.beginPath();
      ctx.moveTo(px(t), base + 4);
      ctx.lineTo(px(t), base + 10);
      ctx.stroke();
      ctx.fillText(String(t), px(t), base + 14);
    }
    ctx.restore();

    // the rows of chosen sets (and, for W, the ones not chosen)
    type Row = { iv: OpenIv; chosen: boolean; idx: number };
    const rows: Row[][] = [];
    if (pr.family === 'blocks') BLOCKS.forEach((iv, i) => rows.push([{ iv, chosen: s.picks[i], idx: i }]));
    else if (pr.family === 'tail') {
      const all = ivs;
      const shown = all.length <= 9 ? all : [...all.slice(0, 7), null, all[all.length - 1]];
      shown.forEach((iv, i) => rows.push(iv ? [{ iv, chosen: true, idx: i }] : []));
    } else {
      if (pr.allowV0) rows.push([{ iv: pointIv(0), chosen: s.v0, idx: 0 }]);
      const vs = ivs.filter((v) => v.name !== 'V₀');
      if (vs.length > 0) rows.push(vs.map((iv, i) => ({ iv, chosen: true, idx: i + 1 })));
    }
    const top = 18;
    const gap = Math.min(30, (base - 34 - top) / Math.max(rows.length, 1));
    const rowY = (k: number) => base - 30 - k * gap;
    const hit: { iv: OpenIv; y: number; idx: number }[] = [];
    rows.forEach((row, k) => {
      const y = rowY(k);
      if (row.length === 0) {
        halo('⋮', px(0.5), y, 'center', p.ink2, 14);
        return;
      }
      for (const r of row) {
        const a = Math.max(toNumber(r.iv.l), w0);
        const b = Math.min(toNumber(r.iv.r), w1);
        const isHome = home !== null && home.name === r.iv.name;
        const color = isHome ? p.limit : r.chosen ? p.curve : p.ink3;
        seg(a, b, y, color, r.chosen ? (isHome ? 5 : 3.2) : 1.6, r.chosen ? [] : [5, 4]);
        if (toNumber(r.iv.l) >= w0) dot(px(toNumber(r.iv.l)), y, 3.4, false, color);
        if (toNumber(r.iv.r) <= w1) dot(px(toNumber(r.iv.r)), y, 3.4, false, color);
        if (row.length === 1) halo(r.iv.name, toNumber(r.iv.l) >= w0 ? px(toNumber(r.iv.l)) - 8 : px(w0) + 2, y - 10, toNumber(r.iv.l) >= w0 ? 'right' : 'left', color);
        hit.push({ iv: r.iv, y, idx: r.idx });
      }
      if (row.length > 1) halo(`V₁ … ${row[row.length - 1].iv.name}`, px(0.5), y - 12, 'center', p.curve);
    });
    geo.current = { px, wx, base, rows: hit };

    // the ball B_X(x, δ): a cool band from the axis up to the rows, open ends hollow
    if (probeOn) {
      const xn = toNumber(xR);
      const dn = toNumber(dR);
      const a = Math.max(xn - dn, toNumber(X.lo));
      const b = Math.min(xn + dn, toNumber(X.hi));
      const yTop = rowY(rows.length - 1) - 12;
      ctx.save();
      if (home) {
        ctx.fillStyle = p.deltaBand;
        ctx.fillRect(px(a), yTop, px(b) - px(a), base - yTop);
      }
      ctx.strokeStyle = home ? p.delta : p.pointOut;
      ctx.lineWidth = 1.6;
      ctx.setLineDash(home ? [] : [6, 4]);
      ctx.strokeRect(px(a), yTop, px(b) - px(a), base - yTop);
      ctx.restore();
      halo(`B(${fmtRat(xR)}, ${fmtRat(dR)})`, (px(a) + px(b)) / 2, yTop - 9, 'center', home ? p.delta : p.pointOut);
    }

    // X on the axis
    if (isIv) {
      seg(toNumber(X.lo), toNumber(X.hi), base, p.ink, 6);
      dot(px(toNumber(X.lo)), base, 5, !X.loOpen, p.ink);
      dot(px(toNumber(X.hi)), base, 5, !X.hiOpen, p.ink);
      for (const piece of uncoveredInterval(X, ivs)) {
        const a = toNumber(piece.lo);
        const b = toNumber(piece.hi);
        if (b - a > 1e-12) seg(a, b, base - 9, p.pointOut, 4, [5, 3]);
        dot(px(a), base - 9, 4.5, !piece.loOpen, p.pointOut);
        if (b - a > 1e-12) dot(px(b), base - 9, 4.5, !piece.hiOpen, p.pointOut);
        else {
          ctx.save();
          ctx.strokeStyle = p.pointOut;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(px(a), base - 9, 9, 0, 2 * Math.PI);
          ctx.stroke();
          ctx.restore();
        }
      }
    } else {
      const u = uncoveredSeq(pr.set as SeqSet, ivs);
      const bad = (n: number) => u.ns.includes(n) || (u.tailFrom !== null && n >= u.tailFrom);
      for (let n = 1; n <= 120; n++) {
        const r = n <= 12 ? 4 : 2.6;
        const out = bad(n);
        dot(px(1 / n), base, r, !out, out ? p.pointOut : p.pointIn);
      }
      if ((pr.set as SeqSet).zero) dot(px(0), base, 5, !u.zero, u.zero ? p.pointOut : p.pointIn);
    }

    // the probe point x: a triangle under the axis
    if (probeOn) {
      const tx = px(toNumber(xR));
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(tx, base + 3);
      ctx.lineTo(tx - 7, base + 14);
      ctx.lineTo(tx + 7, base + 14);
      ctx.closePath();
      ctx.fillStyle = p.accent;
      ctx.fill();
      ctx.restore();
    }

    // the worst point of the Lebesgue number
    if (s.showL && leb && leb.value !== null && leb.at) {
      const lx = px(toNumber(leb.at));
      ctx.save();
      ctx.fillStyle = p.limit;
      ctx.beginPath();
      ctx.moveTo(lx, base - 22);
      ctx.lineTo(lx + 6, base - 16);
      ctx.lineTo(lx, base - 10);
      ctx.lineTo(lx - 6, base - 16);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1.6, worldHeight: 1, animate: false });
  useEffect(invalidate, [s]);

  const onPointerDown = (e: PointerEvent) => {
    const g = geo.current;
    if (!g) return;
    if (pr.family === 'blocks') {
      const r = g.rows.find((row) => Math.abs(row.y - e.offsetY) < 10 && g.wx(e.offsetX) >= toNumber(row.iv.l) - 0.03 && g.wx(e.offsetX) <= toNumber(row.iv.r) + 0.03);
      if (r) {
        const picks = [...s.picks];
        picks[r.idx] = !picks[r.idx];
        userSet({ picks });
        return;
      }
    }
    if (probeOn && e.offsetY > g.base - 26) {
      dragging.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      userSet({ x: snapX(s.preset, g.wx(e.offsetX)) });
    }
  };
  const onPointerMove = (e: PointerEvent) => {
    const g = geo.current;
    if (!dragging.current || !g) return;
    const x = snapX(s.preset, g.wx(e.offsetX));
    if (x !== s.x) userSet({ x });
  };
  const onPointerUp = () => {
    dragging.current = false;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      if (probeOn) userSet({ x: snapX(s.preset, s.x + (dir * step) / GRID_DEN) });
      else if (pr.select === 'prefix') userSet({ n: clamp(s.n + dir * step, pr.nMin, pr.nMax) });
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const dir = e.key === 'ArrowUp' ? 1 : -1;
      if (pr.select === 'prefix') userSet({ n: clamp(s.n + dir * step, pr.nMin, pr.nMax) });
      else if (probeOn) userSet({ delta: snapD(s.delta + (dir * step) / GRID_DEN) });
    }
  };

  const offered = (props.presets ?? []).filter((id) => id in PRESETS);
  const [xa, xb] = xRange(s.preset);
  const names = ivs.length === 0 ? '' : ivs.length <= 6 ? ivs.map((v) => v.name).join(', ') : `${ivs[0].name}, …, ${ivs[ivs.length - 1].name}`;
  return (
    <SimShell
      fig={props.id}
      label={`איור חי: קבוצה X על הישר וקטעים פתוחים שמכסים אותה. בוחרים מספר סופי של קטעים ובודקים אם הם מכסים. במקלדת: חצים. ${describeCover(cs())}`}
      canvasRef={canvasRef}
      aspect={1.6}
      live={live}
      tasks={tasks}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      cursor={probeOn ? 'ew-resize' : 'pointer'}
      onReset={() => {
        setS(fresh(props));
        setLive('האיור אופס.');
      }}
      readout={
        <>
          <span data-readout="set">
            <Q>X = {pr.setText}</Q>
          </span>
          <span data-readout="count">
            נבחרו <Q>{ivs.length}</Q> קבוצות{names && <>: <Q>{names}</Q></>}
          </span>
          <span data-readout="covers">
            {ok ? (
              <>הן מכסות את <Q>X</Q>.</>
            ) : (
              <>
                לא מכסות. לא מכוסה: <Q>{uncoveredText(pr.set, ivs)}</Q>
              </>
            )}
          </span>
          {probeOn && (
            <span data-readout="probe">
              {home ? (
                <>
                  <Q>{`B(${fmtRat(xR)}, ${fmtRat(dR)}) ⊆ ${home.name}`}</Q>
                </>
              ) : (
                <>
                  <Q>{`B(${fmtRat(xR)}, ${fmtRat(dR)})`}</Q> אינו מוכל באף קבוצה שנבחרה.
                </>
              )}
            </span>
          )}
          {isIv && s.showL && (
            <span data-readout="lebesgue">
              {leb === null ? (
                <>הקבוצות לא מכסות את <Q>X</Q>: אין מספר לבג לחשב.</>
              ) : leb.value === null ? (
                <>קבוצה אחת מכילה את <Q>X</Q>: כל <Q>δ &gt; 0</Q> הוא מספר לבג.</>
              ) : (
                <>
                  מספר לבג הגדול ביותר: <Q>{fmtRat(leb.value)}</Q>, בנקודה <Q>{fmtRat(leb.at!)}</Q>
                  {leb.atOpenEnd ? ' (כגבול, בקצה פתוח)' : ''}
                </>
              )}
            </span>
          )}
        </>
      }
      controls={
        <>
          {offered.length > 1 && (
            <div class="group" role="group" aria-label="הקבוצה והכיסוי">
              {offered.map((id) => (
                <Toggle key={id} label={<bdi dir="ltr">{PRESET_LABEL(id)}</bdi>} on={s.preset === id} onChange={() => userSet({ preset: id })} />
              ))}
            </div>
          )}
          {pr.select === 'prefix' && <Slider label="N" value={s.n} min={pr.nMin} max={pr.nMax} step={1} format={(v) => String(Math.round(v))} onChange={(v) => userSet({ n: Math.round(v) })} />}
          {pr.allowV0 && <Toggle label={<bdi dir="ltr">V₀ = (−0.15, 0.15)</bdi>} on={s.v0} onChange={(on) => userSet({ v0: on })} />}
          {pr.select === 'pick' && (
            <div class="group" role="group" aria-label="הקטעים שנבחרו">
              {BLOCKS.map((b, i) => (
                <Toggle
                  key={b.name}
                  label={<bdi dir="ltr">{`${b.name} = (${fmtRat(b.l)}, ${fmtRat(b.r)})`}</bdi>}
                  on={s.picks[i]}
                  onChange={(on) => {
                    const picks = [...s.picks];
                    picks[i] = on;
                    userSet({ picks });
                  }}
                />
              ))}
            </div>
          )}
          {isIv && props.probe !== false && (
            <>
              <div class="group">
                <Toggle label="כדור בודק" on={s.showProbe} onChange={(on) => userSet({ showProbe: on })} />
                <Toggle label="מספר לבג" on={s.showL} onChange={(on) => userSet({ showL: on })} />
              </div>
              {s.showProbe && (
                <>
                  <Slider label="x" value={s.x} min={xa} max={xb} step={1 / GRID_DEN} format={(v) => fmtRat(onGrid(v))} onChange={(v) => userSet({ x: snapX(s.preset, v) })} />
                  <Slider label="δ" value={s.delta} min={DELTA_MIN} max={DELTA_MAX} step={1 / GRID_DEN} format={(v) => fmtRat(onGrid(v))} onChange={(v) => userSet({ delta: snapD(v) })} />
                </>
              )}
            </>
          )}
        </>
      }
    />
  );
}
