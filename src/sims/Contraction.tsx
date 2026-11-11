/**
 * Lesson 2.3's figure (chapter 7 reuses it): the cobweb of an iteration x_{k+1} = f(x_k) for the Banach fixed-point
 * theorem. The graph of f over its domain X is drawn in ink (outside X faintly dotted), the diagonal y = x dashed, X
 * is marked on the x-axis (a closed end filled, an open end hollow, a ray to the edge with an arrow) and the cobweb
 * x₀ → x₁ → … in the warm colour. x₀ is a triangle on the axis: drag it, or use the slider. The fixed point is green
 * (filled when it lies in X, a hollow ring when the iteration heads for a point that is not in X). An iterate that
 * leaves X is drawn hollow with a ring and the iteration stops there. With the bounds on, the readouts add the
 * a-priori and a-posteriori error bounds of the contraction theorem; with the images on, the intervals fⁿ(X) are
 * marked on the axis.
 *
 * Every number comes from src/math/contraction.ts. The figure is a probe of one map, one x₀ and n ≤ 40: it shows the
 * theorem, it does not prove it, and the caption says so. No animation: every frame is a still state.
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  MAPS,
  N_MAX,
  X0_STEP,
  TOL,
  aPosteriori,
  aPriori,
  describeContraction,
  firstNApriori,
  fmtNum,
  images,
  orbit,
  snapX0,
  sub,
  sup,
  target,
  trueError,
  type MapId,
} from '~/math/contraction';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { drawAxes, insetBox, makePlot, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

/** a left-to-right island inside Hebrew text (U+2066 … U+2069) */
const ltr = (s: string) => `⁦${s}⁩`;

const TASK_LABEL: Record<string, string> = {
  'reach-tol': `ב-${ltr('cos')} על ${ltr('[0, 1]')}, הדליקו את חסמי השגיאה והעבירו את n אל ה-n הקטן ביותר שהחסם האפריורי בו קטן מ-${ltr('10⁻³')}.`,
  'any-start': `ב-${ltr('cos')} על ${ltr('[0, 1]')}, הריצו ${ltr('n ≥ 10')} משתי נקודות התחלה ${ltr('x₀')} שהמרחק ביניהן לפחות ${ltr('0.5')}: שתיהן מגיעות לאותה נקודה.`,
  escape: `ב-${ltr('x + 1/x')} על ${ltr('[1, ∞)')}, הגדילו את n עד ${ltr('20')} לפחות: המרחקים מצטמצמים, אבל האיטרציה לא מתייצבת.`,
  leave: `ב-${ltr('x/2 + 1')} על ${ltr('[0, 1]')}, הגדילו את n עד ${ltr('2')} לפחות: האיטרציה יוצאת מ-${ltr('X')}.`,
  hole: `ב-${ltr('x/2')} על ${ltr('(0, 1]')}, הגדילו את n עד ${ltr('15')} לפחות: הנקודות מתקרבות ל-${ltr('0')}, שאינו ב-${ltr('X')}.`,
};

/** the x₀ a preset starts with (and the picker switches to) */
const DEFAULT_X0: Record<MapId, number> = { cos: 0, 'newton-sqrt2': 1, 'half-open': 1, 'x-plus-inv': 1.5, leaves: 0, 'cos-R': 0 };

const MAP_LABEL = (id: MapId) => `${MAPS[id].formula.replace('f(x) = ', '')}, ${MAPS[id].domainText}`;

interface State {
  map: MapId;
  x0: number;
  n: number;
  showBound: boolean;
  showImages: boolean;
}

export interface ContractionProps {
  id: string;
  map?: MapId;
  maps?: MapId[];
  x0?: number;
  n?: number;
  showBound?: boolean;
  showImages?: boolean;
  tasks?: string[];
}

const clampN = (v: number) => Math.max(0, Math.min(N_MAX, Math.round(v)));

function fresh(p: ContractionProps): State {
  const map: MapId = p.map && p.map in MAPS ? p.map : 'cos';
  return {
    map,
    x0: snapX0(MAPS[map], typeof p.x0 === 'number' ? p.x0 : DEFAULT_X0[map]),
    n: clampN(typeof p.n === 'number' ? p.n : 3),
    showBound: p.showBound ?? false,
    showImages: p.showImages ?? false,
  };
}

const Q = (p: { children: ComponentChildren }) => (
  <b class="q">
    <bdi dir="ltr">{p.children}</bdi>
  </b>
);

