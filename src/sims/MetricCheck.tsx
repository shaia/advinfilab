/**
 * Lesson 1.1's figure: is this a metric? Two modes.
 *
 * - 'line': three points x, y, z on the real line, which the student drags, and a candidate distance d from a
 *   preset list (some metrics, some not). Below the line, the triangle inequality as two bars: d(x,z) on top,
 *   d(x,y) + d(y,z) stacked below it, with a dashed guide at the end of the top bar. A verdict mark beside the
 *   bars is filled when the inequality holds for this triple and hollow with a ring when it fails (shape, not
 *   only colour). The zero axiom is checked at the pairs of the triple and at d(x,x).
 * - 'sup': two functions f and g on a closed interval, a probe t the student drags, and the gap |f(t) − g(t)| as
 *   a vertical segment. The sup metric is the largest such gap over the whole interval, which need not be at an
 *   end: a toggle marks the exact maximum (proved in the lesson).
 *
 * Every value comes from src/math/axioms.ts. One triple that breaks an axiom proves "not a metric"; triples that
 * pass prove nothing about the others, and the caption says so.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { CANDIDATES, PAIRS, gridPoint, triangleVerdict, zeroAxiomAt, type DistId, type PairId } from '~/math/axioms';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { withAlpha } from './core/ink';
import { drawAxes, drawCurve, insetBox, makePlot, type Plot } from './core/plot';
import SimShell, { Toggle, type TaskDef } from './core/SimShell';

type Mode = 'line' | 'sup';
type Which = 'x' | 'y' | 'z';

const TASK_LABEL: Record<string, string> = {
  equality: 'עם ⁦|x − y|⁩, מצאו שלוש נקודות שונות שבהן אי-שוויון המשולש מתקיים בשוויון.',
  'break-square': 'עם ⁦(x − y)²⁩, מצאו שלשה x, y, z שבה אי-שוויון המשולש נכשל.',
  'zero-fail': 'עם ⁦|x² − y²|⁩, מצאו שתי נקודות שונות שהמרחק ביניהן 0.',
  'find-sup': 'בזוג ⁦sin, cos⁩, הזיזו את t למקום שבו הפער בין הגרפים הגדול ביותר.',
};

/** the grid is in tenths, kept as integers so that equal points compare equal */
const K_MAX = 25;
const fmt = (v: number) => sci(Math.round(v * 1e9) / 1e9, 3).replace(/^-/, '−');
const SUP_STEPS = 100;

interface State {
  dist: DistId;
  /** the points in tenths */
  k: Record<Which, number>;
  sel: Which;
  pair: PairId;
  /** the probe as a step 0…SUP_STEPS of the interval */
  ti: number;
  showSup: boolean;
}

export interface MetricCheckProps {
  id: string;
  mode: Mode;
  dist?: DistId;
  dists?: DistId[];
  /** the points, as numbers on the 0.1 grid */
  x?: number;
  y?: number;
  z?: number;
  pair?: PairId;
  pairs?: PairId[];
  t?: number;
  showSup?: boolean;
  tasks?: string[];
}

const toK = (v: number | undefined, dflt: number) => Math.max(-K_MAX, Math.min(K_MAX, Math.round((v ?? dflt) * 10)));
const tiOf = (pair: PairId, t: number) => {
  const p = PAIRS[pair];
  return Math.max(0, Math.min(SUP_STEPS, Math.round(((t - p.a) / (p.b - p.a)) * SUP_STEPS)));
};
const tOf = (pair: PairId, ti: number) => PAIRS[pair].a + ((PAIRS[pair].b - PAIRS[pair].a) * ti) / SUP_STEPS;

function fresh(p: MetricCheckProps): State {
  const pair = p.pair ?? 'sincos';
  return {
    dist: p.dist ?? 'abs',
    k: { x: toK(p.x, -1), y: toK(p.y, 0.5), z: toK(p.z, 2) },
    sel: 'y',
    pair,
    ti: tiOf(pair, p.t ?? PAIRS[pair].a),
    showSup: p.showSup ?? false,
  };
}

