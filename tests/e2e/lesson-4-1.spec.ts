import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/4-1/';

/** Set a range input as a student would: the value, then an input event. */
const slide = (s: Locator, v: number) =>
  s.evaluate((el: HTMLInputElement, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);

/** Bring a figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page, fig: string) {
  const f = page.locator(`#${fig}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas'));
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

// FunctionBall (src/sims/FunctionBall.tsx). Tube mode (4.1א): range inputs n, then ε (an index into EPS_FINE for the
// exp-series preset: 0.01 is index 7). Set mode (4.1ב): range inputs r (an index into RADII: 0.1 → 1, 0.25 → 4,
// 0.3 → 5), then c.
const nth = (fig: Locator, i: number) => fig.locator('input[type=range]').nth(i);

test.describe('lesson 4.1: the space C(K)', () => {
  test('both figures draw, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    const canvases = page.locator('.sim-stage canvas');
    await expect(canvases).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      const c = canvases.nth(i);
      await c.scrollIntoViewIfNeeded();
      await expect(c).toHaveCSS('direction', 'ltr');
      await expect.poll(() => inked(c)).toBeGreaterThan(200);
    }
  });

  test('xⁿ on [0, 1] stays at sup distance 1 from its pointwise limit, and n ≥ 40 ticks the never task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-1a');
    await fig.getByRole('button', { name: 'xⁿ על [0, 1]' }).click();
    await slide(nth(fig, 1), 1); // ε = 0.5
    for (const v of [10, 45]) {
      await slide(nth(fig, 0), v);
      await expect(fig.locator('[data-readout="sup"]')).toContainText('sup = 1 (לא מתקבל)');
      await expect(fig.locator('[data-readout="verdict"]')).toContainText('אינה');
    }
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-1a:never']).toBeTruthy();
  });

  test('Taylor polynomials of eˣ: outside the 0.01-tube at n = 3, inside at n = 4, and that ticks the taylor task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-1a');
    await fig.getByRole('button', { name: 'טור חזקות של eˣ' }).click();
    await slide(nth(fig, 1), 7); // ε = 0.01
    await slide(nth(fig, 0), 3);
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('אינה');
    await slide(nth(fig, 0), 4);
    await expect(fig.locator('[data-readout="verdict"]')).not.toContainText('אינה');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-1a:taylor']).toBeTruthy();
  });

  test('P: the largest ball has radius min f = 0.25, a larger ball contains a shift that leaves P, and both tasks tick', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-1b');
    await expect(fig.locator('[data-readout="inf"]')).toContainText('min f = 0.25');
    await slide(nth(fig, 0), 4); // r = 0.25
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-1b:largest-ball']).toBeTruthy();
    await slide(nth(fig, 0), 5); // r = 0.3
    await slide(nth(fig, 1), 0.27);
    await expect(fig.locator('[data-readout="ball"]')).toContainText('בתוך');
    await expect(fig.locator('[data-readout="set"]')).toContainText('g ∉ P');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-1b:leave-pos']).toBeTruthy();
  });

  test('inside the largest ball the shift stays in P: r = 0.25 and c = 0.24 give min g = 0.01', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-1b');
    await slide(nth(fig, 0), 4);
    await slide(nth(fig, 1), 0.24);
    await expect(fig.locator('[data-readout="set"]')).toContainText('min g = 0.01');
    await expect(fig.locator('[data-readout="set"]')).toContainText('g ∈ P');
    await page.waitForTimeout(300);
    expect((await progress(page))?.tasks?.['fig-4-1b:leave-pos']).toBeFalsy();
  });

  test('on (0, 1] the infimum 0 is not attained and a small ball already leaves P; Z_p loses every shift', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-1b');
    await fig.getByRole('button', { name: 'P′ על (0, 1]' }).click();
    await expect(fig.locator('[data-readout="inf"]')).toContainText('inf f = 0 (לא מתקבל)');
    await slide(nth(fig, 0), 1); // r = 0.1
    await slide(nth(fig, 1), 0.05);
    await expect(fig.locator('[data-readout="set"]')).toContainText('g ∉ P');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-1b:open-fails']).toBeTruthy();
    await fig.getByRole('button', { name: 'Zₚ עם p = 1/2' }).click();
    await slide(nth(fig, 0), 1);
    await slide(nth(fig, 1), 0.03);
    await expect(fig.locator('[data-readout="set"]')).toContainText('g(p) = −0.03');
    await expect(fig.locator('[data-readout="set"]')).toContainText('g ∉ Zₚ');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-1b:leave-zero']).toBeTruthy();
  });

  test('a text step drives the figure: the second Explore step sets xⁿ with n = 10', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-4-1a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const step = page.locator('.step[data-fig="fig-4-1a"]').nth(1);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="n"]')).toContainText('n = 10');
    await expect(fig.locator('[data-readout="sup"]')).toContainText('sup = 1 (לא מתקבל)');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig="fig-4-1a"], .step[data-fig="fig-4-1b"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['fig-4-1a:never', 'fig-4-1a:bump', 'fig-4-1a:taylor', 'fig-4-1b:largest-ball', 'fig-4-1b:leave-pos', 'fig-4-1b:open-fails', 'fig-4-1b:leave-zero']) {
      expect(tasks[t]).toBeFalsy();
    }
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-4.1-max', 'Q-4.1-finite-k', 'Q-4.1-conv', 'Q-4.1-tent', 'Q-4.1-open']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-4-1-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors other pages link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'definition',
      'test-spaces',
      'convergence',
      'complete',
      'open',
      'positive-open',
      'positive-not-open',
      'closed',
      'evaluation',
      'neither',
      'polynomials',
      'bounded',
      'operations',
      'closure',
    ]) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    // Every statement opens with a bold heading that is the whole label and ends in a period (see lesson-2-3.spec.ts).
    // The name may hold parentheses itself ("משפט 4.1.4 (C(K) שלם)."), so the name part is greedy.
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה וטענה|הגדרה|למה|טענה|משפט|מסקנה) 4\.1\.(\d+[א-ת]?)(?: \(.*\))?\.$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1]);
    expect(numbers).toEqual(['1', '1א', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
  });
});
