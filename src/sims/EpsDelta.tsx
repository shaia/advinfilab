/**
 * The figure of lessons 1.6 and 1.7: continuity as a game of two bands (1.6, mode 'graph'), and Lipschitz
 * equivalence of metrics as nested balls (1.7, mode 'nested').
 *
 * Mode 'graph': the graph of f: ℝ → ℝ, a point a, the ε-band around f(a) (warm, horizontal) and the δ-band around a
 * (cool, vertical). δ works at a when the graph over (a − δ, a + δ) stays inside the ε-band, i.e.
 * f(B(a, δ)) ⊆ B(f(a), ε). The point (a, f(a)) is drawn filled when δ works and hollow with a ring when not, and a
 * witness x (in the δ-band, its value out of the ε-band) is marked hollow. With "all points" on, a lower panel draws
 * the largest δ that works, δ*(a), as a function of a across the window, with the student's δ as a line: one δ works
 * for every a (uniform continuity on the window) exactly when the line lies under the whole curve.
 *
 * Mode 'nested': the outer ball B(0, 1) of one norm metric on ℝ² and an inner ball B(0, ρ) of another. The inner
 * ball fits once ρ ≤ 1/C, where C is the constant in d_outer ≤ C·d_inner. Lipschitz equivalence is "both directions
 * have such a C": every ball of one metric contains a ball of the other with the same centre.
 *
 * Mode 'uniform' (lesson 3.4): f restricted to a closed bounded interval D, the left end c of [c, 1] or the half-width
 * W of [−W, W] on a slider. The same two bands at a ∈ D, with only the points of D counted, and a lower panel that is
 * always on: δ*_D(a) across D and the student's δ as a line. On every D the curve stays above a positive level
 * (Cantor's theorem on a compact interval); for 1/x and sin(1/x) that level falls to 0 as c → 0, for x² as W → ∞,
 * and for √x it does not. The δ slider is logarithmic, since the uniform δ of 1/x on [0.02, 1] is about 2·10⁻⁴.
 *
 * Every δ*, every uniform δ and every C comes from src/math/continuity.ts, which holds closed formulas (the uniform
 * δ of sin(1/x) is a refined sample). The figure shows one ε, one a, one window: evidence, and the captions say so.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import {
  DOMAIN_PRESETS,
  PRESETS,
  deltaWorks,
  innerFits,
  normRatio,
  type DomainPresetId,
  type NormP,
  type PresetId,
} from '~/math/continuity';
import { markTask, progress } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useMounted } from '~/ui/useMounted';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { withAlpha } from './core/ink';
import { drawAxes, insetBox, makePlot, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

type Mode = 'graph' | 'nested' | 'uniform';
type MetricKey = 'd1' | 'd2' | 'dinf';
/** a left-to-right island inside Hebrew text (U+2066 … U+2069) */
const ltr = (s: string) => `⁦${s}⁩`;

const TASK_LABEL: Record<string, string> = {
  'find-delta': 'בפונקציה ⁦x²⁩, בנקודה ⁦a ≥ 2⁩ ועם ⁦ε ≤ 0.5⁩: עד כמה אפשר להגדיל את δ כך שהוא עוד מתאים? מצאו δ מתאים שהוא לפחות חצי מהגבול הזה.',
  'no-delta': 'בפונקציית הקפיצה, בנקודה ⁦a = 0⁩ ועם ⁦ε ≤ 1⁩, צמצמו את δ עד ⁦0.05⁩ או פחות: האם הוא מתאים?',
  'not-uniform': 'בפונקציה ⁦x²⁩, בחרו δ שמתאים ב-⁦a = 0⁩ והזיזו את a: האם אותו δ מתאים בכל נקודה? מצאו נקודה שמכריעה.',
  'uniform-sqrt': 'בפונקציה ⁦√|x|⁩, עם "כל הנקודות" דולק: האם יש δ אחד שמתאים לכל a בחלון? אם כן, מצאו כזה שהוא לפחות חצי מהגדול ביותר האפשרי.',
  'best-inner': 'כדור חיצוני ב-⁦d₁⁩ וכדור פנימי ב-⁦d∞⁩: מצאו את הרדיוס הפנימי הגדול ביותר שעוד נכנס.',
  reverse: 'הפכו את התפקידים: כדור חיצוני ב-⁦d∞⁩ וכדור פנימי ב-⁦d₁⁩. מה עכשיו הרדיוס הפנימי הגדול ביותר?',
  'compact-delta': `בפונקציה ${ltr('1/x')} על ${ltr('[c, 1]')} עם ${ltr('0.2 ≤ c ≤ 0.3')} ו-${ltr('ε = 0.5')}: בחרו δ שמתאים לכל הנקודות של התחום, וגדול לפחות מחצי ה-δ הגדול ביותר שמתאים לכולן.`,
  'lose-delta': `בפונקציה ${ltr('1/x')} או ${ltr('sin(1/x)')}: בחרו δ שמתאים לכל הנקודות של ${ltr('[c, 1]')}, ואז הזיזו את c שמאלה עד שאותו δ כבר אינו מתאים לכולן.`,
  'sqrt-keeps': `בפונקציה ${ltr('√x')}: הזיזו את c עד הקצה השמאלי של המחוון, ובחרו δ שמתאים לכל הנקודות של התחום, וגדול לפחות מחצי ה-δ הגדול ביותר שמתאים לכולן. השוו ל-${ltr('1/x')}.`,
  window: `בפונקציה ${ltr('x²')} על ${ltr('[−W, W]')} עם ${ltr('W ≥ 5')}: בחרו δ שמתאים לכל הנקודות של התחום, וגדול לפחות מחצי ה-δ הגדול ביותר שמתאים לכולן.`,
};

const DPRESET_LABEL: Record<DomainPresetId, string> = {
  recip: `${ltr('f(x) = 1/x')} על ${ltr('[c, 1]')}`,
  sinrecip: `${ltr('f(x) = sin(1/x)')} על ${ltr('[c, 1]')}`,
  sqrtc: `${ltr('f(x) = √x')} על ${ltr('[c, 1]')}`,
  squareW: `${ltr('f(x) = x²')} על ${ltr('[−W, W]')}`,
};
const DPRESET_SHORT: Record<DomainPresetId, string> = { recip: '1/x', sinrecip: 'sin(1/x)', sqrtc: '√x', squareW: 'x²' };
const C_MIN = 0.02;
const C_MAX = 0.9;
const W_MIN = 1;
const W_MAX = 10;
const LOGD_MIN = -4;
const LOGD_MAX = 0;

