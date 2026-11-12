import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/1-1/';

/** Bring a figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page, fig: string) {
  const f = page.locator(`#${fig}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas'));
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

/** Move the selected point (or the probe) with the keyboard: one press is one grid step. */
async function press(canvas: Locator, key: string, times: number) {
  await canvas.focus();
  // focus once, then raw keys: locator.press re-runs its actionability checks on every call, which under a loaded
  // suite cost ~200 ms a key and timed out a 75-key walk
  for (let i = 0; i < times; i++) await canvas.page().keyboard.press(key);
}

test.describe('lesson 1.1: metric spaces', () => {
  test('all three figures draw, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    const canvases = page.locator('.sim-stage canvas');
    // 1.1א (axioms on the line), 1.1ב (sup metric), 1.1ג (new metrics from old, 1.1.10–1.1.13)
    await expect(canvases).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      const c = canvases.nth(i);
      await c.scrollIntoViewIfNeeded();
      await expect(c).toHaveCSS('direction', 'ltr');
      await expect.poll(() => inked(c)).toBeGreaterThan(200);
    }
  });

  test('for |x − y| the triangle is an equality with y between x and z, and strict outside', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-1a');
    const canvas = fig.locator('canvas');
    // x = −1, y = 2.4, z = 2 (the figure does not start at an equality); y is selected
    await expect(fig.locator('[data-readout="triangle"]')).not.toContainText('בשוויון');
    // five steps left: y = 1.9, between x and z
    await press(canvas, 'ArrowLeft', 5);
    await expect(fig.locator('[data-readout="triangle"]')).toContainText('בשוויון');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-1a:equality']).toBeTruthy();
    // two steps right: y = 2.1, past z
    await press(canvas, 'ArrowRight', 2);
    await expect(fig.locator('[data-readout="points"]')).toContainText('y = 2.1');
    await expect(fig.locator('[data-readout="triangle"]')).not.toContainText('בשוויון');
    await expect(fig.locator('[data-readout="triangle"]')).not.toContainText('נכשל');
  });

  test('(x − y)² holds at the start but breaks the triangle at −1, 0.5, 2, which ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-1a');
    await fig.getByRole('button', { name: '(x − y)²', exact: true }).click();
    // at −1, 2.4, 2 the triangle holds: choosing the function alone must not answer the task
    await expect(fig.locator('[data-readout="triangle"]')).not.toContainText('נכשל');
    expect((await progress(page))?.tasks?.['fig-1-1a:break-square']).toBeFalsy();
    // nineteen steps left: y = 0.5, strictly between x and z
    await press(fig.locator('canvas'), 'ArrowLeft', 19);
    await expect(fig.locator('[data-readout="triangle"]')).toContainText('d(x,z) = 9');
    await expect(fig.locator('[data-readout="triangle"]')).toContainText('נכשל');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-1a:break-square']).toBeTruthy();
  });

  test('|x² − y²| gives distance 0 between −1 and 1', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-1a');
    await fig.getByRole('button', { name: '|x² − y²|', exact: true }).click();
    // y = 2.4 → 1: fourteen steps left
    await press(fig.locator('canvas'), 'ArrowLeft', 14);
    await expect(fig.locator('[data-readout="points"]')).toContainText('x = −1, y = 1');
    await expect(fig.locator('[data-readout="zero"]')).toContainText('d(x,y) = 0');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-1a:zero-fail']).toBeTruthy();
  });

  test('the sup distance of sin and cos is √2, at 3π/4, not the gap 1 at the end', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-1b');
    await expect(fig.locator('[data-readout="gap"]')).toContainText('= 1');
    // 3π/4 is position 75 of 100: seven PageUp (ten steps each) and five arrows
    await press(fig.locator('canvas'), 'PageUp', 7);
    await press(fig.locator('canvas'), 'ArrowRight', 5);
    await expect(fig.locator('[data-readout="gap"]')).toContainText('1.41');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-1b:find-sup']).toBeTruthy();
  });

  test('a text step never ticks a task, even one that sets a failing triple', async ({ page }) => {
    await page.goto(LESSON);
    // the Explain steps of 1.1א set |x − y| at −1, 0.5, 2: exactly an equality triple
    for (const step of await page.locator('.step[data-fig="fig-1-1a"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    expect(tasks['fig-1-1a:break-square']).toBeFalsy();
    expect(tasks['fig-1-1a:zero-fail']).toBeFalsy();
    expect(tasks['fig-1-1a:equality']).toBeFalsy();
  });

  test('the Check has its six bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-1.1-axioms', 'Q-1.1-discrete', 'Q-1.1-unbounded', 'Q-1.1-which', 'Q-1.1-sqrt-key', 'Q-1.1-truncate']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-1-1-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });
});
