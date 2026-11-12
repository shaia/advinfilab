import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/4-2/';

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

// Equicontinuity's range inputs, in order (src/sims/Equicontinuity.tsx): the number of members m, the point a, ε,
// and δ on a log10 scale.
const sliders = (fig: Locator) => {
  const r = fig.locator('input[type=range]');
  return { m: r.nth(0), a: r.nth(1), eps: r.nth(2), logDelta: r.nth(3) };
};
const family = (fig: Locator, formula: string) => fig.getByRole('button', { name: formula, exact: true }).click();

test.describe('lesson 4.2: equicontinuity', () => {
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

  test('sin(nx) at a = 0: the δ of the drawn members is arcsin(ε)/m (0.0654 for 8, 0.0131 for 40)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-2a');
    const s = sliders(fig);
    await family(fig, 'sin(nx)');
    await slide(s.a, 0);
    await slide(s.m, 8);
    await expect(fig.locator('[data-readout="delta-star"]')).toContainText('0.0654');
    await expect(fig.locator('[data-readout="delta-star"]')).toContainText('n = 8');
    await slide(s.m, 40);
    await expect(fig.locator('[data-readout="delta-star"]')).toContainText('0.0131');
  });

  test('shifts of sin: δ ≈ 0.501 works at every point for all members, and ticks the shift-one task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-2a');
    const s = sliders(fig);
    await slide(s.logDelta, -0.3);
    await expect(fig.locator('[data-readout="ok"]')).toContainText('מתאים בנקודה הזו');
    await expect(fig.locator('[data-readout="uniform"]')).toContainText('0.505');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-2a:shift-one']).toBeTruthy();
  });

  test('xⁿ at a = 1 with ε = 0.4: 17 members push δ below 0.03 and tick power-fails; 16 do not', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-2a');
    const s = sliders(fig);
    await family(fig, 'xⁿ');
    await slide(s.eps, 0.4);
    await slide(s.a, 1);
    await slide(s.m, 16);
    await page.waitForTimeout(200);
    expect((await progress(page))?.tasks?.['fig-4-2a:power-fails']).toBeFalsy();
    await slide(s.m, 17);
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-2a:power-fails']).toBeTruthy();
  });

  test('away from the failure point one δ works: xⁿ at a = 1/2 with 30 members, the tents at a = 0.3', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-2b');
    const s = sliders(fig);
    await slide(s.m, 30);
    await slide(s.a, 0.5);
    await slide(s.logDelta, -0.6);
    await expect(fig.locator('[data-readout="delta-star"]')).toContainText('0.355');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-2b:power-inside']).toBeTruthy();
    await family(fig, 'tₙ');
    await slide(s.m, 12);
    await slide(s.a, 0.3);
    await slide(s.logDelta, -1.25);
    await expect(fig.locator('[data-readout="delta-star"]')).toContainText('0.0625');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-2b:tent-away']).toBeTruthy();
  });

  test('sin(nx) near 0 with 27 members: δ below 0.02 ticks freq-zero', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-2b');
    const s = sliders(fig);
    await family(fig, 'sin(nx)');
    await slide(s.a, 0);
    await slide(s.m, 27);
    await expect(fig.locator('[data-readout="delta-star"]')).toContainText('0.0194');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-2b:freq-zero']).toBeTruthy();
  });

  test('a text step drives the figure: the second Explore step shows sin(nx) with 8 members at a = 0', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-4-2a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const step = page.locator('.step[data-fig="fig-4-2a"]').nth(1);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="family"]')).toContainText('sin(nx)');
    await expect(fig.locator('[data-readout="delta-star"]')).toContainText('0.0654');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig="fig-4-2a"], .step[data-fig="fig-4-2b"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['fig-4-2a:shift-one', 'fig-4-2a:power-fails', 'fig-4-2b:power-inside', 'fig-4-2b:freq-zero', 'fig-4-2b:tent-away']) {
      expect(tasks[t]).toBeFalsy();
    }
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-4.2-def', 'Q-4.2-neg', 'Q-4.2-lip-delta', 'Q-4.2-each-not-family', 'Q-4.2-sin']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-4-2-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors other pages link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['definition', 'negation', 'compact', 'sufficient', 'unbounded', 'failures', 'convergence']) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה וטענה|הגדרה|למה|טענה|משפט|מסקנה) 4\.2\.(\d+[א-ת]?)(?: \([^)]*\))?\.$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1]);
    expect(numbers).toEqual(['1', '1א', '2', '3', '4', '5', '6', '7', '8', '9', '10', '10א']);
  });
});
