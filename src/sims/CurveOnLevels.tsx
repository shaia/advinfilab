/**
 * Lesson 5.5's figure: the chain rule along a curve.
 *
 * Upper panel: the level curves of a real function f on the plane (thin), the level curve through the moving point
 * (thick), a curve γ, the point γ(t), its velocity γ′(t) (cool arrow, labelled γ′) and the gradient ∇f(γ(t)) (accent
 * arrow, labelled ∇f). Both axes have the same scale, so the gradient is drawn at its true angle to the level curves.
 * The arrows are scaled by one factor per preset (the longest along the curve fills about a fifth of the window).
 *
 * Lower panel: the graph of φ(t) = f(γ(t)) over the curve's parameter interval, the point (t, φ(t)), and a dashed
 * segment through it with slope ∇f(γ(t))·γ′(t), the chain-rule number. Where f is differentiable at γ(t) the segment is
 * tangent to the graph; at the origin for x³/(x²+y²) or x²y/(x²+y²) (not differentiable there) it is not.
 *
 * The readout prints both numbers: the chain-rule number (closed form, src/math/chain.ts) and the slope of the graph by
 * a symmetric difference quotient (a probe; the caption says so). On the circle the parameter is θ and the slope is
 * ∂_θ g of טענה 5.5.4. No animation.
 */

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  CURVES,
  FUNCS,
  arrowScales,
  chainRate,
  composite,
  curveBox,
  describe,
  fitWindow,
  quotientRate,
  show,
  tangencyCos,
  type CurveId,
  type CurveParams,
  type FuncId,
} from '~/math/chain';
import type { Vec2 } from '~/math/vec';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { contourLines } from './core/contour';
import { arrow, withAlpha } from './core/ink';
import { drawAxes, insetBox, makePlot, niceTicks, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

/** a left-to-right island inside Hebrew text (U+2066 … U+2069), with no-break spaces so it never wraps */
const ltr = (s: string) => `⁦${s.replace(/ /g, '\u00a0')}⁩`;

const TASK_LABEL: Record<string, string> = {
  'rate-two': `בחרו ${ltr('f = x² − xy + y')} ואת המסילה ${ltr('(t², t³)')}, והביאו את ${ltr('t')} ל-${ltr('1')}: קראו את קצב השינוי.`,
  tangent: `עם אחת הפונקציות הפולינומיות: מצאו נקודה על המסילה שבה ${ltr('γ′')} ניצב לגרדיאנט (בטווח של כ-${ltr('2°')}) והגרדיאנט אינו אפס.`,
  'formula-fails': `בחרו ${ltr('x³/(x² + y²)')} או ${ltr('x²y/(x² + y²)')} על ישר דרך הראשית שאינו ציר, והביאו את ${ltr('t')} ל-${ltr('0')}: השוו את שני המספרים.`,
  'polar-min': `עם ${ltr('f = x² − y²')} על המעגל ברדיוס ${ltr('2')}: מצאו ${ltr('θ')} שבה ${ltr('∂g/∂θ')} שלילית ככל האפשר.`,
  'polar-zero': `עם ${ltr('f = xy²')} על מעגל היחידה: מצאו ${ltr('θ')} שבה ${ltr('∂g/∂θ = 0')} והגרדיאנט אינו אפס.`,
};

const T_STEP = 0.001;
const DEG_STEP = 0.25;
const M_MIN = -3;
const M_MAX = 3;
const R_MIN = 0.25;
const R_MAX = 2.5;
const roundM = (v: number) => Math.min(M_MAX, Math.max(M_MIN, Math.round(v * 20) / 20));
const roundR = (v: number) => Math.min(R_MAX, Math.max(R_MIN, Math.round(v * 100) / 100));

interface State {
  func: FuncId;
  curve: CurveId;
  /** the curve's parameter; radians on the circle */
  t: number;
  m: number;
  r: number;
}

export interface CurveOnLevelsProps {
  id: string;
  func?: FuncId;
  funcs?: FuncId[];
  curve?: CurveId;
  curves?: CurveId[];
  t?: number;
  m?: number;
  r?: number;
  /** the line's base point γ(0) */
  base?: [number, number];
  tasks?: string[];
}

/** keep t in the curve's domain, on the slider's grid (0.001 for t; 0.25° for θ) */
function clampT(curve: CurveId, t: number): number {
  const [lo, hi] = CURVES[curve].domain;
  if (curve === 'circle') {
    const deg = Math.min(360, Math.max(0, Math.round(((t * 180) / Math.PI) / DEG_STEP) * DEG_STEP));
    return (deg * Math.PI) / 180;
  }
  const v = Math.round(t / T_STEP) * T_STEP;
  return Math.min(hi, Math.max(lo, Number(v.toFixed(3))));
}

function fresh(p: CurveOnLevelsProps): State {
  const func: FuncId = p.func && p.func in FUNCS ? p.func : 'T';
  const curve: CurveId = p.curve && p.curve in CURVES ? p.curve : 'cubic';
  return {
    func,
    curve,
    t: clampT(curve, typeof p.t === 'number' ? p.t : 0.5),
    m: roundM(typeof p.m === 'number' ? p.m : 1),
    r: roundR(typeof p.r === 'number' ? p.r : 2),
  };
}

const Q = (p: { children: string }) => (
  <b class="q">
    <bdi dir="ltr">{p.children}</bdi>
  </b>
);

const PI_TICKS = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, 2 * Math.PI];
/** cos 90° is 6·10⁻¹⁷ in floating point, and a difference quotient at a flat point 10⁻¹⁰: the readouts, whose values
 * are of order 1, print such noise as 0 */
