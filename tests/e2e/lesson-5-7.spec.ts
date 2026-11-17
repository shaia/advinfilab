import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/5-7/';

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

// SecondDifference's range inputs, in order (src/sims/SecondDifference.tsx): log10 of the radius r, then the probe
// (h, k) as fractions u = h/r and v = k/r.
const sliders = (fig: Locator) => {
  const r = fig.locator('input[type=range]');
  return { logr: r.nth(0), u: r.nth(1), v: r.nth(2) };
};
const preset = (fig: Locator, formula: string) => fig.getByRole('button', { name: formula, exact: true }).click();
const SCHWARZ = 'f = xy(x² − y²)/(x² + y²)';

test.describe('lesson 5.7: higher-order derivatives and Schwarz', () => {
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

  test('x³y² at (1, 1): at r = 10⁻³ every quotient on the square is within 0.01 of 6 and ticks settle; at 10⁻²·⁹ not', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-7a');
    const s = sliders(fig);
    await expect(fig.locator('[data-readout="iterated"]')).toContainText('= 6');
    await slide(s.logr, -2.9);
    await expect(fig.locator('[data-readout="square"]')).toContainText('0.01134');
    await page.waitForTimeout(200);
    expect((await progress(page))?.tasks?.['fig-5-7a:settle']).toBeFalsy();
    await slide(s.logr, -3);
    await expect(fig.locator('[data-readout="square"]')).toContainText('0.009005');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-5-7a:settle']).toBeTruthy();
  });

  test('the counterexample: the iterated limits are −1 and 1, and near the axes the quotient is ∓0.995 (two tasks)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-7a');
    const s = sliders(fig);
    await preset(fig, SCHWARZ);
    await expect(fig.locator('[data-readout="iterated"]')).toContainText('∂²f/∂y∂x(a, b) = −1');
    await expect(fig.locator('[data-readout="iterated"]')).toContainText('∂²f/∂x∂y(a, b) = 1');
    await slide(s.logr, -2);
    await slide(s.u, 0.05);
    await slide(s.v, 1);
    await expect(fig.locator('[data-readout="probe"]')).toContainText('−0.995');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-5-7a:minus-one']).toBeTruthy();
    await slide(s.u, 1);
    await slide(s.v, 0.05);
    await expect(fig.locator('[data-readout="probe"]')).toContainText('0.995');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-5-7a:plus-one']).toBeTruthy();
  });

  test('the counterexample is homogeneous of degree 0: the same readouts at r = 1 and r = 10⁻⁴', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-7a');
    const s = sliders(fig);
    await preset(fig, SCHWARZ);
    await slide(s.logr, 0);
    const square = fig.locator('[data-readout="square"]');
    await expect(square).toContainText('−0.999');
    await expect(square).toContainText('0.999');
    const q1 = await fig.locator('[data-readout="probe"]').innerText();
    await slide(s.logr, -4);
    await expect(square).toContainText('−0.999');
    const q2 = await fig.locator('[data-readout="probe"]').innerText();
    // the probe moves with r, so (h, k) changes but the quotient does not
    expect(q1.split('=').at(-1)?.trim()).toBe(q2.split('=').at(-1)?.trim());
  });

  test('figure 5.7b: a point with quotient 0.4966 at r = 10⁻³ ticks the half task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-7b');
    const s = sliders(fig);
    await slide(s.logr, -3);
    await slide(s.u, 1);
    await slide(s.v, 0.58);
    await expect(fig.locator('[data-readout="probe"]')).toContainText('0.4966');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-5-7b:half']).toBeTruthy();
  });

  test('a text step drives the figure: the third Explore step shows the counterexample', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-5-7a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const step = page.locator('.step[data-fig="fig-5-7a"]').nth(2);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="fn"]')).toContainText('xy(x² − y²)');
    await expect(fig.locator('[data-readout="iterated"]')).toContainText('−1');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig="fig-5-7a"], .step[data-fig="fig-5-7b"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['fig-5-7a:settle', 'fig-5-7a:minus-one', 'fig-5-7a:plus-one', 'fig-5-7b:half']) {
      expect(tasks[t]).toBeFalsy();
    }
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-5.7-compute', 'Q-5.7-count', 'Q-5.7-schwarz', 'Q-5.7-classes', 'Q-5.7-fx-axis']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-5-7-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors other pages link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['notation', 'classes', 'second-difference', 'schwarz', 'schwarz-weak', 'counterexample', 'which-fails', 'consequences']) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה וטענה|הגדרה|למה|טענה|משפט|מסקנה) 5\.7\.(\d+[א-ת]?)(?: \([^)]*\))?\.$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1]);
    expect(numbers).toEqual(['1', '2', '2א', '3', '3א', '4', '4א', '5', '6', '7', '8']);
  });
});
