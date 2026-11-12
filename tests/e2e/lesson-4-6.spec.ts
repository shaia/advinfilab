import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/4-6/';

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

// AlgebraFit: the only range input is the degree n (src/sims/AlgebraFit.tsx).
const degree = (fig: Locator) => fig.locator('input[type=range]').first();
const pick = (fig: Locator, name: string) => fig.getByRole('button', { name, exact: true }).click();

test.describe('lesson 4.6: the Stone–Weierstrass theorem', () => {
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

  test('polynomials in x² on [−1, 1] stall at 1 for f(x) = x, the proved bound appears, and the task ticks', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-6a');
    await pick(fig, 'פולינומים ב-x²');
    await pick(fig, 'f(x) = x');
    await slide(degree(fig), 12);
    await expect(fig.locator('[data-readout="n"]')).toContainText('n = 12');
    await expect(fig.locator('[data-readout="err"]')).toHaveText(/≈ 1$/);
    await expect(fig.locator('[data-readout="bound"]')).toContainText('1');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-6a:even-stall']).toBeTruthy();
  });

  test('the same algebra on [0, 1] gets below 0.05 at degree 12, and the task ticks', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-6a');
    await pick(fig, 'פולינומים ב-x²');
    await pick(fig, '[0, 1]');
    await pick(fig, 'f(x) = x');
    await slide(degree(fig), 11);
    await expect(fig.locator('[data-readout="err"]')).toContainText('0.0553');
    await page.waitForTimeout(200);
    expect((await progress(page))?.tasks?.['fig-4-6a:even-half']).toBeFalsy();
    await slide(degree(fig), 12);
    await expect(fig.locator('[data-readout="err"]')).toContainText('0.0471');
    await expect(fig.locator('[data-readout="bound"]')).toHaveCount(0);
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-6a:even-half']).toBeTruthy();
  });

  test('polynomials vanishing at 0 stay at distance 1 from the constant 1', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-6a');
    await pick(fig, 'פולינומים שמתאפסים ב-0');
    await pick(fig, 'f(x) = 1');
    await slide(degree(fig), 20);
    await expect(fig.locator('[data-readout="err"]')).toHaveText(/≈ 1$/);
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-6a:vanish-one']).toBeTruthy();
  });

  test('trigonometric polynomials: |x| below 0.05 at degree 13; x stuck at π with the bound shown; both tasks tick', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-6b');
    await slide(degree(fig), 13);
    await expect(fig.locator('[data-readout="err"]')).toContainText('0.0453');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-6b:trig-abs']).toBeTruthy();
    await pick(fig, 'f(x) = x');
    await slide(degree(fig), 12);
    await expect(fig.locator('[data-readout="err"]')).toContainText('3.14');
    await expect(fig.locator('[data-readout="bound"]')).toContainText('3.142');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-6b:trig-x']).toBeTruthy();
  });

  test('a text step drives the figure: the third Explore step sets x² polynomials, f(x) = x, n = 8', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-4-6a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const step = page.locator('.step[data-fig="fig-4-6a"]').nth(2);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="n"]')).toContainText('n = 8');
    await expect(fig.locator('[data-readout="err"]')).toHaveText(/≈ 1$/);
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig="fig-4-6a"], .step[data-fig="fig-4-6b"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['fig-4-6a:even-stall', 'fig-4-6a:even-half', 'fig-4-6a:vanish-one', 'fig-4-6b:trig-x', 'fig-4-6b:trig-abs']) {
      expect(tasks[t]).toBeFalsy();
    }
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-4.6-statement', 'Q-4.6-separates', 'Q-4.6-algebra', 'Q-4.6-vanish', 'Q-4.6-even-half']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-4-6-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors other pages link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'definition',
      'examples',
      'lemmas',
      'theorem',
      'trig',
      'trig-interval',
      'separable',
      'hypotheses',
      'dense-vs-contains',
      'closed-conditions',
    ]) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    // Every statement opens with a bold heading that is the whole label and ends in a period. A title may hold
    // rendered math (מסקנה 4.6.9), whose text has its own parentheses, so the title part is matched greedily.
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה|למה|טענה|משפט|מסקנה) 4\.6\.(\d+[א-ת]?)(?: \([\s\S]*\))?\.$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1]);
    expect(numbers).toEqual(['1', '1א', '2', '3', '4', '5', '6', '7', '7א', '7ב', '8', '8א', '9', '9א', '10']);
  });
});