/** The verdicts the figure shows for the current state. */
function lineVerdict(s: State) {
  const c = CANDIDATES[s.dist];
  const [x, y, z] = [gridPoint(s.k.x), gridPoint(s.k.y), gridPoint(s.k.z)];
  const dxz = c.d(x, z);
  const dxy = c.d(x, y);
  const dyz = c.d(y, z);
  const tri = triangleVerdict(c.d, x, y, z);
  // the zero axiom: a point with itself, then the three pairs of the triple
  let zero: string | null = null;
  if (zeroAxiomAt(c.d, x, x)) zero = `d(x,x) = ${fmt(c.d(x, x))} ≠ 0`;
  else
    for (const [a, b, na, nb] of [[x, y, 'x', 'y'], [y, z, 'y', 'z'], [x, z, 'x', 'z']] as const) {
      if (zeroAxiomAt(c.d, a, b) === 'distinct-zero') {
        zero = `${na} ≠ ${nb} אבל d(${na},${nb}) = 0`;
        break;
      }
    }
  return { x, y, z, dxz, dxy, dyz, tri, zero };
}

export default function MetricCheck(props: MetricCheckProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const dragging = useRef<Which | 'probe' | null>(null);
  const geo = useRef<{ lineL: number; lineR: number; lineY: number; plot: Plot | null } | null>(null);
  const mode = props.mode;
  const v = lineVerdict(s);
  const pair = PAIRS[s.pair];
  const t = tOf(s.pair, s.ti);
  const gap = Math.abs(pair.f(t) - pair.g(t));

  /** The student's own change: a text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch, k: { ...s.k, ...(patch.k ?? {}) } };
    setS(next);
    const has = (id: string) => props.tasks?.includes(id);
    if (mode === 'line') {
      const nv = lineVerdict(next);
      const distinct = nv.x !== nv.y && nv.y !== nv.z && nv.x !== nv.z;
      if (has('equality') && next.dist === 'abs' && distinct && nv.tri === 'equal') markTask(`${props.id}:equality`);
      if (has('break-square') && next.dist === 'sq' && nv.tri === 'fails') markTask(`${props.id}:break-square`);
      if (has('zero-fail') && next.dist === 'abs2' && nv.zero !== null) markTask(`${props.id}:zero-fail`);
    } else {
      const np = PAIRS[next.pair];
      const nt = tOf(next.pair, next.ti);
      if (has('find-sup') && next.pair === 'sincos' && patch.ti !== undefined && Math.abs(np.f(nt) - np.g(nt)) >= 0.999 * np.sup) markTask(`${props.id}:find-sup`);
    }
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev, k: { ...prev.k } };
          if (typeof st.dist === 'string' && st.dist in CANDIDATES) next.dist = st.dist as DistId;
          for (const w of ['x', 'y', 'z'] as const) if (typeof st[w] === 'number') next.k[w] = toK(st[w] as number, 0);
          if (typeof st.pair === 'string' && st.pair in PAIRS) next.pair = st.pair as PairId;
          if (typeof st.t === 'number') next.ti = tiOf(next.pair, st.t);
          if (typeof st.showSup === 'boolean') next.showSup = st.showSup;
          return next;
        });
      }),
    [props.id],
  );

  const describe = () => {
    if (mode === 'line') {
      const c = CANDIDATES[s.dist];
      const tri =
        v.tri === 'fails' ? 'אי-שוויון המשולש נכשל בשלשה הזו.' : v.tri === 'equal' ? 'אי-שוויון המשולש מתקיים בשוויון.' : 'אי-שוויון המשולש מתקיים.';
      return `d(x,y) = ${c.formula}. x = ${fmt(v.x)}, y = ${fmt(v.y)}, z = ${fmt(v.z)}. d(x,z) = ${fmt(v.dxz)}, d(x,y) + d(y,z) = ${fmt(v.dxy + v.dyz)}: ${tri} ${v.zero ? `אקסיומת האפס נכשלת: ${v.zero}.` : ''}`;
    }
    return `f(x) = ${pair.fName}, g(x) = ${pair.gName}. t = ${fmt(t)}, |f(t) − g(t)| = ${fmt(gap)}.${s.showSup ? ` המרחק במטריקת הסופרמום: ${fmt(pair.sup)}.` : ''}`;
  };

  useEffect(() => {
    const id = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(id);
  }, [s]);

  const draw = (fi: FrameInfo) => (mode === 'line' ? drawLine(fi) : drawSup(fi));

  const drawLine = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const padX = narrow ? 18 : 28;
    const lineL = padX;
    const lineR = view.w - padX;
    const lineY = view.h * 0.24;
    geo.current = { lineL, lineR, lineY, plot: null };
    const px = (u: number) => lineL + ((u + K_MAX / 10) / (2 * K_MAX / 10)) * (lineR - lineL);

    // the number line with integer ticks
    ctx.save();
    ctx.strokeStyle = p.ink3;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(lineL, lineY);
    ctx.lineTo(lineR, lineY);
    ctx.stroke();
    ctx.fillStyle = p.ink3;
    ctx.font = `12px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let n = -2; n <= 2; n++) {
      ctx.beginPath();
      ctx.moveTo(px(n), lineY - 5);
      ctx.lineTo(px(n), lineY + 5);
      ctx.stroke();
      ctx.fillText(n < 0 ? `−${-n}` : String(n), px(n), lineY + 8);
    }
    ctx.restore();

    // the three points; points at the same place are drawn with their labels stacked
    const order: Which[] = ['x', 'y', 'z'];
    const seen = new Map<number, number>();
    for (const w of order) {
      const k = s.k[w];
      const level = seen.get(k) ?? 0;
      seen.set(k, level + 1);
      const cx = px(k / 10);
      ctx.save();
      ctx.fillStyle = p.curve;
      ctx.beginPath();
      ctx.arc(cx, lineY, 6, 0, 2 * Math.PI);
      ctx.fill();
      if (s.sel === w) {
        ctx.strokeStyle = p.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, lineY, 10, 0, 2 * Math.PI);
        ctx.stroke();
      }
      ctx.fillStyle = p.ink;
      ctx.font = `700 15px ${p.fontUi}`;
      ctx.direction = 'ltr';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(w, cx, lineY - 12 - level * 17);
      ctx.restore();
    }

    // the triangle inequality as bars
    const labelW = narrow ? 92 : 128;
    const barL = lineL + labelW;
    const barR = lineR - 40;
    const sum = v.dxy + v.dyz;
    const top = Math.max(v.dxz, sum, 0.5);
    const bx = (u: number) => barL + (u / top) * (barR - barL);
    const row1 = view.h * 0.55;
    const row2 = view.h * 0.78;
    const bh = narrow ? 18 : 22;
    ctx.save();
    ctx.font = `600 ${narrow ? 12 : 13}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = p.ink;
    ctx.fillText('d(x,z)', lineL, row1);
    ctx.fillText('d(x,y)+d(y,z)', lineL, row2);
    ctx.fillStyle = p.ink;
    ctx.fillRect(barL, row1 - bh / 2, bx(v.dxz) - barL, bh);
    ctx.fillStyle = p.accent;
    ctx.fillRect(barL, row2 - bh / 2, bx(v.dxy) - barL, bh);
    ctx.fillStyle = withAlpha(p.accent, 0.45);
    ctx.fillRect(bx(v.dxy), row2 - bh / 2, bx(sum) - bx(v.dxy), bh);
    ctx.strokeStyle = p.paper;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx(v.dxy), row2 - bh / 2, bx(sum) - bx(v.dxy), bh);
    // the guide at the end of d(x,z): the lower bar must reach it
    ctx.strokeStyle = p.ink2;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(bx(v.dxz), row1 - bh / 2 - 4);
    ctx.lineTo(bx(v.dxz), row2 + bh / 2 + 4);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = p.ink2;
    ctx.textBaseline = 'bottom';
    ctx.fillText(fmt(v.dxz), Math.min(bx(v.dxz) + 4, barR - 10), row1 - bh / 2 - 2);
    ctx.fillText(fmt(sum), Math.min(bx(sum) + 4, barR - 10), row2 - bh / 2 - 2);
    ctx.restore();

    // the verdict mark: filled when the inequality holds, hollow with a ring when it fails
    drawMark(ctx, p, lineR - 14, (row1 + row2) / 2, v.tri !== 'fails');
  };

  const drawSup = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const box = insetBox({ x: 0, y: 0, w: view.w, h: view.h }, { l: narrow ? 40 : 48, r: 16, t: 18, b: 40 });
    const ys = Array.from({ length: 201 }, (_, i) => {
      const u = pair.a + ((pair.b - pair.a) * i) / 200;
      return [pair.f(u), pair.g(u)];
    }).flat();
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    const pad = 0.12 * (hi - lo);
    const ticks = s.pair === 'sincos' ? [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI] : undefined;
    const tickName = (u: number) => (s.pair === 'sincos' ? (['0', 'π/4', 'π/2', '3π/4', 'π'][Math.round(u / (Math.PI / 4))] ?? '') : fmt(u));
    const plot = makePlot(box, { min: pair.a, max: pair.b, label: 'x', ticks, format: tickName }, { min: lo - pad, max: hi + pad });
    geo.current = { lineL: 0, lineR: 0, lineY: 0, plot };
    drawAxes(ctx, plot, p);
    drawCurve(ctx, plot, pair.f, { color: p.curve, width: 2.4 });
    drawCurve(ctx, plot, pair.g, { color: p.curve2, width: 2.4, dash: [7, 4] });

    // the curve names at the right end
    ctx.save();
    ctx.font = `600 13px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    const xe = pair.a + 0.97 * (pair.b - pair.a);
    ctx.fillStyle = p.curve;
    ctx.fillText(`f = ${pair.fName}`, plot.px(xe), plot.py(pair.f(xe)) - 6);
    ctx.fillStyle = p.curve2;
    ctx.textBaseline = 'top';
    ctx.fillText(`g = ${pair.gName}`, plot.px(xe), plot.py(pair.g(xe)) + 6);
    ctx.restore();

    const seg = (u: number, color: string, w: number, dash: number[]) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(plot.px(u), plot.py(pair.f(u)));
      ctx.lineTo(plot.px(u), plot.py(pair.g(u)));
      ctx.stroke();
      ctx.restore();
    };
    if (s.showSup) {
      seg(pair.argSup, p.limit, 2.4, [6, 4]);
      ctx.save();
      ctx.fillStyle = p.limit;
      ctx.font = `600 13px ${p.fontUi}`;
      ctx.direction = 'ltr';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`sup = ${fmt(pair.sup)}`, plot.px(pair.argSup), box.y + 14);
      ctx.restore();
    }
    // the probe: the gap at t, with a handle on the axis
    seg(t, p.eps, 3, []);
    ctx.save();
    ctx.fillStyle = p.eps;
    ctx.beginPath();
    ctx.arc(plot.px(t), box.y + box.h, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.font = `700 14px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const ym = (plot.py(pair.f(t)) + plot.py(pair.g(t))) / 2;
    const right = plot.px(t) < box.x + box.w - 70;
    ctx.textAlign = right ? 'left' : 'right';
    ctx.fillText(fmt(gap), plot.px(t) + (right ? 7 : -7), ym);
    ctx.restore();
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1.4, worldHeight: 1, animate: false });
  useEffect(invalidate, [s]);

  /** Which point a pointer grabs: the nearest one on the line. */
  const kFromPointer = (e: PointerEvent) => {
    const g = geo.current;
    if (!g) return null;
    const u = ((e.offsetX - g.lineL) / (g.lineR - g.lineL)) * (2 * K_MAX) - K_MAX;
    return Math.max(-K_MAX, Math.min(K_MAX, Math.round(u)));
  };
  const tiFromPointer = (e: PointerEvent) => {
    const plot = geo.current?.plot;
    if (!plot) return null;
    return Math.max(0, Math.min(SUP_STEPS, Math.round(((e.offsetX - plot.box.x) / plot.box.w) * SUP_STEPS)));
  };
  const onPointerDown = (e: PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (mode === 'sup') {
      const ti = tiFromPointer(e);
      if (ti === null) return;
      dragging.current = 'probe';
      if (ti !== s.ti) userSet({ ti });
      return;
    }
    const k = kFromPointer(e);
    if (k === null) return;
    // grab the nearest point; on a tie keep the selected one
    const order: Which[] = [s.sel, ...(['x', 'y', 'z'] as Which[]).filter((w) => w !== s.sel)];
    const w = order.reduce((best, c) => (Math.abs(s.k[c] - k) < Math.abs(s.k[best] - k) ? c : best), order[0]);
    dragging.current = w;
    if (k !== s.k[w] || w !== s.sel) userSet({ sel: w, k: { ...s.k, [w]: k } });
  };
  const onPointerMove = (e: PointerEvent) => {
    const w = dragging.current;
    if (!w) return;
    if (w === 'probe') {
      const ti = tiFromPointer(e);
      if (ti !== null && ti !== s.ti) userSet({ ti });
      return;
    }
    const k = kFromPointer(e);
    if (k !== null && k !== s.k[w]) userSet({ k: { ...s.k, [w]: k } });
  };
  const onPointerUp = () => {
    dragging.current = null;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (mode === 'line' && (e.key === 'x' || e.key === 'y' || e.key === 'z')) {
      e.preventDefault();
      setS({ ...s, sel: e.key });
      return;
    }
    // PageUp / PageDown move ten steps: the probe has 100 positions, too many to walk one key at a time
    const big = mode === 'sup' ? 10 : 5;
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'PageUp' ? big : e.key === 'PageDown' ? -big : 0;
    if (!dir) return;
    e.preventDefault();
    if (mode === 'sup') userSet({ ti: Math.max(0, Math.min(SUP_STEPS, s.ti + dir)) });
    else userSet({ k: { ...s.k, [s.sel]: Math.max(-K_MAX, Math.min(K_MAX, s.k[s.sel] + dir)) } });
  };

  const dists = props.dists ?? [];
  const pairs = props.pairs ?? [];
  const c = CANDIDATES[s.dist];
  return (
    <SimShell
      fig={props.id}
      label={
        mode === 'line'
          ? `איור חי: שלוש נקודות x, y, z על ציר המספרים ופונקציית מרחק מועמדת. מתחת לציר שני פסים: d(x,z), ומתחתיו d(x,y) + d(y,z). סימן מלא פירושו שאי-שוויון המשולש מתקיים בשלשה, וחלול עם טבעת פירושו שהוא נכשל. גררו נקודה; במקלדת: x, y או z בוחרים נקודה, והחצים מזיזים אותה, ו-PageUp או PageDown חמישה צעדים. ${describe()}`
          : `איור חי: הגרפים של שתי פונקציות על קטע, ונקודה t שבה מצויר הפער ביניהן. מטריקת הסופרמום היא הפער הגדול ביותר על כל הקטע. גררו את t; במקלדת: החצים מזיזים אותה, ו-PageUp או PageDown מזיזים אותה עשרה צעדים. ${describe()}`
      }
      canvasRef={canvasRef}
      aspect={1.4}
      live={live}
      tasks={tasks}
      cursor="ew-resize"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onReset={() => {
        setS(fresh(props));
        setLive('האיור אופס.');
      }}
      readout={
        mode === 'line' ? (
          <>
            <span data-readout="dist">
              <bdi dir="ltr" class="q">
                d(x,y) = {c.formula}
              </bdi>
            </span>
            <span data-readout="points">
              <b class="q">
                x = {fmt(v.x)}, y = {fmt(v.y)}, z = {fmt(v.z)}
              </b>
            </span>
            <span data-readout="triangle">
              <b class="q">d(x,z) = {fmt(v.dxz)}</b>, <b class="q">d(x,y) + d(y,z) = {fmt(v.dxy + v.dyz)}</b>:{' '}
              {v.tri === 'fails' ? 'אי-שוויון המשולש נכשל בשלשה הזו.' : v.tri === 'equal' ? 'אי-שוויון המשולש מתקיים, בשוויון.' : 'אי-שוויון המשולש מתקיים בשלשה הזו.'}
            </span>
            <span data-readout="zero">
              {v.zero ? (
                <>
                  אקסיומת האפס נכשלת: <b class="q">{v.zero}</b>
                </>
              ) : (
                <>אקסיומת האפס מתקיימת בנקודות האלה.</>
              )}
            </span>
          </>
        ) : (
          <>
            <span data-readout="gap">
              <b class="q">
                t = {fmt(t)}, |f(t) − g(t)| = {fmt(gap)}
              </b>
            </span>
            {s.showSup && (
              <span data-readout="sup">
                המרחק במטריקת הסופרמום: <b class="q">{fmt(pair.sup)}</b>
              </span>
            )}
          </>
        )
      }
      controls={
        <>
          {mode === 'line' && dists.length > 1 && (
            <div class="group" role="group" aria-label="פונקציית המרחק">
              {dists.map((id) => (
                <Toggle key={id} label={<bdi dir="ltr">{CANDIDATES[id].formula}</bdi>} on={s.dist === id} onChange={() => userSet({ dist: id })} />
              ))}
            </div>
          )}
          {mode === 'line' && (
            <div class="group" role="group" aria-label="הנקודה שזזה במקלדת">
              {(['x', 'y', 'z'] as Which[]).map((w) => (
                <Toggle key={w} label={<bdi dir="ltr">{w}</bdi>} on={s.sel === w} onChange={() => setS({ ...s, sel: w })} />
              ))}
            </div>
          )}
          {mode === 'sup' && pairs.length > 1 && (
            <div class="group" role="group" aria-label="זוג הפונקציות">
              {pairs.map((id) => (
                <Toggle key={id} label={<bdi dir="ltr">{`${PAIRS[id].fName}, ${PAIRS[id].gName}`}</bdi>} on={s.pair === id} onChange={() => userSet({ pair: id, ti: 0 })} />
              ))}
            </div>
          )}
          {mode === 'sup' && (
            <div class="group">
              <Toggle label="הראו את הפער הגדול ביותר" on={s.showSup} onChange={(on) => userSet({ showSup: on })} />
            </div>
          )}
        </>
      }
    />
  );
}

function drawMark(ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number, ok: boolean) {
  ctx.save();
  if (ok) {
    ctx.fillStyle = p.pointIn;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, 2 * Math.PI);
    ctx.fill();
  } else {
    ctx.fillStyle = p.paper;
    ctx.strokeStyle = p.pointOut;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, 2 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}
