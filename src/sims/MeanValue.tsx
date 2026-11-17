/**
 * Lesson 5.6's figure: the mean value theorem in several variables, and why it has no vector form.
 *
 * Mode 'real': the level curves of a real f on the plane, a segment [a, b] with draggable ends, and the mean value
 * points c = a + τ(b − a) on it (filled green dots). Below: the graph of φ(t) = f(a + t(b − a)) on [0, 1], its chord
 * from (0, φ(0)) to (1, φ(1)) (warm), and at each τ the tangent of φ, parallel to the chord (warm, dashed), with τ
 * marked on the graph.
 *
 * Mode 'vector': a curve γ in the plane (faint), the arc over [t0, t1] (ink), the chord γ(t1) − γ(t0) from γ(t0)
 * (green arrow), and the candidates (t1 − t0)γ′(c) drawn from γ(t0) (cool arrows) with the locus of their tips. The
 * candidate nearest to the chord is bold; where it misses, a hollow ring marks the chord's tip (no common point), and
 * a filled dot marks it when they meet. Below: c ↦ ‖(t1 − t0)γ′(c) − (γ(t1) − γ(t0))‖ on [t0, t1], and on its axis
 * the mean value points of each component alone: triangles for the first, squares for the second (shape, not only
 * colour). The readout compares the mean speed with sup‖γ′‖, the constant of the mean value inequality.
 *
 * Every number comes from src/math/meanvalue.ts (closed forms; roots by sign changes and bisection, the least gap on
 * a grid: probes, and the caption says so). No animation.
 */

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  CURVES,
  REAL,
  chord,
  componentPoints,
  fmtNum,
  gap,
  minGap,
  mvtPoints,
  phi,
  ratio,
  type CurveId,
  type RealId,
} from '~/math/meanvalue';
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
  'cubic-23': `ב-${ltr('x³ − y²')}, עם ${ltr('a = (0, 0)')}: גררו את b אל ${ltr('(1, 1)')} וקראו את τ.`,
  'quad-long': `ב-${ltr('x² − xy + 2y²')}: בחרו קטע שאורכו לפחות ${ltr('3')}. איפה נמצאת הנקודה c?`,
  'wave-three': `ב-${ltr('sin(2x)·cos(y)')}: מצאו קטע שיש עליו לפחות שלוש נקודות c.`,
  'circle-zero': `במעגל: בחרו קטע זמנים שבו ${ltr('γ(t₁) − γ(t₀) = 0')}. האם יש c שעבורה ${ltr('(t₁ − t₀)γ′(c) = 0')}?`,
  'circle-sharp': `במעגל: מצאו קטע זמנים שבו המהירות הממוצעת ${ltr('‖γ(t₁) − γ(t₀)‖/(t₁ − t₀)')} היא לפחות ${ltr('0.99')}, כמעט החסם ${ltr('sup‖γ′‖ = 1')}.`,
  'cusp-apart': `ב-${ltr('(t², t³)')}: מצאו קטע זמנים שבו הנקודה של הרכיב הראשון רחוקה לפחות ${ltr('0.5')} מכל נקודה של הרכיב השני.`,
};

const R = 2; // the segment's ends live in [−2, 2]²
const GRID = 0.05;
const snap = (v: number) => Math.min(R, Math.max(-R, Math.round(v / GRID) * GRID));
const snapP = (p: Vec2): Vec2 => [Number(snap(p[0]).toFixed(2)), Number(snap(p[1]).toFixed(2))];
// sin π is 1.2·10⁻¹⁶ in floating point: every number printed here is of order 1, so such noise is printed as 0
const sig = (v: number, n = 6) => fmtNum(Math.abs(v) < 1e-12 ? 0 : Number(v.toPrecision(n)));
const pt = (p: Vec2) => `(${sig(p[0], 4)}, ${sig(p[1], 4)})`;

/** t on the slider grid of a curve: t = lo + k·step */
const kMax = (c: CurveId) => Math.round((CURVES[c].domain[1] - CURVES[c].domain[0]) / CURVES[c].step);
const tOf = (c: CurveId, k: number) => CURVES[c].domain[0] + k * CURVES[c].step;
const kOf = (c: CurveId, t: number) => Math.min(kMax(c), Math.max(0, Math.round((t - CURVES[c].domain[0]) / CURVES[c].step)));
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** the circle's times are multiples of π/24: write them as fractions of π */
function tLabel(c: CurveId, k: number): string {
  if (c !== 'circle') return sig(tOf(c, k), 5);
  if (k === 0) return '0';
  const g = gcd(k, 24);
  const num = k / g;
  const den = 24 / g;
  const top = num === 1 ? 'π' : `${num}π`;
  return den === 1 ? top : `${top}/${den}`;
}

