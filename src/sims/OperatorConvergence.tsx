/**
 * Lesson 1.9's figure: convergence of a sequence of linear maps in the operator norm, and what it is not.
 *
 * mode 'matrix' (fig-1-9a): a sequence of 2×2 matrices A_k compared with a matrix A (its limit; for `flip`, which has
 * no limit, the identity), in one plane with equal axis scales and the same p-norm (p = 1, 2, ∞) on both sides.
 * The main panel (left) draws the unit sphere {‖x‖_p = 1} (faint, dashed), its image under A (green, a broad soft
 * line) and its image under A_k (ink, a thin line), and one sample vector x₀ on the unit sphere with A x₀ (a green
 * cross) and A_k x₀ (an ink dot). With `showError` a second panel (right, its own fixed zoom) draws the image of
 * the unit ball under A_k − A (ink) and the ε-ball of ‖·‖_p (warm band), with a marker at the point of the error
 * image farthest from 0 (‖·‖_p = ‖A_k − A‖_p): filled when the error image lies inside the ε-ball (‖A_k − A‖_p < ε),
 * hollow with a ring otherwise (shape, not only colour). Readouts: k, A_k and A, ‖A_k − A‖_p (opNorm), the largest
 * entry |a_ij^(k) − a_ij|, ‖A_k‖_p and ‖A‖_p.
 *
 * mode 'functional' (fig-1-9b): the space C[0,1] with ‖·‖∞ and T_k f = f(1/k) − f(0). The graph of f on [0,1]
 * (ink), the band {|y − f(0)| < ε} (warm), the point (0, f(0)) and the point (1/k, f(1/k)) joined to the level
 * f(0) by a vertical segment of signed length T_k f; the point at 1/k is filled when |T_k f| < ε and hollow with a
 * ring otherwise. With `showWitness`: the witness g_k(x) = min(1, 2kx − 1) (the second ink colour, dashed), its
 * points (0, −1) and (1/k, 1) as squares, and readouts ‖g_k‖∞ = 1 and T_k g_k = 2: why ‖T_k‖ = 2 for every k
 * although T_k f → 0 for every f.
 *
 * Every number comes from src/math/opconv.ts (closed values; the norms from multivar.opNorm). The figure shows
 * k ≤ 60 only, so "from this k on" is checked on that window; the lesson proves the limits.
 */

