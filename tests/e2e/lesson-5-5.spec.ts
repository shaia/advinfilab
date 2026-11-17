import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/5-5/';

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

// CurveOnLevels' range inputs, in order (src/sims/CurveOnLevels.tsx): the parameter (t, or θ in degrees on the
// circle), then the line's slope m (only on the line) or the circle's radius r (only on the circle).
const sliders = (fig: Locator) => {
  const r = fig.locator('input[type=range]');
  return { t: r.nth(0), second: r.nth(1) };
};
const pick = (fig: Locator, label: string) => fig.getByRole('button', { name: label, exact: true }).click();
const task = async (page: Page, id: string) => (await progress(page))?.tasks?.[id];

test.describe('lesson 5.5: the chain rule', () => {
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

  test('T = x² − xy + y along (t², t³) at t = 1: the chain-rule number is 2, the graph agrees, rate-two ticks', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-5a');
    const s = sliders(fig);
    await slide(s.t, 0.9);
    await page.waitForTimeout(200);
    expect(await task(page, 'fig-5-5a:rate-two')).toBeFalsy();
    await slide(s.t, 1);
    await expect(fig.locator('[data-readout="vectors"]')).toContainText('(1, 0)');
    await expect(fig.locator('[data-readout="vectors"]')).toContainText('(2, 3)');
    await expect(fig.locator('[data-readout="chain"]')).toHaveText(/= 2$/);
    await expect(fig.locator('[data-readout="slope"]')).toContainText('≈ 2');
    await expect.poll(() => task(page, 'fig-5-5a:rate-two')).toBeTruthy();
  });

  test('x³/(x²+y²) on the line (t, t) at t = 0: formula 1, graph ½, and formula-fails ticks', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-5a');
    await pick(fig, 'f = x³/(x² + y²)');
    await pick(fig, 'γ(t) = (t, t)');
    const s = sliders(fig);
    await slide(s.t, 0);
    await expect(fig.locator('[data-readout="chain"]')).toHaveText(/= 1$/);
    await expect(fig.locator('[data-readout="slope"]')).toContainText('≈ 0.5');
    await expect(fig.locator('[data-readout="slope"]')).toContainText('שונה');
    await expect.poll(() => task(page, 'fig-5-5a:formula-fails')).toBeTruthy();
  });

  test('x² − y² along (eᵗ, 1 + 2t) at t = 0.839: γ′ ⊥ ∇f, and tangent ticks', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-5a');
    await pick(fig, 'f = x² − y²');
    await pick(fig, 'γ(t) = (eᵗ, 1 + 2t)');
    const s = sliders(fig);
    await slide(s.t, 0.5);
    await page.waitForTimeout(200);
    expect(await task(page, 'fig-5-5a:tangent')).toBeFalsy();
    await slide(s.t, 0.839);
    // the angle prints with four significant digits: 89.99° or 90.01° at this grid point
    await expect(fig.locator('[data-readout="vectors"]')).toContainText(/(89\.9\d|90(\.0\d)?)°/);
    await expect.poll(() => task(page, 'fig-5-5a:tangent')).toBeTruthy();
  });

  test('polar: x² − y² on the circle of radius 2 at θ = 45°: ∂g/∂θ = −8, and polar-min ticks', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-5b');
    const s = sliders(fig);
    await slide(s.t, 30);
    await page.waitForTimeout(200);
    expect(await task(page, 'fig-5-5b:polar-min')).toBeFalsy();
    await slide(s.t, 45);
    await expect(fig.locator('[data-readout="chain"]')).toHaveText(/= −8$/);
    await expect.poll(() => task(page, 'fig-5-5b:polar-min')).toBeTruthy();
  });

  test('polar: xy² on the unit circle at θ = 54.75°: ∂g/∂θ ≈ 0 with ∇f ≠ 0, and polar-zero ticks', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-5b');
    await pick(fig, 'f = xy²');
    const s = sliders(fig);
    await slide(s.second, 1);
    await slide(s.t, 0);
    await page.waitForTimeout(200);
    expect(await task(page, 'fig-5-5b:polar-zero')).toBeFalsy();
    await slide(s.t, 54.75);
    await expect.poll(() => task(page, 'fig-5-5b:polar-zero')).toBeTruthy();
  });

  test('a text step drives the figure: the second Explore step shows x² − y² along (eᵗ, 1 + 2t)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-5-5a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const step = page.locator('.step[data-fig="fig-5-5a"]').nth(1);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="func"]')).toContainText('x² − y²');
    await expect(fig.locator('[data-readout="func"]')).toContainText('eᵗ');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig="fig-5-5a"], .step[data-fig="fig-5-5b"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['fig-5-5a:rate-two', 'fig-5-5a:tangent', 'fig-5-5a:formula-fails', 'fig-5-5b:polar-min', 'fig-5-5b:polar-zero']) {
      expect(tasks[t]).toBeFalsy();
    }
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-5.5-statement', 'Q-5.5-curve', 'Q-5.5-polar-r', 'Q-5.5-euler-check', 'Q-5.5-matrix']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-5-5-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors other pages link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['statement', 'matrices', 'paths', 'polar', 'rules', 'euler', 'hypotheses']) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה וטענה|הגדרה|למה|טענה|משפט|מסקנה) 5\.5\.(\d+[א-ת]?)(?: \([^)]*\))?\.$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1]);
    expect(numbers).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  });
});
