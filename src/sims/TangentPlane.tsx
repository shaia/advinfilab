/**
 * Lesson 5.3's figure: is there a tangent plane? The remainder ratio of the candidate plane, zoomed.
 *
 * Upper panel (2D, the default and the one every task uses): the disk ‖h‖₂ ≤ ρ of steps h around the point a,
 * always drawn at the same size (zoomed coordinates u = h/ρ), shaded by the ratio q(h) = |r(h)|/‖h‖₂ of the
 * remainder r(h) = f(a + h) − f(a) − J_f(a)h of the candidate plane: cells where q ≥ ε in the warm ε colour, darker
 * as q grows; cells where q < ε left blank. The disk is the δ-ball of הגדרה 5.3.1 with δ = ρ (cool outline). A
 * direction θ (the student's) ends on the circle in a point that is filled when q < ε there and a hollow ring when
 * q ≥ ε (shape, not only colour); small warm triangles outside the circle mark the directions where q is largest.
 *
 * Lower panel: ρ′ ↦ S(ρ′), the sup of q on the circle of radius ρ′, on log-log axes, with the ε line (warm, dashed)
 * and the current ρ (cool, dashed). Differentiable presets give a line of slope 1 that drops below every ε; the
 * degree-1 homogeneous ones a flat line; x²y/(x⁴ + y²) a line of slope −1.
 *
 * Optional 3D view (a toggle): the graph of f and the candidate plane, zoomed by 1/ρ in all three axes, rendered by
 * three.js. three.js is loaded with a dynamic import() only after webglAvailable() says yes and the reader asks for
 * it; without WebGL the toggle says so and the 2D view stays. Every number comes from src/math/tangent.ts (closed
 * forms); the shading samples a grid (a probe: the caption says so). No animation.
 */

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { webglAvailable } from '~/figures3d/webgl';
import {
  PRESETS,
  RHO_MAX,
  RHO_MIN,
  deg,
  describe as describeState,
  fmtNum,
  ratioGrid,
  rhoWorks,
  type PresetId,
} from '~/math/tangent';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { withAlpha } from './core/ink';
import { drawAxes, insetBox, makePlot, type Box, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import type { Tangent3D } from './TangentPlane3D';

/** a left-to-right island inside Hebrew text (U+2066 … U+2069), with no-break spaces so it never wraps */
const ltr = (s: string) => `⁦${s.replace(/ /g, '\u00a0')}⁩`;

const TASK_LABEL: Record<string, string> = {
  'paraboloid-delta': `ב-${ltr('x² + y²')} סביב ${ltr('(1, 1)')}, עם ${ltr('ε ≤ 0.05')}: מצאו ρ שמתאים כ-δ, כלומר היחס קטן מ-ε בכל העיגול.`,
  'sqrt-worst': `ב-${ltr('√|xy|')}, עם ${ltr('ρ ≤ 0.01')}: כוונו את θ לכיוון שבו היחס הגדול ביותר (עד ${ltr('1%')} מהסופרמום).`,
  'cubic-worst': `ב-${ltr('x³/(x² + y²)')}: מצאו כיוון θ שבו היחס הגדול ביותר (עד ${ltr('1%')} מהסופרמום).`,
  'square-delta': `ב-${ltr('x²y²/(x² + y²)')}, עם ${ltr('ε ≤ 0.01')}: מצאו ρ שמתאים כ-δ.`,
  'parabola-blowup': `ב-${ltr('x²y/(x⁴ + y²)')}, עם ${ltr('ρ ≤ 0.05')}: מצאו כיוון θ שבו היחס גדול מ-${ltr('5')}.`,
};

const LOG_MIN = Math.log10(RHO_MIN);
const LOG_MAX = Math.log10(RHO_MAX);
const sig3 = (v: number) => Number(v.toPrecision(3));
const clampLog = (v: number) => Math.min(RHO_MAX, Math.max(RHO_MIN, sig3(v)));
/**
 * The opening 3D view of a preset: about 50° away from the direction of steepest ascent of the candidate plane, so
 * its tilt shows (looking along it, the plane is seen almost face-on and reads as a tall slab; across it, edge-on).
 * three.js is y-up and maps (u₁, u₂) to (x, −z), so J = (J₁, J₂) points at the azimuth atan2(−J₂, J₁).
 */
const defaultOrbit = (J: readonly [number, number]) => ({
  azimuth: J[0] === 0 && J[1] === 0 ? -1.0 : Math.atan2(-J[1], J[0]) + Math.PI - 0.45,
  elevation: 0.7,
});

const roundTheta = (v: number) => {
  const t = Math.round(v * 2) / 2;
  return ((t % 360) + 360) % 360;
};
const S_MIN = 1e-4;
const S_MAX = 1e3;

interface State {
  preset: PresetId;
  rho: number;
  eps: number;
  /** degrees */
  theta: number;
}

type View3DState = 'off' | 'loading' | 'on' | 'unavailable';

export interface TangentPlaneProps {
  id: string;
  preset?: PresetId;
  presets?: PresetId[];
  rho?: number;
  eps?: number;
  theta?: number;
  tasks?: string[];
}

function fresh(p: TangentPlaneProps): State {
  return {
    preset: p.preset && p.preset in PRESETS ? p.preset : 'paraboloid',
    rho: clampLog(typeof p.rho === 'number' ? p.rho : 0.5),
    eps: clampLog(typeof p.eps === 'number' ? p.eps : 0.1),
    theta: roundTheta(typeof p.theta === 'number' ? p.theta : 30),
  };
}

const Q = (p: { children: string }) => (
  <b class="q">
    <bdi dir="ltr">{p.children}</bdi>
  </b>
);
const num = (v: number) => (Number.isFinite(v) ? fmtNum(sig3(v)) : '∞');
const rad = (d: number) => (d * Math.PI) / 180;

export default function TangentPlane(props: TangentPlaneProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const [view3d, setView3d] = useState<View3DState>('off');
  const engine = useRef<Tangent3D | null>(null);
  const orbit = useRef(defaultOrbit(PRESETS[fresh(props).preset].J));
  const topRef = useRef<{ box: Box; cx: number; cy: number; R: number } | null>(null);
  const lowRef = useRef<Plot | null>(null);
  const drag = useRef<null | { kind: 'theta' | 'rho' | 'orbit'; x: number; y: number }>(null);
  const shade = useRef<HTMLCanvasElement | null>(null);
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const has = (t: string) => props.tasks?.includes(t) ?? false;

  const P = PRESETS[s.preset];
  const q = P.ratioExact(s.rho, rad(s.theta));
  // On an axis cos θ or sin θ is exactly 0, but Math.cos(π/2) is 6·10⁻¹⁷ (and its square root 8·10⁻⁹): print 0 there.
  const qShown = s.theta % 90 === 0 && Math.abs(q) < 1e-6 ? 0 : q;
  const S = P.circleSup(s.rho);
  const D = P.diskSup(s.rho);
  const works = rhoWorks(P, s.rho, s.eps);
  const worst = P.worst(s.rho);
  const n = 64;
  const grid = useMemo(() => ratioGrid(P, s.rho, n), [s.preset, s.rho]);

  /** The student's own change. A text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    setS(next);
    const id = props.id;
    const F = PRESETS[next.preset];
    const qq = F.ratioExact(next.rho, rad(next.theta));
    const SS = F.circleSup(next.rho);
    const ok = rhoWorks(F, next.rho, next.eps);
    if (has('paraboloid-delta') && next.preset === 'paraboloid' && next.eps <= 0.05 + 1e-9 && ok) markTask(`${id}:paraboloid-delta`);
    if (has('sqrt-worst') && next.preset === 'sqrt' && next.rho <= 0.01 + 1e-12 && qq >= 0.99 * SS) markTask(`${id}:sqrt-worst`);
    if (has('cubic-worst') && next.preset === 'cubic' && qq >= 0.99 * SS) markTask(`${id}:cubic-worst`);
    if (has('square-delta') && next.preset === 'square' && next.eps <= 0.01 + 1e-9 && ok) markTask(`${id}:square-delta`);
    if (has('parabola-blowup') && next.preset === 'parabola' && next.rho <= 0.05 + 1e-12 && qq > 5) markTask(`${id}:parabola-blowup`);
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.preset === 'string' && st.preset in PRESETS) next.preset = st.preset as PresetId;
          if (typeof st.rho === 'number') next.rho = clampLog(st.rho);
          if (typeof st.eps === 'number') next.eps = clampLog(st.eps);
          if (typeof st.theta === 'number') next.theta = roundTheta(st.theta);
          return next;
        });
      }),
    [props.id],
  );

  const describe = () => describeState(P, s.rho, s.eps, s.theta);
  useEffect(() => {
    const t = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(t);
  }, [s]);

  // the 3D engine is freed with the island
  useEffect(
    () => () => {
      engine.current?.dispose();
      engine.current = null;
    },
    [],
  );

  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const splitY = view.h * 0.6;
    // the round tool buttons (reset, full screen) sit over the top-right corner: keep the legend left of them
    const toolsW = 2 * 34 + 6 + 8 + 8;
    const top: Box = { x: 0, y: 0, w: view.w, h: splitY };
    // the two legend lines get a strip of their own, above the disk
    const legendH = narrow ? 40 : 30;
    const cx = view.w / 2;
    const cy = top.y + legendH + (top.h - legendH) / 2 + 4;
    const R = Math.max(20, Math.min(view.w * 0.4, (top.h - legendH) / 2 - 22));
    topRef.current = { box: top, cx, cy, R };
    const X = (u1: number) => cx + R * u1;
    const Y = (u2: number) => cy - R * u2;

    const show3d = view3d === 'on' && engine.current;
    if (show3d) {
      try {
        const img = engine.current!.render({
          preset: P,
          rho: s.rho,
          width: top.w,
          height: top.h - legendH,
          dpr: view.dpr,
          palette: p,
          azimuth: orbit.current.azimuth,
          elevation: orbit.current.elevation,
        });
        ctx.drawImage(img, top.x, top.y + legendH, top.w, top.h - legendH);
      } catch {
        // a lost context: fall back to the 2D view
        engine.current?.dispose();
        engine.current = null;
        setView3d('unavailable');
      }
    } else {
      // ---------------- the disk of steps, shaded by the ratio
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, 2 * Math.PI);
      ctx.fillStyle = p.deltaBand;
      ctx.fill();
      ctx.clip();
      // one pixel per grid cell of an n × n offscreen canvas, scaled onto the disk: translucent cells drawn straight
      // onto the disk would overlap (or leave gaps) along every seam and draw a grid over it
      const off = (shade.current ??= document.createElement('canvas'));
      off.width = n;
      off.height = n;
      const oc = off.getContext('2d');
      if (oc) {
        oc.clearRect(0, 0, n, n);
        for (let j = 0; j < n; j++)
          for (let i = 0; i < n; i++) {
            const v = grid[j * n + i];
            if (!(v >= s.eps)) continue;
            const t = Math.min(1, Math.log10(v / s.eps) / 1.5);
            oc.fillStyle = withAlpha(p.eps, 0.28 + 0.6 * t);
            oc.fillRect(i, j, 1, 1);
          }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(off, cx - R, cy - R, 2 * R, 2 * R);
        ctx.imageSmoothingEnabled = true;
      }
      ctx.restore();

      // axes of h
      ctx.save();
      ctx.strokeStyle = p.ink3;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(X(-1.12), Y(0));
      ctx.lineTo(X(1.12), Y(0));
      ctx.moveTo(X(0), Y(-1.12));
      ctx.lineTo(X(0), Y(1.12));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `600 ${narrow ? 11 : 12}px ${p.fontUi}`;
      ctx.fillStyle = p.ink2;
      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('h₁', X(1.12) + 4, Y(0));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('h₂', X(0), Y(1.12) - 2);
      ctx.restore();

      // the circle ‖h‖ = ρ
      ctx.save();
      ctx.strokeStyle = p.delta;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();

      // the worst directions
      if (worst) {
        ctx.save();
        ctx.fillStyle = p.eps;
        for (const w of worst) {
          const ux = Math.cos(w);
          const uy = Math.sin(w);
          const tipX = X(1.04 * ux);
          const tipY = Y(1.04 * uy);
          const bx = X(1.16 * ux);
          const by = Y(1.16 * uy);
          const nx = -uy * 6;
          const ny = -ux * 6;
          ctx.beginPath();
          ctx.moveTo(tipX, tipY);
          ctx.lineTo(bx + nx, by + ny);
          ctx.lineTo(bx - nx, by - ny);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // the direction θ and its point on the circle: filled when q < ε, a hollow ring when q ≥ ε
      const th = rad(s.theta);
      const ex = X(Math.cos(th));
      const ey = Y(Math.sin(th));
      ctx.save();
      ctx.strokeStyle = p.curve;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, 2 * Math.PI);
      ctx.fillStyle = p.curve;
      ctx.fill();
      const inside = q < s.eps;
      ctx.beginPath();
      ctx.arc(ex, ey, inside ? 5 : 6.5, 0, 2 * Math.PI);
      if (inside) {
        ctx.fillStyle = p.pointIn;
        ctx.fill();
      } else {
        ctx.fillStyle = p.paper;
        ctx.fill();
        ctx.strokeStyle = p.pointOut;
        ctx.lineWidth = 2.4;
        ctx.stroke();
      }
      ctx.restore();
    }

    // legend, LTR
    ctx.save();
    ctx.font = `600 ${narrow ? 11 : 13}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const l1 = `f = ${P.formula},  a = ${P.at}`;
    const l2 = `T = (${P.J[0]}, ${P.J[1]}),  ‖h‖ ≤ ρ = ${num(s.rho)}`;
    const room = narrow ? Math.max(60, view.w - toolsW - 8) : undefined;
    ctx.fillStyle = p.curve;
    ctx.fillText(l1, 8, 14, room);
    ctx.fillStyle = show3d ? p.limit : p.delta;
    ctx.fillText(show3d ? `z = T·u,  u = h/ρ` : l2, 8, 31, room);
    ctx.restore();

    // ---------------- lower panel: ρ′ ↦ S(ρ′) on log-log axes
    const box2 = insetBox({ x: 0, y: splitY, w: view.w, h: view.h - splitY }, { l: narrow ? 40 : 46, r: 14, t: narrow ? 22 : 14, b: 24 });
    const plot = makePlot(box2, { min: RHO_MIN, max: RHO_MAX, scale: 'log' }, { min: S_MIN, max: S_MAX, scale: 'log', ticks: narrow ? [1e-4, 1e-2, 1, 1e2] : undefined });
    lowRef.current = plot;
    drawAxes(ctx, plot, p);
    ctx.save();
    ctx.beginPath();
    ctx.rect(box2.x, box2.y - 2, box2.w, box2.h + 4);
    ctx.clip();
    const clampS = (v: number) => Math.min(S_MAX * 2, Math.max(S_MIN / 2, v));
    // ε line
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = p.eps;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(box2.x, plot.py(s.eps));
    ctx.lineTo(box2.x + box2.w, plot.py(s.eps));
    ctx.stroke();
    // current ρ
    ctx.strokeStyle = p.delta;
    ctx.beginPath();
    ctx.moveTo(plot.px(s.rho), box2.y);
    ctx.lineTo(plot.px(s.rho), box2.y + box2.h);
    ctx.stroke();
    ctx.setLineDash([]);
    // S(ρ′)
    ctx.strokeStyle = p.curve;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k <= 120; k++) {
      const r = 10 ** (LOG_MIN + ((LOG_MAX - LOG_MIN) * k) / 120);
      const yv = plot.py(clampS(P.circleSup(r)));
      if (k) ctx.lineTo(plot.px(r), yv);
      else ctx.moveTo(plot.px(r), yv);
    }
    ctx.stroke();
    const okHere = S < s.eps;
    ctx.beginPath();
    ctx.arc(plot.px(s.rho), plot.py(clampS(S)), 5, 0, 2 * Math.PI);
    ctx.fillStyle = okHere ? p.pointIn : p.paper;
    ctx.fill();
    ctx.strokeStyle = okHere ? p.pointIn : p.pointOut;
    ctx.lineWidth = okHere ? 1 : 2.2;
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.font = `600 ${narrow ? 11 : 12}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = p.curve;
    ctx.fillText('S(ρ′)', narrow ? box2.x : box2.x + 8, narrow ? box2.y - 11 : box2.y + 10);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = p.ink2;
    ctx.fillText('ρ′', box2.x + box2.w, box2.y + box2.h - 3);
    ctx.restore();
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1, worldHeight: 1, animate: false });
  useEffect(invalidate, [s, grid, view3d]);
  // a new function opens on its own 3D view
  const shownPreset = useRef(s.preset);
  if (shownPreset.current !== s.preset) {
    shownPreset.current = s.preset;
    orbit.current = defaultOrbit(P.J);
  }

  const toggle3d = () => {
    if (view3d === 'on') {
      setView3d('off');
      return;
    }
    if (view3d === 'loading') return;
    if (!webglAvailable()) {
      setView3d('unavailable');
      return;
    }
    if (engine.current) {
      setView3d('on');
      return;
    }
    setView3d('loading');
    import('./TangentPlane3D')
      .then((m) => {
        engine.current = m.createTangent3D();
        setView3d('on');
      })
      .catch(() => {
        engine.current = null;
        setView3d('unavailable');
      });
  };

  const onPointerDown = (e: PointerEvent) => {
    const t = topRef.current;
    const plot = lowRef.current;
    if (!t || !plot) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (e.offsetY < t.box.y + t.box.h) {
      if (view3d === 'on') {
        drag.current = { kind: 'orbit', x: e.offsetX, y: e.offsetY };
        return;
      }
      drag.current = { kind: 'theta', x: e.offsetX, y: e.offsetY };
      thetaFrom(e);
    } else {
      drag.current = { kind: 'rho', x: e.offsetX, y: e.offsetY };
      rhoFrom(e);
    }
  };
  const thetaFrom = (e: PointerEvent) => {
    const t = topRef.current;
    if (!t) return;
    const dx = e.offsetX - t.cx;
    const dy = t.cy - e.offsetY;
    if (Math.hypot(dx, dy) < 4) return;
    const th = roundTheta(deg(Math.atan2(dy, dx)));
    if (th !== s.theta) userSet({ theta: th });
  };
  const rhoFrom = (e: PointerEvent) => {
    const plot = lowRef.current;
    if (!plot) return;
    const f = (e.offsetX - plot.box.x) / plot.box.w;
    const r = clampLog(10 ** (LOG_MIN + f * (LOG_MAX - LOG_MIN)));
    if (r !== s.rho) userSet({ rho: r });
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'theta') thetaFrom(e);
    else if (d.kind === 'rho') rhoFrom(e);
    else {
      const o = orbit.current;
      o.azimuth += (e.offsetX - d.x) * 0.01;
      o.elevation = Math.max(-1.3, Math.min(1.3, o.elevation + (e.offsetY - d.y) * 0.01));
      d.x = e.offsetX;
      d.y = e.offsetY;
      invalidate();
    }
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      userSet({ theta: roundTheta(s.theta + (e.key === 'ArrowLeft' ? 1 : -1) * (e.shiftKey ? 10 : 1)) });
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      userSet({ rho: clampLog(10 ** (Math.log10(s.rho) + (e.key === 'ArrowUp' ? 0.05 : -0.05))) });
    }
  };

  const offered = (props.presets ?? []).filter((id) => id in PRESETS);
  const worstDeg = worst ? worst.map(deg).sort((a, b) => a - b)[0] : null;

  const readout = (
    <>
      <span data-readout="preset">
        <Q>{`f = ${P.formula}`}</Q> סביב <Q>{`a = ${P.at}`}</Q>; המועמד מהנגזרות החלקיות: <Q>{`T = J_f(a) = (${P.J[0]}, ${P.J[1]})`}</Q>
      </span>
      <span data-readout="ratio">
        בכיוון <Q>{`θ = ${fmtNum(s.theta)}°`}</Q> על המעגל: <Q>{`|r(h)|/‖h‖ ≈ ${num(qShown)}`}</Q>
        {q < s.eps ? ' (קטן מ-ε)' : ' (לפחות ε)'}
      </span>
      <span data-readout="circle">
        על המעגל <Q>{`‖h‖ = ρ = ${num(s.rho)}`}</Q>: הסופרמום <Q>{`S(ρ) = ${num(S)}`}</Q>
        {worstDeg === null ? ', בכל כיוון' : <>, בכיוון <Q>{`θ ≈ ${fmtNum(Number(worstDeg.toFixed(1)))}°`}</Q> (ובכיוונים הסימטריים)</>}
      </span>
      <span data-readout="delta">
        {works ? (
          <>
            בכל העיגול <Q>{`0 < ‖h‖ ≤ ${num(s.rho)}`}</Q> היחס קטן מ-<Q>{`ε = ${num(s.eps)}`}</Q>: ρ מתאים כ-δ.
          </>
        ) : (
          <>
            ρ אינו מתאים כ-δ ל-<Q>{`ε = ${num(s.eps)}`}</Q>: בעיגול <Q>{`0 < ‖h‖ ≤ ${num(s.rho)}`}</Q> הסופרמום של היחס הוא <Q>{num(D)}</Q>.
          </>
        )}
      </span>
      {view3d !== 'off' && (
        <span data-readout="view3d">
          {view3d === 'loading'
            ? 'טוענים את התצוגה התלת-ממדית…'
            : view3d === 'on'
              ? 'תלת-ממד: הגרף והמישור המועמד, מוגדלים פי 1/ρ בכל הצירים. גררו כדי לסובב.'
              : 'תצוגה תלת-ממדית אינה זמינה בדפדפן הזה; האיור הדו-ממדי מראה את אותו מידע.'}
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
      <Slider label="ρ" value={Math.log10(s.rho)} min={LOG_MIN} max={LOG_MAX} step={0.01} format={(v) => fmtNum(clampLog(10 ** v))} onChange={(v) => userSet({ rho: clampLog(10 ** v) })} />
      <Slider label="ε" value={Math.log10(s.eps)} min={LOG_MIN} max={LOG_MAX} step={0.01} format={(v) => fmtNum(clampLog(10 ** v))} onChange={(v) => userSet({ eps: clampLog(10 ** v) })} />
      <Slider label="θ (מעלות)" value={s.theta} min={0} max={359.5} step={0.5} format={(v) => fmtNum(roundTheta(v))} onChange={(v) => userSet({ theta: roundTheta(v) })} />
      <div class="group" role="group" aria-label="תצוגה">
        <Toggle label="תלת-ממד" on={view3d === 'on'} onChange={toggle3d} />
      </div>
    </>
  );

  return (
    <SimShell
      fig={props.id}
      label={`איור חי: עיגול הצעדים h סביב הנקודה, מוצלל לפי היחס בין השארית של המישור המועמד לבין אורך הצעד; למטה, הסופרמום של היחס על המעגל כפונקציה של הרדיוס. במקלדת: חצים ימינה ושמאלה מסובבים את הכיוון θ, למעלה ולמטה משנים את ρ. ${describe()}`}
      canvasRef={canvasRef}
      aspect={1}
      live={live}
      tasks={tasks}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      cursor={view3d === 'on' ? 'grab' : 'crosshair'}
      onReset={() => {
        setS(fresh(props));
        orbit.current = defaultOrbit(PRESETS[fresh(props).preset].J);
        setLive('האיור אופס.');
      }}
      readout={readout}
      controls={controls}
    />
  );
}