import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  CONVERGES,
  FNS,
  Tk,
  below,
  entryErr,
  errMatrix,
  errNorm,
  seqMatrix,
  seqTarget,
  tailStart,
  witness,
  witnessSup,
  type FnId,
  type M2,
  type SeqId,
} from '~/math/opconv';
import { opNorm } from '~/math/multivar';
import { apply, imageOutline, maximiser, sphereOutline, spherePoint, type P, type V2 } from '~/math/opnorm2d';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { withAlpha } from './core/ink';
import { drawAxes, drawCurve, insetBox, makePlot, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

export type PId = '1' | '2' | 'inf';
export type { FnId, SeqId };

export interface OperatorConvergenceProps {
  /** the figure id (Spread passes it) */
  id: string;
  mode: 'matrix' | 'functional';
  /** the index k, 1–60 */
  k?: number;
  /** the radius ε, 0.05–1 */
  eps?: number;
  tasks?: string[];
  /** matrix mode */
  p?: PId;
  ps?: PId[];
  seq?: SeqId;
  seqs?: SeqId[];
  showError?: boolean;
  /** functional mode */
  f?: FnId;
  fs?: FnId[];
  showWitness?: boolean;
}

const K_MAX = 60;
const EPS_MIN = 0.05;
const EPS_MAX = 1;

const TASK_LABEL: Record<string, string> = {
  'enter-eps':
    'בסדרה מתכנסת, עם השגיאה מוצגת: הגדילו את k עד שתמונת כדור היחידה תחת ⁦Aₖ − A⁩ נכנסת כולה לכדור ε, כלומר ⁦‖Aₖ − A‖ < ε⁩.',
  'norms-not-maps':
    'בסדרה עם הסימן המתחלף: קבעו k אי-זוגי, ושימו לב ש-⁦‖Aₖ‖ = ‖I‖⁩ ובכל זאת ⁦‖Aₖ − I‖ = 2⁩.',
  'pointwise-small': 'בחרו פונקציה f והגדילו את k עד ש-⁦|Tₖf| < ε⁩ מאותו k והלאה.',
  'witness-2':
    'הציגו את פונקציית העד ⁦gₖ⁩ וקבעו ⁦k ≥ 10⁩: אף ש-⁦1/k⁩ קרוב ל-0, עדיין ⁦‖gₖ‖ = 1⁩ ו-⁦Tₖgₖ = 2⁩.',
};

const P_OF: Record<PId, P> = { '1': 1, '2': 2, inf: Infinity };
const P_LABEL: Record<PId, string> = { '1': 'p = 1', '2': 'p = 2', inf: 'p = ∞' };
const SEQ_LABEL: Record<SeqId, string> = { shear: 'משולשת', rot: 'סיבוב', scale: 'אלכסונית', flip: 'סימן מתחלף' };
const FN_LABEL: Record<FnId, string> = { sqrt: '√x', cos3: 'cos 3x', x2: 'x²', sinpi: 'sin πx' };
const SEQ_IDS = Object.keys(SEQ_LABEL) as SeqId[];
const FN_IDS = Object.keys(FN_LABEL) as FnId[];
/** the sample vector x₀: the point of the unit p-sphere at 35° */
const X0_DEG = 35;

const minus = (t: string) => t.replace(/^-/, '−');
const fmt = (v: number) => minus(sci(Math.round(v * 1e6) / 1e6, 4));
const matText = (A: M2) => `(${fmt(A[0][0])}, ${fmt(A[0][1])}; ${fmt(A[1][0])}, ${fmt(A[1][1])})`;
const clampK = (v: number) => Math.min(K_MAX, Math.max(1, Math.round(v)));
const clampEps = (v: number) => Math.min(EPS_MAX, Math.max(EPS_MIN, Math.round(v * 100) / 100));

interface State {
  k: number;
  eps: number;
  p: PId;
  seq: SeqId;
  showError: boolean;
  f: FnId;
  showWitness: boolean;
}

function fresh(props: OperatorConvergenceProps): State {
  return {
    k: clampK(props.k ?? 1),
    eps: clampEps(props.eps ?? 0.2),
    p: props.p ?? '2',
    seq: props.seq ?? 'shear',
    showError: props.showError ?? false,
    f: props.f ?? 'sqrt',
    showWitness: props.showWitness ?? false,
  };
}

/** From this k on (within k ≤ 60) the error stays below ε; null when it does not. */
const matrixTail = (st: State) => tailStart((j) => errNorm(st.seq, j, P_OF[st.p]), st.eps, K_MAX);
const fnTail = (st: State) => tailStart((j) => Math.abs(Tk(FNS[st.f], j)), st.eps, K_MAX);

/** A filled point (inside) or a hollow point with a ring (outside): shape, not only colour. */
function inOutMarker(ctx: CanvasRenderingContext2D, pal: Palette, x: number, y: number, inside: boolean) {
  ctx.save();
  if (inside) {
    ctx.fillStyle = pal.pointIn;
    ctx.beginPath();
    ctx.arc(x, y, 6.5, 0, 2 * Math.PI);
    ctx.fill();
  } else {
    ctx.fillStyle = pal.paper;
    ctx.strokeStyle = pal.pointOut;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, 2 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}

/** Text with a paper halo, LTR (math space). */
function label(ctx: CanvasRenderingContext2D, pal: Palette, t: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left') {
  ctx.save();
  ctx.font = `700 13px ${pal.fontUi}`;
  ctx.direction = 'ltr';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = pal.paper;
  ctx.lineWidth = 4;
  ctx.strokeText(t, x, y);
  ctx.fillStyle = color;
  ctx.fillText(t, x, y);
  ctx.restore();
}

export default function OperatorConvergence(props: OperatorConvergenceProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const matrix = props.mode === 'matrix';

  // matrix mode
  const p = P_OF[s.p];
  const Ak = seqMatrix(s.seq, s.k);
  const A = seqTarget(s.seq);
  const E = errMatrix(s.seq, s.k);
  const err = errNorm(s.seq, s.k, p);
  const entry = entryErr(s.seq, s.k);
  const nAk = opNorm(Ak, p);
  const nA = opNorm(A, p);
  const errIn = below(err, s.eps);

  // functional mode
  const fn = FNS[s.f];
  const tk = Tk(fn, s.k);
  const tkIn = below(Math.abs(tk), s.eps);
  const g = witness(s.k);
  const gSup = witnessSup(s.k);
  const tg = Tk(g, s.k);

  /** fixed extents per (sequence, p), so the scale does not move as k moves */
  const extent = useMemo(() => {
    let x = 1;
    let y = 1;
    let e = 0;
    for (let j = 1; j <= K_MAX; j++) {
      for (const q of imageOutline(seqMatrix(s.seq, j), p, 96)) {
        x = Math.max(x, Math.abs(q[0]));
        y = Math.max(y, Math.abs(q[1]));
      }
      e = Math.max(e, errNorm(s.seq, j, p));
    }
    return { x, y, e };
  }, [s.seq, s.p]);

  /** The student's own change: a text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    setS(next);
    const has = (t: string) => !!props.tasks?.includes(t);
    if (matrix) {
      if (has('enter-eps') && next.showError && CONVERGES[next.seq]) {
        const K = matrixTail(next);
        if (K !== null && next.k >= K) markTask(`${props.id}:enter-eps`);
      }
      if (has('norms-not-maps') && next.seq === 'flip' && next.k % 2 === 1) markTask(`${props.id}:norms-not-maps`);
    } else {
      if (has('pointwise-small')) {
        const K = fnTail(next);
        if (K !== null && next.k >= K) markTask(`${props.id}:pointwise-small`);
      }
      const moved = patch.k !== undefined || patch.showWitness !== undefined;
      if (has('witness-2') && moved && next.showWitness && next.k >= 10) markTask(`${props.id}:witness-2`);
    }
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.k === 'number') next.k = clampK(st.k);
          if (typeof st.eps === 'number') next.eps = clampEps(st.eps);
          if (typeof st.p === 'string' && st.p in P_OF) next.p = st.p as PId;
          if (typeof st.seq === 'string' && st.seq in SEQ_LABEL) next.seq = st.seq as SeqId;
          if (typeof st.showError === 'boolean') next.showError = st.showError;
          if (typeof st.f === 'string' && st.f in FN_LABEL) next.f = st.f as FnId;
          if (typeof st.showWitness === 'boolean') next.showWitness = st.showWitness;
          return next;
        });
      }),
    [props.id],
  );

  const flip = s.seq === 'flip';
  const verdictM = errIn ? 'התמונה של השגיאה בתוך כדור ε.' : 'התמונה של השגיאה יוצאת מכדור ε.';
  const verdictF = tkIn ? '⁦|Tₖf| < ε⁩.' : '⁦|Tₖf| ≥ ε⁩.';
  const describe = () =>
    matrix
      ? `${SEQ_LABEL[s.seq]}, ${P_LABEL[s.p]}, k = ${s.k}. Aₖ = ${matText(Ak)}, ${flip ? 'משווים ל-I' : 'הגבול A'} = ${matText(A)}. ` +
        `‖Aₖ − A‖ = ${fmt(err)}, ‖Aₖ‖ = ${fmt(nAk)}, ‖A‖ = ${fmt(nA)}.` +
        (s.showError ? ` ε = ${s.eps.toFixed(2)}. ${verdictM}` : '')
      : `f(x) = ${FN_LABEL[s.f]}, k = ${s.k}, 1/k = ${fmt(1 / s.k)}. Tₖf = f(1/k) − f(0) = ${fmt(tk)}. ε = ${s.eps.toFixed(2)}. ${verdictF}` +
        (s.showWitness ? ` gₖ: ‖gₖ‖∞ = ${fmt(gSup)}, Tₖgₖ = ${fmt(tg)}.` : '');

  useEffect(() => {
    const t = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(t);
  }, [s]);

  const drawMatrix = ({ ctx, view, palette: pal }: FrameInfo) => {
    const split = s.showError;
    const gap = split ? 10 : 0;
    const mainW = split ? Math.round(view.w * 0.58) : view.w;
    const errW = view.w - mainW - gap;

    // ---- main panel: the unit sphere, its images under A and A_k, and x₀ ----
    const hx = extent.x * 1.12;
    const hy = extent.y * 1.12;
    const k = Math.min(mainW / (2 * hx), view.h / (2 * hy));
    const cx = mainW / 2;
    const cy = view.h / 2;
    const S = (q: readonly number[]): [number, number] => [cx + q[0] * k, cy - q[1] * k];
    const poly = (pts: V2[]) => {
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(...S(q)) : ctx.moveTo(...S(q))));
      ctx.closePath();
    };

    ctx.save();
    ctx.strokeStyle = withAlpha(pal.ink3, 0.55);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(mainW, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, view.h);
    ctx.stroke();

    // the unit sphere: faint, dashed
    poly(sphereOutline(p, 1));
    ctx.strokeStyle = withAlpha(pal.ink3, 0.8);
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // the image under A: green, broad and soft, so the thin ink A_k reads on top of it where they meet
    poly(imageOutline(A, p));
    ctx.strokeStyle = withAlpha(pal.limit, 0.55);
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // the image under A_k: ink, thin
    poly(imageOutline(Ak, p));
    ctx.strokeStyle = pal.curve;
    ctx.lineWidth = 2;
    ctx.stroke();

    // x₀ and its images: A x₀ a green cross, A_k x₀ an ink dot
    const x0 = spherePoint(p, (X0_DEG * Math.PI) / 180);
    const [ax, ay] = S(apply(A, x0));
    const [bx, by] = S(apply(Ak, x0));
    const [xx, xy] = S(x0);
    ctx.fillStyle = withAlpha(pal.ink3, 0.9);
    ctx.beginPath();
    ctx.arc(xx, xy, 3.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = pal.limit;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(ax - 7, ay - 7);
    ctx.lineTo(ax + 7, ay + 7);
    ctx.moveTo(ax + 7, ay - 7);
    ctx.lineTo(ax - 7, ay + 7);
    ctx.stroke();
    ctx.fillStyle = pal.curve;
    ctx.beginPath();
    ctx.arc(bx, by, 4.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();

    label(ctx, pal, 'x₀', xx + 7, xy + 12, pal.ink3);
    label(ctx, pal, flip ? 'Ix₀' : 'Ax₀', ax + 10, ay - 12, pal.limit);
    label(ctx, pal, 'Aₖx₀', bx + 10, by + 14, pal.curve);
    // the legend, top-left of the panel
    label(ctx, pal, `Aₖ, k = ${s.k}`, 10, 16, pal.curve);
    label(ctx, pal, flip ? 'I' : 'A', 10, 34, pal.limit);
    label(ctx, pal, `‖x‖ = 1 (${P_LABEL[s.p]})`, 10, view.h - 14, pal.ink3);

    if (!split) return;

    // ---- error panel: the image of the unit ball under A_k − A, and the ε-ball ----
    const ox = mainW + gap;
    ctx.save();
    ctx.strokeStyle = pal.rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ox - gap / 2, 8);
    ctx.lineTo(ox - gap / 2, view.h - 8);
    ctx.stroke();
    const R = Math.max(s.eps, extent.e) * 1.15;
    const top = 30;
    const side = Math.min(errW, view.h - top - 24);
    const ek = side / (2 * R);
    const ecx = ox + errW / 2;
    const ecy = top + side / 2;
    const T = (q: readonly number[]): [number, number] => [ecx + q[0] * ek, ecy - q[1] * ek];
    const epoly = (pts: V2[]) => {
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(...T(q)) : ctx.moveTo(...T(q))));
      ctx.closePath();
    };
    ctx.strokeStyle = withAlpha(pal.ink3, 0.55);
    ctx.beginPath();
    ctx.moveTo(ecx - side / 2, ecy);
    ctx.lineTo(ecx + side / 2, ecy);
    ctx.moveTo(ecx, ecy - side / 2);
    ctx.lineTo(ecx, ecy + side / 2);
    ctx.stroke();

    epoly(sphereOutline(p, s.eps));
    ctx.fillStyle = pal.epsBand;
    ctx.fill();
    ctx.strokeStyle = pal.eps;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    epoly(imageOutline(E, p));
    ctx.strokeStyle = pal.curve;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();

    // the farthest point of the error image: on the sphere of radius ‖A_k − A‖_p
    const far = apply(E, maximiser(E, p));
    const [fx, fy] = T(far);
    inOutMarker(ctx, pal, fx, fy, errIn);

    label(ctx, pal, flip ? 'Aₖ − I' : 'Aₖ − A', ox + 4, 14, pal.curve);
    // under the panel title, on the left: the top-right corner of the stage belongs to the reset/fullscreen buttons
    label(ctx, pal, `ε = ${s.eps.toFixed(2)}`, ox + 4, 32, pal.eps);
    label(ctx, pal, `‖Aₖ − A‖ = ${fmt(err)}`, ecx, Math.min(view.h - 12, ecy + side / 2 + 14), pal.curve, 'center');
  };

  const drawFunctional = ({ ctx, view, palette: pal }: FrameInfo) => {
    const narrow = view.w < 420;
    const box = insetBox({ x: 0, y: 0, w: view.w, h: view.h }, { l: narrow ? 36 : 44, r: 14, t: 26, b: 26 });
    const plot: Plot = makePlot(
      box,
      { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1], format: (v) => String(v) },
      { min: -1.3, max: 1.3, ticks: [-1, -0.5, 0, 0.5, 1], format: (v) => minus(String(v)) },
    );
    drawAxes(ctx, plot, pal);
    const X = plot.px;
    const Y = plot.py;
    const xk = 1 / s.k;
    const f0 = fn(0);
    const fk = fn(xk);

    ctx.save();
    // the line y = 0
    ctx.strokeStyle = withAlpha(pal.ink3, 0.8);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(box.x, Y(0));
    ctx.lineTo(box.x + box.w, Y(0));
    ctx.stroke();

    // the band |y − f(0)| < ε
    const yTop = Y(Math.min(1.3, f0 + s.eps));
    const yBot = Y(Math.max(-1.3, f0 - s.eps));
    ctx.fillStyle = pal.epsBand;
    ctx.fillRect(box.x, yTop, box.w, yBot - yTop);
    ctx.strokeStyle = pal.eps;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(box.x, yTop);
    ctx.lineTo(box.x + box.w, yTop);
    ctx.moveTo(box.x, yBot);
    ctx.lineTo(box.x + box.w, yBot);
    ctx.stroke();

    // the vertical x = 1/k
    ctx.strokeStyle = withAlpha(pal.ink3, 0.8);
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(X(xk), box.y);
    ctx.lineTo(X(xk), box.y + box.h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // the witness g_k: piecewise linear through its nodes, drawn exactly
    if (s.showWitness) {
      ctx.save();
      ctx.strokeStyle = pal.curve2;
      ctx.lineWidth = 2.2;
      ctx.setLineDash([7, 4]);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(X(0), Y(g(0)));
      ctx.lineTo(X(xk), Y(g(xk)));
      ctx.lineTo(X(1), Y(g(1)));
      ctx.stroke();
      ctx.setLineDash([]);
      // its jump T_k g_k: a vertical segment from g_k(0) = −1 to g_k(1/k) = 1, a little to the right of x = 1/k
      const sx = X(xk) + 5;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx, Y(g(0)));
      ctx.lineTo(sx, Y(g(xk)));
      ctx.stroke();
      ctx.fillStyle = pal.curve2;
      for (const [qx, qy] of [[X(0), Y(g(0))], [X(xk), Y(g(xk))]]) ctx.fillRect(qx - 5, qy - 5, 10, 10);
      ctx.restore();
      label(ctx, pal, 'gₖ', X(Math.min(0.9, xk + 0.12)), Y(1) - 12, pal.curve2);
      label(ctx, pal, `Tₖgₖ = ${fmt(tg)}`, sx + 8, Y(-0.55), pal.curve2);
    }

    // the graph of f
    drawCurve(ctx, plot, fn, { color: pal.curve, width: 2.4, samples: 600 });

    // the level f(0) up to x = 1/k, and the segment T_k f at x = 1/k
    ctx.save();
    ctx.strokeStyle = pal.curve;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(X(0), Y(f0));
    ctx.lineTo(X(xk), Y(f0));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(X(xk), Y(f0));
    ctx.lineTo(X(xk), Y(fk));
    ctx.stroke();
    ctx.fillStyle = pal.curve;
    ctx.beginPath();
    ctx.arc(X(0), Y(f0), 4.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
    inOutMarker(ctx, pal, X(xk), Y(fk), tkIn);

    // centred, not right-aligned: the top-right corner of the stage belongs to the reset/fullscreen buttons
    label(ctx, pal, `f(x) = ${FN_LABEL[s.f]}`, box.x + box.w / 2, box.y - 12, pal.curve, 'center');
    label(ctx, pal, `ε = ${s.eps.toFixed(2)}`, box.x + 6, box.y - 12, pal.eps);
    const ty = Y((f0 + fk) / 2);
    label(ctx, pal, `Tₖf = ${fmt(tk)}`, X(xk) + 14, Math.abs(Y(fk) - Y(f0)) < 18 ? Y(fk) - 18 : ty, pal.curve);
    label(ctx, pal, `1/k = ${fmt(xk)}`, Math.max(X(xk), box.x + 34), box.y + box.h - 10, pal.ink3, 'left');
  };

  const draw = (fi: FrameInfo) => (matrix ? drawMatrix(fi) : drawFunctional(fi));
  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 2, worldHeight: 2, animate: false });
  useEffect(invalidate, [s, extent]);

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const k = clampK(s.k + step * (e.shiftKey ? 10 : 1));
    if (k !== s.k) userSet({ k });
  };

  const ps = props.ps ?? [];
  const seqs = (props.seqs ?? []).filter((q) => SEQ_IDS.includes(q));
  const fs = (props.fs ?? []).filter((q) => FN_IDS.includes(q));
  const kStar = matrix ? (CONVERGES[s.seq] ? matrixTail(s) : null) : fnTail(s);

  const readMatrix = (
    <>
      <span data-readout="k">
        <b class="q">k = {s.k}</b>, <b class="q">Aₖ = {matText(Ak)}</b>,{' '}
        {flip ? 'משווים ל-' : 'הגבול '}
        <b class="q">
          {flip ? 'I' : 'A'} = {matText(A)}
        </b>
        {flip && '. לסדרה הזאת אין גבול'}
      </span>
      <span data-readout="err">
        ‖Aₖ − {flip ? 'I' : 'A'}‖ ({P_LABEL[s.p]}) = <b class="q">{fmt(err)}</b>; הכניסה הגדולה ביותר של ההפרש:{' '}
        <b class="q">{fmt(entry)}</b>
        {s.showError && (
          <>
            . <b class="q">ε = {s.eps.toFixed(2)}</b>: {verdictM}
          </>
        )}
      </span>
      <span data-readout="norms">
        הנורמות עצמן: <b class="q">‖Aₖ‖ = {fmt(nAk)}</b>, <b class="q">‖{flip ? 'I' : 'A'}‖ = {fmt(nA)}</b>
      </span>
    </>
  );

  const readFunctional = (
    <>
      <span data-readout="k">
        <b class="q">k = {s.k}</b>, <b class="q">1/k = {fmt(1 / s.k)}</b>
      </span>
      <span data-readout="tf">
        <b class="q">
          Tₖf = f(1/k) − f(0) = {fmt(fn(1 / s.k))} − {fmt(fn(0))} = {fmt(tk)}
        </b>
        . <b class="q">ε = {s.eps.toFixed(2)}</b>: {verdictF}
        {kStar !== null && s.k >= kStar && ' כך גם לכל k גדול יותר באיור.'}
      </span>
      {s.showWitness && (
        <span data-readout="witness">
          פונקציית העד: <b class="q">‖gₖ‖∞ = {fmt(gSup)}</b>, <b class="q">Tₖgₖ = {fmt(tg)}</b>, ולכן{' '}
          <b class="q">‖Tₖ‖ ≥ {fmt(Math.abs(tg) / gSup)}</b>
        </span>
      )}
    </>
  );

  const ariaWhat = matrix
    ? 'איור חי: סדרת מטריצות Aₖ והמטריצה A שאליה משווים אותה. ספרת היחידה, התמונה שלה תחת A ותחת Aₖ, ותמונת כדור היחידה תחת ההפרש לעומת כדור ε.'
    : 'איור חי: הגרף של פונקציה f בקטע [0,1], הנקודות ב-0 וב-1/k, וההפרש Tₖf. אפשר להציג גם את פונקציית העד gₖ.';

  return (
    <SimShell
      fig={props.id}
      label={`${ariaWhat} במקלדת: החצים משנים את k באחד, ועם Shift בעשר. ${describe()}`}
      canvasRef={canvasRef}
      aspect={matrix ? 1.5 : 1.4}
      live={live}
      tasks={tasks}
      onKeyDown={onKeyDown}
      onReset={() => {
        setS(fresh(props));
        setLive('האיור אופס.');
      }}
      readout={matrix ? readMatrix : readFunctional}
      controls={
        <>
          {matrix && seqs.length > 1 && (
            <div class="group" role="group" aria-label="הסדרה">
              {seqs.map((id) => (
                <Toggle key={id} label={SEQ_LABEL[id]} on={s.seq === id} onChange={() => userSet({ seq: id })} />
              ))}
            </div>
          )}
          {matrix && ps.length > 1 && (
            <div class="group" role="group" aria-label="הנורמה">
              {ps.map((id) => (
                <Toggle key={id} label={<bdi dir="ltr">{P_LABEL[id]}</bdi>} on={s.p === id} onChange={() => userSet({ p: id })} />
              ))}
            </div>
          )}
          {!matrix && fs.length > 1 && (
            <div class="group" role="group" aria-label="הפונקציה">
              {fs.map((id) => (
                <Toggle key={id} label={<bdi dir="ltr">{FN_LABEL[id]}</bdi>} on={s.f === id} onChange={() => userSet({ f: id })} />
              ))}
            </div>
          )}
          <Slider label="k" value={s.k} min={1} max={K_MAX} step={1} format={(v) => String(Math.round(v))} onChange={(v) => userSet({ k: clampK(v) })} />
          <Slider label="ε" value={s.eps} min={EPS_MIN} max={EPS_MAX} step={0.05} format={(v) => v.toFixed(2)} onChange={(v) => userSet({ eps: clampEps(v) })} />
          <div class="group">
            {matrix ? (
              <Toggle label={<>הראו את השגיאה <bdi dir="ltr">Aₖ − A</bdi> ואת כדור ε</>} on={s.showError} onChange={(on) => userSet({ showError: on })} />
            ) : (
              <Toggle label={<>הראו את פונקציית העד <bdi dir="ltr">gₖ</bdi></>} on={s.showWitness} onChange={(on) => userSet({ showWitness: on })} />
            )}
          </div>
        </>
      }
    />
  );
}
