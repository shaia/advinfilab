/**
 * Lesson 4.3's figure: the diagonal argument of למה 4.3.6 made visible.
 *
 * A bounded sequence of functions on [0,1] (f_n = sin(x + n), רציפה במידה אחידה; or f_n = sin(nx), which is not),
 * the points q_1, q_2, … of the dyadic rationals (a countable dense set D), and the table of nested rows: row j keeps
 * the indices of row j−1 whose value at q_j lies in the fullest window of width 1/2 (the pigeonhole step of
 * Bolzano–Weierstrass, on finitely many terms). The diagonal g_k = the k-th index of row k is marked in the table.
 *
 * Canvas: the windows W_j at the points q_j (ε colours: a value window), the graphs of the diagonal functions (ink;
 * the tail from the selected row on solid, the earlier ones thin and dashed), their values at the q_j (filled inside
 * W_j, hollow outside: shape and colour), and a probe line at x (δ colours) with the spread of the tail there.
 *
 * Every number comes from src/math/diagonal.ts. With finitely many terms nothing converges: the caption says that the
 * figure is a probe. No animation.
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  FAMILIES,
  MAX_ROWS,
  TERMS,
  buildRows,
  describe,
  diagonal,
  firstAllInside,
  fmtNum,
  spreadAt,
  spreadOnD,
  supSpread,
  type FamilyId,
  type Row,
} from '~/math/diagonal';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { drawAxes, insetBox, makePlot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

/** a left-to-right island inside Hebrew text (U+2066 … U+2069) */
const ltr = (s: string) => `⁦${s}⁩`;

const TASK_LABEL: Record<string, string> = {
  tail: `במשפחה ${ltr('sin(nx)')}, עם שש שורות: מצאו את המקום הראשון ${ltr('k')} שממנו והלאה כל העיגולים, בכל שש הנקודות, מלאים, והדגישו את השורה ${ltr('Sₖ')}.`,
  gap: `במשפחה ${ltr('sin(nx)')}, הדגישו שורה ${ltr('j ≥ 3')}, הזיזו את נקודת הבדיקה ${ltr('x')} ומצאו נקודה שבה שתי פונקציות מזנב האלכסון רחוקות זו מזו יותר מ-${ltr('1')}.`,
  close: `במשפחה ${ltr('sin(x + n)')}, בחרו שורה שממנה והלאה כל שתי פונקציות אלכסון רחוקות זו מזו פחות מ-${ltr('0.5')} בכל הקטע.`,
};

const FAM_IDS: FamilyId[] = ['shift', 'osc'];
const clampK = (v: number) => Math.max(1, Math.min(MAX_ROWS, Math.round(v)));
const roundX = (v: number) => Math.max(0, Math.min(1, Math.round(v * 1000) / 1000));
/** the table shows this many indices of each row */
const SHOW = 7;
const SUB = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
const sub = (n: number) => String(n).split('').map((d) => SUB[Number(d)]).join('');

interface State {
  fam: FamilyId;
  /** rows built and shown */
  rows: number;
  /** the selected row j: the tail of the diagonal from place j on */
  sel: number;
  /** the probe point */
  x: number;
}

export interface DiagonalProps {
  id: string;
  fam?: FamilyId;
  rows?: number;
  sel?: number;
  x?: number;
  tasks?: string[];
}

function fresh(p: DiagonalProps): State {
  const rows = clampK(typeof p.rows === 'number' ? p.rows : MAX_ROWS);
  return {
    fam: p.fam && p.fam in FAMILIES ? p.fam : 'shift',
    rows,
    sel: Math.min(rows, clampK(typeof p.sel === 'number' ? p.sel : 1)),
    x: roundX(typeof p.x === 'number' ? p.x : 0.9),
  };
}

const Q = (p: { children: ComponentChildren }) => (
  <b class="q">
    <bdi dir="ltr">{p.children}</bdi>
  </b>
);

/** the rows of both families, computed once per island (20 000 terms, 6 rows each: a few milliseconds) */
const cache: Partial<Record<FamilyId, Row[]>> = {};
const rowsOf = (fam: FamilyId): Row[] => (cache[fam] ??= buildRows(fam));

