import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/5-2/';

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

// DirectionalSlice's range inputs, in order (src/sims/DirectionalSlice.tsx): the direction angle θ in degrees, and
// the secant step t on a log10 scale (from −3).
const sliders = (fig: Locator) => {
  const r = fig.locator('input[type=range]');
  return { deg: r.nth(0), logT: r.nth(1) };
};
const preset = (fig: Locator, formula: string) => fig.getByRole('button', { name: formula, exact: true }).click();
const task = async (page: Page, id: string) => (await progress(page))?.tasks?.[id];

test.describe('lesson 5.2: partial and directional derivatives', () => {
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

  test('a text step drives the figure: the first Explore step shows x² + 3xy at (1,1) with D_v f(a) = 27/5', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-5-2a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const step = page.locator('.step[data-fig="fig-5-2a"]').nth(0);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="preset"]')).toContainText('x² + 3xy');
    await expect(fig.locator('[data-readout="direction"]')).toContainText('v = (0.6, 0.8)');
    await expect(fig.locator('[data-readout="dv"]')).toContainText('D_v f(a) = 5.4');
  });

  test('x² + 3xy: shrinking t to 0.001 brings both secant slopes within 0.01 of D_v f(a) and ticks poly-secant', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-2a');
    const s = sliders(fig);
    await slide(s.logT, -1);
    await page.waitForTimeout(200);
    expect(await task(page, 'fig-5-2a:poly-secant')).toBeFalsy();
    await slide(s.logT, -3);
    await expect(fig.locator('[data-readout="secants"]')).toContainText('t = 0.001');
    await expect.poll(() => task(page, 'fig-5-2a:poly-secant')).toBeTruthy();
  });

  test('x²y/(x⁴ + y²): the direction at 53.1° gives D_v g(0) ≈ 0.4508 and ticks g-value; the x-axis gives 0', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-2a');
    const s = sliders(fig);
    await preset(fig, 'x²y/(x⁴ + y²)');
    await slide(s.deg, 0);
    await expect(fig.locator('[data-readout="dv"]')).toContainText('D_v f(a) = 0');
    await slide(s.deg, 53.1);
    await expect(fig.locator('[data-readout="dv"]')).toContainText('0.4508');
    await expect.poll(() => task(page, 'fig-5-2a:g-value')).toBeTruthy();
  });

  test('xy/(x² + y²): off the axes the slice jumps and there is no derivative; at 40° the jump is ≥ 0.4 (xy-jump)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-2b');
    const s = sliders(fig);
    await expect(fig.locator('[data-readout="dv"]')).toContainText('קופצת');
    await slide(s.deg, 10);
    await page.waitForTimeout(200);
    expect(await task(page, 'fig-5-2b:xy-jump')).toBeFalsy();
    await slide(s.deg, 40);
    await expect.poll(() => task(page, 'fig-5-2b:xy-jump')).toBeTruthy();
    await slide(s.deg, 90);
    await expect(fig.locator('[data-readout="dv"]')).toContainText('D_v f(a) = 0');
  });

  test('the parabola indicator h: D_v h(0) = 0 in every direction; at 5° the spike is nearer than 0.1 (h-near)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-2b');
    const s = sliders(fig);
    await preset(fig, 'h');
    await slide(s.deg, 30);
    await expect(fig.locator('[data-readout="dv"]')).toContainText('D_v f(a) = 0');
    await expect(fig.locator('[data-readout="spike"]')).toContainText('t* = 0.6667');
    await slide(s.deg, 5);
    await expect(fig.locator('[data-readout="dv"]')).toContainText('D_v f(a) = 0');
    await expect.poll(() => task(page, 'fig-5-2b:h-near')).toBeTruthy();
  });

  test('‖x‖₂: the one-sided limits are 1 and −1, and t = 0.001 ticks norm-sides', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-2b');
    const s = sliders(fig);
    await preset(fig, '‖x‖₂');
    await expect(fig.locator('[data-readout="dv"]')).toContainText('אינה קיימת');
    await slide(s.logT, -3);
    await expect(fig.locator('[data-readout="secants"]')).toContainText('מימין 1');
    await expect.poll(() => task(page, 'fig-5-2b:norm-sides')).toBeTruthy();
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig="fig-5-2a"], .step[data-fig="fig-5-2b"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['fig-5-2a:poly-secant', 'fig-5-2a:g-value', 'fig-5-2b:xy-jump', 'fig-5-2b:h-near', 'fig-5-2b:norm-sides']) {
      expect(tasks[t]).toBeFalsy();
    }
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-5.2-def', 'Q-5.2-compute', 'Q-5.2-l1', 'Q-5.2-partials-imply', 'Q-5.2-dir-value']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-5-2-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors other pages link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'partial',
      'directional',
      'directional-rules',
      'test-spaces',
      'computations',
      'partials-no-continuity',
      'directional-no-continuity',
      'parabola-indicator',
      'continuous-no-derivative',
      'what-implies-what',
      'mean-value',
    ]) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה וטענה|הגדרה|למה|טענה|משפט|מסקנה) 5\.2\.(\d+[א-ת]?)(?: \([^)]*\))?\.$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1]);
    expect(numbers).toEqual(['1', '2', '2א', '2ב', '3', '4', '5', '6', '7', '8']);
  });
});
