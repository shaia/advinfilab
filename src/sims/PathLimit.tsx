/**
 * Lesson 5.1's figure: limits of a function of two variables at the origin, along paths and on circles.
 *
 * Upper panel: the square [−1, 1]² shaded by the value of f (the `pos` colour above 0, the `neg` colour below, deeper
 * with |f|), its level curves (solid for positive levels, dashed for negative: never colour alone), and the origin as a
 * hollow ring (f is not defined there).
 * - Path mode: a path to the origin, the ray of a line y = mx or the half of a parabola y = kx² on the side x > 0 or
 *   x < 0, with dots at t = 1, ½, ¼, …; dragging on the plane picks the line or parabola through the pointer.
 *   Lower panel: t ↦ f(γ(t)) on (0, 1], and the limit along the path (closed form) as a dashed line and a filled dot
 *   at t = 0, in the limit colour.
 * - Circle mode: the circle ‖p‖₂ = ρ around the origin (the δ colour) and a hollow ring where |f − 0| is largest on it.
 *   Lower panel: ρ ↦ S(ρ) = sup over the circle of |f − 0| (closed form), with the chosen ρ marked.
 *
 * Every number comes from src/math/pathlimit.ts. Finitely many paths and radii are a probe, never a proof: the caption
 * says so. No animation.
 */

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  ALPHA_MAX,
  ALPHA_MIN,
  K_MAX,
  K_MIN,
  M_MAX,
  M_MIN,
  PRESETS,
  RHO_MAX,
  RHO_MIN,
  describePath,
  fmtNum,
  gamma,
  pathThrough,
  pathValue,
  type Path,
  type PathKind,
  type PresetId,
  type Side,
} from '~/math/pathlimit';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { contourLines } from './core/contour';
import { withAlpha } from './core/ink';
import { drawAxes, drawCurve, insetBox, makePlot, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

/** a left-to-right island inside Hebrew text (U+2066 … U+2069), with no-break spaces so it never wraps */
const ltr = (s: string) => `⁦${s.replace(/ /g, '\u00a0')}⁩`;

const TASK_LABEL: Record<string, string> = {
  'line-04': `בפונקציה ${ltr('xy/(x² + y²)')}: מצאו ישר דרך הראשית שעליו הערך של הפונקציה הוא ${ltr('0.4')}.`,
  'parabola-half': `בפונקציה ${ltr('x²y/(x⁴ + y²)')}: מצאו פרבולה ${ltr('y = kx²')} שלאורכה הגבול הוא ${ltr('½')}.`,
  'circle-small': `בפונקציה ${ltr('x³/(x² + y²)')}, במצב המעגל: הקטינו את ρ עד שהסופרמום על המעגל קטן מ-${ltr('0.05')}.`,
  'parab-circle': `בפונקציה ${ltr('x²y/(x⁴ + y²)')}, במצב המעגל: כווצו את המעגל עד ${ltr('ρ ≤ 0.05')}, וקראו את הסופרמום.`,
  'alpha-one': `בפונקציה ${ltr('|x|^α y/(x² + y²)')} עם ${ltr('α = 1')}: מצאו ישר שלאורכו הגבול הוא ${ltr('½')}.`,
  'alpha-bound': `בפונקציה ${ltr('|x|^α y/(x² + y²)')}, במצב המעגל: בחרו α ו-ρ שבהם הסופרמום על המעגל קטן מ-${ltr('0.05')}.`,
};

type Mode = 'path' | 'circle';

interface State {
  preset: PresetId;
  mode: Mode;
  kind: PathKind;
  m: number;
  k: number;
  side: Side;
  rho: number;
  alpha: number;
}

export interface PathLimitProps {
  id: string;
  preset?: PresetId;
  presets?: PresetId[];
  mode?: Mode;
  path?: PathKind;
  m?: number;
  k?: number;
  side?: Side;
  rho?: number;
  alpha?: number;
  tasks?: string[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const sig3 = (v: number) => (Number.isFinite(v) ? Number(v.toPrecision(3)) : v);
const num = (v: number) => fmtNum(sig3(v));

function fresh(p: PathLimitProps): State {
  return {
    preset: p.preset && p.preset in PRESETS ? p.preset : 'xy',
    mode: p.mode === 'circle' ? 'circle' : 'path',
    kind: p.path === 'parabola' ? 'parabola' : 'line',
    m: r2(clamp(typeof p.m === 'number' ? p.m : 1, M_MIN, M_MAX)),
    k: r2(clamp(typeof p.k === 'number' ? p.k : 1, K_MIN, K_MAX)),
    side: p.side === -1 ? -1 : 1,
    rho: r3(clamp(typeof p.rho === 'number' ? p.rho : 0.5, RHO_MIN, RHO_MAX)),
    alpha: r2(clamp(typeof p.alpha === 'number' ? p.alpha : 1, ALPHA_MIN, ALPHA_MAX)),
  };
}

const pathOf = (s: State): Path => ({ kind: s.kind, m: s.m, k: s.k, side: s.side });

const Q = (p: { children: string }) => (
  <b class="q">
    <bdi dir="ltr">{p.children}</bdi>
  </b>
);

export default function PathLimit(props: PathLimitProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const planeRef = useRef<{ cx: number; cy: number; ppu: number } | null>(null);
  const dragging = useRef(false);
  const shade = useRef<HTMLCanvasElement | null>(null);
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const has = (t: string) => props.tasks?.includes(t) ?? false;

  const pr = PRESETS[s.preset];
  const path = pathOf(s);
  const limit = pr.pathLimit(path, s.alpha);
  const sup = pr.circleSup(s.rho, s.alpha);
  const formula = s.preset === 'alpha' ? `${pr.formula},  α = ${fmtNum(s.alpha)}` : pr.formula;

  // level curves depend only on the function
  const levels = useMemo(
    () =>
      contourLines((x, y) => pr.f(x, y, s.alpha), { xmin: -1, xmax: 1, ymin: -1, ymax: 1 }, { nx: 81, ny: 81, step: 0.1, offset: 0.5, maxLevelsPerCell: 6 }),
    [s.preset, s.alpha],
  );

  /** The student's own change. A text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    setS(next);
    const id = props.id;
    const P = PRESETS[next.preset];
    const L = P.pathLimit(pathOf(next), next.alpha);
    const S = P.circleSup(next.rho, next.alpha);
    const onPath = next.mode === 'path';
    const onCircle = next.mode === 'circle';
    if (has('line-04') && next.preset === 'xy' && onPath && next.kind === 'line' && Math.abs(L - 0.4) < 0.005) markTask(`${id}:line-04`);
    if (has('parabola-half') && next.preset === 'parab' && onPath && next.kind === 'parabola' && Math.abs(L - 0.5) < 0.002)
      markTask(`${id}:parabola-half`);
    if (has('circle-small') && next.preset === 'x3' && onCircle && S < 0.05) markTask(`${id}:circle-small`);
    if (has('parab-circle') && next.preset === 'parab' && onCircle && next.rho <= 0.05 + 1e-9) markTask(`${id}:parab-circle`);
    if (has('alpha-one') && next.preset === 'alpha' && onPath && Math.abs(next.alpha - 1) < 1e-9 && next.kind === 'line' && Math.abs(L - 0.5) < 0.005)
      markTask(`${id}:alpha-one`);
    if (has('alpha-bound') && next.preset === 'alpha' && onCircle && S < 0.05) markTask(`${id}:alpha-bound`);
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.preset === 'string' && st.preset in PRESETS) next.preset = st.preset as PresetId;
          if (st.mode === 'path' || st.mode === 'circle') next.mode = st.mode;
          if (st.path === 'line' || st.path === 'parabola') next.kind = st.path;
          if (typeof st.m === 'number') next.m = r2(clamp(st.m, M_MIN, M_MAX));
          if (typeof st.k === 'number') next.k = r2(clamp(st.k, K_MIN, K_MAX));
          if (st.side === 1 || st.side === -1) next.side = st.side;
          if (typeof st.rho === 'number') next.rho = r3(clamp(st.rho, RHO_MIN, RHO_MAX));
          if (typeof st.alpha === 'number') next.alpha = r2(clamp(st.alpha, ALPHA_MIN, ALPHA_MAX));
          return next;
        });
      }),
    [props.id],
  );

  const limitText = Number.isFinite(limit) ? num(limit) : limit > 0 ? '+∞' : '−∞';
  const describe = () =>
    s.mode === 'path'
      ? `הפונקציה ${formula}. המסילה ${describePath(path)}. הגבול לאורך המסילה: ${limitText}.`
      : `הפונקציה ${formula}. על המעגל ברדיוס ${num(s.rho)} סביב הראשית, הערך המוחלט הגדול ביותר הוא ${num(sup)}.`;
  useEffect(() => {
    const t = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(t);
  }, [s]);

  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const splitY = view.h * 0.64;

    // ---------------- upper panel: the plane
    const outer = insetBox({ x: 0, y: 0, w: view.w, h: splitY }, { l: narrow ? 26 : 32, r: 10, t: narrow ? 46 : 10, b: 22 });
    const side = Math.min(outer.w, outer.h);
    const box = { x: outer.x + (outer.w - side) / 2, y: outer.y + (outer.h - side) / 2, w: side, h: side };
    const ppu = side / 2;
    const cx = box.x + side / 2;
    const cy = box.y + side / 2;
    planeRef.current = { cx, cy, ppu };
    const X = (x: number) => cx + x * ppu;
    const Y = (y: number) => cy - y * ppu;

    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    // shading by the value of f: one pixel per cell of an N × N offscreen canvas, scaled onto the plane. Translucent
    // cells drawn straight onto the plane would overlap (or leave gaps) along every seam and draw a grid over it.
    const N = narrow ? 70 : 96;
    const off = (shade.current ??= document.createElement('canvas'));
    off.width = N;
    off.height = N;
    const oc = off.getContext('2d');
    if (oc) {
      oc.clearRect(0, 0, N, N);
      for (let i = 0; i < N; i++)
        for (let j = 0; j < N; j++) {
          const x = -1 + (2 * (i + 0.5)) / N;
          const y = 1 - (2 * (j + 0.5)) / N;
          const v = pr.f(x, y, s.alpha);
          if (!Number.isFinite(v) || v === 0) continue;
          oc.fillStyle = withAlpha(v > 0 ? p.pos : p.neg, 0.42 * Math.min(1, Math.abs(v) / pr.scale));
          oc.fillRect(i, j, 1, 1);
        }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, box.x, box.y, side, side);
      ctx.imageSmoothingEnabled = true;
    }
    // level curves: solid above 0, dashed below
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    for (const c of levels) {
      ctx.strokeStyle = p.ink3;
      ctx.setLineDash(c.k < 0 ? [4, 3] : []);
      ctx.beginPath();
      c.points.forEach(([x, y], n) => (n ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      if (c.closed) ctx.closePath();
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // axes
    ctx.strokeStyle = p.rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(box.x, cy);
    ctx.lineTo(box.x + side, cy);
    ctx.moveTo(cx, box.y);
    ctx.lineTo(cx, box.y + side);
    ctx.stroke();

    if (s.mode === 'path') {
      // the path γ(t), t ∈ (0, 1], and dots at t = 2^{−j}
      ctx.strokeStyle = p.curve;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let n = 0; n <= 400; n++) {
        const [x, y] = gamma(path, n / 400);
        if (n) ctx.lineTo(X(x), Y(y));
        else ctx.moveTo(X(x), Y(y));
      }
      ctx.stroke();
      ctx.fillStyle = p.curve;
      for (let j = 0; j <= 6; j++) {
        const [x, y] = gamma(path, 2 ** -j);
        ctx.beginPath();
        ctx.arc(X(x), Y(y), 3.4, 0, 2 * Math.PI);
        ctx.fill();
      }
    } else {
      // the disk of radius ρ, its circle, and the point where |f| is largest on it
      ctx.fillStyle = p.deltaBand;
      ctx.beginPath();
      ctx.arc(cx, cy, s.rho * ppu, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = p.delta;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      const [ax, ay] = pr.circleArgmax(s.rho, s.alpha);
      ctx.beginPath();
      ctx.arc(X(ax), Y(ay), 6, 0, 2 * Math.PI);
      ctx.fillStyle = p.paper;
      ctx.fill();
      ctx.strokeStyle = p.pointOut;
      ctx.lineWidth = 2.4;
      ctx.stroke();
    }
    // the origin, outside the domain: a hollow ring
    ctx.beginPath();
    ctx.arc(cx, cy, 4.5, 0, 2 * Math.PI);
    ctx.fillStyle = p.paper;
    ctx.fill();
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();

    // frame and tick labels of the plane
    ctx.save();
    ctx.strokeStyle = p.rule;
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.fillStyle = p.ink2;
    ctx.font = `11px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const v of [-1, 0, 1]) ctx.fillText(String(v), X(v), box.y + side + 4);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const v of [-1, 0, 1]) ctx.fillText(String(v), box.x - 5, Y(v));
    ctx.restore();

    // legend, LTR: in a strip above the plane on a phone (left of the tool buttons), inside it on a desktop
    ctx.save();
    ctx.font = `600 ${narrow ? 11 : 13}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const toolsW = 3 * 34 + 2 * 6 + 8 + 8;
    const legend2 = s.mode === 'path' ? describePath(path) : `‖(x, y)‖₂ = ρ = ${fmtNum(s.rho)}`;
    const lx = narrow ? 8 : box.x + 8;
    const ly = narrow ? 14 : box.y + 14;
    const room = narrow ? Math.max(60, view.w - toolsW - lx) : side - 16;
    if (!narrow) {
      // a paper backing, so the legend stays legible over the shading
      const wText = Math.min(room, Math.max(ctx.measureText(`f = ${formula}`).width, ctx.measureText(legend2).width));
      ctx.fillStyle = withAlpha(p.paper, 0.82);
      ctx.fillRect(lx - 4, ly - 10, wText + 8, 38);
    }
    ctx.fillStyle = p.ink;
    ctx.fillText(`f = ${formula}`, lx, ly, room);
    ctx.fillStyle = s.mode === 'path' ? p.curve : p.delta;
    ctx.fillText(legend2, lx, ly + 18, room);
    ctx.restore();

    // ---------------- lower panel
    const box2 = insetBox({ x: 0, y: splitY, w: view.w, h: view.h - splitY }, { l: narrow ? 34 : 42, r: 12, t: narrow ? 22 : 12, b: 24 });
    let plot: Plot;
    if (s.mode === 'path') {
      const top = s.preset === 'alpha' && s.alpha < 1 ? 1.5 : Math.max(0.6, pr.scale * 1.2);
      plot = makePlot(box2, { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1], format: fmtNum }, { min: -top, max: top, ticks: narrow ? [-top, 0, top].map(r2) : undefined });
      drawAxes(ctx, plot, p);
      if (Number.isFinite(limit)) {
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = p.limit;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(box2.x, plot.py(limit));
        ctx.lineTo(box2.x + box2.w, plot.py(limit));
        ctx.stroke();
        ctx.restore();
      }
      drawCurve(ctx, plot, (t) => (t <= 0 ? NaN : pathValue(pr, path, t, s.alpha)), { color: p.curve, width: 2.2, samples: 400 });
      ctx.save();
      if (Number.isFinite(limit)) {
        ctx.beginPath();
        ctx.arc(plot.px(0), plot.py(limit), 5.5, 0, 2 * Math.PI);
        ctx.fillStyle = p.limit;
        ctx.fill();
      }
      ctx.font = `600 ${narrow ? 11 : 12}px ${p.fontUi}`;
      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = p.curve;
      const lab = `t ↦ f(γ(t)),  t → 0⁺: ${limitText}`;
      if (narrow) ctx.fillText(lab, box2.x, box2.y - 11, box2.w);
      else ctx.fillText(lab, box2.x + 8, box2.y + 10);
      ctx.restore();
    } else {
      const S1 = pr.circleSup(1, s.alpha);
      const top = Math.min(1.5, Math.max(0.6, S1 * 1.15));
      plot = makePlot(box2, { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1], format: fmtNum }, { min: 0, max: top, ticks: narrow ? [0, r2(top / 2), r2(top)] : undefined });
      drawAxes(ctx, plot, p);
      drawCurve(ctx, plot, (r) => (r <= 0 ? NaN : Math.min(top * 1.5, pr.circleSup(r, s.alpha))), { color: p.curve, width: 2.2, samples: 400 });
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = p.delta;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(plot.px(s.rho), box2.y + box2.h);
      ctx.lineTo(plot.px(s.rho), plot.py(Math.min(sup, top)));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(plot.px(s.rho), plot.py(Math.min(sup, top)), 5.5, 0, 2 * Math.PI);
      ctx.fillStyle = p.pointOut;
      ctx.fill();
      ctx.font = `600 ${narrow ? 11 : 12}px ${p.fontUi}`;
      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = p.curve;
      const lab = narrow ? 'ρ ↦ S(ρ)' : 'ρ ↦ S(ρ) = sup { |f(p)| : ‖p‖₂ = ρ }';
      if (narrow) ctx.fillText(lab, box2.x, box2.y - 11);
      else ctx.fillText(lab, box2.x + 8, box2.y + 10);
      ctx.restore();
    }
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1, worldHeight: 1.18, animate: false });
  useEffect(invalidate, [s, levels]);

  const worldFromPointer = (e: PointerEvent): [number, number] | null => {
    const pl = planeRef.current;
    if (!pl) return null;
    const x = (e.offsetX - pl.cx) / pl.ppu;
    const y = (pl.cy - e.offsetY) / pl.ppu;
    if (Math.abs(x) > 1.05 || Math.abs(y) > 1.05) return null;
    return [x, y];
  };
  const fromPoint = (pt: [number, number]) => {
    const [x, y] = pt;
    if (Math.hypot(x, y) < 1e-3) return;
    if (s.mode === 'circle') userSet({ rho: r3(clamp(Math.hypot(x, y), RHO_MIN, RHO_MAX)) });
    else {
      const pth = pathThrough(s.kind, x, y);
      userSet({ m: s.kind === 'line' ? pth.m : s.m, k: s.kind === 'parabola' ? pth.k : s.k, side: pth.side });
    }
  };
  const onPointerDown = (e: PointerEvent) => {
    const pt = worldFromPointer(e);
    if (!pt) return;
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    fromPoint(pt);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging.current) return;
    const pt = worldFromPointer(e);
    if (pt) fromPoint(pt);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const d = e.key === 'ArrowUp' ? 1 : -1;
    if (s.mode === 'circle') userSet({ rho: r3(clamp(s.rho + d * 0.01, RHO_MIN, RHO_MAX)) });
    else if (s.kind === 'line') userSet({ m: r2(clamp(s.m + d * 0.05, M_MIN, M_MAX)) });
    else userSet({ k: r2(clamp(s.k + d * 0.05, K_MIN, K_MAX)) });
  };

  const offered = (props.presets ?? []).filter((id) => id in PRESETS);

  const readout = (
    <>
      <span data-readout="preset">
        <Q>{`f = ${formula}`}</Q>
      </span>
      {s.mode === 'path' ? (
        <>
          <span data-readout="path">
            המסילה: <Q>{describePath(path)}</Q>; בנקודה <Q>{`t = 0.1`}</Q> הערך <Q>{num(pathValue(pr, path, 0.1, s.alpha))}</Q>
          </span>
          <span data-readout="path-limit">
            הגבול לאורך המסילה, כש-<Q>{'t → 0⁺'}</Q>: <Q>{limitText}</Q>
            {Number.isFinite(limit) ? '' : ' (אין גבול סופי)'}
          </span>
        </>
      ) : (
        <span data-readout="circle">
          על המעגל ברדיוס <Q>{`ρ = ${fmtNum(s.rho)}`}</Q> הערך המוחלט הגדול ביותר של <Q>{'f − 0'}</Q> הוא <Q>{num(sup)}</Q>
        </span>
      )}
    </>
  );

  const controls = (
    <>
      {offered.length > 1 && (
        <div class="group" role="group" aria-label="הפונקציה">
          {offered.map((id) => (
            <Toggle key={id} label={<bdi dir="ltr">{PRESETS[id].formula}</bdi>} on={s.preset === id} onChange={() => userSet({ preset: id })} />
          ))}
        </div>
      )}
      <div class="group" role="group" aria-label="המסילה או המעגל">
        <Toggle label="ישר" on={s.mode === 'path' && s.kind === 'line'} onChange={() => userSet({ mode: 'path', kind: 'line' })} />
        <Toggle label="פרבולה" on={s.mode === 'path' && s.kind === 'parabola'} onChange={() => userSet({ mode: 'path', kind: 'parabola' })} />
        <Toggle label="מעגל" on={s.mode === 'circle'} onChange={() => userSet({ mode: 'circle' })} />
      </div>
      <div class="group" role="group" aria-label="הצד של הראשית">
        <Toggle label={<bdi dir="ltr">x &gt; 0</bdi>} on={s.side === 1} onChange={() => userSet({ side: 1 })} />
        <Toggle label={<bdi dir="ltr">x &lt; 0</bdi>} on={s.side === -1} onChange={() => userSet({ side: -1 })} />
      </div>
      <Slider label="שיפוע הישר m" value={s.m} min={M_MIN} max={M_MAX} step={0.05} format={(v) => fmtNum(r2(v))} onChange={(v) => userSet({ m: r2(v) })} />
      <Slider label="מקדם הפרבולה k" value={s.k} min={K_MIN} max={K_MAX} step={0.05} format={(v) => fmtNum(r2(v))} onChange={(v) => userSet({ k: r2(v) })} />
      <Slider label="רדיוס המעגל ρ" value={s.rho} min={RHO_MIN} max={RHO_MAX} step={0.005} format={(v) => fmtNum(r3(v))} onChange={(v) => userSet({ rho: r3(v) })} />
      {s.preset === 'alpha' && (
        <Slider label="α" value={s.alpha} min={ALPHA_MIN} max={ALPHA_MAX} step={0.05} format={(v) => fmtNum(r2(v))} onChange={(v) => userSet({ alpha: r2(v) })} />
      )}
    </>
  );

  return (
    <SimShell
      fig={props.id}
      label={`איור חי: המישור ליד הראשית, צבוע לפי הערך של הפונקציה, עם קווי הגובה שלה; מסילה אל הראשית והערכים של הפונקציה לאורכה, או מעגל סביב הראשית והערך המוחלט הגדול ביותר עליו. גררו על המישור כדי לבחור ישר, פרבולה או רדיוס; במקלדת, חצים למעלה ולמטה. ${describe()}`}
      canvasRef={canvasRef}
      aspect={1 / 1.18}
      live={live}
      tasks={tasks}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      cursor="crosshair"
      onReset={() => {
        setS(fresh(props));
        setLive('האיור אופס.');
      }}
      readout={readout}
      controls={controls}
    />
  );
}
