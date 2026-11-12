import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/4-5/';

/** Set a range input as a student would: the value, then an input event. */
const slide = (s: Locator, v: number) =>
  s.evaluate((el: HTMLInputElement, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);

/** Bring the figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page, fig: string) {
  const f = page.locator(`#${fig}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas'));
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

// BernsteinFit has three range inputs, in this order: n, x, δ (src/sims/BernsteinFit.tsx).
const sliders = (fig: Locator) => fig.locator('input[type=range]');
const nSlider = (fig: Locator) => sliders(fig).nth(0);
const xSlider = (fig: Locator) => sliders(fig).nth(1);
const dSlider = (fig: Locator) => sliders(fig).nth(2);

test.describe('lesson 4.5: the Weierstrass approximation theorem', () => {
  test('the figure draws, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    const c = page.locator('#fig-4-5a .sim-stage canvas');
    await c.scrollIntoViewIfNeeded();
    await expect(c).toHaveCSS('direction', 'ltr');
    await expect.poll(() => inked(c)).toBeGreaterThan(200);
  });

  test('x²: the sup error is exactly 1/(4n) (0.05 at n = 5, 0.005 at n = 50), and reaching 0.005 ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-5a');
    await expect(fig.locator('[data-readout="err"]')).toContainText('0.05');
    await slide(nSlider(fig), 49);
    await page.waitForTimeout(200);
    expect((await progress(page))?.tasks?.['fig-4-5a:square-n']).toBeFalsy();
    await slide(nSlider(fig), 50);
    await expect(fig.locator('[data-readout="err"]')).toContainText('0.005');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-5a:square-n']).toBeTruthy();
  });

  test('the far weight at x = 0.5, δ = 0.1 drops below 0.05 by n = 150, ticking the far-mass task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-5a');
    await slide(xSlider(fig), 0.5);
    await slide(dSlider(fig), 0.1);
    await slide(nSlider(fig), 50);
    await expect(fig.locator('[data-readout="far"]')).toContainText('0.203');
    await page.waitForTimeout(200);
    expect((await progress(page))?.tasks?.['fig-4-5a:far-mass']).toBeFalsy();
    await slide(nSlider(fig), 150);
    await expect(fig.locator('[data-readout="far"]')).toContainText('0.0176');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-5a:far-mass']).toBeTruthy();
  });

  test('|x − 1/2|: n = 100 then 400 halves the error (0.0398 → 0.0199) and ticks the abs-quarter task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-5a');
    await fig.getByRole('button', { name: '|x − 1/2|', exact: true }).click();
    await slide(nSlider(fig), 100);
    await expect(fig.locator('[data-readout="err"]')).toContainText('0.0398');
    await slide(nSlider(fig), 400);
    await expect(fig.locator('[data-readout="err"]')).toContainText('0.0199');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-5a:abs-quarter']).toBeTruthy();
  });

  test('sin(1/(x + 0.1)): error ≥ 0.1 at n = 400, < 0.1 at n = 500, which ticks the osc task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-5a');
    await fig.getByRole('button', { name: 'sin(1/(x + 0.1))', exact: true }).click();
    await slide(nSlider(fig), 400);
    await expect(fig.locator('[data-readout="err"]')).toContainText('0.12');
    await page.waitForTimeout(200);
    expect((await progress(page))?.tasks?.['fig-4-5a:osc-tenth']).toBeFalsy();
    await slide(nSlider(fig), 500);
    await expect(fig.locator('[data-readout="err"]')).toContainText('0.097');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-5a:osc-tenth']).toBeTruthy();
  });

  test('a text step drives the figure: the third Explore step selects |x − 1/2| with n = 25', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-4-5a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const step = page.locator('.step[data-fig="fig-4-5a"]').nth(2);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="err"]')).toContainText('0.0806');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig="fig-4-5a"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['fig-4-5a:square-n', 'fig-4-5a:far-mass', 'fig-4-5a:abs-quarter', 'fig-4-5a:osc-tenth']) expect(tasks[t]).toBeFalsy();
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-4.5-statement', 'Q-4.5-bern10', 'Q-4.5-node', 'Q-4.5-uniform-role', 'Q-4.5-poly-set']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-4-5-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors other pages link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'bernstein',
      'concentration',
      'theorem',
      'dense',
      'test-spaces',
      'limits',
      'slow',
      'closed-interval',
      'not-taylor',
      'consequences',
      'countable-dense',
      'moments',
      'abs-approx',
    ]) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה וטענה|הגדרה|למה|טענה|משפט|מסקנה) 4\.5\.(\d+[א-ת]?)(?: \([^)]*\))?\.$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1]);
    expect(numbers).toEqual(['1', '2', '3', '4', '4א', '5', '5א', '6', '7', '8', '9']);
  });
});