export default function Contraction(props: ContractionProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const plotRef = useRef<Plot | null>(null);
  const dragging = useRef(false);
  /** x₀ values from which the student ran n ≥ 10 on cos (task "any-start") */
  const ran = useRef<number[]>([]);
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));

  const m = MAPS[s.map];
  const o = orbit(m, s.x0, s.n);
  const K = o.xs.length - 1;
  const xn = o.xs[K];
  const escaped = o.escapedAt !== null;
  const err = trueError(m, s.x0, s.n);
  const prior = aPriori(m, s.x0, s.n);
  const post = aPosteriori(m, s.x0, s.n);
  const ims = s.showImages ? images(m, s.n) : null;
  const tgt = target(m);

  /** The student's own change: a text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    if (patch.map !== undefined && patch.x0 === undefined) next.x0 = snapX0(MAPS[next.map], DEFAULT_X0[next.map]);
    setS(next);
    const has = (t: string) => props.tasks?.includes(t);
    const moved = patch.n !== undefined || patch.x0 !== undefined || patch.map !== undefined;
    if (!moved) return;
    if (has('reach-tol') && next.map === 'cos' && next.n === firstNApriori(MAPS.cos, next.x0, TOL, N_MAX)) markTask(`${props.id}:reach-tol`);
    if (has('any-start') && next.map === 'cos' && next.n >= 10) {
      if (!ran.current.some((v) => Math.abs(v - next.x0) < 1e-9)) ran.current.push(next.x0);
      if (Math.max(...ran.current) - Math.min(...ran.current) >= 0.5 - 1e-9) markTask(`${props.id}:any-start`);
    }
    if (has('escape') && next.map === 'x-plus-inv' && next.n >= 20) markTask(`${props.id}:escape`);
    if (has('leave') && next.map === 'leaves' && next.n >= 2) markTask(`${props.id}:leave`);
    if (has('hole') && next.map === 'half-open' && next.n >= 15) markTask(`${props.id}:hole`);
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.map === 'string' && st.map in MAPS) {
            next.map = st.map as MapId;
            next.x0 = snapX0(MAPS[next.map], typeof st.x0 === 'number' ? st.x0 : DEFAULT_X0[next.map]);
          } else if (typeof st.x0 === 'number') next.x0 = snapX0(MAPS[next.map], st.x0);
          if (typeof st.n === 'number') next.n = clampN(st.n);
          if (typeof st.showBound === 'boolean') next.showBound = st.showBound;
          if (typeof st.showImages === 'boolean') next.showImages = st.showImages;
          return next;
        });
      }),
    [props.id],
  );

  const describe = () => describeContraction(s);

  useEffect(() => {
    const t = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(t);
  }, [s]);

  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const outer = insetBox({ x: 0, y: 0, w: view.w, h: view.h }, { l: narrow ? 44 : 54, r: 18, t: 40, b: 54 });
    const [wx0, wx1] = m.window.x;
    const [wy0, wy1] = m.window.y;
    // equal scales on both axes, so the diagonal is at 45° and the cobweb is honest
    const sc = Math.min(outer.w / (wx1 - wx0), outer.h / (wy1 - wy0));
    const bw = sc * (wx1 - wx0);
    const bh = sc * (wy1 - wy0);
    const box = { x: outer.x + (outer.w - bw) / 2, y: outer.y + (outer.h - bh) / 2, w: bw, h: bh };
    const plot = makePlot(box, { min: wx0, max: wx1, label: 'x' }, { min: wy0, max: wy1, label: 'y' });
    plotRef.current = plot;
    const y0 = box.y + box.h;
    const aX = Math.max(wx0, m.X.lo);
    const bX = Math.min(wx1, m.X.hi);

    const halo = (txt: string, x: number, y: number, align: CanvasTextAlign, color: string) => {
      ctx.save();
      ctx.font = `600 ${narrow ? 12 : 13}px ${p.fontUi}`;
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
      ctx.lineWidth = filled ? 1.2 : 2.2;
      ctx.stroke();
      ctx.restore();
    };
    const arrowHead = (x: number, y: number, ang: number, color: string) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-10, -5);
      ctx.lineTo(-10, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    const strokeFn = (a: number, b: number, color: string, width: number, dash: number[]) => {
      if (!(b > a)) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y - 2, box.w, box.h + 4);
      ctx.clip();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.setLineDash(dash);
      ctx.beginPath();
      const N = 320;
      for (let i = 0; i <= N; i++) {
        const x = a + ((b - a) * i) / N;
        if (i) ctx.lineTo(plot.px(x), plot.py(m.f(x)));
        else ctx.moveTo(plot.px(x), plot.py(m.f(x)));
      }
      ctx.stroke();
      ctx.restore();
    };

    // the image fⁿ(X): a vertical strip over its x-range
    const imsNow = ims !== null ? ims[Math.min(s.n, ims.length - 1)] : null;
    if (imsNow) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, box.h);
      ctx.clip();
      ctx.fillStyle = p.deltaBand;
      ctx.fillRect(plot.px(imsNow.lo), box.y, plot.px(imsNow.hi) - plot.px(imsNow.lo), box.h);
      ctx.restore();
    }

    drawAxes(ctx, plot, p);

    // the diagonal y = x
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    ctx.strokeStyle = p.ink3;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    const dl = Math.max(wx0, wy0);
    const dh = Math.min(wx1, wy1);
    ctx.moveTo(plot.px(dl), plot.py(dl));
    ctx.lineTo(plot.px(dh), plot.py(dh));
    ctx.stroke();
    ctx.restore();

    // f: faint everywhere in the window, ink over X
    strokeFn(wx0, wx1, p.ink3, 1.4, [2, 4]);
    strokeFn(aX, bX, p.curve, 2.4, []);
    if (Number.isFinite(m.X.lo)) dot(plot.px(m.X.lo), plot.py(m.f(m.X.lo)), 4.5, !m.X.loOpen, p.curve);
    if (Number.isFinite(m.X.hi)) dot(plot.px(m.X.hi), plot.py(m.f(m.X.hi)), 4.5, !m.X.hiOpen, p.curve);
    const tail = (xe: number, dir: 1 | -1) => {
      const h = 0.05 * dir;
      arrowHead(plot.px(xe), plot.py(m.f(xe)), Math.atan2(plot.py(m.f(xe)) - plot.py(m.f(xe - h)), plot.px(xe) - plot.px(xe - h)), p.curve);
    };
    if (m.X.hi === Infinity) tail(wx1, 1);
    if (m.X.lo === -Infinity) tail(wx0, -1);

    // the domain X on the x-axis: a thick bar, filled / hollow ends, arrows for rays
    ctx.save();
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 6;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(plot.px(aX), y0);
    ctx.lineTo(plot.px(bX), y0);
    ctx.stroke();
    ctx.restore();
    if (Number.isFinite(m.X.lo)) dot(plot.px(m.X.lo), y0, 5.5, !m.X.loOpen, p.ink);
    else arrowHead(box.x, y0, Math.PI, p.ink);
    if (Number.isFinite(m.X.hi)) dot(plot.px(m.X.hi), y0, 5.5, !m.X.hiOpen, p.ink);
    else arrowHead(box.x + box.w, y0, 0, p.ink);

    // the images f⁰(X) ⊇ f¹(X) ⊇ … : endpoint ticks of every one, a bar and end dots for the current one
    if (ims !== null) {
      ctx.save();
      ctx.strokeStyle = p.delta;
      ctx.lineWidth = 1.2;
      for (let k = 0; k < ims.length && k <= s.n; k++) {
        for (const v of [ims[k].lo, ims[k].hi]) {
          ctx.beginPath();
          ctx.moveTo(plot.px(v), y0 - 18);
          ctx.lineTo(plot.px(v), y0 - 11);
          ctx.stroke();
        }
      }
      if (imsNow) {
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(plot.px(imsNow.lo), y0 - 9);
        ctx.lineTo(plot.px(imsNow.hi), y0 - 9);
        ctx.stroke();
        ctx.restore();
        dot(plot.px(imsNow.lo), y0 - 9, 3.8, !imsNow.loOpen, p.delta);
        dot(plot.px(imsNow.hi), y0 - 9, 3.8, !imsNow.hiOpen, p.delta);
        halo(`f${sup(Math.min(s.n, ims.length - 1))}(X)`, plot.px(imsNow.hi) + 8, y0 - 22, 'left', p.delta);
      } else ctx.restore();
    }

    // the fixed point: green, with a guide to the axis; a hollow ring when it is not in X
    const fx = m.fixed ?? m.outside;
    if (fx !== null && fx >= wx0 && fx <= wx1) {
      ctx.save();
      ctx.strokeStyle = p.limit;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(plot.px(fx), y0);
      ctx.lineTo(plot.px(fx), plot.py(fx));
      ctx.stroke();
      ctx.restore();
      dot(plot.px(fx), plot.py(fx), 6.5, m.fixed !== null, p.limit);
      halo('x*', plot.px(fx) + 9, plot.py(fx) + 14, 'left', p.limit);
    }

    // the cobweb: (x₀, axis) → (x₀, x₁) → (x₁, x₁) → (x₁, x₂) → …
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    ctx.strokeStyle = p.eps;
    ctx.lineWidth = 1.7;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(plot.px(o.xs[0]), y0);
    for (let k = 0; k < K; k++) {
      ctx.lineTo(plot.px(o.xs[k]), plot.py(o.xs[k + 1]));
      ctx.lineTo(plot.px(o.xs[k + 1]), plot.py(o.xs[k + 1]));
    }
    ctx.stroke();
    ctx.restore();

    // the iterates on the diagonal: small ink dots; the last one filled (in X) or hollow with a ring (outside X)
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x - 12, box.y - 12, box.w + 24, box.h + 24);
    ctx.clip();
    for (let k = 0; k < K; k++) dot(plot.px(o.xs[k]), plot.py(o.xs[k]), 3, true, p.ink);
    const lx = plot.px(xn);
    const ly = plot.py(xn);
    if (escaped) {
      dot(lx, ly, 5.5, false, p.pointOut);
      ctx.strokeStyle = p.pointOut;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(lx, ly, 10, 0, 2 * Math.PI);
      ctx.stroke();
    } else dot(lx, ly, 5.5, true, p.pointIn);
    ctx.restore();
    if (xn >= wx0 && xn <= wx1) halo(`x${sub(K)}`, lx + 12, ly - 12, 'left', escaped ? p.pointOut : p.ink);

    // x₀ on the axis: a triangle (drag it)
    const tx = plot.px(o.xs[0]);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(tx, y0 + 2);
    ctx.lineTo(tx - 7, y0 + 13);
    ctx.lineTo(tx + 7, y0 + 13);
    ctx.closePath();
    ctx.fillStyle = p.accent;
    ctx.fill();
    ctx.strokeStyle = p.paper;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
    halo('x₀', tx + 10, y0 - 12, 'left', p.ink);
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1.25, worldHeight: 1, animate: false });
  useEffect(invalidate, [s]);

  const x0FromPointer = (e: PointerEvent) => {
    const plot = plotRef.current;
    if (!plot) return null;
    const [wx0, wx1] = m.window.x;
    return snapX0(m, wx0 + ((e.offsetX - plot.box.x) / plot.box.w) * (wx1 - wx0));
  };
  const onPointerDown = (e: PointerEvent) => {
    const x0 = x0FromPointer(e);
    if (x0 === null) return;
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (Math.abs(x0 - s.x0) > 1e-9) userSet({ x0 });
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging.current) return;
    const x0 = x0FromPointer(e);
    if (x0 !== null && Math.abs(x0 - s.x0) > 1e-9) userSet({ x0 });
  };
  const onPointerUp = () => {
    dragging.current = false;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      userSet({ x0: snapX0(m, s.x0 + (e.key === 'ArrowRight' ? 1 : -1) * X0_STEP * (e.shiftKey ? 10 : 1)) });
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      userSet({ n: clampN(s.n + (e.key === 'ArrowUp' ? 1 : -1)) });
    }
  };

  const offered = props.maps ?? [];
  const imsLen = ims !== null && s.showImages ? ims : null;
  return (
    <SimShell
      fig={props.id}
      label={`איור חי: גרף הפונקציה f על התחום X, האלכסון y = x, והאיטרציה x₀, x₁, … כקורי עכביש. גוררים את x₀ על הציר. במקלדת: חץ ימינה ושמאלה משנה את x₀, חץ למעלה ולמטה משנה את n. ${describe()}`}
      canvasRef={canvasRef}
      aspect={1.25}
      live={live}
      tasks={tasks}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      cursor="ew-resize"
      onReset={() => {
        ran.current = [];
        setS(fresh(props));
        setLive('האיור אופס.');
      }}
      readout={
        <>
          <span data-readout="n">
            <Q>n = {s.n}</Q>
          </span>
          {escaped ? (
            <span data-readout="escape">
              {o.escapedAt === 0 ? (
                <>
                  <Q>x₀ = {fmtNum(s.x0)}</Q> מחוץ ל-<Q>X</Q>.
                </>
              ) : (
                <>
                  האיטרציה יצאה מ-<Q>X</Q> ונעצרה: <Q>{`x${sub(K)} = ${fmtNum(xn)}`}</Q> מחוץ ל-<Q>X</Q>.
                </>
              )}
            </span>
          ) : (
            <>
              <span data-readout="xn">
                <Q>{`x${sub(K)} = ${fmtNum(xn)}`}</Q>
              </span>
              {K >= 1 && (
                <span data-readout="step">
                  מרחק בין איטרציות: <Q>{`d(x${sub(K - 1)}, x${sub(K)}) = ${fmtNum(Math.abs(xn - o.xs[K - 1]))}`}</Q>
                </span>
              )}
            </>
          )}
          <span data-readout="fixed">
            {m.fixed !== null ? (
              <>
                נקודת השבת: <Q>{`x* = ${fmtNum(m.fixed)}`}</Q>
              </>
            ) : (
              <>אין נקודת שבת ב-<Q>X</Q>.</>
            )}
          </span>
          {m.fixed === null && m.outside !== null && (
            <span data-readout="outside">
              {m.id === 'half-open' ? 'הסדרה שואפת ל-' : 'נקודת השבת של הנוסחה היא '}
              <Q>{fmtNum(m.outside)}</Q>, מחוץ ל-<Q>X</Q>.
            </span>
          )}
          {err !== null && tgt !== null && (
            <span data-readout="error">
              {m.fixed !== null ? 'השגיאה האמיתית: ' : 'המרחק מהגבול: '}
              <Q>{`|x${sub(K)} − ${m.fixed !== null ? 'x*' : fmtNum(tgt)}| = ${fmtNum(err)}`}</Q>
            </span>
          )}
          {s.showBound && (
            <>
              {m.q === null ? (
                <span data-readout="no-q">
                  אין <Q>q &lt; 1</Q>. {m.qWhy}
                </span>
              ) : !m.mapsInto ? (
                <span data-readout="no-bound">
                  <Q>{`q = ${fmtNum(m.q)}`}</Q>, אבל <Q>f(X) ⊄ X</Q>, ולכן אין חסמים.
                </span>
              ) : (
                <>
                  <span data-readout="q">
                    <Q>{`q = ${fmtNum(m.q)}`}</Q>
                  </span>
                  {prior !== null && (
                    <span data-readout="bound-prior">
                      חסם אפריורי: <Q>{`qⁿ/(1−q)·|x₁ − x₀| = ${fmtNum(prior)}`}</Q>
                    </span>
                  )}
                  {post !== null && (
                    <span data-readout="bound-post">
                      חסם אפוסטריורי: <Q>{`q/(1−q)·|xₙ − xₙ₋₁| = ${fmtNum(post)}`}</Q>
                    </span>
                  )}
                </>
              )}
            </>
          )}
          {s.showImages && (
            <span data-readout="images">
              {imsLen === null ? (
                <>
                  <Q>X</Q> אינה חסומה: אין תמונות לסמן.
                </>
              ) : imsLen.length <= s.n ? (
                <>
                  התמונה <Q>{`f${sup(imsLen.length)}(X)`}</Q> לא מוגדרת: <Q>{`f${sup(imsLen.length - 1)}(X)`}</Q> אינה מוכלת ב-<Q>X</Q>.
                </>
              ) : (
                <>
                  אורך <Q>{`fⁿ(X) = ${fmtNum(imsLen[s.n].hi - imsLen[s.n].lo)}`}</Q>
                  {m.q !== null && (
                    <>
                      , החסם <Q>{`qⁿ·אורך(X) = ${fmtNum(m.q ** s.n * (m.X.hi - m.X.lo))}`}</Q>
                    </>
                  )}
                </>
              )}
            </span>
          )}
        </>
      }
      controls={
        <>
          {offered.length > 1 && (
            <div class="group" role="group" aria-label="הפונקציה">
              {offered.filter((id) => id in MAPS).map((id) => (
                <Toggle key={id} label={<bdi dir="ltr">{MAP_LABEL(id)}</bdi>} on={s.map === id} onChange={() => userSet({ map: id })} />
              ))}
            </div>
          )}
          <Slider
            label="x₀"
            value={s.x0}
            min={m.x0Range[0]}
            max={m.x0Range[1]}
            step={X0_STEP}
            format={(v) => fmtNum(Number(v.toFixed(6)))}
            onChange={(v) => userSet({ x0: snapX0(m, v) })}
          />
          <Slider label="n" value={s.n} min={0} max={N_MAX} step={1} format={(v) => String(Math.round(v))} onChange={(v) => userSet({ n: clampN(v) })} />
          <div class="group">
            <Toggle label="חסמי שגיאה" on={s.showBound} onChange={(on) => userSet({ showBound: on })} />
            {m.bounded && m.image !== null && (
              <Toggle
                label={
                  <>
                    תמונות <bdi dir="ltr">fⁿ(X)</bdi>
                  </>
                }
                on={s.showImages}
                onChange={(on) => userSet({ showImages: on })}
              />
            )}
          </div>
        </>
      }
    />
  );
}
