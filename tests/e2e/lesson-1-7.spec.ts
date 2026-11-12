import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/1-7/';

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

test.describe('lesson 1.7: Lipschitz equivalence of metrics', () => {
  test('the figure draws, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    const canvases = page.locator('.sim-stage canvas');
    await expect(canvases).toHaveCount(1);
    const c = canvases.first();
    await c.scrollIntoViewIfNeeded();
    await expect(c).toHaveCSS('direction', 'ltr');
    await expect.poll(() => inked(c)).toBeGreaterThan(200);
  });

  test('a d∞-ball of radius ½ fits in the d₁ unit ball and one of radius 0.55 does not', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-7a');
    const rho = fig.locator('input[type=range]').nth(0);
    // the answer of the open task is hidden: no constant, no largest radius
    await expect(fig.locator('[data-readout="constant"]')).toHaveCount(0);
    await expect(fig.locator('[data-readout="best"]')).not.toContainText('0.5');
    await slide(rho, 0.5);
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('כולו בתוך');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-7a:best-inner']).toBeTruthy();
    // once the task is ticked, the figure states the answer
    await expect(fig.locator('[data-readout="best"]')).toContainText('0.5');
    await slide(rho, 0.55);
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('בולט');
  });

  test('a text step never ticks a task, even one that sets the best radius', async ({ page }) => {
    await page.goto(LESSON);
    // the step after the lemma sets ρ = 1 with outer d∞ and inner d₁: exactly the reverse answer
    for (const step of await page.locator('.step[data-fig="fig-1-7a"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['fig-1-7a:best-inner', 'fig-1-7a:reverse']) expect(tasks[t]).toBeFalsy();
  });

  test('the Check has its six bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-1.7-def', 'Q-1.7-r5', 'Q-1.7-cont', 'Q-1.7-one-side', 'Q-1.7-one-way', 'Q-1.7-bounded-not-enough']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-1-7-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });
});
