import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/1-3/';

/** Bring a figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page, fig: string) {
  const f = page.locator(`#${fig}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas'));
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

/** Move the probe with the keyboard: the canvas takes arrow keys in steps of 0.05. */
async function press(canvas: Locator, key: string, times: number) {
  await canvas.focus();
  // focus once, then raw keys: locator.press re-runs its actionability checks on every call, which under a loaded
  // suite cost ~200 ms a key and timed out a 75-key walk
  for (let i = 0; i < times; i++) await canvas.page().keyboard.press(key);
}

test.describe('lesson 1.3: balls, open sets and closed sets', () => {
  test('all three figures draw, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    const canvases = page.locator('.sim-stage canvas');
    await expect(canvases).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      const c = canvases.nth(i);
      await c.scrollIntoViewIfNeeded();
      await expect(c).toHaveCSS('direction', 'ltr');
      await expect.poll(() => inked(c)).toBeGreaterThan(200);
    }
  });

  test('a point on an edge of the closed square has no ball inside, and finding one ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-3a');
    await fig.getByRole('button', { name: 'ריבוע עם השפה' }).click();
    // the probe starts at (0.5, 0.5): ten steps right put it on the edge x = 1
    const canvas = fig.locator('canvas');
    await press(canvas, 'ArrowRight', 9);
    await expect(fig.locator('[data-readout="best"]')).toContainText('0.05');
    await press(canvas, 'ArrowRight', 1);
    await expect(fig.locator('[data-readout="point"]')).toContainText('(1, 0.5)');
    await expect(fig.locator('[data-readout="best"]')).toContainText('אין אף כדור');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-3a:edge-point']).toBeTruthy();
  });

  test('in the discrete metric the same edge point has the ball {x} inside', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-3a');
    await fig.getByRole('button', { name: 'ריבוע עם השפה' }).click();
    await press(fig.locator('canvas'), 'ArrowRight', 10);
    await fig.getByRole('button', { name: 'בדידה' }).click();
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('כולו בקבוצה');
    await expect(fig.locator('[data-readout="best"]')).toContainText('1');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-3a:discrete']).toBeTruthy();
  });

  test('the proof radius s = 1 − d(a,y) always fits, and s = d(a,y) sticks out far from the centre', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-3b');
    const canvas = fig.locator('canvas');
    // y starts at (0.5, 0.3); eight steps right: (0.9, 0.3), d₂ ≈ 0.949, s ≈ 0.0513 ≤ 0.1 from the edge
    await press(canvas, 'ArrowRight', 8);
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('כולו בתוך');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-3b:fit-edge']).toBeTruthy();
    await fig.getByRole('button', { name: 's = d(a,y)' }).click();
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('בולט');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-3b:naive-out']).toBeTruthy();
  });

  test('a text step never ticks a task, even one that puts the probe on an edge', async ({ page }) => {
    await page.goto(LESSON);
    // the second step of 1.3א puts the probe at (1, 0.4) on the closed square: exactly the edge-point answer
    for (const step of await page.locator('.step[data-fig="fig-1-3a"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    expect((await progress(page))?.tasks?.['fig-1-3a:edge-point']).toBeFalsy();
    expect((await progress(page))?.tasks?.['fig-1-3a:discrete']).toBeFalsy();
  });

  test('the Check has its six bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-1.3-open-def', 'Q-1.3-radius', 'Q-1.3-both', 'Q-1.3-classify', 'Q-1.3-finite', 'Q-1.3-subspace']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-1-3-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });
});
