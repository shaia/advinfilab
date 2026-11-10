/**
 * Lesson 1.7's figure: the operator norm of a 2×2 matrix, drawn. In one plane, with one p-norm (p = 1, 2, ∞) on
 * both sides: the unit ball B = {‖x‖_p ≤ 1} (cool: the inputs), its image A(B) (warm: the outputs), and the ball
 * of radius ‖A‖_op in the same norm (green, dashed). The image always fits inside that ball and touches it: that
 * is what "the smallest M with ‖Ax‖ ≤ M‖x‖" looks like.
 *
 * The student turns a unit vector x around the sphere and watches ‖Ax‖_p. When x is a direction where A stretches
 * most, Ax lands on the green sphere and is drawn filled; otherwise it is hollow with a ring (shape, not only
 * colour). The norms come from the closed formulas in src/math/opnorm2d.ts (largest column sum, largest row sum,
 * √λ_max(AᵀA)); the figure checks one direction at a time, which is evidence, and the caption says so.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { pNorm } from '~/math/multivar';
import { MATRICES, apply, imageOutline, maximiser, norms, sphereOutline, spherePoint, type MatrixId, type P, type V2 } from '~/math/opnorm2d';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { sci } from './core/format';
import { withAlpha } from './core/ink';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

type PId = '1' | '2' | 'inf';
type M2 = [[number, number], [number, number]];

const TASK_LABEL: Record<string, string> = {
  'stretch-2': 'במטריצה המשולשת, עם ⁦p = 2⁩, סובבו את x אל הכיוון שבו A מותחת הכי הרבה: Ax נוגע בשפת הכדור הירוק.',
  'stretch-inf': 'במטריצה הכללית, עם ⁦p = ∞⁩, מצאו וקטור x על ספרת היחידה שבו ‖Ax‖ שווה לנורמה.',
  differ: 'שנו כניסות של A עד שהנורמה בנורמת 1 והנורמה בנורמת אינסוף יהיו שונות זו מזו.',
};

const P_OF: Record<PId, P> = { '1': 1, '2': 2, inf: Infinity };
const P_LABEL: Record<PId, string> = { '1': 'p = 1', '2': 'p = 2', inf: 'p = ∞' };
const MAT_LABEL: Record<MatrixId, string> = { tri: 'משולשת', diag: 'אלכסונית', rot: 'סיבוב', gen: 'כללית' };
const DEG = Math.PI / 180;
/** Ax is "on the green sphere" when it is within 0.1% of the norm */
const ON = 0.999;

const minus = (t: string) => t.replace(/^-/, '−');
const fmt = (v: number) => minus(sci(Math.round(v * 1e6) / 1e6, 4));
const copy = (A: readonly (readonly number[])[]): M2 => [[A[0][0], A[0][1]], [A[1][0], A[1][1]]];
const normOf = (A: M2, p: PId) => {
  const n = norms(A);
  return p === '1' ? n.one : p === '2' ? n.two : n.inf;
};

interface State {
  p: PId;
  A: M2;
  mat: MatrixId | 'custom';
  /** the direction of x, in whole degrees */
  deg: number;
  showMax: boolean;
}

export interface OperatorNormProps {
  id: string;
  p?: PId;
  ps?: PId[];
  matrix?: MatrixId;
  matrices?: MatrixId[];
  deg?: number;
  editable?: boolean;
  showMax?: boolean;
  tasks?: string[];
}

function fresh(props: OperatorNormProps): State {
  const mat = props.matrix ?? 'tri';
  return { p: props.p ?? '2', A: copy(MATRICES[mat]), mat, deg: props.deg ?? 0, showMax: props.showMax ?? false };
}