const clean = (v: number) => (Math.abs(v) < 1e-9 ? 0 : v);
const piLabel = (v: number) => (['0', 'π/2', 'π', '3π/2', '2π'][Math.round(v / (Math.PI / 2))] ?? show(v));
const deg = (t: number) => Math.round(((t * 180) / Math.PI) * 100) / 100;

export default function CurveOnLevels(props: CurveOnLevelsProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const planeRef = useRef<{ plot: Plot; samples: { t: number; sx: number; sy: number }[] } | null>(null);
  const graphRef = useRef<Plot | null>(null);
  const dragging = useRef<'plane' | 'graph' | null>(null);
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const has = (t: string) => props.tasks?.includes(t) ?? false;
  const base: Vec2 = props.base ?? [0, 0];

  const F = FUNCS[s.func];
  const C = CURVES[s.curve];
  const prm: CurveParams = { m: s.m, r: s.r, base };
  const chain = chainRate(F, C, s.t, prm);
  const quot = quotientRate(F, C, s.t, prm);
  const [gx, gy] = C.gamma(s.t, prm);
  const grad = F.grad(gx, gy);
  const vel = C.velocity(s.t, prm);
  const cosA = tangencyCos(F, C, s.t, prm);

  /** The student's own change. A text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    if (patch.curve && patch.curve !== s.curve) next.t = clampT(patch.curve, next.t);
    setS(next);
    const id = props.id;
    const NF = FUNCS[next.func];
    const NC = CURVES[next.curve];
    const np: CurveParams = { m: next.m, r: next.r, base };
    const [x, y] = NC.gamma(next.t, np);
    const g = NF.grad(x, y);
    const v = NC.velocity(next.t, np);
    if (has('rate-two') && next.func === 'T' && next.curve === 'cubic' && Math.abs(next.t - 1) < 5e-4) markTask(`${id}:rate-two`);
    const c = tangencyCos(NF, NC, next.t, np);
    if (has('tangent') && NF.smooth && Math.hypot(...g) > 0.05 && Math.hypot(...v) > 0.05 && Math.abs(c) <= 0.03) markTask(`${id}:tangent`);
    if (
      has('formula-fails') &&
      !NF.smooth &&
      next.curve === 'line' &&
      base[0] === 0 &&
      base[1] === 0 &&
      Math.abs(next.t) < 5e-4 &&
      Math.abs(quotientRate(NF, NC, next.t, np) - chainRate(NF, NC, next.t, np)) > 0.05
    )
      markTask(`${id}:formula-fails`);
    if (has('polar-min') && next.func === 'saddle' && next.curve === 'circle' && Math.abs(next.r - 2) < 0.005 && chainRate(NF, NC, next.t, np) <= -7.99)
      markTask(`${id}:polar-min`);
    if (has('polar-zero') && next.func === 'xy2' && next.curve === 'circle' && Math.abs(next.r - 1) < 0.005 && Math.hypot(...g) > 0.05 && Math.abs(c) <= 0.03)
      markTask(`${id}:polar-zero`);
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.func === 'string' && st.func in FUNCS) next.func = st.func as FuncId;
          if (typeof st.curve === 'string' && st.curve in CURVES) next.curve = st.curve as CurveId;
          if (typeof st.m === 'number') next.m = roundM(st.m);
          if (typeof st.r === 'number') next.r = roundR(st.r);
          next.t = clampT(next.curve, typeof st.t === 'number' ? st.t : next.t);
          return next;
        });
      }),
    [props.id],
  );

  useEffect(() => {
    const t = setTimeout(() => setLive(describe(F, C, s.t, prm)), 300);
    return () => clearTimeout(t);
  }, [s]);

  // the curve's parameter range and the values of φ on it; the arrow scales; recomputed when the preset changes
  const geom = useMemo(() => {
    const [lo, hi] = C.domain;
    const N = 500;
    const ts: number[] = [];
    const phi: number[] = [];
    for (let i = 0; i <= N; i++) {
      const t = lo + ((hi - lo) * i) / N;
      ts.push(t);
      phi.push(composite(F, C, t, prm));
    }
    // the median lengths of ∇f and γ′ along the curve (sampled), for the arrow scale
    const median = (xs: number[]) => {
      const v = xs.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
      return v.length ? v[Math.floor(v.length / 2)] : 0;
    };
    const gl: number[] = [];
    const vl: number[] = [];
    for (const t of ts) {
      const [x, y] = C.gamma(t, prm);
      const gg = F.grad(x, y);
      const vv = C.velocity(t, prm);
      gl.push(Math.hypot(gg[0], gg[1]));
      vl.push(Math.hypot(vv[0], vv[1]));
    }
    return { ts, phi, box: curveBox(C, prm), scales: arrowScales(F, C, prm), typical: { grad: median(gl), vel: median(vl) } };
  }, [s.func, s.curve, s.m, s.r]);

  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const splitY = view.h * 0.6;
    const toolsW = 3 * 34 + 2 * 6 + 8 + 8;
    const legendTop = narrow ? 46 : 12;

    // ---------------- upper panel: the plane
    const box = insetBox({ x: 0, y: 0, w: view.w, h: splitY }, { l: narrow ? 30 : 36, r: 10, t: legendTop, b: 22 });
    const win = fitWindow(geom.box, box.w / box.h);
    const plot = makePlot(
      box,
      { min: win.xmin, max: win.xmax, ticks: niceTicks(win.xmin, win.xmax, narrow ? 4 : 6), format: show },
      { min: win.ymin, max: win.ymax, ticks: niceTicks(win.ymin, win.ymax, narrow ? 3 : 5), format: show },
    );
    drawAxes(ctx, plot, p);
    const X = plot.px;
    const Y = plot.py;

    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();

    // the coordinate axes through the origin
    ctx.strokeStyle = p.ink3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(X(win.xmin), Y(0));
    ctx.lineTo(X(win.xmax), Y(0));
    ctx.moveTo(X(0), Y(win.ymin));
    ctx.lineTo(X(0), Y(win.ymax));
    ctx.stroke();

    // level curves, and the one through γ(t)
    const cbox = { xmin: win.xmin, xmax: win.xmax, ymin: win.ymin, ymax: win.ymax };
    const grid = narrow ? 70 : 110;
    const strokeLines = (lines: ReturnType<typeof contourLines>) => {
      for (const ln of lines) {
        ctx.beginPath();
        ln.points.forEach(([x, y], k) => (k ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
        if (ln.closed) ctx.closePath();
        ctx.stroke();
      }
    };
    ctx.strokeStyle = withAlpha(p.equip, 0.5);
    ctx.lineWidth = 1;
    strokeLines(contourLines(F.f, cbox, { nx: grid, ny: grid, step: F.levelStep, offset: 0.5, maxLevelsPerCell: 6 }));
    const c0 = F.f(gx, gy);
    const BIG = 1e6;
    ctx.strokeStyle = p.equip;
    ctx.lineWidth = 2.4;
    ctx.setLineDash([7, 4]);
    strokeLines(contourLines(F.f, cbox, { nx: grid * 2, ny: grid * 2, step: BIG, offset: c0 / BIG, maxLevelsPerCell: 1 }));
    ctx.setLineDash([]);

    // the curve
    const samples: { t: number; sx: number; sy: number }[] = [];
    ctx.strokeStyle = p.curve;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    geom.ts.forEach((t, k) => {
      const [x, y] = C.gamma(t, prm);
      const sx = X(x);
      const sy = Y(y);
      samples.push({ t, sx, sy });
      if (k) ctx.lineTo(sx, sy);
      else ctx.moveTo(sx, sy);
    });
    ctx.stroke();
    planeRef.current = { plot, samples };

    // the arrows: one scale per choice of function and curve (the caption says so). A typical length along the curve
    // (the median) is drawn at about 0.16 of the window, the longest at most 0.75 of it: scaling the longest to a fifth
    // made the arrows a few pixels long wherever the curve is slow, which is where the lesson's steps look.
    const span = Math.min(win.xmax - win.xmin, win.ymax - win.ymin);
    const scaleOf = (typical: number, longest: number) => (longest > 0 ? Math.min((0.16 * span) / (typical || longest), (0.75 * span) / longest) : 0);
    const sG = scaleOf(geom.typical.grad, geom.scales.grad);
    const sV = scaleOf(geom.typical.vel, geom.scales.vel);
    const P0: [number, number] = [X(gx), Y(gy)];
    const tipG: [number, number] = [X(gx + sG * grad[0]), Y(gy + sG * grad[1])];
    const tipV: [number, number] = [X(gx + sV * vel[0]), Y(gy + sV * vel[1])];
    arrow(ctx, P0[0], P0[1], tipV[0], tipV[1], { color: p.delta, width: 2.4, head: 10 });
    arrow(ctx, P0[0], P0[1], tipG[0], tipG[1], { color: p.accent, width: 2.4, head: 10 });
    ctx.font = `600 ${narrow ? 12 : 14}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // each label just beyond its tip, outlined in paper colour; when the two would meet (arrows close in direction and
    // length), each is pushed sideways, away from the other arrow
    const at = (tip: [number, number]): [number, number] | null => {
      const dx = tip[0] - P0[0];
      const dy = tip[1] - P0[1];
      const L = Math.hypot(dx, dy);
      return L < 3 ? null : [tip[0] + (dx / L) * 14, tip[1] + (dy / L) * 14];
    };
    let lv = at(tipV);
    let lg = at(tipG);
    if (lv && lg && Math.hypot(lv[0] - lg[0], lv[1] - lg[1]) < 26) {
      const side = (tip: [number, number], other: [number, number]): [number, number] => {
        const d = [tip[0] - P0[0], tip[1] - P0[1]];
        const L = Math.hypot(d[0], d[1]) || 1;
        let n = [-d[1] / L, d[0] / L];
        if (n[0] * (other[0] - P0[0]) + n[1] * (other[1] - P0[1]) > 0) n = [-n[0], -n[1]];
        return [n[0] * 12, n[1] * 12];
      };
      const sv = side(tipV, tipG);
      const sg = side(tipG, tipV);
      lv = [lv[0] + sv[0], lv[1] + sv[1]];
      lg = [lg[0] + sg[0], lg[1] + sg[1]];
    }
    const label = (q: [number, number] | null, text: string, color: string) => {
      if (!q) return;
      ctx.strokeStyle = p.paper;
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.strokeText(text, q[0], q[1]);
      ctx.fillStyle = color;
      ctx.fillText(text, q[0], q[1]);
    };
    label(lv, 'γ′', p.delta);
    label(lg, '∇f', p.accent);

    // the point γ(t)
    ctx.beginPath();
    ctx.arc(P0[0], P0[1], 5.5, 0, 2 * Math.PI);
    ctx.fillStyle = p.pointIn;
    ctx.fill();
    ctx.strokeStyle = p.paper;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // legend, LTR
    ctx.save();
    ctx.font = `600 ${narrow ? 11 : 13}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const l1 = F.formula;
    const l2 = C.formula(prm);
    if (narrow) {
      const room = Math.max(60, view.w - toolsW - 8);
      ctx.fillStyle = p.equip;
      ctx.fillText(l1, 8, 14, room);
      ctx.fillStyle = p.curve;
      ctx.fillText(l2, 8, 31, room);
    } else {
      const w = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width) + 12;
      ctx.fillStyle = withAlpha(p.paper, 0.85);
      ctx.fillRect(box.x + 4, box.y + 3, w, 38);
      ctx.fillStyle = p.equip;
      ctx.fillText(l1, box.x + 10, box.y + 13);
      ctx.fillStyle = p.curve;
      ctx.fillText(l2, box.x + 10, box.y + 31);
    }
    ctx.restore();

    // ---------------- lower panel: the graph of φ = f∘γ and the chain-rule slope
    const [lo, hi] = C.domain;
    const fin = geom.phi.filter((v) => Number.isFinite(v));
    let ymin = Math.min(...fin);
    let ymax = Math.max(...fin);
    if (ymax - ymin < 1e-9) {
      ymin -= 1;
      ymax += 1;
    }
    const pad = 0.1 * (ymax - ymin);
    ymin -= pad;
    ymax += pad;
    const box2 = insetBox({ x: 0, y: splitY, w: view.w, h: view.h - splitY }, { l: narrow ? 30 : 36, r: 10, t: narrow ? 24 : 14, b: 22 });
    const circle = s.curve === 'circle';
    const plot2 = makePlot(
      box2,
      { min: lo, max: hi, ticks: circle ? PI_TICKS : niceTicks(lo, hi, narrow ? 4 : 6), format: circle ? piLabel : show },
      { min: ymin, max: ymax, ticks: niceTicks(ymin, ymax, narrow ? 2 : 4), format: show },
    );
    graphRef.current = plot2;
    drawAxes(ctx, plot2, p);
    const X2 = plot2.px;
    const Y2 = plot2.py;
    ctx.save();
    ctx.beginPath();
    ctx.rect(box2.x, box2.y - 2, box2.w, box2.h + 4);
    ctx.clip();
    ctx.strokeStyle = p.curve;
    ctx.lineWidth = 2;
    ctx.beginPath();
    geom.ts.forEach((t, k) => (k ? ctx.lineTo(X2(t), Y2(geom.phi[k])) : ctx.moveTo(X2(t), Y2(geom.phi[k]))));
    ctx.stroke();
    // the segment of slope ∇f·γ′ through (t, φ(t))
    const phi0 = composite(F, C, s.t, prm);
    const half = 0.16 * (hi - lo);
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 2.2;
    ctx.setLineDash([7, 4]);
    ctx.beginPath();
    ctx.moveTo(X2(s.t - half), Y2(phi0 - half * chain));
    ctx.lineTo(X2(s.t + half), Y2(phi0 + half * chain));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // the point, outside the clip: at either end of the domain it would be cut in half
    ctx.beginPath();
    ctx.arc(X2(s.t), Y2(phi0), 5, 0, 2 * Math.PI);
    ctx.fillStyle = p.pointIn;
    ctx.fill();
    ctx.save();
    ctx.font = `600 ${narrow ? 11 : 12}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    // math only (no English words): the graph, and the dashed segment whose slope is the chain-rule number
    const g1 = circle ? 'g(r, θ) = f(γ(θ))' : 'f(γ(t))';
    const g2 = circle ? '- - ∂g/∂θ = ∇f·γ′' : '- - ∇f(γ(t))·γ′(t)';
    const gy0 = narrow ? box2.y - 12 : box2.y + 8;
    // outlined in paper colour: on a desktop the legend sits inside the plot, on the graph
    ctx.strokeStyle = p.paper;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    const gx2 = box2.x + 6 + ctx.measureText(g1).width + 16;
    ctx.strokeText(g1, box2.x + 6, gy0);
    ctx.strokeText(g2, gx2, gy0);
    ctx.fillStyle = p.curve;
    ctx.fillText(g1, box2.x + 6, gy0);
    ctx.fillStyle = p.accent;
    ctx.fillText(g2, gx2, gy0);
    ctx.restore();
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1, worldHeight: 1.16, animate: false });
  useEffect(invalidate, [s, geom]);

  const tFromPointer = (e: PointerEvent): { t: number; where: 'plane' | 'graph' } | null => {
    const g = graphRef.current;
    const pl = planeRef.current;
    if (g && e.offsetY >= g.box.y - 10) {
      const t = g.x.min + ((e.offsetX - g.box.x) / g.box.w) * (g.x.max - g.x.min);
      return { t: clampT(s.curve, t), where: 'graph' };
    }
    if (!pl) return null;
    let best = pl.samples[0];
    let bd = Infinity;
    for (const q of pl.samples) {
      const d = (q.sx - e.offsetX) ** 2 + (q.sy - e.offsetY) ** 2;
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return best ? { t: clampT(s.curve, best.t), where: 'plane' } : null;
  };
  const onPointerDown = (e: PointerEvent) => {
    const hit = tFromPointer(e);
    if (!hit) return;
    dragging.current = hit.where;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (Math.abs(hit.t - s.t) > 1e-12) userSet({ t: hit.t });
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging.current) return;
    const hit = tFromPointer(e);
    if (hit && Math.abs(hit.t - s.t) > 1e-12) userSet({ t: hit.t });
  };
  const onPointerUp = () => {
    dragging.current = null;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const step = (s.curve === 'circle' ? (DEG_STEP * Math.PI) / 180 : T_STEP) * (e.shiftKey ? 40 : 4);
    userSet({ t: clampT(s.curve, s.t + dir * step) });
  };

  const offeredF = (props.funcs ?? []).filter((id) => id in FUNCS);
  const offeredC = (props.curves ?? []).filter((id) => id in CURVES);
  const circle = s.curve === 'circle';
  const par = C.param;
  const tText = circle ? `θ = ${show(deg(s.t))}° ≈ ${show(s.t)}` : `t = ${show(s.t)}`;
  const angle = Number.isFinite(cosA) ? (Math.acos(Math.max(-1, Math.min(1, cosA))) * 180) / Math.PI : NaN;

  const readout = (
    <>
      <span data-readout="func">
        <Q>{F.formula}</Q> לאורך <Q>{C.formula(prm)}</Q>
      </span>
      <span data-readout="point">
        ב-<Q>{tText}</Q>: <Q>{`γ(${par}) = (${show(clean(gx))}, ${show(clean(gy))})`}</Q>, <Q>{`f(γ(${par})) = ${show(clean(composite(F, C, s.t, prm)))}`}</Q>
      </span>
      <span data-readout="vectors">
        <Q>{`∇f(γ(${par})) = (${show(clean(grad[0]))}, ${show(clean(grad[1]))})`}</Q>, <Q>{`γ′(${par}) = (${show(clean(vel[0]))}, ${show(clean(vel[1]))})`}</Q>
        {Number.isFinite(angle) && (
          <>
            , הזווית ביניהם <Q>{`${show(angle)}°`}</Q>
          </>
        )}
      </span>
      <span data-readout="chain">
        לפי כלל השרשרת: <Q>{`${circle ? '∂g/∂θ = ' : ''}∇f(γ(${par}))·γ′(${par}) = ${show(clean(chain))}`}</Q>
      </span>
      <span data-readout="slope">
        שיפוע הגרף (מנת הפרשים סימטרית, בדיקה מספרית): <Q>{`≈ ${show(clean(quot))}`}</Q>
        {Math.abs(quot - chain) > 1e-3 * Math.max(1, Math.abs(chain)) && <> — שונה מהמספר של כלל השרשרת</>}
      </span>
    </>
  );

  const controls = (
    <>
      {offeredF.length > 1 && (
        <div class="group" role="group" aria-label="הפונקציה">
          {offeredF.map((id) => (
            <Toggle key={id} label={<bdi dir="ltr">{FUNCS[id].formula}</bdi>} on={s.func === id} onChange={() => userSet({ func: id })} />
          ))}
        </div>
      )}
      {offeredC.length > 1 && (
        <div class="group" role="group" aria-label="המסילה">
          {offeredC.map((id) => (
            <Toggle key={id} label={<bdi dir="ltr">{CURVES[id].formula(prm)}</bdi>} on={s.curve === id} onChange={() => userSet({ curve: id })} />
          ))}
        </div>
      )}
      {circle ? (
        <Slider label="θ (במעלות)" value={deg(s.t)} min={0} max={360} step={DEG_STEP} format={(v) => `${show(v)}°`} onChange={(v) => userSet({ t: clampT('circle', (v * Math.PI) / 180) })} />
      ) : (
        <Slider label="t" value={s.t} min={C.domain[0]} max={C.domain[1]} step={T_STEP} format={(v) => show(Number(v.toFixed(3)))} onChange={(v) => userSet({ t: clampT(s.curve, v) })} />
      )}
      {s.curve === 'line' && (
        <Slider label="השיפוע m של הישר" value={s.m} min={M_MIN} max={M_MAX} step={0.05} format={(v) => show(roundM(v))} onChange={(v) => userSet({ m: roundM(v) })} />
      )}
      {circle && <Slider label="הרדיוס r" value={s.r} min={R_MIN} max={R_MAX} step={0.01} format={(v) => show(roundR(v))} onChange={(v) => userSet({ r: roundR(v) })} />}
    </>
  );

  return (
    <SimShell
      fig={props.id}
      label={`איור חי: קווי הגובה של פונקציה, מסילה, הנקודה הנעה עליה עם וקטור המהירות והגרדיאנט; למטה, הגרף של הפונקציה לאורך המסילה וקטע ששיפועו המכפלה הסקלרית שלהם. במקלדת: חצים ימינה ושמאלה מזיזים את הנקודה. ${describe(F, C, s.t, prm)}`}
      canvasRef={canvasRef}
      aspect={1 / 1.16}
      live={live}
      tasks={tasks}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      cursor="pointer"
      onReset={() => {
        setS(fresh(props));
        setLive('האיור אופס.');
      }}
      readout={readout}
      controls={controls}
    />
  );
}
