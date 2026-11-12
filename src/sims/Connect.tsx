/**
 * Lesson 3.6's figure: connectedness and paths. Two modes.
 *
 * "poly": a planar set U (an open annulus, the punctured plane, two disjoint open discs, or the line minus 0), shaded
 * with a dashed boundary (an open set does not contain its boundary; an excluded point is a hollow ring). The student
 * builds a polygonal path from p (a filled square) by clicking grid points (or with the keyboard: arrows move the
 * cursor, Enter adds it, Backspace undoes). A segment inside U is drawn solid in ink; the first segment that leaves U
 * is dashed in the "outside" colour, with a hollow ring where it leaves. The target q is a ring, filled when a path
 * inside U reaches it. Every inside/outside verdict is EXACT (integer grid arithmetic, src/math/connect.ts).
 *
 * "sine": the topologist's sine curve S = G ∪ J. G = the graph of sin(1/x) on (0, 1] in ink, J = {0} × [−1, 1] in the
 * limit colour. Below the pixel scale the oscillations are filled as a strip (said in the caption). A walker goes along
 * G from (1, sin 1) to the point with abscissa x (a log slider): its stretch of the graph is warm, its end is a filled
 * dot, and the readout gives its distance to J and how many times the walk reached the heights ±1. With "approach" on,
 * a point (0, y) of J is a ring and the graph points x_j = 1/(arcsin y + 2πj), j ≤ k, at the same height are filled
 * dots converging to it. The figure shows a probe of finitely many points; the proofs are טענה 3.6.13 in the lesson.
 *
 * A text step sets state through subscribeSteps and never ticks a task: tasks tick only in the user* handlers. The
 * steps of the lesson set, in a task's region, only the start [p] or a path that already leaves U, and a path that
 * leaves U cannot be completed into a path inside U by appending vertices, so no step does part of a task.
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  APPROACH_TOL,
  GRID,
  K_MAX,
  REGIONS,
  U_MIN,
  U_STEP,
  WALK_TOL,
  Y_STEP,
  approach,
  checkPath,
  distToJ,
  exitParam,
  fmt,
  isRegion,
  peakCount,
  pt,
  sameV,
  sineG,
  snap,
  snapU,
  snapY,
  xOfU,
  type RegionId,
  type V,
} from '~/math/connect';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { withAlpha } from './core/ink';
import { drawAxes, insetBox, makePlot, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

/** a left-to-right island inside Hebrew text (U+2066 … U+2069) */
const ltr = (s: string) => `⁦${s}⁩`;

type Mode = 'poly' | 'sine';

const TASK_LABEL: Record<string, string> = {
  'annulus-around': `בטבעת ${ltr('1 < ‖x‖₂ < 2')}: בנו מסילה פוליגונלית מ-p אל q שכל הקטעים שלה בתוך הקבוצה.`,
  'punctured-around': `במישור בלי הראשית: בנו מסילה פוליגונלית מ-${ltr('p = (1, 0)')} אל ${ltr('q = (−1, 0)')} שכולה בתוך הקבוצה.`,
  'line-try': `בישר בלי 0: נסו לחבר את ${ltr('p = 1')} אל ${ltr('q = −1')} בקטעים על הישר. מה האיור מדווח?`,
  'walk-close': `בעקומת הסינוס: הזיזו את קצה ההליכה על הגרף עד שהמרחק שלו מהקטע האנכי קטן מ-${ltr('0.01')}. כמה פעמים הגיעה ההליכה לגובה ${ltr('±1')}?`,
  approach: `בעקומת הסינוס: הדליקו "נקודות מתקרבות", בחרו נקודה ${ltr('(0, y)')} על הקטע האנכי, והגדילו את k עד שנקודת הגרף ה-k במרחק קטן מ-${ltr('0.01')} ממנה.`,
};

interface State {
  mode: Mode;
  region: RegionId;
  path: V[];
  cursor: V;
  /** the walker: x = 10^u */
  u: number;
  y: number;
  k: number;
  showApproach: boolean;
}

export interface ConnectProps {
  id: string;
  mode?: Mode;
  modes?: Mode[];
  region?: RegionId;
  regions?: RegionId[];
  /** a starting path as grid vertices [[i, j], …]; its first vertex is replaced by the region's start */
  path?: number[][];
  u?: number;
  y?: number;
  k?: number;
  showApproach?: boolean;
  tasks?: string[];
}