export default function OperatorNorm(props: OperatorNormProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const dragging = useRef(false);
  const geo = useRef<{ cx: number; cy: number; k: number } | null>(null);

  const p = P_OF[s.p];
  const x = spherePoint(p, s.deg * DEG);
  const Ax = apply(s.A, x);
  const ax = pNorm(Ax, p);
  const N = normOf(s.A, s.p);
  const top = N > 0 && ax >= ON * N;
  const all = norms(s.A);

  /** The student's own change: a text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    setS(next);
    const has = (t: string) => props.tasks?.includes(t);
    const np = P_OF[next.p];
    const nN = normOf(next.A, next.p);
    const nax = pNorm(apply(next.A, spherePoint(np, next.deg * DEG)), np);
    const atTop = nN > 0 && nax >= ON * nN;
    const turned = patch.deg !== undefined;
    if (has('stretch-2') && turned && next.p === '2' && next.mat === 'tri' && atTop) markTask(`${props.id}:stretch-2`);
    if (has('stretch-inf') && turned && next.p === 'inf' && next.mat === 'gen' && atTop) markTask(`${props.id}:stretch-inf`);
    const n = norms(next.A);
    if (has('differ') && patch.A !== undefined && Math.abs(n.one - n.inf) > 1e-9) markTask(`${props.id}:differ`);
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.p === 'string' && st.p in P_OF) next.p = st.p as PId;
          if (typeof st.matrix === 'string' && st.matrix in MATRICES) {
            next.mat = st.matrix as MatrixId;
            next.A = copy(MATRICES[next.mat]);
          }
          if (typeof st.deg === 'number') next.deg = ((Math.round(st.deg) % 360) + 360) % 360;
          if (typeof st.showMax === 'boolean') next.showMax = st.showMax;
          return next;
        });
      }),
    [props.id],
  );

  const matText = `(${fmt(s.A[0][0])}, ${fmt(s.A[0][1])}; ${fmt(s.A[1][0])}, ${fmt(s.A[1][1])})`;
  const describe = () =>
    `${P_LABEL[s.p]}, A = ${matText}. x = (${fmt(x[0])}, ${fmt(x[1])}) על ספרת היחידה, ‖Ax‖ = ${fmt(ax)}. ` +
    `‖A‖ = ${fmt(N)}. ${top ? 'כאן A מותחת הכי הרבה.' : 'יש כיוון שבו A מותחת יותר.'}`;

  useEffect(() => {
    const t = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(t);
  }, [s]);

  const draw = ({ ctx, view, palette: pal }: FrameInfo) => {
    const half = Math.max(1, N) * 1.15;
    const k = Math.min(view.w, view.h) / (2 * half);
    const cx = view.w / 2;
    const cy = view.h / 2;
    geo.current = { cx, cy, k };
    const S = (q: readonly number[]): [number, number] => [cx + q[0] * k, cy - q[1] * k];
    const poly = (pts: V2[]) => {
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(...S(q)) : ctx.moveTo(...S(q))));
      ctx.closePath();
    };

    // axes
    ctx.save();
    ctx.strokeStyle = withAlpha(pal.ink3, 0.55);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(view.w, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, view.h);
    ctx.stroke();
    ctx.restore();

    // the ball of radius ‖A‖_op: green, dashed
    if (N > 0) {
      ctx.save();
      poly(sphereOutline(p, N));
      ctx.strokeStyle = pal.limit;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 5]);
      ctx.stroke();
      ctx.restore();
    }

    // the image A(B): warm
    ctx.save();
    poly(imageOutline(s.A, p));
    ctx.fillStyle = pal.epsBand;
    ctx.fill();
    ctx.strokeStyle = pal.eps;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // the unit ball B: cool
    ctx.save();
    poly(sphereOutline(p, 1));
    ctx.fillStyle = pal.deltaBand;
    ctx.fill();
    ctx.strokeStyle = pal.delta;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // the directions where A stretches most: small crosses (×) at ±x* and ±Ax*. Not diamonds: the 1-norm unit ball
    // is a diamond, and the lesson text names these markers "הצלבים הקטנים".
    if (s.showMax && N > 0) {
      const xs = maximiser(s.A, p);
      ctx.save();
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 2;
      for (const q of [xs, [-xs[0], -xs[1]], apply(s.A, xs), apply(s.A, [-xs[0], -xs[1]])]) {
        const [qx, qy] = S(q);
        ctx.beginPath();
        ctx.moveTo(qx - 6, qy - 6);
        ctx.lineTo(qx + 6, qy + 6);
        ctx.moveTo(qx + 6, qy - 6);
        ctx.lineTo(qx - 6, qy + 6);
        ctx.stroke();
      }
      ctx.restore();
    }

    // the arrows 0 → x and 0 → Ax
    const [ox, oy] = S([0, 0]);
    const [xx, xy] = S(x);
    const [ux, uy] = S(Ax);
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = pal.delta;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(xx, xy);
    ctx.stroke();
    ctx.strokeStyle = pal.eps;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ux, uy);
    ctx.stroke();

    // x: a filled cool dot
    ctx.fillStyle = pal.delta;
    ctx.beginPath();
    ctx.arc(xx, xy, 5.5, 0, 2 * Math.PI);
    ctx.fill();

    // Ax: filled on the green sphere, hollow with a ring when A stretches some other direction more
    if (top) {
      ctx.fillStyle = pal.pointIn;
      ctx.beginPath();
      ctx.arc(ux, uy, 6.5, 0, 2 * Math.PI);
      ctx.fill();
    } else {
      ctx.fillStyle = pal.paper;
      ctx.strokeStyle = pal.pointOut;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(ux, uy, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(ux, uy, 11, 0, 2 * Math.PI);
      ctx.stroke();
    }

    ctx.font = `700 14px ${pal.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const label = (t: string, px: number, py: number, color: string) => {
      ctx.strokeStyle = pal.paper;
      ctx.lineWidth = 4;
      ctx.strokeText(t, px, py);
      ctx.fillStyle = color;
      ctx.fillText(t, px, py);
    };
    ctx.textAlign = 'left';
    label('x', xx + 9, xy - 9, pal.delta);
    label('Ax', ux + 12, uy - 10, pal.eps);
    if (N > 0) {
      const [lx, ly] = S(p === Infinity ? [N, N] : p === 1 ? [0, N] : [N * Math.SQRT1_2, N * Math.SQRT1_2]);
      ctx.textAlign = 'right';
      label(`‖A‖ = ${fmt(N)}`, Math.min(lx, view.w - 4), Math.max(ly - 12, 12), pal.limit);
    }
    ctx.restore();
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 2, worldHeight: 2, animate: false });
  useEffect(invalidate, [s]);

  const degFromPointer = (e: PointerEvent) => {
    const g = geo.current;
    if (!g) return null;
    const a = Math.atan2(g.cy - e.offsetY, e.offsetX - g.cx) / DEG;
    return ((Math.round(a) % 360) + 360) % 360;
  };
  const onPointerDown = (e: PointerEvent) => {
    const d = degFromPointer(e);
    if (d === null) return;
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (d !== s.deg) userSet({ deg: d });
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging.current) return;
    const d = degFromPointer(e);
    if (d !== null && d !== s.deg) userSet({ deg: d });
  };
  const onPointerUp = () => {
    dragging.current = false;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    userSet({ deg: (((s.deg + step * (e.shiftKey ? 10 : 1)) % 360) + 360) % 360 });
  };

  const setEntry = (i: 0 | 1, j: 0 | 1, v: number) => {
    const A = copy(s.A);
    A[i][j] = v;
    userSet({ A, mat: 'custom' });
  };

  const ps = props.ps ?? [];
  const mats = props.matrices ?? [];
  const formula = s.p === '1' ? 'הסכום הגדול ביותר של עמודה' : s.p === 'inf' ? 'הסכום הגדול ביותר של שורה' : 'השורש של הערך העצמי הגדול של ⁦AᵀA⁩';
  return (
    <SimShell
      fig={props.id}
      label={`איור חי: כדור היחידה בנורמה ${P_LABEL[s.p]}, התמונה שלו תחת המטריצה A, והכדור ברדיוס נורמת האופרטור. וקטור x על ספרת היחידה ותמונתו Ax. גררו סביב הראשית כדי לסובב את x; במקלדת: החצים מסובבים במעלה אחת, ועם Shift בעשר. ${describe()}`}
      canvasRef={canvasRef}
      aspect={1.2}
      live={live}
      tasks={tasks}
      cursor="grab"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onReset={() => {
        setS(fresh(props));
        setLive('האיור אופס.');
      }}
      readout={
        <>
          <span data-readout="matrix">
            <b class="q">A = {matText}</b>
          </span>
          <span data-readout="x">
            <b class="q">
              x = ({fmt(x[0])}, {fmt(x[1])})
            </b>
            , <b class="q">‖Ax‖ = {fmt(ax)}</b>
          </span>
          <span data-readout="norm">
            ‖A‖ ({P_LABEL[s.p]}) = <b class="q">{fmt(N)}</b>: {formula}. {top ? 'כאן A מותחת הכי הרבה.' : 'יש כיוון שבו A מותחת יותר.'}
          </span>
          <span data-readout="norms">
            בשלוש הנורמות: <b class="q">p = 1: {fmt(all.one)}</b>, <b class="q">p = 2: {fmt(all.two)}</b>, <b class="q">p = ∞: {fmt(all.inf)}</b>
          </span>
        </>
      }
      controls={
        <>
          {ps.length > 1 && (
            <div class="group" role="group" aria-label="הנורמה">
              {ps.map((id) => (
                <Toggle key={id} label={<bdi dir="ltr">{P_LABEL[id]}</bdi>} on={s.p === id} onChange={() => userSet({ p: id })} />
              ))}
            </div>
          )}
          {mats.length > 1 && (
            <div class="group" role="group" aria-label="המטריצה">
              {mats.map((id) => (
                <Toggle key={id} label={MAT_LABEL[id]} on={s.mat === id} onChange={() => userSet({ mat: id, A: copy(MATRICES[id]) })} />
              ))}
            </div>
          )}
          <Slider label="הכיוון של x (מעלות)" value={s.deg} min={0} max={359} step={1} format={(v) => `${Math.round(v)}°`} onChange={(v) => userSet({ deg: Math.round(v) })} />
          {props.editable &&
            ([[0, 0], [0, 1], [1, 0], [1, 1]] as const).map(([i, j]) => (
              <Slider
                key={`${i}${j}`}
                label={`הכניסה בשורה ${i + 1}, עמודה ${j + 1}`}
                value={s.A[i][j]}
                min={-3}
                max={3}
                step={0.5}
                format={fmt}
                onChange={(v) => setEntry(i, j, Math.round(v * 2) / 2)}
              />
            ))}
          <div class="group">
            <Toggle label="הראו את הכיוונים שבהם A מותחת הכי הרבה" on={s.showMax} onChange={(on) => userSet({ showMax: on })} />
          </div>
        </>
      }
    />
  );
}
