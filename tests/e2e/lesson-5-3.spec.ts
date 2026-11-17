import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/5-3/';

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

// TangentPlane's range inputs, in order (src/sims/TangentPlane.tsx): ρ and ε on a log10 scale, then θ in degrees.
const sliders = (fig: Locator) => {
  const r = fig.locator('input[type=range]');
  return { logRho: r.nth(0), logEps: r.nth(1), theta: r.nth(2) };
};
const preset = (fig: Locator, formula: string) => fig.getByRole('button', { name: formula, exact: true }).click();
const task = async (page: Page, id: string) => (await progress(page))?.tasks?.[id];

test.describe('lesson 5.3: differentiability', () => {
  test('both figures draw in the 2D view, in LTR math space, without loading three.js', async ({ page }) => {
    await page.goto(LESSON);
    const canvases = page.locator('.sim-stage canvas');
    await expect(canvases).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      const c = canvases.nth(i);
      await c.scrollIntoViewIfNeeded();
      await hydrated(c);
      await expect(c).toHaveCSS('direction', 'ltr');
      await expect.poll(() => inked(c)).toBeGreaterThan(200);
    }
    const loaded3d = await page.evaluate(() => performance.getEntriesByType('resource').some((e) => /TangentPlane3D|three/i.test(e.name)));
    expect(loaded3d).toBe(false);
  });

  test('x² + y² at (1, 1): with ε = 0.049, ρ = 0.0398 works as δ and ticks the task; ρ = 0.1 does not', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-3a');
    const s = sliders(fig);
    await expect(fig.locator('[data-readout="preset"]')).toContainText('x² + y²');
    await slide(s.logEps, -1.31);
    await slide(s.logRho, -1);
    await expect(fig.locator('[data-readout="delta"]')).toContainText('אינו מתאים');
    await page.waitForTimeout(200);
    expect(await task(page, 'fig-5-3a:paraboloid-delta')).toBeFalsy();
    await slide(s.logRho, -1.4);
    await expect(fig.locator('[data-readout="delta"]')).toContainText('ρ מתאים כ-δ.');
    await expect(fig.locator('[data-readout="circle"]')).toContainText('S(ρ) = 0.0398');
    await expect.poll(() => task(page, 'fig-5-3a:paraboloid-delta')).toBeTruthy();
  });

  test('√|xy|: the sup on the circle stays 1/√2 ≈ 0.707 at every zoom; θ = 45° with ρ = 0.01 ticks sqrt-worst', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-3a');
    const s = sliders(fig);
    await preset(fig, '√|xy|');
    await expect(fig.locator('[data-readout="circle"]')).toContainText('0.707');
    await slide(s.logRho, -2);
    await expect(fig.locator('[data-readout="circle"]')).toContainText('0.707');
    await slide(s.theta, 45);
    await expect(fig.locator('[data-readout="ratio"]')).toContainText('0.707');
    await expect.poll(() => task(page, 'fig-5-3a:sqrt-worst')).toBeTruthy();
  });

  test('x³/(x² + y²): the worst direction is θ ≈ 54.7° with ratio 2/(3√3) ≈ 0.385; θ = 54.5° ticks cubic-worst, θ = 0 gives 0', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-3a');
    const s = sliders(fig);
    await preset(fig, 'x³/(x² + y²)');
    await expect(fig.locator('[data-readout="preset"]')).toContainText('(1, 0)');
    await expect(fig.locator('[data-readout="circle"]')).toContainText('0.385');
    await expect(fig.locator('[data-readout="circle"]')).toContainText('54.7');
    await slide(s.theta, 0);
    await expect(fig.locator('[data-readout="ratio"]')).toContainText('≈ 0 ');
    await slide(s.theta, 54.5);
    await expect.poll(() => task(page, 'fig-5-3a:cubic-worst')).toBeTruthy();
  });

  test('second figure: x²y²/(x² + y²) with ε ≈ 0.00977 and ρ ≈ 0.0316 ticks square-delta', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-3b');
    const s = sliders(fig);
    await preset(fig, 'x²y²/(x² + y²)');
    await slide(s.logEps, -2.01);
    await slide(s.logRho, -1.5);
    await expect(fig.locator('[data-readout="delta"]')).toContainText('ρ מתאים כ-δ.');
    await expect.poll(() => task(page, 'fig-5-3b:square-delta')).toBeTruthy();
  });

  test('second figure: x²y/(x⁴ + y²) has S(ρ) = 1/(2ρ), 10.2 at ρ = 0.049, and θ = 3° there ticks parabola-blowup', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-3b');
    const s = sliders(fig);
    await preset(fig, 'x²y/(x⁴ + y²)');
    await slide(s.logRho, -1.31);
    await expect(fig.locator('[data-readout="circle"]')).toContainText('10.2');
    await expect(fig.locator('[data-readout="delta"]')).toContainText('∞');
    await slide(s.theta, 3);
    await expect.poll(() => task(page, 'fig-5-3b:parabola-blowup')).toBeTruthy();
  });

  test('the 3D toggle degrades gracefully: it either draws the 3D view or says it is unavailable, and the figure keeps drawing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-3a');
    await fig.getByRole('button', { name: 'תלת-ממד', exact: true }).click();
    await expect(fig.locator('[data-readout="view3d"]')).toContainText(/תלת-ממד:|אינה זמינה/, { timeout: 15_000 });
    await expect.poll(() => inked(fig.locator('canvas'))).toBeGreaterThan(200);
    // the 2D readouts and tasks still work in either case
    await slide(sliders(fig).logRho, -1);
    await expect(fig.locator('[data-readout="circle"]')).toContainText('S(ρ) = 0.1');
    expect(errors).toEqual([]);
  });

  test('a text step drives the figure: the second Explore step shows √|xy|', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-5-3a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const step = page.locator('.step[data-fig="fig-5-3a"]').nth(1);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="preset"]')).toContainText('√|xy|');
    await expect(fig.locator('[data-readout="circle"]')).toContainText('0.707');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig="fig-5-3a"], .step[data-fig="fig-5-3b"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['fig-5-3a:paraboloid-delta', 'fig-5-3a:sqrt-worst', 'fig-5-3a:cubic-worst', 'fig-5-3b:square-delta', 'fig-5-3b:parabola-blowup']) {
      expect(tasks[t]).toBeFalsy();
    }
  });

  test('the Check has its seven bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-5.3-def', 'Q-5.3-affine', 'Q-5.3-jacobian', 'Q-5.3-continuous', 'Q-5.3-candidate', 'Q-5.3-sqrt', 'Q-5.3-decide']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-5-3-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors other pages link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['definition', 'divide', 'uniqueness', 'differential', 'examples', 'continuity', 'jacobian', 'special-point', 'recipe', 'decisions', 'gateaux', 'normed-spaces']) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה וטענה|הגדרה|דוגמה|למה|טענה|משפט|מסקנה) 5\.3\.(\d+[א-ת]?)(?: \([^)]*\))?\.$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1]);
    expect(numbers).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
  });
});