const PRESET_LABEL: Record<PresetId, string> = { line: 'f(x) = 2x', square: 'f(x) = x²', sqrt: 'f(x) = √|x|', jump: 'קפיצה ב-0' };
/** the y-window of each graph */
const Y_RANGE: Record<PresetId, [number, number]> = { line: [-6.5, 6.5], square: [-1, 9.5], sqrt: [-0.3, 2], jump: [-0.6, 1.6] };
const W = 3;
const P_OF: Record<MetricKey, NormP> = { d1: 1, d2: 2, dinf: Infinity };
const METRIC_LABEL: Record<MetricKey, string> = { d1: 'd₁', d2: 'd₂', dinf: 'd∞' };

const fmt = (v: number) => (Number.isFinite(v) ? sci(Math.round(v * 1e6) / 1e6, 3).replace(/^-/, '−') : '∞');
const round = (v: number, step: number) => Math.round(v / step) * step;

interface State {
  preset: PresetId;
  a: number;
  eps: number;
  delta: number;
  all: boolean;
  outer: MetricKey;
  inner: MetricKey;
  rho: number;
  /** mode 'uniform': the function, the left end c of [c, 1] and the half-width W of [−W, W] */
  dpreset: DomainPresetId;
  c: number;
  W: number;
}

export interface EpsDeltaProps {
  id: string;
  mode: Mode;
  /** a PresetId in modes 'graph' and 'nested', a DomainPresetId in mode 'uniform' */
  preset?: PresetId | DomainPresetId;
  presets?: (PresetId | DomainPresetId)[];
  a?: number;
  eps?: number;
  delta?: number;
  all?: boolean;
  outer?: MetricKey;
  inner?: MetricKey;
  rho?: number;
  c?: number;
  W?: number;
  tasks?: string[];
}

const isPreset = (v: unknown): v is PresetId => typeof v === 'string' && v in PRESETS;
const isDomain = (v: unknown): v is DomainPresetId => typeof v === 'string' && v in DOMAIN_PRESETS;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** the domain D of the current function in mode 'uniform' */
const domainOf = (s: Pick<State, 'dpreset' | 'c' | 'W'>): [number, number] => {
  const P = DOMAIN_PRESETS[s.dpreset];
  return P.domain(P.param === 'c' ? s.c : s.W);
};
const parOf = (s: Pick<State, 'dpreset' | 'c' | 'W'>) => (DOMAIN_PRESETS[s.dpreset].param === 'c' ? s.c : s.W);
/** δ with three significant figures, as the logarithmic slider sets it */
const sig3 = (v: number) => Number(v.toPrecision(3));
/** mode 'uniform': the task whose answer is the uniform δ of each function (its readout stays hidden until it is ticked) */
const UNIFORM_ANSWERS: Partial<Record<DomainPresetId, string>> = { recip: 'compact-delta', sqrtc: 'sqrt-keeps', squareW: 'window' };
/** mode 'uniform': whether a state meets a task's target (δ works on all of D and is at least half the largest such δ) */
function uniformTarget(t: string, x: State): boolean {
  const un = DOMAIN_PRESETS[x.dpreset].uniformDelta(x.eps, parOf(x));
  const fit = x.delta <= un + 1e-12 && x.delta >= un / 2;
  if (t === 'compact-delta') return fit && x.dpreset === 'recip' && x.c >= 0.2 - 1e-9 && x.c <= 0.3 + 1e-9 && Math.abs(x.eps - 0.5) < 1e-9;
  if (t === 'sqrt-keeps') return fit && x.dpreset === 'sqrtc' && x.c <= C_MIN + 1e-9;
  if (t === 'window') return fit && x.dpreset === 'squareW' && x.W >= 5 - 1e-9;
  return false;
}

function fresh(p: EpsDeltaProps): State {
  const s: State = {
    preset: isPreset(p.preset) ? p.preset : 'square',
    a: p.a ?? 1,
    eps: p.eps ?? 0.5,
    delta: p.delta ?? 0.3,
    all: p.all ?? false,
    outer: p.outer ?? 'd1',
    inner: p.inner ?? 'dinf',
    rho: p.rho ?? 0.3,
    dpreset: isDomain(p.preset) ? p.preset : 'recip',
    c: clamp(p.c ?? 0.2, C_MIN, C_MAX),
    W: clamp(p.W ?? 2, W_MIN, W_MAX),
  };
  if (p.mode === 'uniform') {
    const [lo, hi] = domainOf(s);
    s.a = clamp(s.a, lo, hi);
  }
  return s;
}

/** A point x with |x − a| < δ and |f(x) − f(a)| ≥ ε, or null when δ works. */
function witness(s: State): number | null {
  const { f, deltaStar } = PRESETS[s.preset];
  const ds = deltaStar(s.a, s.eps);
  if (s.delta <= ds + 1e-12) return null;
  const t = ds + (s.delta - ds) / 2;
  for (const x of [s.a + t, s.a - t]) if (Math.abs(f(x) - f(s.a)) >= s.eps) return x;
  return null;
}

