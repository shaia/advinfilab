import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/3-3/';

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

// EpsNet: in plane mode the only range input is ε; in zigzag mode it is m (src/sims/EpsNet.tsx).
const sliderOf = (fig: Locator) => fig.locator('input[type=range]').first();

test.describe('lesson 3.3: total boundedness', () => {
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

  test('the square in d∞ with ε = 0.25: greedy net 9 and a ½-separated set of 9, and finding it ticks the sandwich task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-3a');
    await fig.getByRole('button', { name: 'd∞', exact: true }).click();
    await fig.getByRole('button', { name: 'קבוצה מופרדת' }).click();
    await slide(sliderOf(fig), 0.25);
    await expect(fig.locator('[data-readout="net"]')).toContainText('N = 9');
    await expect(fig.locator('[data-readout="sep"]')).toContainText('9');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-3a:sandwich']).toBeTruthy();
  });

  test('halving ε in the square ticks the halve task (d₂: 0.2 then 0.1 gives 25 then 81 points)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-3a');
    await slide(sliderOf(fig), 0.2);
    await expect(fig.locator('[data-readout="net"]')).toContainText('N = 25');
    await slide(sliderOf(fig), 0.1);
    await expect(fig.locator('[data-readout="net"]')).toContainText('N = 81');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-3a:halve']).toBeTruthy();
  });

  test('the discrete metric: 12 points for ε ≤ 1, one point for ε > 1, both tick the discrete task, and only then the readout names the ball', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-3a');
    await fig.getByRole('button', { name: 'מטריקה בדידה' }).click();
    await slide(sliderOf(fig), 0.5);
    await expect(fig.locator('[data-readout="net"]')).toContainText('N = 12');
    // the threshold is the task's answer: the ball readout stays hidden until both nets were seen
    await expect(fig.locator('[data-readout="ball"]')).toHaveCount(0);
    await slide(sliderOf(fig), 1.2);
    await expect(fig.locator('[data-readout="net"]')).toContainText('N = 1');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-3a:discrete']).toBeTruthy();
    await expect(fig.locator('[data-readout="ball"]')).toContainText('= A');
    await slide(sliderOf(fig), 0.5);
    await expect(fig.locator('[data-readout="ball"]')).toContainText('{y}');
  });

  test('the sandwich task does not tick on the trivial one-point equality at large ε', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-3a');
    await fig.getByRole('button', { name: 'd∞', exact: true }).click();
    await fig.getByRole('button', { name: 'קבוצה מופרדת' }).click();
    await slide(sliderOf(fig), 1.2);
    await expect(fig.locator('[data-readout="net"]')).toContainText('N = 1');
    await page.waitForTimeout(300);
    expect((await progress(page))?.tasks?.['fig-3-3a:sandwich']).toBeFalsy();
  });

  test('zigzags: the zero function is at distance exactly h, the tent t₁ breaks the bound, and the tasks tick', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-3b');
    await fig.getByRole('button', { name: '0', exact: true }).click();
    for (const m of [4, 5, 8]) {
      await slide(sliderOf(fig), m);
      await expect(fig.locator('[data-readout="dist"]')).toContainText(String(1 / m).slice(0, 4));
    }
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-3b:sharp']).toBeTruthy();
    await fig.getByRole('button', { name: 't₁', exact: true }).click();
    await slide(sliderOf(fig), 4);
    await expect(fig.locator('[data-readout="dist"]')).toContainText('0.75');
    await expect(fig.locator('[data-readout="in-L"]')).toContainText('f ∉ L');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-3b:outside-L']).toBeTruthy();
    await fig.getByRole('button', { name: '0.2·sin 5x', exact: true }).click();
    await slide(sliderOf(fig), 11);
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-3b:close']).toBeTruthy();
  });

  test('a text step drives the figure: the second Explore step sets ε = 0.1 on the square', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-3-3a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const step = page.locator('.step[data-fig="fig-3-3a"]').nth(1);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="eps"]')).toContainText('ε = 0.1');
    await expect(fig.locator('[data-readout="net"]')).toContainText('N = 81');
  });

  test('a text step never ticks a task', async ({ page }) => {
    // two figures with many steps; scrolling through all of them outlasts the default 30 s
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig="fig-3-3a"], .step[data-fig="fig-3-3b"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of [
      'fig-3-3a:halve',
      'fig-3-3a:strip-halve',
      'fig-3-3a:discrete',
      'fig-3-3a:sandwich',
      'fig-3-3b:close',
      'fig-3-3b:sharp',
      'fig-3-3b:outside-L',
    ]) {
      expect(tasks[t]).toBeFalsy();
    }
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-3.3-def', 'Q-3.3-discrete', 'Q-3.3-tb-bounded', 'Q-3.3-open-interval', 'Q-3.3-xn']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-3-3-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors other pages link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'definition',
      'test-spaces',
      'intrinsic',
      'equivalent',
      'separated',
      'segment',
      'bounded-vs-tb',
      'operations',
      'euclidean',
      'sequential',
      'compact-iff',
      'two-halves',
      'corollaries',
      'function-spaces',
    ]) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    // Every statement opens with a bold heading that is the whole label and ends in a period (see lesson-2-3.spec.ts).
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה וטענה|הגדרה|למה|טענה|משפט|מסקנה) 3\.3\.(\d+[א-ת]?)(?: \([^)]*\))?\.$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1]);
    expect(numbers).toEqual(['1', '2', '2א', '2ב', '3', '3א', '3ב', '4', '5', '6', '7', '8', '9', '10']);
  });
});
