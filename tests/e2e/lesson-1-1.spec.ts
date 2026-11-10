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

  test('for |x − y| the triangle is an equality with y between x and z, and strict outside', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-1a');
    const canvas = fig.locator('canvas');
    // x = −1, y = 0.5, z = 2; y is selected: one step right keeps it between
    await press(canvas, 'ArrowRight', 1);
    await expect(fig.locator('[data-readout="triangle"]')).toContainText('בשוויון');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-1a:equality']).toBeTruthy();
    // fifteen more: y = 2.1, past z
    await press(canvas, 'ArrowRight', 15);
    await expect(fig.locator('[data-readout="points"]')).toContainText('y = 2.1');
    await expect(fig.locator('[data-readout="triangle"]')).not.toContainText('בשוויון');
    await expect(fig.locator('[data-readout="triangle"]')).not.toContainText('נכשל');
  });

  test('(x − y)² breaks the triangle at −1, 0.5, 2, and choosing it ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-1a');
    await fig.getByRole('button', { name: '(x − y)²', exact: true }).click();
    await expect(fig.locator('[data-readout="triangle"]')).toContainText('d(x,z) = 9');
    await expect(fig.locator('[data-readout="triangle"]')).toContainText('נכשל');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-1a:break-square']).toBeTruthy();
  });

  test('|x² − y²| gives distance 0 between −1 and 1', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-1a');
    await fig.getByRole('button', { name: '|x² − y²|', exact: true }).click();
    await press(fig.locator('canvas'), 'ArrowRight', 5);
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
    // the second step of 1.1א sets (x − y)² at 0, 1, 2: exactly the break-square answer
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
