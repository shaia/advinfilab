import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/1-6/';

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

test.describe('lesson 1.6: continuity between metric spaces', () => {
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

  test('for x² at a = 1 and ε = 0.5, δ = 0.3 fails; the largest δ stays hidden until a fitting δ at a = 2 ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-6a');
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('אינו מתאים');
    // δ*(1, 0.5) = √1.5 − 1 ≈ 0.225 answers the open task, so it is not printed
    await expect(fig.locator('[data-readout="best"]')).not.toContainText('0.225');
    const [a, , delta] = [0, 1, 2].map((i) => fig.locator('input[type=range]').nth(i));
    await slide(a, 2);
    await expect(fig.locator('[data-readout="best"]')).not.toContainText('0.121');
    await slide(delta, 0.1);
    await expect(fig.locator('[data-readout="verdict"]')).not.toContainText('אינו');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-6a:find-delta']).toBeTruthy();
    // δ*(2, 0.5) = √4.5 − 2 ≈ 0.121, shown once the task is ticked
    await expect(fig.locator('[data-readout="best"]')).toContainText('0.121');
  });

  test('the jump at 0 has no δ at all, however small', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-6a');
    await fig.getByRole('button', { name: 'קפיצה ב-0' }).click();
    const [a, , delta] = [0, 1, 2].map((i) => fig.locator('input[type=range]').nth(i));
    await slide(a, 0);
    for (const v of [0.3, 0.1, 0.02]) {
      await slide(delta, v);
      await expect(fig.locator('[data-readout="verdict"]')).toContainText('אינו מתאים');
    }
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-6a:no-delta']).toBeTruthy();
    await expect(fig.locator('[data-readout="best"]')).toContainText('אין אף δ');
  });

  test('a text step never ticks a task', async ({ page }) => {
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig="fig-1-6a"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['fig-1-6a:find-delta', 'fig-1-6a:no-delta', 'fig-1-6a:not-uniform', 'fig-1-6a:uniform-sqrt'])
      expect(tasks[t]).toBeFalsy();
  });

  test('the Check has its seven bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-1.6-epsdelta', 'Q-1.6-preimage', 'Q-1.6-lipconst', 'Q-1.6-closed-ball', 'Q-1.6-x2', 'Q-1.6-eval', 'Q-1.6-closed-dist']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-1-6-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });
});