const SUBS = '₀₁₂₃₄₅₆₇₈₉';
const subDigits = (n: number) => String(n).replace(/\d/g, (c) => SUBS[Number(c)]);

const clampK = (v: number) => Math.max(1, Math.min(K_MAX, Math.round(v)));

/** a path from props or a step: integer vertices, starting at the region's start */
function pathOf(region: RegionId, raw: unknown): V[] {
  const r = REGIONS[region];
  const out: V[] = [r.start];
  if (Array.isArray(raw)) {
    for (const v of raw.slice(1)) {
      if (Array.isArray(v) && v.length === 2 && v.every((c) => typeof c === 'number' && Number.isInteger(c))) {
        out.push([v[0] + 0, r.onAxis ? 0 : v[1] + 0]);
      }
    }
  }
  return out;
}

function fresh(p: ConnectProps): State {
  const region: RegionId = p.region && isRegion(p.region) ? p.region : 'annulus';
  const path = pathOf(region, p.path);
  return {
    mode: p.mode === 'sine' ? 'sine' : 'poly',
    region,
    path,
    cursor: path[path.length - 1],
    u: snapU(typeof p.u === 'number' ? p.u : 0),
    y: snapY(typeof p.y === 'number' ? p.y : 0.5),
    k: clampK(typeof p.k === 'number' ? p.k : 3),
    showApproach: p.showApproach ?? false,
  };
}

const Q = (p: { children: ComponentChildren }) => (
  <b class="q">
    <bdi dir="ltr">{p.children}</bdi>
  </b>
);

const vText = (v: V) => {
  const [x, y] = pt(v);
  return `(${fmt(x)}, ${fmt(y)})`;
};