interface State {
  mode: 'real' | 'vector';
  fn: RealId;
  a: Vec2;
  b: Vec2;
  curve: CurveId;
  k0: number;
  k1: number;
}

export interface MeanValueProps {
  id: string;
  mode?: 'real' | 'vector';
  fn?: RealId;
  fns?: RealId[];
  a?: [number, number];
  b?: [number, number];
  curve?: CurveId;
  curves?: CurveId[];
  t0?: number;
  t1?: number;
  tasks?: string[];
}

/** keep 0 ≤ k0 < k1 ≤ K; the end that moved wins */
function order(c: CurveId, k0: number, k1: number, moved: 0 | 1): [number, number] {
  const K = kMax(c);
  k0 = Math.min(K, Math.max(0, Math.round(k0)));
  k1 = Math.min(K, Math.max(0, Math.round(k1)));
  if (k0 < k1) return [k0, k1];
  if (moved === 0) return k0 >= K ? [K - 1, K] : [k0, k0 + 1];
  return k1 <= 0 ? [0, 1] : [k1 - 1, k1];
}

function fresh(p: MeanValueProps): State {
  const fn: RealId = p.fn && p.fn in REAL ? p.fn : 'cubic';
  const curve: CurveId = p.curve && p.curve in CURVES ? p.curve : 'circle';
  const [k0, k1] = order(curve, kOf(curve, p.t0 ?? CURVES[curve].domain[0]), kOf(curve, p.t1 ?? CURVES[curve].domain[1] / 2), 1);
  return {
    mode: p.mode === 'vector' ? 'vector' : 'real',
    fn,
    a: snapP(p.a ?? [0, 0]),
    b: snapP(p.b ?? [1, 1]),
    curve,
    k0,
    k1,
  };
}

const Q = (p: { children: string }) => (
  <b class="q">
    <bdi dir="ltr">{p.children}</bdi>
  </b>
);

/** What the vector mode computes, shared by the drawing, the readout and the tasks. */
function vectorFacts(c: CurveId, k0: number, k1: number) {
  const C = CURVES[c];
  const t0 = tOf(c, k0);
  const t1 = tOf(c, k1);
  const v = chord(C, t0, t1);
  const c1 = componentPoints(C, t0, t1, 0);
  const c2 = componentPoints(C, t0, t1, 1);
  // a common point: a point of one component at which the gap vanishes
  const cand = c1.all ? c2.roots : c2.all ? c1.roots : c1.roots;
  const common = c1.all && c2.all ? [(t0 + t1) / 2] : cand.filter((t) => gap(C, t0, t1, t) < 1e-9);
  const near = minGap(C, t0, t1);
  const q = ratio(C, t0, t1);
  const sup = C.speedSup(t0, t1);
  let apart = Infinity;
  if (!c1.all && !c2.all) for (const x of c1.roots) for (const y of c2.roots) apart = Math.min(apart, Math.abs(x - y));
  return { C, t0, t1, v, c1, c2, common, near, q, sup, apart };
}