export default function EpsDelta(props: EpsDeltaProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const plotRef = useRef<Plot | null>(null);
  const dragging = useRef(false);
  const mode = props.mode;

  const P = PRESETS[s.preset];
  const best = P.deltaStar(s.a, s.eps);
  const works = deltaWorks(s.preset, s.a, s.eps, s.delta);
  const uni = P.uniformDelta(s.eps, W);
  const uniWorks = s.delta <= uni + 1e-12;
  // mode 'graph': the largest δ (at a, or over the window) answers the task about the current function, so it is
  // shown only once that task is ticked (before mount, as on the server, every task counts as open)
  const mounted = useMounted();
  const ANSWERS: Partial<Record<PresetId, string>> = { square: 'find-delta', jump: 'no-delta', sqrt: 'uniform-sqrt' };
  const answerTask = ANSWERS[s.preset];
  const reveal = !answerTask || !props.tasks?.includes(answerTask) || (mounted && !!progress.value.tasks[`${props.id}:${answerTask}`]);
  const HIDDEN = 'יופיע אחרי שתפתרו את המשימה על הפונקציה הזו.';
  const C = normRatio(P_OF[s.outer], P_OF[s.inner]);
  const fits = innerFits(P_OF[s.outer], 1, P_OF[s.inner], s.rho);
  // mode 'nested': the constant and the largest inner radius answer the task about the current pair of metrics, so
  // they are shown only once that task is ticked; a pair no task asks about shows them at once
  const pairTask = s.outer === 'd1' && s.inner === 'dinf' ? 'best-inner' : s.outer === 'dinf' && s.inner === 'd1' ? 'reverse' : undefined;
  const revealPair = !pairTask || !props.tasks?.includes(pairTask) || (mounted && !!progress.value.tasks[`${props.id}:${pairTask}`]);
  // mode 'uniform'
  const DP = DOMAIN_PRESETS[s.dpreset];
  const par = parOf(s);
  const [dlo, dhi] = domainOf(s);
  const nb = mode === 'uniform' ? DP.nearestBad(s.a, s.eps, par) : { dist: Infinity, x: null };
  const dWorks = s.delta <= nb.dist + 1e-12;
  const dUni = mode === 'uniform' ? DP.uniformDelta(s.eps, par) : Infinity;
  const dUniWorks = s.delta <= dUni + 1e-12;
  const aStep = DP.param === 'c' ? 0.01 : 0.05;
  // the uniform δ answers the task about the current function, so it is shown only once that task is ticked
  const uAnswer = UNIFORM_ANSWERS[s.dpreset];
  const revealUni = !uAnswer || !props.tasks?.includes(uAnswer) || (mounted && !!progress.value.tasks[`${props.id}:${uAnswer}`]);
  /** mode 'uniform': the current δ was set by the student (not by a text step or the reset) */
  const ownDelta = useRef(false);

  /** The student's own change: text steps set state through subscribeSteps and never tick a task. */
  const userSet = (patch: Partial<State>) => {
    const n = { ...s, ...patch };
    if (mode === 'uniform') {
      // a stays a point of the domain when c, W or the function changes
      const [lo, hi] = domainOf(n);
      n.a = clamp(n.a, lo, hi);
    }
    setS(n);
    const has = (t: string) => props.tasks?.includes(t);
    if (mode === 'uniform') {
      if ('delta' in patch) ownDelta.current = true;
      const un = DOMAIN_PRESETS[n.dpreset].uniformDelta(n.eps, parOf(n));
      const okAll = n.delta <= un + 1e-12;
      const changed = ['delta', 'c', 'W', 'eps', 'dpreset'].some((k) => k in patch);
      // a target task ticks only when the student's change brings the state into the target: a state a text step (or
      // a reset) already put there, nudged a little, never counts
      for (const t of ['compact-delta', 'sqrt-keeps', 'window'])
        if (has(t) && changed && uniformTarget(t, n) && !uniformTarget(t, s)) markTask(`${props.id}:${t}`);
      // lose-delta: the δ that worked must be the student's own, not one a text step or the reset chose
      const wasAll = s.delta <= DOMAIN_PRESETS[s.dpreset].uniformDelta(s.eps, parOf(s)) + 1e-12;
      if (has('lose-delta') && ownDelta.current && 'c' in patch && (n.dpreset === 'recip' || n.dpreset === 'sinrecip') && n.dpreset === s.dpreset && n.delta === s.delta && n.c < s.c && wasAll && !okAll)
        markTask(`${props.id}:lose-delta`);
      return;
    }
    if (mode === 'graph') {
      const pr = PRESETS[n.preset];
      const ds = pr.deltaStar(n.a, n.eps);
      const ok = deltaWorks(n.preset, n.a, n.eps, n.delta);
      if (has('find-delta') && patch.delta !== undefined && n.preset === 'square' && Math.abs(n.a) >= 2 - 1e-9 && n.eps <= 0.5 + 1e-9 && ok && n.delta >= ds / 2)
        markTask(`${props.id}:find-delta`);
      if (has('no-delta') && patch.delta !== undefined && n.preset === 'jump' && Math.abs(n.a) < 1e-9 && n.eps <= 1 && n.delta <= 0.05 + 1e-9)
        markTask(`${props.id}:no-delta`);
      if (has('not-uniform') && patch.a !== undefined && n.preset === 'square' && n.delta <= pr.deltaStar(0, n.eps) && !ok) markTask(`${props.id}:not-uniform`);
      const u = pr.uniformDelta(n.eps, W);
      if (has('uniform-sqrt') && (patch.delta !== undefined || patch.eps !== undefined || patch.all !== undefined) && n.preset === 'sqrt' && n.all && n.delta <= u + 1e-12 && n.delta >= u / 2)
        markTask(`${props.id}:uniform-sqrt`);
      return;
    }
    const nf = innerFits(P_OF[n.outer], 1, P_OF[n.inner], n.rho);
    const nextFits = innerFits(P_OF[n.outer], 1, P_OF[n.inner], n.rho + 0.05);
    if (has('best-inner') && n.outer === 'd1' && n.inner === 'dinf' && nf && !nextFits) markTask(`${props.id}:best-inner`);
    if (has('reverse') && n.outer === 'dinf' && n.inner === 'd1' && nf && !nextFits) markTask(`${props.id}:reverse`);
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const n = { ...prev };
          if (isPreset(st.preset)) n.preset = st.preset;
          if (isDomain(st.preset)) n.dpreset = st.preset;
          if (typeof st.a === 'number') n.a = st.a;
          if (typeof st.eps === 'number') n.eps = st.eps;
          if (typeof st.delta === 'number') n.delta = st.delta;
          if (typeof st.all === 'boolean') n.all = st.all;
          if (typeof st.outer === 'string' && st.outer in P_OF) n.outer = st.outer as MetricKey;
          if (typeof st.inner === 'string' && st.inner in P_OF) n.inner = st.inner as MetricKey;
          if (typeof st.rho === 'number') n.rho = st.rho;
          if (typeof st.c === 'number') n.c = clamp(st.c, C_MIN, C_MAX);
          if (typeof st.W === 'number') n.W = clamp(st.W, W_MIN, W_MAX);
          if (mode === 'uniform') {
            const [lo, hi] = domainOf(n);
            n.a = clamp(n.a, lo, hi);
            if (typeof st.delta === 'number') ownDelta.current = false;
          }
          return n;
        });
      }),
    [props.id],
  );

  const describe = () => {
    if (mode === 'uniform') {
      const parts = [`${DPRESET_LABEL[s.dpreset]}, התחום ${ltr(`[${fmt(dlo)}, ${fmt(dhi)}]`)}, a = ${fmt(s.a)}, ε = ${fmt(s.eps)}, δ = ${fmt(s.delta)}.`];
      parts.push(dWorks ? 'ה-δ הזה מתאים בנקודה a.' : 'ה-δ הזה אינו מתאים בנקודה a.');
      parts.push(nb.dist === Infinity ? 'כל δ מתאים בנקודה a.' : `ה-δ הגדול ביותר שמתאים בנקודה a: ${fmt(nb.dist)}.`);
      if (dUni === Infinity) parts.push('כל δ מתאים לכל הנקודות של התחום.');
      else if (revealUni) parts.push(`δ שמתאים לכל הנקודות של התחום: עד ${fmt(dUni)}.`);
      else parts.push(dUniWorks ? 'ה-δ הזה מתאים לכל הנקודות של התחום.' : 'ה-δ הזה אינו מתאים לכל הנקודות של התחום.');
      return parts.join(' ');
    }
    if (mode === 'nested') {
      return `כדור חיצוני B(0,1) במטריקה ${METRIC_LABEL[s.outer]}, כדור פנימי ברדיוס ${fmt(s.rho)} במטריקה ${METRIC_LABEL[s.inner]}. ${fits ? 'הפנימי כולו בתוך החיצוני.' : 'הפנימי בולט מחוץ לחיצוני.'}${revealPair ? ` הרדיוס הפנימי הגדול ביותר שנכנס: ${fmt(1 / C)}.` : ''}`;
    }
    const parts = [`${PRESET_LABEL[s.preset]}, a = ${fmt(s.a)}, ε = ${fmt(s.eps)}, δ = ${fmt(s.delta)}.`];
    parts.push(works ? 'ה-δ הזה מתאים בנקודה a.' : 'ה-δ הזה אינו מתאים בנקודה a.');
    if (reveal) parts.push(best === 0 ? 'אין אף δ חיובי שמתאים בנקודה a.' : `ה-δ הגדול ביותר שמתאים בנקודה a: ${fmt(best)}.`);
    if (s.all) {
      if (reveal) parts.push(uni === 0 ? 'אין δ חיובי אחד שמתאים לכל הנקודות בחלון.' : `δ שמתאים לכל a בחלון: עד ${fmt(uni)}.`);
      else parts.push(uniWorks ? 'ה-δ הזה מתאים לכל a בחלון.' : 'ה-δ הזה אינו מתאים לכל a בחלון.');
    }
    return parts.join(' ');
  };

  useEffect(() => {
    const t = setTimeout(() => setLive(describe()), 300);
    return () => clearTimeout(t);
  }, [s]);

  const draw = (fi: FrameInfo) => (mode === 'graph' ? drawGraph(fi) : mode === 'uniform' ? drawOnDomain(fi) : drawNested(fi));

  /** Points of D at which to draw f (and δ*): evenly in u = 1/x for 1/x and sin(1/x), whose detail crowds near c. */
  const domainSamples = (): number[] => {
    const xs: number[] = [];
    if (s.dpreset === 'recip' || s.dpreset === 'sinrecip') {
      const U = 1 / dlo;
      const N = Math.max(600, Math.ceil(60 * (U - 1)));
      for (let i = N; i >= 0; i--) xs.push(1 / (1 + ((U - 1) * i) / N));
    } else {
      for (let i = 0; i <= 900; i++) xs.push(dlo + ((dhi - dlo) * i) / 900);
    }
    return xs;
  };

  /** Mode 'uniform': the graph of f on D with the two bands, and below it δ*_D(a) across D with the student's δ. */
  const drawOnDomain = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const lowerH = Math.round(view.h * 0.32);
    const box = insetBox({ x: 0, y: 0, w: view.w, h: view.h - lowerH }, { l: narrow ? 40 : 48, r: 14, t: 14, b: 34 });
    const xr: [number, number] = DP.param === 'c' ? [0, 1.02] : [-par * 1.03, par * 1.03];
    const yr: [number, number] =
      s.dpreset === 'recip'
        ? [0, Math.min(1 / par, 55) * 1.08]
        : s.dpreset === 'sinrecip'
          ? [-1.35, 1.35]
          : s.dpreset === 'sqrtc'
            ? [-0.1, 1.15]
            : [-0.06 * par * par, 1.08 * par * par];
    const plot = makePlot(box, { min: xr[0], max: xr[1], label: 'x' }, { min: yr[0], max: yr[1], label: 'f(x)' });
    plotRef.current = plot;
    const f = DP.f;
    const fa = f(s.a);

    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    const bl = plot.px(Math.max(dlo, s.a - s.delta));
    const br = plot.px(Math.min(dhi, s.a + s.delta));
    ctx.fillStyle = p.deltaBand;
    ctx.fillRect(bl, box.y, Math.max(1, br - bl), box.h);
    const yt = plot.py(fa + s.eps);
    const yb = plot.py(fa - s.eps);
    ctx.fillStyle = p.epsBand;
    ctx.fillRect(box.x, yt, box.w, yb - yt);
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = p.eps;
    for (const y of [yt, yb]) {
      ctx.beginPath();
      ctx.moveTo(box.x, y);
      ctx.lineTo(box.x + box.w, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    drawAxes(ctx, plot, p);

    // the graph over D, then the part over the δ-interval (inside D): in the ε-band in ink, outside it dashed
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y - 2, box.w, box.h + 4);
    ctx.clip();
    const xs = domainSamples();
    ctx.strokeStyle = p.curve;
    ctx.lineWidth = 2;
    ctx.beginPath();
    xs.forEach((x, i) => (i === 0 ? ctx.moveTo(plot.px(x), plot.py(f(x))) : ctx.lineTo(plot.px(x), plot.py(f(x)))));
    ctx.stroke();
    const lo = Math.max(dlo, s.a - s.delta);
    const hi = Math.min(dhi, s.a + s.delta);
    const M = 400;
    for (let i = 0; i < M; i++) {
      const x0 = lo + ((hi - lo) * i) / M;
      const x1 = lo + ((hi - lo) * (i + 1)) / M;
      const out = Math.abs(f((x0 + x1) / 2) - fa) >= s.eps;
      ctx.strokeStyle = out ? p.pointOut : p.curve;
      ctx.lineWidth = out ? 4 : 3.4;
      ctx.setLineDash(out ? [4, 3] : []);
      ctx.beginPath();
      ctx.moveTo(plot.px(x0), plot.py(f(x0)));
      ctx.lineTo(plot.px(x1), plot.py(f(x1)));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // the domain D on the x-axis: a thick segment with filled (closed) ends
    ctx.save();
    const yAxis = box.y + box.h;
    ctx.strokeStyle = p.ink;
    ctx.fillStyle = p.ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(plot.px(dlo), yAxis);
    ctx.lineTo(plot.px(dhi), yAxis);
    ctx.stroke();
    for (const x of [dlo, dhi]) {
      ctx.beginPath();
      ctx.arc(plot.px(x), yAxis, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.restore();

    // the nearest bad point (the witness when δ is too big), and the point (a, f(a))
    if (!dWorks && nb.x !== null) ring(ctx, p, plot.px(nb.x), plot.py(f(nb.x)), 5, false);
    ring(ctx, p, plot.px(s.a), plot.py(fa), 6, dWorks);
    ctx.save();
    ctx.fillStyle = p.ink;
    ctx.font = `700 13px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('a', plot.px(s.a), box.y + box.h + 18);
    ctx.restore();

    // the lower panel: δ*_D(a) for a across D; its lowest level is the uniform δ
    const lbox = insetBox({ x: 0, y: view.h - lowerH, w: view.w, h: lowerH }, { l: narrow ? 40 : 48, r: 14, t: 10, b: 22 });
    const top = clamp(Math.max(s.delta * 1.6, dUni === Infinity ? 0.2 : dUni * 4), 1e-3, 2);
    const lp = makePlot(lbox, { min: xr[0], max: xr[1] }, { min: 0, max: top, ticks: [0], format: () => '0' });
    const curveAt = (a: number) => Math.min(top * 2, DP.nearestBad(a, s.eps, par).dist);
    ctx.save();
    ctx.fillStyle = withAlpha(p.ink, 0.04);
    ctx.fillRect(lbox.x, lbox.y, lbox.w, lbox.h);
    ctx.beginPath();
    ctx.rect(lbox.x, lbox.y, lbox.w, lbox.h);
    ctx.clip();
    // every sample of the graph (at most about 3000, each δ* a closed formula): thinning would skip the dips near c
    const as = xs;
    ctx.fillStyle = p.deltaBand;
    ctx.beginPath();
    ctx.moveTo(lp.px(as[0]), lp.py(0));
    for (const a of as) ctx.lineTo(lp.px(a), lp.py(curveAt(a)));
    ctx.lineTo(lp.px(as[as.length - 1]), lp.py(0));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = p.delta;
    ctx.lineWidth = 2;
    ctx.beginPath();
    as.forEach((a, i) => (i === 0 ? ctx.moveTo(lp.px(a), lp.py(curveAt(a))) : ctx.lineTo(lp.px(a), lp.py(curveAt(a)))));
    ctx.stroke();
    // the student's δ: solid ink when it works at every a, dashed in the "out" colour when not
    ctx.strokeStyle = dUniWorks ? p.ink : p.pointOut;
    ctx.lineWidth = 1.8;
    ctx.setLineDash(dUniWorks ? [] : [6, 4]);
    ctx.beginPath();
    ctx.moveTo(lbox.x, lp.py(s.delta));
    ctx.lineTo(lbox.x + lbox.w, lp.py(s.delta));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = p.ink2;
    ctx.font = `600 12px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('δ*(a)', lbox.x + 4, lbox.y + 2);
    ctx.fillText('a', lbox.x + lbox.w - 10, lbox.y + lbox.h + 4);
    ctx.restore();
  };

  const drawGraph = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    const lowerH = s.all ? Math.round(view.h * 0.3) : 0;
    const box = insetBox({ x: 0, y: 0, w: view.w, h: view.h - lowerH }, { l: narrow ? 38 : 46, r: 14, t: 14, b: 34 });
    const [y0, y1] = Y_RANGE[s.preset];
    const plot = makePlot(box, { min: -W, max: W, label: 'x' }, { min: y0, max: y1, label: 'f(x)' });
    plotRef.current = plot;
    const fa = P.f(s.a);

    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    // the δ-band (cool, vertical) and the ε-band (warm, horizontal)
    const xl = plot.px(s.a - s.delta);
    const xr = plot.px(s.a + s.delta);
    ctx.fillStyle = p.deltaBand;
    ctx.fillRect(xl, box.y, xr - xl, box.h);
    const yt = plot.py(fa + s.eps);
    const yb = plot.py(fa - s.eps);
    ctx.fillStyle = p.epsBand;
    ctx.fillRect(box.x, yt, box.w, yb - yt);
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = p.delta;
    for (const x of [xl, xr]) {
      ctx.beginPath();
      ctx.moveTo(x, box.y);
      ctx.lineTo(x, box.y + box.h);
      ctx.stroke();
    }
    ctx.strokeStyle = p.eps;
    for (const y of [yt, yb]) {
      ctx.beginPath();
      ctx.moveTo(box.x, y);
      ctx.lineTo(box.x + box.w, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    drawAxes(ctx, plot, p);

    // the graph; over the δ-interval, the part outside the ε-band is drawn thick in the "out" colour, dashed
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y - 2, box.w, box.h + 4);
    ctx.clip();
    const N = 900;
    const seg = (from: number, to: number, color: string, width: number, dash: number[] = []) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= N; i++) {
        const x = from + ((to - from) * i) / N;
        // the jump: break the line at 0 instead of drawing a vertical segment
        if (s.preset === 'jump' && i > 0) {
          const xPrev = from + ((to - from) * (i - 1)) / N;
          if (xPrev < 0 && x >= 0) started = false;
        }
        const X = plot.px(x);
        const Y = plot.py(P.f(x));
        if (started) ctx.lineTo(X, Y);
        else ctx.moveTo(X, Y);
        started = true;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };
    seg(-W, W, p.curve, 2.2);
    // emphasise the graph over the δ-interval: inside the ε-band in ink, outside it in the "out" colour
    const lo = Math.max(-W, s.a - s.delta);
    const hi = Math.min(W, s.a + s.delta);
    const M = 400;
    for (let i = 0; i < M; i++) {
      const x0 = lo + ((hi - lo) * i) / M;
      const x1 = lo + ((hi - lo) * (i + 1)) / M;
      if (s.preset === 'jump' && x0 < 0 && x1 >= 0) continue;
      const out = Math.abs(P.f((x0 + x1) / 2) - fa) >= s.eps;
      ctx.strokeStyle = out ? p.pointOut : p.curve;
      ctx.lineWidth = out ? 4 : 3.4;
      ctx.setLineDash(out ? [4, 3] : []);
      ctx.beginPath();
      ctx.moveTo(plot.px(x0), plot.py(P.f(x0)));
      ctx.lineTo(plot.px(x1), plot.py(P.f(x1)));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    if (s.preset === 'jump') {
      // the graph's own convention at the jump: (0, 1) belongs to the graph, (0, 0) does not (small, in ink)
      ctx.fillStyle = p.curve;
      ctx.beginPath();
      ctx.arc(plot.px(0), plot.py(1), 3.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = p.paper;
      ctx.strokeStyle = p.curve;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(plot.px(0), plot.py(0), 3.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // the witness x: in the δ-band, value out of the ε-band (hollow, out colour)
    const w = witness(s);
    if (w !== null) ring(ctx, p, plot.px(w), plot.py(P.f(w)), 5, false);
    // the point (a, f(a)): filled when δ works, hollow with a ring when not
    ring(ctx, p, plot.px(s.a), plot.py(fa), 6, works);
    ctx.save();
    ctx.fillStyle = p.ink;
    ctx.font = `700 13px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('a', plot.px(s.a), box.y + box.h + 18);
    ctx.restore();

    if (s.all) drawUniform(ctx, p, view.w, view.h - lowerH, lowerH, narrow);
  };

  /** The lower panel: δ*(a) across the window, and the student's δ as a horizontal line. */
  const drawUniform = (ctx: CanvasRenderingContext2D, p: Palette, w: number, top: number, h: number, narrow: boolean) => {
    const box = insetBox({ x: 0, y: top, w, h }, { l: narrow ? 38 : 46, r: 14, t: 10, b: 22 });
    // room for the student's δ and for δ*(0); a curve that runs higher is clipped at the panel's top
    const top_ = Math.min(1.6, Math.max(0.2, s.delta * 1.6, P.deltaStar(0, s.eps) * 1.2));
    const plot = makePlot(box, { min: -W, max: W }, { min: 0, max: top_, ticks: [0], format: () => '0' });
    ctx.save();
    ctx.fillStyle = withAlpha(p.ink, 0.04);
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    // under the curve: the δ that work at that a
    ctx.fillStyle = p.deltaBand;
    ctx.beginPath();
    ctx.moveTo(plot.px(-W), plot.py(0));
    for (let i = 0; i <= 600; i++) {
      const a = -W + (2 * W * i) / 600;
      ctx.lineTo(plot.px(a), plot.py(Math.min(top_ * 2, P.deltaStar(a, s.eps))));
    }
    ctx.lineTo(plot.px(W), plot.py(0));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = p.delta;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 600; i++) {
      const a = -W + (2 * W * i) / 600;
      const y = plot.py(Math.min(top_ * 2, P.deltaStar(a, s.eps)));
      if (i === 0) ctx.moveTo(plot.px(a), y);
      else ctx.lineTo(plot.px(a), y);
    }
    ctx.stroke();
    // the student's δ
    ctx.strokeStyle = uniWorks ? p.ink : p.pointOut;
    ctx.lineWidth = 1.8;
    ctx.setLineDash(uniWorks ? [] : [6, 4]);
    ctx.beginPath();
    ctx.moveTo(box.x, plot.py(s.delta));
    ctx.lineTo(box.x + box.w, plot.py(s.delta));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = p.ink2;
    ctx.font = `600 12px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('δ*(a)', box.x + 4, box.y + 2);
    ctx.fillText('a', box.x + box.w - 10, box.y + box.h + 4);
    ctx.restore();
  };

  const drawNested = ({ ctx, view, palette: p }: FrameInfo) => {
    const k = Math.min(view.w, view.h) / 3.4;
    const cx = view.w / 2;
    const cy = view.h / 2;
    const path = (m: MetricKey, r: number) => {
      const R = r * k;
      ctx.beginPath();
      if (m === 'd2') ctx.arc(cx, cy, R, 0, 2 * Math.PI);
      else if (m === 'dinf') ctx.rect(cx - R, cy - R, 2 * R, 2 * R);
      else {
        ctx.moveTo(cx + R, cy);
        ctx.lineTo(cx, cy - R);
        ctx.lineTo(cx - R, cy);
        ctx.lineTo(cx, cy + R);
        ctx.closePath();
      }
    };
    ctx.save();
    // axes
    ctx.strokeStyle = withAlpha(p.ink3, 0.6);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(view.w, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, view.h);
    ctx.stroke();
    // the outer ball: the set, ink, dashed (an open ball)
    path(s.outer, 1);
    ctx.fillStyle = withAlpha(p.ink, 0.08);
    ctx.fill();
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);
    ctx.stroke();
    // the inner ball: cool (a δ-ball inside an ε-ball)
    path(s.inner, s.rho);
    ctx.fillStyle = p.deltaBand;
    ctx.fill();
    ctx.strokeStyle = fits ? p.delta : p.pointOut;
    ctx.lineWidth = 2.2;
    ctx.setLineDash(fits ? [6, 4] : [3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // a witness when the inner ball sticks out: the extremal direction of the ratio, at inner distance just under ρ
    if (!fits) {
      const po = P_OF[s.outer];
      const pi = P_OF[s.inner];
      const dir: [number, number] = po < pi ? [1, 1] : [1, 0];
      const q = pi === Infinity ? 1 : pi === 2 ? Math.SQRT2 : 2;
      const len = dir[0] === 1 && dir[1] === 1 ? q : 1;
      const t = (s.rho * 0.999) / len;
      ring(ctx, p, cx + dir[0] * t * k, cy - dir[1] * t * k, 5, false);
    }
    ring(ctx, p, cx, cy, 4.5, true);
    ctx.save();
    ctx.fillStyle = p.ink2;
    ctx.font = `600 13px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`B(0,1), ${METRIC_LABEL[s.outer]}`, cx + k * 0.75, cy - k * 0.95);
    ctx.restore();
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1.5, worldHeight: 1, animate: false });
  useEffect(invalidate, [s]);

  const aFromPointer = (e: PointerEvent) => {
    const plot = plotRef.current;
    if (!plot) return null;
    const x = plot.x.min + ((e.offsetX - plot.box.x) / plot.box.w) * (plot.x.max - plot.x.min);
    if (mode === 'uniform') return clamp(round(x, aStep), dlo, dhi);
    return Math.max(-W, Math.min(W, round(x, 0.05)));
  };
  const onPointerDown = (e: PointerEvent) => {
    if (mode === 'nested') return;
    const a = aFromPointer(e);
    if (a === null) return;
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (Math.abs(a - s.a) > 1e-9) userSet({ a });
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging.current) return;
    const a = aFromPointer(e);
    if (a !== null && Math.abs(a - s.a) > 1e-9) userSet({ a });
  };
  const onPointerUp = () => {
    dragging.current = false;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (mode === 'uniform') {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        userSet({ a: clamp(round(s.a + (e.key === 'ArrowRight' ? aStep : -aStep), aStep), dlo, dhi) });
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const lg = clamp(Math.log10(s.delta) + (e.key === 'ArrowUp' ? 0.05 : -0.05), LOGD_MIN, LOGD_MAX);
        userSet({ delta: sig3(10 ** lg) });
      }
      return;
    }
    if (mode === 'graph') {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        userSet({ a: Math.max(-W, Math.min(W, round(s.a + (e.key === 'ArrowRight' ? 0.05 : -0.05), 0.05))) });
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        userSet({ delta: Math.max(0.01, Math.min(1.5, round(s.delta + (e.key === 'ArrowUp' ? 0.01 : -0.01), 0.01))) });
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      userSet({ rho: Math.max(0.05, Math.min(1.5, round(s.rho + (e.key === 'ArrowUp' ? 0.05 : -0.05), 0.05))) });
    }
  };

  const offered = (props.presets ?? []).filter(isPreset);
  const offeredD = (props.presets ?? []).filter(isDomain);
  if (mode === 'uniform') {
    return (
      <SimShell
        fig={props.id}
        label={`איור חי: גרף של ${DPRESET_LABEL[s.dpreset]}, רק על התחום המסומן על הציר, עם רצועת ε סביב f(a) ורצועת δ סביב a. מתחת לגרף: לכל a בתחום, ה-δ הגדול ביותר שמתאים בה, והקו של ה-δ שבחרתם. גררו את a; במקלדת: חצים ימינה ושמאלה מזיזים את a, למעלה ולמטה משנים את δ. ${describe()}`}
        canvasRef={canvasRef}
        aspect={1.3}
        live={live}
        tasks={tasks}
        cursor="ew-resize"
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onReset={() => {
          ownDelta.current = false;
          setS(fresh(props));
          setLive('האיור אופס.');
        }}
        readout={
          <>
            <span data-readout="domain">
              התחום: <bdi dir="ltr">[{fmt(dlo)}, {fmt(dhi)}]</bdi>
            </span>
            <span>
              <b class="q" data-readout="a">a = {fmt(s.a)}</b>
            </span>
            <span data-readout="verdict">
              {dWorks ? 'ה-δ מתאים ב-a: כל נקודות התחום ברצועת δ נשלחות לתוך רצועת ε.' : 'ה-δ אינו מתאים ב-a: יש נקודה של התחום ברצועת δ שערכה מחוץ לרצועת ε.'}
            </span>
            <span data-readout="best">
              {nb.dist === Infinity ? (
                <>כל δ מתאים בנקודה הזו.</>
              ) : (
                <>
                  ה-δ הגדול ביותר שמתאים כאן: <b class="q">{fmt(nb.dist)}</b>
                </>
              )}
            </span>
            <span data-readout="uniform">
              {dUni === Infinity ? (
                <>כל δ מתאים לכל הנקודות של התחום.</>
              ) : !revealUni ? (
                <>
                  ה-δ הגדול ביותר שמתאים לכל הנקודות: {HIDDEN} {dUniWorks ? '(ה-δ שלכם מתאים לכולן)' : '(ה-δ שלכם גדול מדי)'}
                </>
              ) : (
                <>
                  δ שמתאים לכל הנקודות של התחום: עד <b class="q">{fmt(dUni)}</b> {dUniWorks ? '(ה-δ שלכם מתאים לכולן)' : '(ה-δ שלכם גדול מדי)'}
                </>
              )}
            </span>
          </>
        }
        controls={
          <>
            {offeredD.length > 1 && (
              <div class="group" role="group" aria-label="הפונקציה">
                {offeredD.map((id) => (
                  <Toggle key={id} label={<bdi dir="ltr">{DPRESET_SHORT[id]}</bdi>} on={s.dpreset === id} onChange={() => userSet({ dpreset: id })} />
                ))}
              </div>
            )}
            <Slider label="הנקודה a" value={s.a} min={dlo} max={dhi} step={aStep} format={fmt} onChange={(v) => userSet({ a: clamp(round(v, aStep), dlo, dhi) })} />
            <Slider label="ε: רוחב רצועת הערכים" value={s.eps} min={0.05} max={1.5} step={0.05} format={fmt} onChange={(v) => userSet({ eps: round(v, 0.05) })} />
            <Slider
              label="δ (סולם לוגריתמי)"
              value={Math.log10(s.delta)}
              min={LOGD_MIN}
              max={LOGD_MAX}
              step={0.01}
              format={(v) => fmt(sig3(10 ** v))}
              onChange={(v) => userSet({ delta: sig3(10 ** v) })}
            />
            {DP.param === 'c' ? (
              <Slider label="הקצה השמאלי c של התחום" value={s.c} min={C_MIN} max={C_MAX} step={0.01} format={fmt} onChange={(v) => userSet({ c: round(v, 0.01) })} />
            ) : (
              <Slider label="חצי הרוחב W של התחום" value={s.W} min={W_MIN} max={W_MAX} step={0.5} format={fmt} onChange={(v) => userSet({ W: round(v, 0.5) })} />
            )}
          </>
        }
      />
    );
  }
  return (
    <SimShell
      fig={props.id}
      label={
        mode === 'graph'
          ? `איור חי: גרף של ${PRESET_LABEL[s.preset]}, רצועת ε אופקית סביב f(a) ורצועת δ אנכית סביב a. נקודה מלאה: ה-δ מתאים; חלולה עם טבעת: לא. גררו את a; במקלדת: חצים ימינה ושמאלה מזיזים את a, למעלה ולמטה משנים את δ. ${describe()}`
          : `איור חי: כדור היחידה הפתוח של מטריקה אחת במישור, וכדור קטן של מטריקה אחרת באותו מרכז. במקלדת: חצים למעלה ולמטה משנים את הרדיוס הפנימי. ${describe()}`
      }
      canvasRef={canvasRef}
      aspect={1.5}
      live={live}
      tasks={tasks}
      cursor={mode === 'graph' ? 'ew-resize' : 'default'}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onReset={() => {
        setS(fresh(props));
        setLive('האיור אופס.');
      }}
      readout={
        mode === 'graph' ? (
          <>
            <span>
              <b class="q" data-readout="a">a = {fmt(s.a)}</b>
            </span>
            <span data-readout="verdict">
              {works ? 'ה-δ מתאים: הגרף מעל רצועת δ כולו בתוך רצועת ε.' : 'ה-δ אינו מתאים: חלק מהגרף מעל רצועת δ יוצא מרצועת ε.'}
            </span>
            <span data-readout="best">
              {!reveal ? (
                <>ה-δ הגדול ביותר שמתאים כאן: {HIDDEN}</>
              ) : best === 0 ? (
                <>אין אף δ חיובי שמתאים בנקודה הזו.</>
              ) : (
                <>
                  ה-δ הגדול ביותר שמתאים כאן: <b class="q">{fmt(best)}</b>
                </>
              )}
            </span>
            {s.all && (
              <span data-readout="uniform">
                {!reveal ? (
                  <>{uniWorks ? 'ה-δ שלכם מתאים לכל a בחלון.' : 'ה-δ שלכם אינו מתאים לכל a בחלון.'}</>
                ) : uni === 0 ? (
                  <>אין δ חיובי אחד שמתאים לכל a בחלון.</>
                ) : (
                  <>
                    δ שמתאים לכל a בחלון: עד <b class="q">{fmt(uni)}</b> {uniWorks ? '(ה-δ שלכם מתאים לכולן)' : '(ה-δ שלכם גדול מדי)'}
                  </>
                )}
              </span>
            )}
          </>
        ) : (
          <>
            {revealPair && (
              <span data-readout="constant">
                <bdi dir="ltr">
                  {METRIC_LABEL[s.outer]} ≤ {fmt(C)} · {METRIC_LABEL[s.inner]}
                </bdi>
              </span>
            )}
            <span data-readout="verdict">{fits ? 'הכדור הפנימי כולו בתוך החיצוני.' : 'הכדור הפנימי בולט מחוץ לחיצוני.'}</span>
            <span data-readout="best">
              {revealPair ? (
                <>
                  הרדיוס הפנימי הגדול ביותר שנכנס: <b class="q">{fmt(1 / C)}</b>
                </>
              ) : (
                <>הרדיוס הפנימי הגדול ביותר והקבוע בין המטריקות יופיעו אחרי שתפתרו את המשימה על הזוג הזה.</>
              )}
            </span>
          </>
        )
      }
      controls={
        mode === 'graph' ? (
          <>
            {offered.length > 1 && (
              <div class="group" role="group" aria-label="הפונקציה">
                {offered.map((id) => (
                  <Toggle key={id} label={<bdi dir="ltr">{PRESET_LABEL[id]}</bdi>} on={s.preset === id} onChange={() => userSet({ preset: id })} />
                ))}
              </div>
            )}
            <Slider label="הנקודה a" value={s.a} min={-W} max={W} step={0.05} format={fmt} onChange={(v) => userSet({ a: round(v, 0.05) })} />
            <Slider label="ε: רוחב רצועת הערכים" value={s.eps} min={0.05} max={1.5} step={0.05} format={fmt} onChange={(v) => userSet({ eps: round(v, 0.05) })} />
            <Slider label="δ: רוחב רצועת הנקודות" value={s.delta} min={0.01} max={1.5} step={0.01} format={fmt} onChange={(v) => userSet({ delta: round(v, 0.01) })} />
            <div class="group">
              <Toggle label="כל הנקודות בחלון" on={s.all} onChange={(on) => userSet({ all: on })} />
            </div>
          </>
        ) : (
          <>
            <div class="group" role="group" aria-label="המטריקה של הכדור החיצוני">
              <span class="group-label">חיצוני:</span>
              {(['d1', 'd2', 'dinf'] as MetricKey[]).map((m) => (
                <Toggle key={m} label={<bdi dir="ltr">{METRIC_LABEL[m]}</bdi>} on={s.outer === m} onChange={() => userSet({ outer: m })} />
              ))}
            </div>
            <div class="group" role="group" aria-label="המטריקה של הכדור הפנימי">
              <span class="group-label">פנימי:</span>
              {(['d1', 'd2', 'dinf'] as MetricKey[]).map((m) => (
                <Toggle key={m} label={<bdi dir="ltr">{METRIC_LABEL[m]}</bdi>} on={s.inner === m} onChange={() => userSet({ inner: m })} />
              ))}
            </div>
            <Slider label="הרדיוס הפנימי ρ" value={s.rho} min={0.05} max={1.5} step={0.05} format={fmt} onChange={(v) => userSet({ rho: round(v, 0.05) })} />
          </>
        )
      }
    />
  );
}

/** A point: filled in the "in" colour, or hollow in the "out" colour with a ring (shape, not only colour). */
function ring(ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number, r: number, filled: boolean) {
  ctx.save();
  if (filled) {
    ctx.fillStyle = p.pointIn;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fill();
  } else {
    ctx.fillStyle = p.paper;
    ctx.strokeStyle = p.pointOut;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.9, 0, 2 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}