export default function Connect(props: ConnectProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const plotRef = useRef<Plot | null>(null);
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const has = (t: string) => props.tasks?.includes(t) ?? false;

  const r = REGIONS[s.region];
  const rep = checkPath(r, s.path);
  const complete = s.path.length > 1 && sameV(s.path[s.path.length - 1], r.target);
  const xw = xOfU(s.u);
  const xk = approach(s.y, s.k);

  /* ---------------------------------------------------------------- the student's own changes (tick tasks) */

  const userPath = (path: V[], cursor?: V) => {
    const next = { ...s, path, cursor: cursor ?? path[path.length - 1] };
    setS(next);
    const report = checkPath(r, path);
    if (report.done && path.length > 1) {
      if (s.region === 'annulus' && has('annulus-around')) markTask(`${props.id}:annulus-around`);
      if (s.region === 'punctured' && has('punctured-around')) markTask(`${props.id}:punctured-around`);
    }
    if (s.region === 'line' && has('line-try') && path.some((v) => v[0] < 0)) markTask(`${props.id}:line-try`);
  };
  const userAdd = (v: V) => {
    if (complete) return;
    if (sameV(v, s.path[s.path.length - 1])) return;
    userPath([...s.path, v], v);
  };
  const userUndo = () => {
    if (s.path.length > 1) userPath(s.path.slice(0, -1));
  };
  const userClear = () => userPath([r.start]);
  const userRegion = (region: RegionId) => {
    const st = REGIONS[region].start;
    setS({ ...s, region, path: [st], cursor: st });
  };
  const userSine = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    setS(next);
    if (has('walk-close') && patch.u !== undefined && xOfU(next.u) <= WALK_TOL + 1e-12) markTask(`${props.id}:walk-close`);
    if (has('approach') && next.showApproach && (patch.k !== undefined || patch.y !== undefined || patch.showApproach !== undefined)) {
      if (approach(next.y, next.k) < APPROACH_TOL) markTask(`${props.id}:approach`);
    }
  };

  /* ---------------------------------------------------------------- text steps (never tick a task) */

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (st.mode === 'poly' || st.mode === 'sine') next.mode = st.mode;
          if (isRegion(st.region)) {
            next.region = st.region;
            next.path = [REGIONS[st.region].start];
          }
          if (st.path !== undefined) next.path = pathOf(next.region, st.path);
          if (isRegion(st.region) || st.path !== undefined) next.cursor = next.path[next.path.length - 1];
          if (typeof st.u === 'number') next.u = snapU(st.u);
          if (typeof st.y === 'number') next.y = snapY(st.y);
          if (typeof st.k === 'number') next.k = clampK(st.k);
          if (typeof st.showApproach === 'boolean') next.showApproach = st.showApproach;
          return next;
        });
      }),
    [props.id],
  );

  const describe = () => {
    if (s.mode === 'sine') {
      const base = `עקומת הסינוס של הטופולוגים. ההליכה על הגרף הגיעה ל-x = ${fmt(xw)}, במרחק ${fmt(distToJ(xw, sineG(xw)))} מהקטע האנכי, ובדרך הגיעה ${peakCount(xw)} פעמים לגובה 1 או 1−.`;
      return s.showApproach ? `${base} נקודת הגרף ה-${s.k} בגובה ${fmt(s.y)} נמצאת ב-x = ${fmt(xk)}, במרחק ${fmt(xk)} מהנקודה (0, ${fmt(s.y)}).` : base;
    }
    const n = s.path.length - 1;
    const verdict = rep.badSegment !== null ? `הקטע ה-${rep.badSegment} יוצא מהקבוצה.` : rep.done ? 'המסילה מגיעה ל-q וכולה בתוך הקבוצה.' : 'כל הקטעים עד עכשיו בתוך הקבוצה.';
    return `הקבוצה: ${r.label}, ${r.text}. מסילה פוליגונלית עם ${n} קטעים מ-p. ${verdict}`;
  };

  useEffect(() => {
    const t = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(t);
  }, [s]);

  /* ---------------------------------------------------------------- drawing */

  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const outer = insetBox({ x: 0, y: 0, w: view.w, h: view.h }, { l: narrow ? 40 : 50, r: 14, t: 16, b: 34 });

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
    const dot = (x: number, y: number, rad: number, filled: boolean, color: string) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, 2 * Math.PI);
      ctx.fillStyle = filled ? color : p.paper;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = filled ? 1.2 : 2.2;
      ctx.stroke();
      ctx.restore();
    };

    if (s.mode === 'poly') {
      const [wx0, wx1] = r.window.x;
      const [wy0, wy1] = r.window.y;
      // equal scales: a disc is round and a segment's angle is honest
      const sc = Math.min(outer.w / (wx1 - wx0), outer.h / (wy1 - wy0));
      const bw = sc * (wx1 - wx0);
      const bh = sc * (wy1 - wy0);
      const box = { x: outer.x + (outer.w - bw) / 2, y: outer.y + (outer.h - bh) / 2, w: bw, h: bh };
      const plot = makePlot(box, { min: wx0, max: wx1 }, { min: wy0, max: wy1 });
      plotRef.current = plot;
      drawAxes(ctx, plot, p);
      const X = (x: number) => plot.px(x);
      const Y = (y: number) => plot.py(y);

      // the set U: a cool tint, a dashed boundary (open set), excluded points as hollow rings
      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, box.h);
      ctx.clip();
      ctx.fillStyle = p.deltaBand;
      ctx.strokeStyle = p.delta;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 4]);
      if (r.id === 'annulus') {
        ctx.beginPath();
        ctx.arc(X(0), Y(0), 2 * sc, 0, 2 * Math.PI);
        ctx.moveTo(X(0) + sc, Y(0));
        ctx.arc(X(0), Y(0), sc, 0, 2 * Math.PI, true);
        ctx.fill('evenodd');
        ctx.beginPath();
        ctx.arc(X(0), Y(0), 2 * sc, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(X(0), Y(0), sc, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (r.id === 'punctured') {
        ctx.fillRect(box.x, box.y, box.w, box.h);
      } else if (r.id === 'two-discs') {
        for (const c of [-1.2, 1.2]) {
          ctx.beginPath();
          ctx.arc(X(c), Y(0), sc, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        }
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = p.deltaBand;
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(box.x, Y(0));
        ctx.lineTo(box.x + box.w, Y(0));
        ctx.stroke();
        ctx.strokeStyle = p.delta;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(box.x, Y(0));
        ctx.lineTo(box.x + box.w, Y(0));
        ctx.stroke();
      }
      ctx.restore();
      if (r.id === 'punctured' || r.id === 'line') {
        dot(X(0), Y(0), 6, false, p.pointOut);
        halo('0', X(0) + 9, Y(0) + 13, 'left', p.pointOut);
      }

      // the path
      const P = s.path.map(pt);
      ctx.save();
      ctx.lineCap = 'round';
      for (let k = 1; k < P.length; k++) {
        const ok = r.segmentInside(s.path[k - 1], s.path[k]) && (rep.badSegment === null || k < rep.badSegment);
        ctx.strokeStyle = ok ? p.curve : p.pointOut;
        ctx.lineWidth = ok ? 2.6 : 2.2;
        ctx.setLineDash(ok ? [] : [7, 5]);
        ctx.beginPath();
        ctx.moveTo(X(P[k - 1][0]), Y(P[k - 1][1]));
        ctx.lineTo(X(P[k][0]), Y(P[k][1]));
        ctx.stroke();
      }
      ctx.restore();
      if (rep.badSegment !== null) {
        const k = rep.badSegment;
        const t = exitParam(r, s.path[k - 1], s.path[k]);
        if (t !== null) {
          const ex = P[k - 1][0] + t * (P[k][0] - P[k - 1][0]);
          const ey = P[k - 1][1] + t * (P[k][1] - P[k - 1][1]);
          dot(X(ex), Y(ey), 7, false, p.pointOut);
        }
      }
      for (let k = 1; k < P.length; k++) dot(X(P[k][0]), Y(P[k][1]), 3.6, r.contains(s.path[k]), r.contains(s.path[k]) ? p.curve : p.pointOut);

      // p: a filled square; q: a ring, filled once a path inside U reaches it
      const [px0, py0] = pt(r.start);
      ctx.save();
      ctx.fillStyle = p.accent;
      ctx.fillRect(X(px0) - 6, Y(py0) - 6, 12, 12);
      ctx.restore();
      halo('p', X(px0) + 4, Y(py0) - 16, 'left', p.ink);
      const [qx, qy] = pt(r.target);
      dot(X(qx), Y(qy), 7.5, rep.done && complete, p.limit);
      halo('q', X(qx) - 4, Y(qy) - 16, 'right', p.limit);

      // the keyboard cursor: a small cross
      if (!complete) {
        const [cx, cy] = pt(s.cursor);
        ctx.save();
        ctx.strokeStyle = p.ink2;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(X(cx) - 7, Y(cy));
        ctx.lineTo(X(cx) + 7, Y(cy));
        ctx.moveTo(X(cx), Y(cy) - 7);
        ctx.lineTo(X(cx), Y(cy) + 7);
        ctx.stroke();
        ctx.restore();
      }
      return;
    }

    /* ---- sine mode */
    const wx: [number, number] = [-0.12, 1.08];
    const wy: [number, number] = [-1.3, 1.3];
    const plot = makePlot(outer, { min: wx[0], max: wx[1] }, { min: wy[0], max: wy[1] });
    plotRef.current = plot;
    drawAxes(ctx, plot, p);
    const X = (x: number) => plot.px(x);
    const Y = (y: number) => plot.py(y);
    const sx = outer.w / (wx[1] - wx[0]);
    // below xcut consecutive peaks (Δx ≈ πx²) are closer than 2 px: fill that strip instead of drawing them
    const xcut = Math.min(1, Math.sqrt(2 / (Math.PI * sx)));
    const strokeG = (a: number, b: number, color: string, width: number) => {
      if (!(b > a)) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      // step evenly in 1/x, where sin(1/x) is a plain sine: 0.04 rad per sample
      const s0 = 1 / b;
      const s1 = 1 / a;
      const N = Math.max(8, Math.ceil((s1 - s0) / 0.04));
      for (let i = 0; i <= N; i++) {
        const sv = s0 + ((s1 - s0) * i) / N;
        const x = 1 / sv;
        if (i) ctx.lineTo(X(x), Y(Math.sin(sv)));
        else ctx.moveTo(X(x), Y(Math.sin(sv)));
      }
      ctx.stroke();
      ctx.restore();
    };
    const strip = (a: number, b: number, color: string) => {
      if (!(b > a)) return;
      ctx.save();
      ctx.fillStyle = color;
      ctx.fillRect(X(a), Y(1), X(b) - X(a), Y(-1) - Y(1));
      ctx.restore();
    };
    strip(0, xcut, withAlpha(p.curve, 0.45));
    strokeG(xcut, 1, p.curve, 1.6);
    dot(X(1), Y(Math.sin(1)), 4, true, p.curve);

    // J: the segment {0} × [−1, 1]
    ctx.save();
    ctx.strokeStyle = p.limit;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(-1));
    ctx.lineTo(X(0), Y(1));
    ctx.stroke();
    ctx.restore();
    dot(X(0), Y(1), 4, true, p.limit);
    dot(X(0), Y(-1), 4, true, p.limit);
    halo('J', X(0) - 8, Y(1.18), 'right', p.limit);
    halo('G', X(0.8), Y(1.15), 'center', p.curve);

    // the walker along G, from (1, sin 1) to (x, sin(1/x))
    strip(xw, Math.min(xcut, 1), withAlpha(p.eps, 0.55));
    strokeG(Math.max(xw, xcut), 1, p.eps, 3);
    const yw = sineG(xw);
    ctx.save();
    ctx.strokeStyle = p.eps;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(X(0), Y(yw));
    ctx.lineTo(X(xw), Y(yw));
    ctx.stroke();
    ctx.restore();
    dot(X(xw), Y(yw), 5.5, true, p.eps);

    // points of G at height y, converging to (0, y) ∈ J
    if (s.showApproach) {
      ctx.save();
      ctx.strokeStyle = p.ink3;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(X(0), Y(s.y));
      ctx.lineTo(X(1), Y(s.y));
      ctx.stroke();
      ctx.restore();
      for (let j = 1; j <= s.k; j++) dot(X(approach(s.y, j)), Y(s.y), j === s.k ? 5 : 3, true, p.pointIn);
      dot(X(0), Y(s.y), 8, false, p.limit);
    }
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1.25, worldHeight: 1, animate: false });
  useEffect(invalidate, [s]);

  /* ---------------------------------------------------------------- input */

  const vertexFromPointer = (e: PointerEvent): V | null => {
    const plot = plotRef.current;
    if (!plot || s.mode !== 'poly') return null;
    const [wx0, wx1] = r.window.x;
    const [wy0, wy1] = r.window.y;
    const x = wx0 + ((e.offsetX - plot.box.x) / plot.box.w) * (wx1 - wx0);
    const y = wy1 - ((e.offsetY - plot.box.y) / plot.box.h) * (wy1 - wy0);
    return snap(r, x, y);
  };
  const onPointerDown = (e: PointerEvent) => {
    const v = vertexFromPointer(e);
    if (v) userAdd(v);
  };
  const onPointerMove = (e: PointerEvent) => {
    const v = vertexFromPointer(e);
    if (v && !sameV(v, s.cursor)) setS({ ...s, cursor: v });
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (s.mode === 'sine') {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        userSine({ u: snapU(s.u + (e.key === 'ArrowRight' ? 1 : -1) * U_STEP * (e.shiftKey ? 10 : 1)) });
      }
      return;
    }
    const step = e.shiftKey ? 5 : 1;
    const move = (di: number, dj: number) => {
      e.preventDefault();
      const [wx0, wx1] = r.window.x;
      const [wy0, wy1] = r.window.y;
      const i = Math.max(Math.ceil(wx0 * GRID), Math.min(Math.floor(wx1 * GRID), s.cursor[0] + di * step));
      const j = r.onAxis ? 0 : Math.max(Math.ceil(wy0 * GRID), Math.min(Math.floor(wy1 * GRID), s.cursor[1] + dj * step));
      setS({ ...s, cursor: [i + 0, j + 0] });
    };
    if (e.key === 'ArrowLeft') move(-1, 0);
    else if (e.key === 'ArrowRight') move(1, 0);
    else if (e.key === 'ArrowUp') move(0, 1);
    else if (e.key === 'ArrowDown') move(0, -1);
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      userAdd(s.cursor);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      userUndo();
    }
  };

  /* ---------------------------------------------------------------- panel */

  const offeredModes = props.modes ?? [];
  const offeredRegions = (props.regions ?? []).filter(isRegion);
  const label =
    s.mode === 'poly'
      ? 'איור חי: קבוצה במישור ומסילה פוליגונלית שבונים מ-p. לוחצים על נקודה כדי להוסיף קודקוד. במקלדת: החצים מזיזים את הסמן, Enter מוסיף אותו, Backspace מבטל את האחרון.'
      : 'איור חי: עקומת הסינוס של הטופולוגים, הגרף של sin(1/x) והקטע האנכי J. במקלדת: חץ ימינה ושמאלה מזיז את קצה ההליכה.';

  return (
    <SimShell
      fig={props.id}
      label={`${label} ${describe()}`}
      canvasRef={canvasRef}
      aspect={1.25}
      live={live}
      tasks={tasks}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      cursor={s.mode === 'poly' ? 'crosshair' : 'default'}
      onReset={() => {
        setS(fresh(props));
        setLive('האיור אופס.');
      }}
      readout={
        s.mode === 'poly' ? (
          <>
            <span data-readout="region">
              {r.label}: <Q>{r.text}</Q>
            </span>
            <span data-readout="segments">
              קטעים: <Q>{String(s.path.length - 1)}</Q>, הקודקוד האחרון <Q>{vText(s.path[s.path.length - 1])}</Q>
            </span>
            <span data-readout="status">
              {rep.badVertex !== null ? (
                <>הקודקוד ה-{rep.badVertex} מחוץ לקבוצה.</>
              ) : rep.badSegment !== null ? (
                <>הקטע ה-{rep.badSegment} יוצא מהקבוצה (העיגול החלול).</>
              ) : rep.done && complete ? (
                <>המסילה מגיעה ל-q, וכל הקטעים שלה בתוך הקבוצה.</>
              ) : (
                <>כל הקטעים עד עכשיו בתוך הקבוצה.</>
              )}
            </span>
          </>
        ) : (
          <>
            <span data-readout="walker">
              קצה ההליכה: <Q>{`x = ${fmt(xw)}`}</Q>
            </span>
            <span data-readout="dist">
              המרחק מ-<Q>J</Q>: <Q>{fmt(distToJ(xw, sineG(xw)))}</Q>
            </span>
            <span data-readout="peaks">
              בדרך, ההליכה הגיעה לגובה <Q>±1</Q> <Q>{String(peakCount(xw))}</Q> פעמים
            </span>
            {s.showApproach && (
              <span data-readout="approach">
                <Q>{`x${subDigits(s.k)} = ${fmt(xk)}`}</Q>: המרחק מ-<Q>{`(0, ${fmt(s.y)})`}</Q> הוא <Q>{fmt(xk)}</Q>
              </span>
            )}
          </>
        )
      }
      controls={
        <>
          {offeredModes.length > 1 && (
            <div class="group" role="group" aria-label="האיור">
              {offeredModes.includes('poly') && <Toggle label="מסילות בקבוצה" on={s.mode === 'poly'} onChange={() => setS({ ...s, mode: 'poly' })} />}
              {offeredModes.includes('sine') && <Toggle label="עקומת הסינוס" on={s.mode === 'sine'} onChange={() => setS({ ...s, mode: 'sine' })} />}
            </div>
          )}
          {s.mode === 'poly' ? (
            <>
              {offeredRegions.length > 1 && (
                <div class="group" role="group" aria-label="הקבוצה">
                  {offeredRegions.map((id) => (
                    <Toggle key={id} label={REGIONS[id].label} on={s.region === id} onChange={() => userRegion(id)} />
                  ))}
                </div>
              )}
              <div class="group">
                <button type="button" class="toggle" onClick={userUndo} disabled={s.path.length <= 1}>
                  ביטול הקודקוד האחרון
                </button>
                <button type="button" class="toggle" onClick={userClear} disabled={s.path.length <= 1}>
                  מחיקת המסילה
                </button>
              </div>
            </>
          ) : (
            <>
              <Slider
                label="קצה ההליכה x (סולם לוגריתמי)"
                value={s.u}
                min={U_MIN}
                max={0}
                step={U_STEP}
                format={(v) => fmt(xOfU(snapU(v)))}
                onChange={(v) => userSine({ u: snapU(v) })}
              />
              <div class="group">
                <Toggle label="נקודות מתקרבות" on={s.showApproach} onChange={(on) => userSine({ showApproach: on })} />
              </div>
              {s.showApproach && (
                <>
                  <Slider label="y" value={s.y} min={-1} max={1} step={Y_STEP} format={(v) => fmt(snapY(v))} onChange={(v) => userSine({ y: snapY(v) })} />
                  <Slider label="k" value={s.k} min={1} max={K_MAX} step={1} format={(v) => String(Math.round(v))} onChange={(v) => userSine({ k: clampK(v) })} />
                </>
              )}
            </>
          )}
        </>
      }
    />
  );
}