export default function MeanValue(props: MeanValueProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const topRef = useRef<Plot | null>(null);
  const drag = useRef<'a' | 'b' | null>(null);
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const has = (t: string) => props.tasks?.includes(t) ?? false;

  const F = REAL[s.fn];
  const mv = useMemo(() => mvtPoints(F, s.a, s.b), [s.fn, s.a[0], s.a[1], s.b[0], s.b[1]]);
  const vf = useMemo(() => vectorFacts(s.curve, s.k0, s.k1), [s.curve, s.k0, s.k1]);
  const degenerate = s.a[0] === s.b[0] && s.a[1] === s.b[1];

  /** The student's own change. A text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>, moved: 0 | 1 = 1) => {
    const next = { ...s, ...patch };
    if (patch.curve && patch.curve !== s.curve) {
      // keep the times in the new curve's domain
      [next.k0, next.k1] = order(next.curve, kOf(next.curve, tOf(s.curve, s.k0)), kOf(next.curve, tOf(s.curve, s.k1)), 1);
    } else if (patch.k0 !== undefined || patch.k1 !== undefined) [next.k0, next.k1] = order(next.curve, next.k0, next.k1, moved);
    setS(next);
    const id = props.id;
    if (next.mode === 'real') {
      const same = (p: Vec2, x: number, y: number) => Math.abs(p[0] - x) < 1e-9 && Math.abs(p[1] - y) < 1e-9;
      const m = mvtPoints(REAL[next.fn], next.a, next.b);
      const L = Math.hypot(next.b[0] - next.a[0], next.b[1] - next.a[1]);
      if (has('cubic-23') && next.fn === 'cubic' && same(next.a, 0, 0) && same(next.b, 1, 1)) markTask(`${id}:cubic-23`);
      if (has('quad-long') && next.fn === 'quad' && L >= 3 - 1e-9 && m.roots.length === 1) markTask(`${id}:quad-long`);
      if (has('wave-three') && next.fn === 'wave' && !m.all && m.roots.length >= 3) markTask(`${id}:wave-three`);
    } else {
      const f = vectorFacts(next.curve, next.k0, next.k1);
      const z = Math.hypot(f.v[0], f.v[1]);
      if (has('circle-zero') && next.curve === 'circle' && z < 1e-9) markTask(`${id}:circle-zero`);
      if (has('circle-sharp') && next.curve === 'circle' && f.q >= 0.99) markTask(`${id}:circle-sharp`);
      if (has('cusp-apart') && next.curve === 'cusp' && f.apart >= 0.5 - 1e-9 && Number.isFinite(f.apart)) markTask(`${id}:cusp-apart`);
    }
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (st.mode === 'real' || st.mode === 'vector') next.mode = st.mode;
          if (typeof st.fn === 'string' && st.fn in REAL) next.fn = st.fn as RealId;
          if (typeof st.ax === 'number' && typeof st.ay === 'number') next.a = snapP([st.ax, st.ay]);
          if (typeof st.bx === 'number' && typeof st.by === 'number') next.b = snapP([st.bx, st.by]);
          if (typeof st.curve === 'string' && st.curve in CURVES) next.curve = st.curve as CurveId;
          const k0 = typeof st.t0 === 'number' ? kOf(next.curve, st.t0) : next.k0;
          const k1 = typeof st.t1 === 'number' ? kOf(next.curve, st.t1) : next.k1;
          [next.k0, next.k1] = order(next.curve, k0, k1, 1);
          return next;
        });
      }),
    [props.id],
  );

  const describe = () => {
    if (s.mode === 'real') {
      if (degenerate) return `${F.formula}: הקצוות a ו-b מתלכדים, ואין קטע.`;
      const pts = mv.all ? 'כל נקודה של הקטע מקיימת את המשפט' : `נקודות הערך הממוצע: τ = ${mv.roots.map((t) => sig(t, 4)).join(', ')}`;
      return `${F.formula}, a = ${pt(s.a)}, b = ${pt(s.b)}. f(b) − f(a) = ${sig(mv.slope, 4)}. ${pts}.`;
    }
    const z = Math.hypot(vf.v[0], vf.v[1]);
    return `${vf.C.formula} על [${tLabel(s.curve, s.k0)}, ${tLabel(s.curve, s.k1)}]: ‖γ(t₁) − γ(t₀)‖ = ${sig(z, 4)}, המהירות הממוצעת ${sig(vf.q, 4)}, ו-sup‖γ′‖ = ${sig(vf.sup, 4)}. ${
      vf.common.length ? `יש נקודה משותפת, c ≈ ${sig(vf.common[0], 4)}.` : 'אין נקודה c אחת לשני הרכיבים.'
    }`;
  };
  useEffect(() => {
    const t = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(t);
  }, [s]);

  // level curves on a box that covers every view of the plane, once per function
  const contours = useMemo(() => contourLines(F.f, { xmin: -3.2, xmax: 3.2, ymin: -2.4, ymax: 2.4 }, { nx: 128, ny: 96, step: F.step, offset: 0 }), [s.fn]);

  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const splitY = view.h * 0.62;
    const toolsW = 3 * 34 + 2 * 6 + 8 + 8;
    const legendTop = narrow ? 46 : 12;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // ---------------- upper panel: the plane, with equal scales on both axes
    const box = insetBox({ x: 0, y: 0, w: view.w, h: splitY }, { l: narrow ? 30 : 36, r: 12, t: legendTop, b: 24 });
    let cx = 0;
    let cy = 0;
    let half = 2.2;
    if (s.mode === 'vector') ({ cx, cy, half } = vf.C.view);
    let hx = Math.max(half, (half * box.w) / box.h);
    let hy = (hx * box.h) / box.w;
    if (s.mode === 'vector') {
      // widen the window (both axes alike) until the whole curve fits: (t², t³) reaches y = ±3.375, and the view of
      // its preset showed only |y| ≤ 2.2, cutting off γ(t₁) and the vectors of every step that ends past t ≈ 1.3
      const [lo, hi] = vf.C.domain;
      let f = 1;
      for (let i = 0; i <= 200; i++) {
        const [x, y] = vf.C.g(lo + ((hi - lo) * i) / 200);
        f = Math.max(f, (1.1 * Math.abs(x - cx)) / hx, (1.28 * Math.abs(y - cy)) / hy); // room for the labels
      }
      hx *= f;
      hy *= f;
    }
    const plot = makePlot(
      box,
      { min: cx - hx, max: cx + hx, ticks: niceTicks(cx - hx, cx + hx, narrow ? 4 : 6), format: (v) => sig(v, 3) },
      { min: cy - hy, max: cy + hy, ticks: niceTicks(cy - hy, cy + hy, narrow ? 4 : 5), format: (v) => sig(v, 3) },
    );
    topRef.current = plot;
    drawAxes(ctx, plot, p);
    const X = plot.px;
    const Y = plot.py;
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    // the coordinate axes
    ctx.strokeStyle = withAlpha(p.ink2, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(X(cx - hx), Y(0));
    ctx.lineTo(X(cx + hx), Y(0));
    ctx.moveTo(X(0), Y(cy - hy));
    ctx.lineTo(X(0), Y(cy + hy));
    ctx.stroke();

    const dot = (q: Vec2, r: number, fill: string, ring?: string) => {
      ctx.beginPath();
      ctx.arc(X(q[0]), Y(q[1]), r, 0, 2 * Math.PI);
      ctx.fillStyle = fill;
      ctx.fill();
      if (ring) {
        ctx.strokeStyle = ring;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };
    const label = (text: string, q: Vec2, dx: number, dy: number, color: string) => {
      ctx.save();
      ctx.font = `600 ${narrow ? 12 : 14}px ${p.fontUi}`;
      ctx.direction = 'ltr';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(text, X(q[0]) + dx, Y(q[1]) + dy);
      ctx.restore();
    };

    if (s.mode === 'real') {
      // level curves
      for (const line of contours) {
        const zero = Math.abs((line.k + 0) * F.step) < 1e-12;
        ctx.strokeStyle = withAlpha(p.ink3, zero ? 0.9 : 0.55);
        ctx.lineWidth = zero ? 1.4 : 1;
        ctx.beginPath();
        line.points.forEach((q, i) => (i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1]))));
        if (line.closed) ctx.closePath();
        ctx.stroke();
      }
      // the segment and its ends
      ctx.strokeStyle = p.curve;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(X(s.a[0]), Y(s.a[1]));
      ctx.lineTo(X(s.b[0]), Y(s.b[1]));
      ctx.stroke();
      dot(s.a, 6, p.paper, p.curve);
      dot(s.b, 6, p.paper, p.curve);
      label('a', s.a, -12, -12, p.curve);
      label('b', s.b, 12, -12, p.curve);
      // the mean value points c (filled, green)
      if (!degenerate && !mv.all)
        mv.points.forEach((c, i) => {
          dot(c, 5.5, p.limit);
          label(mv.points.length > 1 ? `c${'₁₂₃₄₅₆₇₈₉'[i] ?? ''}` : 'c', c, 0, 15, p.limit);
        });
    } else {
      const { C, t0, t1, v } = vf;
      const [lo, hi] = C.domain;
      const N = 400;
      // the whole curve, faint
      ctx.strokeStyle = withAlpha(p.ink3, 0.6);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const q = C.g(lo + ((hi - lo) * i) / N);
        if (i) ctx.lineTo(X(q[0]), Y(q[1]));
        else ctx.moveTo(X(q[0]), Y(q[1]));
      }
      ctx.stroke();
      // the arc over [t0, t1]
      ctx.strokeStyle = p.curve;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const q = C.g(t0 + ((t1 - t0) * i) / N);
        if (i) ctx.lineTo(X(q[0]), Y(q[1]));
        else ctx.moveTo(X(q[0]), Y(q[1]));
      }
      ctx.stroke();
      const g0 = C.g(t0);
      const g1 = C.g(t1);
      const D = t1 - t0;
      const tip = (c: number): Vec2 => {
        const d = C.dg(c);
        return [g0[0] + D * d[0], g0[1] + D * d[1]];
      };
      // the locus of the candidates' tips, and a fan of candidates
      ctx.strokeStyle = withAlpha(p.delta, 0.8);
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const q = tip(t0 + (D * i) / N);
        if (i) ctx.lineTo(X(q[0]), Y(q[1]));
        else ctx.moveTo(X(q[0]), Y(q[1]));
      }
      ctx.stroke();
      ctx.setLineDash([]);
      const fan = narrow ? 8 : 12;
      for (let i = 1; i < fan; i++) {
        const q = tip(t0 + (D * i) / fan);
        arrow(ctx, X(g0[0]), Y(g0[1]), X(q[0]), Y(q[1]), { color: p.delta, width: 1, head: 7, alpha: 0.35 });
      }
      // the candidate nearest to the chord, bold
      const qn = tip(vf.near.c);
      arrow(ctx, X(g0[0]), Y(g0[1]), X(qn[0]), Y(qn[1]), { color: p.delta, width: 2, head: 10 });
      // the chord, green
      const z = Math.hypot(v[0], v[1]);
      if (z > 1e-9) arrow(ctx, X(g0[0]), Y(g0[1]), X(g1[0]), Y(g1[1]), { color: p.limit, width: 2.6, head: 11 });
      // the ends of the arc
      dot(g0, 5, p.curve);
      dot(g1, 5, p.curve);
      label('γ(t₀)', g0, -20, 14, p.curve);
      if (z > 0.15) label('γ(t₁)', g1, 20, -14, p.curve);
      // where the chord's tip is: filled when a candidate meets it, a hollow ring when none does
      if (vf.common.length) dot(g1, 7, p.pointIn);
      else {
        ctx.beginPath();
        ctx.arc(X(g1[0]), Y(g1[1]), 8, 0, 2 * Math.PI);
        ctx.strokeStyle = p.pointOut;
        ctx.lineWidth = 2.4;
        ctx.stroke();
      }
    }
    ctx.restore();

    // legend, LTR
    ctx.save();
    ctx.font = `600 ${narrow ? 11 : 13}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const l1 = s.mode === 'real' ? F.formula : `${vf.C.formula},  t ∈ [${tLabel(s.curve, s.k0)}, ${tLabel(s.curve, s.k1)}]`;
    const l2 = s.mode === 'real' ? `f(b) − f(a) = ${degenerate ? '0' : sig(mv.slope, 4)}` : `γ(t₁) − γ(t₀) = ${pt(vf.v)}`;
    const lx = narrow ? 8 : box.x + 8;
    const room = narrow ? Math.max(60, view.w - toolsW - lx) : box.w - 16;
    if (!narrow) {
      // a paper backing: inside the plane the legend sits on the level curves
      const w = Math.min(room, Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width));
      ctx.fillStyle = withAlpha(p.paper, 0.85);
      ctx.fillRect(lx - 4, box.y + 2, w + 8, 40);
    }
    ctx.fillStyle = p.curve;
    ctx.fillText(l1, lx, narrow ? 14 : box.y + 12, room);
    ctx.fillStyle = s.mode === 'real' ? p.eps : p.limit;
    ctx.fillText(l2, lx, narrow ? 31 : box.y + 30, room);
    ctx.restore();

    // ---------------- lower panel
    const box2 = insetBox({ x: 0, y: splitY, w: view.w, h: view.h - splitY }, { l: narrow ? 34 : 42, r: 12, t: narrow ? 24 : 12, b: 24 });
    ctx.save();
    if (s.mode === 'real') {
      const N = 300;
      const ys: number[] = [];
      for (let i = 0; i <= N; i++) ys.push(phi(F, s.a, s.b, i / N));
      let ymin = Math.min(...ys);
      let ymax = Math.max(...ys);
      if (ymax - ymin < 1e-6) {
        ymin -= 0.5;
        ymax += 0.5;
      }
      const pad = (ymax - ymin) * 0.12;
      const plot2 = makePlot(
        box2,
        { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1], format: (v) => sig(v, 3) },
        { min: ymin - pad, max: ymax + pad, ticks: niceTicks(ymin - pad, ymax + pad, narrow ? 3 : 4), format: (v) => sig(v, 3) },
      );
      drawAxes(ctx, plot2, p);
      const X2 = plot2.px;
      const Y2 = plot2.py;
      ctx.beginPath();
      ctx.rect(box2.x, box2.y - 2, box2.w, box2.h + 4);
      ctx.clip();
      // φ
      ctx.strokeStyle = p.curve;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ys.forEach((y, i) => (i ? ctx.lineTo(X2(i / N), Y2(y)) : ctx.moveTo(X2(i / N), Y2(y))));
      ctx.stroke();
      // the chord
      ctx.strokeStyle = p.eps;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(X2(0), Y2(ys[0]));
      ctx.lineTo(X2(1), Y2(ys[N]));
      ctx.stroke();
      // the tangents parallel to the chord, at each τ
      if (!degenerate && !mv.all) {
        const w = 0.14;
        for (const t of mv.roots) {
          const y = phi(F, s.a, s.b, t);
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = p.eps;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(X2(t - w), Y2(y - w * mv.slope));
          ctx.lineTo(X2(t + w), Y2(y + w * mv.slope));
          ctx.stroke();
          ctx.strokeStyle = withAlpha(p.limit, 0.7);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(X2(t), Y2(y));
          ctx.lineTo(X2(t), box2.y + box2.h);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(X2(t), Y2(y), 5.5, 0, 2 * Math.PI);
          ctx.fillStyle = p.limit;
          ctx.fill();
        }
      }
      ctx.restore();
      ctx.save();
      ctx.font = `600 ${narrow ? 11 : 12}px ${p.fontUi}`;
      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = p.curve;
      ctx.fillText('φ(t) = f(a + t(b − a))', box2.x + 6, narrow ? box2.y - 12 : box2.y + 10);
    } else {
      const { C, t0, t1 } = vf;
      const N = 300;
      const gs: number[] = [];
      for (let i = 0; i <= N; i++) gs.push(gap(C, t0, t1, t0 + ((t1 - t0) * i) / N));
      const top = Math.max(0.05, ...gs) * 1.12;
      const plot2 = makePlot(
        box2,
        { min: t0, max: t1, ticks: niceTicks(t0, t1, narrow ? 3 : 5), format: (v) => sig(v, 3) },
        { min: 0, max: top, ticks: niceTicks(0, top, narrow ? 2 : 3), format: (v) => sig(v, 3) },
      );
      drawAxes(ctx, plot2, p);
      const X2 = plot2.px;
      const Y2 = plot2.py;
      ctx.beginPath();
      ctx.rect(box2.x - 8, box2.y - 2, box2.w + 16, box2.h + 12);
      ctx.clip();
      ctx.strokeStyle = p.delta;
      ctx.lineWidth = 2;
      ctx.beginPath();
      gs.forEach((g, i) => {
        const x = X2(t0 + ((t1 - t0) * i) / N);
        if (i) ctx.lineTo(x, Y2(g));
        else ctx.moveTo(x, Y2(g));
      });
      ctx.stroke();
      // the component points on the c-axis: triangles (first), squares (second); a band when every c works
      const yAxis = box2.y + box2.h;
      const tri = (x: number) => {
        ctx.beginPath();
        ctx.moveTo(x, yAxis - 13);
        ctx.lineTo(x - 6, yAxis - 3);
        ctx.lineTo(x + 6, yAxis - 3);
        ctx.closePath();
        ctx.fillStyle = p.eps;
        ctx.fill();
      };
      const sq = (x: number) => {
        ctx.fillStyle = p.curve;
        ctx.fillRect(x - 5, yAxis - 24, 10, 10);
      };
      if (vf.c1.all) {
        ctx.fillStyle = withAlpha(p.eps, 0.5);
        ctx.fillRect(box2.x, yAxis - 8, box2.w, 5);
      } else vf.c1.roots.forEach((c) => tri(X2(c)));
      if (vf.c2.all) {
        ctx.fillStyle = withAlpha(p.curve, 0.4);
        ctx.fillRect(box2.x, yAxis - 21, box2.w, 5);
      } else vf.c2.roots.forEach((c) => sq(X2(c)));
      ctx.restore();
      ctx.save();
      ctx.font = `600 ${narrow ? 10 : 12}px ${p.fontUi}`;
      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = p.delta;
      ctx.fillText('‖(t₁ − t₀)γ′(c) − (γ(t₁) − γ(t₀))‖', box2.x + 6, narrow ? box2.y - 13 : box2.y + 8, box2.w - 12);
      if (!narrow) {
        ctx.fillStyle = p.eps;
        ctx.fillText('▲ c₁', box2.x + box2.w - 90, box2.y + 8);
        ctx.fillStyle = p.curve;
        ctx.fillText('■ c₂', box2.x + box2.w - 45, box2.y + 8);
      }
    }
    ctx.restore();
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 0.8, worldHeight: 1, animate: false });
  useEffect(invalidate, [s, mv, vf, contours]);

  // dragging the ends of the segment (mode 'real')
  const world = (e: PointerEvent): Vec2 | null => {
    const plot = topRef.current;
    if (!plot || e.offsetY > plot.box.y + plot.box.h + 12) return null;
    const x = plot.x.min + ((e.offsetX - plot.box.x) / plot.box.w) * (plot.x.max - plot.x.min);
    const y = plot.y.max - ((e.offsetY - plot.box.y) / plot.box.h) * (plot.y.max - plot.y.min);
    return [x, y];
  };
  const onPointerDown = (e: PointerEvent) => {
    if (s.mode !== 'real') return;
    const w = world(e);
    if (!w) return;
    const da = Math.hypot(w[0] - s.a[0], w[1] - s.a[1]);
    const db = Math.hypot(w[0] - s.b[0], w[1] - s.b[1]);
    drag.current = db <= da ? 'b' : 'a';
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const q = snapP(w);
    const cur = drag.current === 'a' ? s.a : s.b;
    if (q[0] !== cur[0] || q[1] !== cur[1]) userSet({ [drag.current]: q } as Partial<State>);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!drag.current) return;
    const w = world(e);
    if (!w) return;
    const q = snapP(w);
    const cur = drag.current === 'a' ? s.a : s.b;
    if (q[0] !== cur[0] || q[1] !== cur[1]) userSet({ [drag.current]: q } as Partial<State>);
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const dir: Record<string, Vec2> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const d = dir[e.key];
    if (!d) return;
    e.preventDefault();
    if (s.mode === 'real') {
      const key = e.shiftKey ? 'a' : 'b';
      const cur = s[key];
      userSet({ [key]: snapP([cur[0] + d[0] * GRID, cur[1] + d[1] * GRID]) } as Partial<State>);
    } else if (d[0] !== 0) {
      if (e.shiftKey) userSet({ k0: s.k0 + d[0] }, 0);
      else userSet({ k1: s.k1 + d[0] }, 1);
    }
  };

  const fns = (props.fns ?? []).filter((id) => id in REAL);
  const curves = (props.curves ?? []).filter((id) => id in CURVES);

  const readout =
    s.mode === 'real' ? (
      <>
        <span data-readout="fn">
          <Q>{F.formula}</Q>, <Q>{`a = ${pt(s.a)}`}</Q>, <Q>{`b = ${pt(s.b)}`}</Q>
        </span>
        <span data-readout="slope">
          ההפרש <Q>{`f(b) − f(a) = φ(1) − φ(0) = ${degenerate ? '0' : sig(mv.slope)}`}</Q>
        </span>
        <span data-readout="tau">
          {degenerate ? (
            <>הקצוות מתלכדים: אין קטע.</>
          ) : mv.all ? (
            <>
              <Q>φ</Q> לינארית על הקטע: כל <Q>τ</Q> מתאים.
            </>
          ) : mv.roots.length === 0 ? (
            <>לא נמצאה נקודה ברשת (בדיקה מספרית).</>
          ) : (
            <>
              {mv.roots.length === 1 ? 'נקודת הערך הממוצע' : `${mv.roots.length} נקודות ערך ממוצע`}:{' '}
              {mv.roots.map((t, i) => (
                <span key={i}>
                  {i > 0 ? '; ' : ''}
                  <Q>{`τ = ${sig(t)}, c = ${pt(mv.points[i])}`}</Q>
                </span>
              ))}
            </>
          )}
        </span>
      </>
    ) : (
      <>
        <span data-readout="curve">
          <Q>{vf.C.formula}</Q> על <Q>{`[${tLabel(s.curve, s.k0)}, ${tLabel(s.curve, s.k1)}]`}</Q>
        </span>
        <span data-readout="chord">
          <Q>{`γ(t₁) − γ(t₀) = ${pt(vf.v)}`}</Q>, באורך <Q>{sig(Math.hypot(vf.v[0], vf.v[1]), 4)}</Q>
        </span>
        <span data-readout="components">
          לכל רכיב לחוד (לגרנז'):{' '}
          <Q>{`c₁ ${vf.c1.all ? '= כל נקודה' : `≈ ${vf.c1.roots.map((t) => sig(t, 4)).join(', ') || '—'}`}`}</Q>;{' '}
          <Q>{`c₂ ${vf.c2.all ? '= כל נקודה' : `≈ ${vf.c2.roots.map((t) => sig(t, 4)).join(', ') || '—'}`}`}</Q>
        </span>
        <span data-readout="common">
          {vf.common.length ? (
            <>
              יש נקודה משותפת: <Q>{`c ≈ ${sig(vf.common[0], 4)}`}</Q>
            </>
          ) : (
            <>
              אין <Q>c</Q> אחת לשני הרכיבים: המועמד הקרוב ביותר מחטיא ב-<Q>{`≈ ${sig(vf.near.gap, 3)}`}</Q> (על רשת)
            </>
          )}
        </span>
        <span data-readout="ratio">
          מהירות ממוצעת <Q>{`‖γ(t₁) − γ(t₀)‖/(t₁ − t₀) ≈ ${sig(vf.q, 4)}`}</Q> לעומת <Q>{`sup‖γ′‖ = ${sig(vf.sup, 4)}`}</Q>
        </span>
      </>
    );

  const controls =
    s.mode === 'real' ? (
      <>
        {fns.length > 1 && (
          <div class="group" role="group" aria-label="הפונקציה">
            {fns.map((id) => (
              <Toggle key={id} label={<bdi dir="ltr">{REAL[id].formula}</bdi>} on={s.fn === id} onChange={() => userSet({ fn: id })} />
            ))}
          </div>
        )}
        <Slider label="a₁" value={s.a[0]} min={-R} max={R} step={GRID} format={(v) => sig(v, 3)} onChange={(v) => userSet({ a: snapP([v, s.a[1]]) })} />
        <Slider label="a₂" value={s.a[1]} min={-R} max={R} step={GRID} format={(v) => sig(v, 3)} onChange={(v) => userSet({ a: snapP([s.a[0], v]) })} />
        <Slider label="b₁" value={s.b[0]} min={-R} max={R} step={GRID} format={(v) => sig(v, 3)} onChange={(v) => userSet({ b: snapP([v, s.b[1]]) })} />
        <Slider label="b₂" value={s.b[1]} min={-R} max={R} step={GRID} format={(v) => sig(v, 3)} onChange={(v) => userSet({ b: snapP([s.b[0], v]) })} />
      </>
    ) : (
      <>
        {curves.length > 1 && (
          <div class="group" role="group" aria-label="המסילה">
            {curves.map((id) => (
              <Toggle key={id} label={<bdi dir="ltr">{CURVES[id].formula}</bdi>} on={s.curve === id} onChange={() => userSet({ curve: id })} />
            ))}
          </div>
        )}
        <Slider label="t₀" value={s.k0} min={0} max={kMax(s.curve)} step={1} format={(k) => tLabel(s.curve, k)} onChange={(k) => userSet({ k0: k }, 0)} />
        <Slider label="t₁" value={s.k1} min={0} max={kMax(s.curve)} step={1} format={(k) => tLabel(s.curve, k)} onChange={(k) => userSet({ k1: k }, 1)} />
      </>
    );

  const label =
    s.mode === 'real'
      ? `איור חי: קווי הגובה של פונקציה ממשית, קטע מ-a ל-b ונקודות הערך הממוצע עליו; למטה, הצמצום של הפונקציה לקטע, המיתר שלו והמשיקים המקבילים למיתר. גררו את הקצוות; במקלדת החצים מזיזים את b, ועם Shift את a. ${describe()}`
      : `איור חי: מסילה במישור, ההעתק בין שתי נקודות עליה (חץ ירוק), והמועמדים (t₁ − t₀)γ′(c) מאותה נקודה (חצים כחולים); למטה, המרחק בין המועמד להעתק לכל c, ועל הציר הנקודות של כל רכיב לחוד. במקלדת החצים ימינה ושמאלה מזיזים את t₁, ועם Shift את t₀. ${describe()}`;

  return (
    <SimShell
      fig={props.id}
      label={label}
      canvasRef={canvasRef}
      aspect={0.8}
      live={live}
      tasks={tasks}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      cursor={s.mode === 'real' ? 'grab' : 'default'}
      onReset={() => {
        setS(fresh(props));
        setLive('האיור אופס.');
      }}
      readout={readout}
      controls={controls}
    />
  );
}