export default function Diagonal(props: DiagonalProps) {
  const [s, setS] = useState<State>(() => fresh(props));
  const [live, setLive] = useState('');
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const has = (t: string) => props.tasks?.includes(t) ?? false;

  const allRows = rowsOf(s.fam);
  const rows = allRows.slice(0, s.rows);
  const g = diagonal(rows);
  const tail = g.slice(s.sel - 1);
  const F = FAMILIES[s.fam];
  const atX = spreadAt(s.fam, tail, s.x);
  const onD = spreadOnD(s.fam, tail, s.rows);
  const sup = supSpread(s.fam, tail, 1001);

  /** The student's own change: a text step sets state through subscribeSteps and never ticks a task. */
  const userSet = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    next.rows = clampK(next.rows);
    next.sel = Math.min(next.rows, clampK(next.sel));
    setS(next);
    const id = props.id;
    const gg = diagonal(rowsOf(next.fam).slice(0, next.rows));
    const tl = gg.slice(next.sel - 1);
    if (has('tail') && next.fam === 'osc' && next.rows === MAX_ROWS && next.sel === firstAllInside('osc', rowsOf('osc'))) markTask(`${id}:tail`);
    if (has('gap') && next.fam === 'osc' && next.sel >= 3 && tl.length >= 2 && spreadAt('osc', tl, next.x) > 1) markTask(`${id}:gap`);
    if (has('close') && next.fam === 'shift' && tl.length >= 2 && supSpread('shift', tl, 1001).value < 0.5) markTask(`${id}:close`);
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setS((prev) => {
          const next = { ...prev };
          if (typeof st.fam === 'string' && st.fam in FAMILIES) next.fam = st.fam as FamilyId;
          if (typeof st.rows === 'number') next.rows = clampK(st.rows);
          if (typeof st.sel === 'number') next.sel = clampK(st.sel);
          if (typeof st.x === 'number') next.x = roundX(st.x);
          next.sel = Math.min(next.rows, next.sel);
          return next;
        });
      }),
    [props.id],
  );

  useEffect(() => {
    const t = setTimeout(() => setLive(describe(s, rows)), 300);
    return () => clearTimeout(t);
  }, [s]);

  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const narrow = view.w < 420;
    // b leaves room for the axis label "x" that drawAxes puts 36 px below the plot; on a phone the wider right
    // margin keeps the rightmost point label (q₃ at 3/4) clear of the reset and full-screen buttons (top right, 82 px)
    const box = insetBox({ x: 0, y: 0, w: view.w, h: view.h }, { l: narrow ? 34 : 44, r: narrow ? 38 : 12, t: 34, b: 40 });
    const plot = makePlot(box, { min: 0, max: 1, label: 'x' }, { min: -1.2, max: 1.2 });
    drawAxes(ctx, plot, p);
    const X = plot.px;
    const Y = plot.py;

    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y - 2, box.w, box.h + 4);
    ctx.clip();

    // the points q_j of D and the windows W_j
    const half = narrow ? 5 : 7;
    rows.forEach((r) => {
      const sx = X(r.q);
      ctx.strokeStyle = p.rule;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(sx, box.y);
      ctx.lineTo(sx, box.y + box.h);
      ctx.stroke();
      ctx.setLineDash([]);
      const top = Y(r.hi);
      const bot = Y(r.lo);
      ctx.fillStyle = p.epsBand;
      ctx.fillRect(sx - half, top, 2 * half, bot - top);
      ctx.strokeStyle = p.eps;
      ctx.lineWidth = r.j <= s.sel ? 2 : 1;
      ctx.strokeRect(sx - half, top, 2 * half, bot - top);
    });

    // the probe line at x and the spread of the tail there
    const px = X(s.x);
    ctx.strokeStyle = p.delta;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(px, box.y);
    ctx.lineTo(px, box.y + box.h);
    ctx.stroke();
    if (tail.length) {
      const vals = tail.map((n) => F.f(n, s.x));
      const top = Y(Math.max(...vals));
      const bot = Y(Math.min(...vals));
      ctx.fillStyle = p.deltaBand;
      ctx.fillRect(px - 5, top, 10, Math.max(1, bot - top));
      ctx.strokeStyle = p.delta;
      ctx.strokeRect(px - 5, top, 10, Math.max(1, bot - top));
    }

    // the diagonal functions: the tail solid, the earlier ones thin and dashed
    const N = s.fam === 'osc' ? 1600 : 300;
    g.forEach((n, k) => {
      const inTail = k + 1 >= s.sel;
      ctx.strokeStyle = inTail ? p.curve : p.ink3;
      ctx.lineWidth = inTail ? 1.8 : 1;
      ctx.setLineDash(inTail ? [] : [4, 4]);
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const x = i / N;
        const y = F.f(n, x);
        if (i) ctx.lineTo(X(x), Y(y));
        else ctx.moveTo(X(x), Y(y));
      }
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // the values of the tail at the q_j: filled inside W_j, hollow outside
    for (const r of rows)
      for (const n of tail) {
        const v = F.f(n, r.q);
        const inside = v >= r.lo && v <= r.hi;
        ctx.beginPath();
        ctx.arc(X(r.q), Y(v), 3.6, 0, 2 * Math.PI);
        ctx.fillStyle = inside ? p.pointIn : p.paper;
        ctx.fill();
        ctx.strokeStyle = inside ? p.pointIn : p.pointOut;
        ctx.lineWidth = inside ? 1 : 2;
        ctx.stroke();
      }
    ctx.restore();

    // labels, LTR
    ctx.save();
    ctx.font = `600 ${narrow ? 11 : 13}px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = p.eps;
    for (const r of rows) ctx.fillText(`q${sub(r.j)}`, X(r.q), box.y - 10);
    ctx.textAlign = 'left';
    ctx.fillStyle = p.curve;
    ctx.fillText(`fₙ = ${F.formula}`, box.x + 6, box.y + 12);
    ctx.restore();
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1.5, worldHeight: 1, animate: false });
  useEffect(invalidate, [s]);

  const onKeyDown = (e: KeyboardEvent) => {
    const up = e.key === 'ArrowUp' || e.key === 'ArrowRight';
    const down = e.key === 'ArrowDown' || e.key === 'ArrowLeft';
    if (!up && !down) return;
    e.preventDefault();
    userSet({ x: roundX(s.x + (up ? 0.005 : -0.005) * (e.shiftKey ? 10 : 1)) });
  };

  const table = (
    <table dir="ltr" data-readout="table" style={{ borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums', fontSize: '0.9em' }}>
      <tbody>
        {rows.map((r) => (
          <tr key={r.j} data-row={r.j} style={{ fontWeight: r.j === s.sel ? 700 : 400 }}>
            <th scope="row" style={{ paddingInlineEnd: '0.5em', textAlign: 'left', color: 'var(--eps)' }}>
              {`S${sub(r.j)}`}
            </th>
            {r.indices.slice(0, SHOW).map((n, k) => {
              const diag = k + 1 === r.j;
              return (
                <td
                  key={k}
                  data-diag={diag ? 'true' : undefined}
                  style={{
                    padding: '0 0.3em',
                    textAlign: 'right',
                    background: diag ? 'var(--eps-band)' : undefined,
                    outline: diag ? '1.5px solid var(--eps)' : undefined,
                  }}
                >
                  {diag ? `[${n}]` : n}
                </td>
              );
            })}
            <td style={{ paddingInlineStart: '0.3em', color: 'var(--ink-3)' }}>…</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const readout = (
    <>
      <span data-readout="diag">
        האלכסון: <Q>{g.map((n, k) => `n${sub(k + 1)} = ${n}`).join(', ')}</Q>
      </span>
      {table}
      <span data-readout="sizes">
        מתוך <Q>{String(TERMS)}</Q> איברים נשארו בשורות: <Q>{rows.map((r) => r.indices.length).join(', ')}</Q>
      </span>
      <span data-readout="ond">
        ממקום <Q>{String(s.sel)}</Q> והלאה, בנקודות <Q>{`q₁, …, q${sub(s.rows)}`}</Q>: הפיזור <Q>{fmtNum(Number(onD.toFixed(3)))}</Q>
      </span>
      <span data-readout="at-x">
        בנקודה <Q>{`x = ${fmtNum(s.x)}`}</Q>: הפיזור <Q>{fmtNum(Number(atX.toFixed(3)))}</Q>
      </span>
      <span data-readout="sup">
        בכל הקטע (בדגימה): <Q>{`max ‖gₖ − gₗ‖∞ ≈ ${fmtNum(Number(sup.value.toFixed(3)))}`}</Q>
      </span>
    </>
  );

  const controls = (
    <>
      <div class="group" role="group" aria-label="המשפחה">
        {FAM_IDS.map((id) => (
          <Toggle key={id} label={<bdi dir="ltr">{FAMILIES[id].formula}</bdi>} on={s.fam === id} onChange={() => userSet({ fam: id })} />
        ))}
      </div>
      <Slider label="מספר השורות" value={s.rows} min={1} max={MAX_ROWS} step={1} format={(v) => String(Math.round(v))} onChange={(v) => userSet({ rows: clampK(v) })} />
      <div class="group" role="group" aria-label="השורה המודגשת">
        {rows.map((r) => (
          <Toggle key={r.j} label={<bdi dir="ltr">{`S${sub(r.j)}`}</bdi>} on={s.sel === r.j} onChange={() => userSet({ sel: r.j })} />
        ))}
      </div>
      <Slider label="נקודת הבדיקה x" value={s.x} min={0} max={1} step={0.005} format={(v) => fmtNum(roundX(v))} onChange={(v) => userSet({ x: roundX(v) })} />
    </>
  );

  return (
    <SimShell
      fig={props.id}
      label={`איור חי: סדרה חסומה של פונקציות על הקטע מאפס עד אחת, הנקודות q של קבוצה צפופה, טבלת תת-הסדרות המקוננות והאלכסון שלה, וגרפים של פונקציות האלכסון. במקלדת: חצים מזיזים את נקודת הבדיקה. ${describe(s, rows)}`}
      canvasRef={canvasRef}
      aspect={1.5}
      live={live}
      tasks={tasks}
      onKeyDown={onKeyDown}
      onReset={() => {
        setS(fresh(props));
        setLive('האיור אופס.');
      }}
      readout={readout}
      controls={controls}
    />
  );
}

