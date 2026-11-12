import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/3-6/';

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

/**
 * Connect (src/sims/Connect.tsx), poly mode: the arrows move a cursor on the grid of tenths (Shift: five steps,
 * i.e. 0.5), Enter adds the cursor as a vertex, Backspace removes the last one. The cursor starts at p.
 */
async function keys(page: Page, fig: Locator, seq: string[]) {
  await fig.locator('canvas').focus();
  for (const k of seq) await page.keyboard.press(k);
}
const times = (k: string, n: number) => Array.from({ length: n }, () => k);

test.describe('lesson 3.6: connectedness and path-connectedness', () => {
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

  test('annulus: a two-segment path via (0, 1.5) stays inside and ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-6a');
    // p = (1.5, 0) → (0, 1.5) → (−1.5, 0) = q
    await keys(page, fig, [...times('Shift+ArrowLeft', 3), ...times('Shift+ArrowUp', 3), 'Enter']);
    await expect(fig.locator('[data-readout="status"]')).toContainText('כל הקטעים עד עכשיו');
    await keys(page, fig, [...times('Shift+ArrowLeft', 3), ...times('Shift+ArrowDown', 3), 'Enter']);
    await expect(fig.locator('[data-readout="status"]')).toContainText('המסילה מגיעה ל-q');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-6a:annulus-around']).toBeTruthy();
  });

  test('punctured plane: the straight segment hits 0; undo, go around through (0, 1), and the task ticks', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-6a');
    await fig.getByRole('button', { name: 'המישור בלי הראשית' }).click();
    await keys(page, fig, [...times('Shift+ArrowLeft', 4), 'Enter']);
    await expect(fig.locator('[data-readout="status"]')).toContainText('יוצא');
    await keys(page, fig, ['Backspace']);
    await expect(fig.locator('[data-readout="segments"]')).toContainText('0');
    await keys(page, fig, [...times('Shift+ArrowLeft', 2), ...times('Shift+ArrowUp', 2), 'Enter']);
    await keys(page, fig, [...times('Shift+ArrowLeft', 2), ...times('Shift+ArrowDown', 2), 'Enter']);
    await expect(fig.locator('[data-readout="status"]')).toContainText('המסילה מגיעה ל-q');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-6a:punctured-around']).toBeTruthy();
  });

  test('the line minus 0: a segment from 1 to −1 leaves the set, and trying ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-6a');
    await fig.getByRole('button', { name: 'הישר בלי 0' }).click();
    await keys(page, fig, [...times('Shift+ArrowLeft', 4), 'Enter']);
    await expect(fig.locator('[data-readout="status"]')).toContainText('יוצא');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-6a:line-try']).toBeTruthy();
  });

  test('sine curve: the walker at x = 0.01 is at distance 0.01 from J after 32 peaks, and the task ticks', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-6b');
    await fig.getByRole('button', { name: 'עקומת הסינוס' }).click();
    // the walker slider runs over u = log₁₀ x
    await slide(fig.locator('input[type=range]').nth(0), -2);
    await expect(fig.locator('[data-readout="dist"]')).toContainText('0.01');
    await expect(fig.locator('[data-readout="peaks"]')).toContainText('32');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-6b:walk-close']).toBeTruthy();
  });

  test('sine curve: the 16th graph point at height 0.5 is within 0.01 of (0, 0.5), and the task ticks', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-6b');
    await fig.getByRole('button', { name: 'עקומת הסינוס' }).click();
    await fig.getByRole('button', { name: 'נקודות מתקרבות' }).click();
    await slide(fig.locator('input[type=range]').nth(1), 0.5);
    await slide(fig.locator('input[type=range]').nth(2), 15);
    await expect(fig.locator('[data-readout="approach"]')).toContainText('0.0106');
    await slide(fig.locator('input[type=range]').nth(2), 16);
    await expect(fig.locator('[data-readout="approach"]')).toContainText('0.0099');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-6b:approach']).toBeTruthy();
  });

  test('a text step drives the figure: the second Explore step draws the straight segment through the hole', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-3-6a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const step = page.locator('.step[data-fig="fig-3-6a"]').nth(1);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="segments"]')).toContainText('1');
    await expect(fig.locator('[data-readout="status"]')).toContainText('יוצא');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig="fig-3-6a"], .step[data-fig="fig-3-6b"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['fig-3-6a:annulus-around', 'fig-3-6a:punctured-around', 'fig-3-6a:line-try', 'fig-3-6b:walk-close', 'fig-3-6b:approach']) {
      expect(tasks[t]).toBeFalsy();
    }
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-3.6-def', 'Q-3.6-which-R', 'Q-3.6-preimage', 'Q-3.6-discrete', 'Q-3.6-path-implies']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-3-6-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors other pages link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'connected',
      'equivalent',
      'test-spaces',
      'intervals',
      'image',
      'image-thm',
      'unions',
      'paths',
      'path-implies',
      'convex',
      'open-connected',
      'open-connected-thm',
      'sine',
      'sine-not-path',
      'predict-answer',
    ]) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה וטענה|הגדרה|למה|טענה|משפט|מסקנה) 3\.6\.(\d+[א-ת]?)(?: \([^)]*\))?\.$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1]);
    expect(numbers).toEqual(['1', '2', '2א', '3', '4', '4א', '5', '5א', '6', '7', '7א', '8', '9', '9א', '10', '11', '12', '13']);
  });
});
