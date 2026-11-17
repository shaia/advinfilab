import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/5-1/';

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

// PathLimit's range inputs, in order (src/sims/PathLimit.tsx): the slope m, the parabola coefficient k, the radius ρ,
// and α (only while the preset is |x|^α y/(x² + y²)).
const sliders = (fig: Locator) => {
  const r = fig.locator('input[type=range]');
  return { m: r.nth(0), k: r.nth(1), rho: r.nth(2), alpha: r.nth(3) };
};
const button = (fig: Locator, name: string) => fig.getByRole('button', { name, exact: true }).click();

test.describe('lesson 5.1: limits and continuity in several variables', () => {
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

  test('xy/(x²+y²) on y = 2x is 0.4, and that ticks line-04; on y = x it is 0.5', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-1a');
    const s = sliders(fig);
    await expect(fig.locator('[data-readout="path-limit"]')).toContainText('0.5');
    expect((await progress(page))?.tasks?.['fig-5-1a:line-04']).toBeFalsy();
    await slide(s.m, 2);
    await expect(fig.locator('[data-readout="path-limit"]')).toContainText('0.4');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-5-1a:line-04']).toBeTruthy();
  });

  test('x²y/(x⁴+y²): 0 along a line, ½ along y = x², which ticks parabola-half', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-1a');
    const s = sliders(fig);
    await button(fig, 'x²y/(x⁴ + y²)');
    await slide(s.m, 3);
    await expect(fig.locator('[data-readout="path-limit"]')).toContainText(': 0');
    await button(fig, 'פרבולה');
    await slide(s.k, 2);
    await expect(fig.locator('[data-readout="path-limit"]')).toContainText('0.4');
    expect((await progress(page))?.tasks?.['fig-5-1a:parabola-half']).toBeFalsy();
    await slide(s.k, 1);
    await expect(fig.locator('[data-readout="path-limit"]')).toContainText('0.5');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-5-1a:parabola-half']).toBeTruthy();
  });

  test('x³/(x²+y²) on circles: the sup is ρ, and ρ = 0.04 ticks circle-small', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-1a');
    const s = sliders(fig);
    await button(fig, 'x³/(x² + y²)');
    await button(fig, 'מעגל');
    await slide(s.rho, 0.3);
    await expect(fig.locator('[data-readout="circle"]')).toContainText('0.3');
    expect((await progress(page))?.tasks?.['fig-5-1a:circle-small']).toBeFalsy();
    await slide(s.rho, 0.04);
    await expect(fig.locator('[data-readout="circle"]')).toContainText('0.04');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-5-1a:circle-small']).toBeTruthy();
  });

  test('the polar trap and the family f_α in the second figure', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-1b');
    const s = sliders(fig);
    // x²y/(x⁴+y²): the sup on every circle is ½
    await button(fig, 'x²y/(x⁴ + y²)');
    await button(fig, 'מעגל');
    await slide(s.rho, 0.05);
    await expect(fig.locator('[data-readout="circle"]')).toContainText('0.5');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-5-1b:parab-circle']).toBeTruthy();
    // f_α with α = 1 on y = x: the limit ½
    await button(fig, '|x|^α y/(x² + y²)');
    await button(fig, 'ישר');
    await slide(s.m, 1);
    await expect(fig.locator('[data-readout="path-limit"]')).toContainText('0.5');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-5-1b:alpha-one']).toBeTruthy();
    // α = 1/2 on y = x: no finite limit
    await slide(s.alpha, 0.5);
    await expect(fig.locator('[data-readout="path-limit"]')).toContainText('∞');
    // α = 2 on the circle of radius 0.1: S = (2/3^{3/2})·0.1 ≈ 0.0385 < 0.05
    await slide(s.alpha, 2);
    await button(fig, 'מעגל');
    await slide(s.rho, 0.1);
    await expect(fig.locator('[data-readout="circle"]')).toContainText('0.0385');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-5-1b:alpha-bound']).toBeTruthy();
  });

  test('a text step drives the figure: the second Explore step shows x²y/(x⁴+y²) on y = x', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-5-1a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const step = page.locator('.step[data-fig="fig-5-1a"]').nth(1);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="preset"]')).toContainText('x²y/(x⁴ + y²)');
    await expect(fig.locator('[data-readout="path"]')).toContainText('y = 1·x');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig="fig-5-1a"], .step[data-fig="fig-5-1b"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of [
      'fig-5-1a:line-04',
      'fig-5-1a:parabola-half',
      'fig-5-1a:circle-small',
      'fig-5-1b:parab-circle',
      'fig-5-1b:alpha-one',
      'fig-5-1b:alpha-bound',
    ]) {
      expect(tasks[t]).toBeFalsy();
    }
  });

  test('the Check has its seven bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'Q-5.1-level',
      'Q-5.1-line-value',
      'Q-5.1-x3-bound',
      'Q-5.1-components',
      'Q-5.1-iterated',
      'Q-5.1-polar-trap',
      'Q-5.1-alpha',
    ]) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-5-1-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors other pages link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'graph-levels',
      'level-sets',
      'limit-def',
      'test-spaces',
      'components',
      'norms',
      'paths',
      'all-lines',
      'iterated',
      'bound',
      'circle-bound',
      'polar-trap',
      'family',
      'separate',
    ]) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה וטענה|הגדרה|למה|טענה|משפט|מסקנה) 5\.1\.(\d+[א-ת]?)(?: \([^)]*\))?\.$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1]);
    expect(numbers).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
  });
});
