import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/1-2/';

/** Bring a figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page, fig: string) {
  const f = page.locator(`#${fig}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas'));
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

/** Arrow keys move the probe ('balls') or y ('par') in steps of 0.05. */
async function press(canvas: Locator, key: string, times: number) {
  await canvas.focus();
  // focus once, then raw keys: locator.press re-runs its actionability checks on every call, which under a loaded
  // suite cost ~200 ms a key and timed out a 75-key walk
  for (let i = 0; i < times; i++) await canvas.page().keyboard.press(key);
}

test.describe('lesson 1.2: normed spaces and inner products', () => {
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

  test('(0.6, 0.4) lies on the 1-sphere and in the closed 1-ball; p = ∞ makes the ball a square and ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-2a');
    await expect(fig.locator('[data-readout="norms"]')).toContainText('‖x‖₁ = 1,');
    await fig.getByRole('button', { name: 'p = 1' }).click();
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('בכדור');
    await expect(fig.locator('[data-readout="verdict"]')).not.toContainText('מחוץ');
    await fig.getByRole('button', { name: 'p = ∞' }).click();
    await expect(fig.locator('[data-readout="p"]')).toContainText('∞');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-2a:square']).toBeTruthy();
  });

  test('(0.8, 0.8) is in the ∞-ball and outside the 2-ball, and finding such a point ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-2a');
    const canvas = fig.locator('canvas');
    await press(canvas, 'ArrowRight', 4);
    await press(canvas, 'ArrowUp', 8);
    await expect(fig.locator('[data-readout="norms"]')).toContainText('x = (0.8, 0.8)');
    await expect(fig.locator('[data-readout="norms"]')).toContainText('‖x‖₂ = 1.13');
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('מחוץ');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-2a:corner']).toBeTruthy();
  });

  test('the parallelogram law in p = ∞ holds for many pairs and fails for some; in p = 1 it holds for a pair off one line', async ({ page }) => {
    // 26 key presses, each waiting for the readout: ~23 s alone, more under a parallel run
    test.setTimeout(90_000);
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-2c');
    const canvas = fig.locator('canvas');
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('מתקיים');
    await fig.getByRole('button', { name: 'p = ∞' }).click();
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('מתקיים');
    // y from (0.5, 0) to (0.5, 0.2): off the line of x, and still 1.5² + 0.5² = 2.5 = 2 + 2·0.5²
    await press(canvas, 'ArrowUp', 4);
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('מתקיים');
    expect((await progress(page))?.tasks?.['fig-1-2c:par-fails-inf']).toBeFalsy();
    // y to (0.5, 0.8): 1.5² + 0.8² = 2.89 against 2 + 2·0.8² = 3.28
    await press(canvas, 'ArrowUp', 12);
    await expect(fig.locator('[data-readout="sides"]')).toContainText('2.89');
    await expect(fig.locator('[data-readout="sides"]')).toContainText('3.28');
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('נכשל');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-2c:par-fails-inf']).toBeTruthy();
    // p = 1, y to (1, 0.8): 2.8² + 0.8² = 8.48 = 2 + 2·1.8², a pair off one line that satisfies the law
    await fig.getByRole('button', { name: 'p = 1' }).click();
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('נכשל');
    expect((await progress(page))?.tasks?.['fig-1-2c:par-holds-l1']).toBeFalsy();
    await press(canvas, 'ArrowRight', 10);
    await expect(fig.locator('[data-readout="sides"]')).toContainText('8.48');
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('מתקיים');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-2c:par-holds-l1']).toBeTruthy();
  });

  test('a text step never ticks a task, even one that puts the figure in a failing pair', async ({ page }) => {
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig="fig-1-2a"], .step[data-fig="fig-1-2c"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['fig-1-2a:square', 'fig-1-2a:corner', 'fig-1-2c:par-fails-inf', 'fig-1-2c:par-holds-l1']) expect(tasks[t]).toBeFalsy();
  });

  test('the Check has its six bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-1.2-def', 'Q-1.2-p1', 'Q-1.2-balls', 'Q-1.2-induced', 'Q-1.2-parallelogram', 'Q-1.2-supnorm']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-1-2-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });
});
