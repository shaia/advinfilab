import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/1-8/';

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

/** Turn x with the keyboard: an arrow turns it by 1°, with Shift by 10°. */
async function turn(canvas: Locator, degrees: number) {
  await canvas.focus();
  for (let i = 0; i < Math.floor(degrees / 10); i++) await canvas.press('Shift+ArrowRight');
  for (let i = 0; i < degrees % 10; i++) await canvas.press('ArrowRight');
}

test.describe('lesson 1.8: bounded linear maps and the operator norm', () => {
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

  test('the triangular matrix stretches most near 58° by the golden ratio, and finding it ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-8a');
    await expect(fig.locator('[data-readout="norm"]')).toContainText('1.618');
    await expect(fig.locator('[data-readout="norm"]')).toContainText('יש כיוון');
    await turn(fig.locator('canvas'), 58);
    await expect(fig.locator('[data-readout="x"]')).toContainText('1.618');
    await expect(fig.locator('[data-readout="norm"]')).toContainText('הכי הרבה');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-8a:stretch-2']).toBeTruthy();
  });

  test('(1 2; 3 4) in the ∞-norm reaches 7 at the corner (1,1), and the three norms read 6, 5.465, 7', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-8a');
    await fig.getByRole('button', { name: 'p = ∞' }).click();
    await fig.getByRole('button', { name: 'כללית' }).click();
    await expect(fig.locator('[data-readout="norms"]')).toContainText('p = 1: 6');
    await expect(fig.locator('[data-readout="norms"]')).toContainText('p = 2: 5.465');
    await expect(fig.locator('[data-readout="norms"]')).toContainText('p = ∞: 7');
    await turn(fig.locator('canvas'), 45);
    await expect(fig.locator('[data-readout="x"]')).toContainText('‖Ax‖ = 7');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-8a:stretch-inf']).toBeTruthy();
  });

  test('editing an entry so that the 1- and ∞-norms differ ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-8a');
    // sliders: the direction of x, then the entries a11, a12, a21, a22; a11 = 2 gives (2 1; 0 1): columns 2, 2; rows 3, 1
    await slide(fig.locator('input[type=range]').nth(1), 2);
    await expect(fig.locator('[data-readout="norms"]')).toContainText('p = 1: 2');
    await expect(fig.locator('[data-readout="norms"]')).toContainText('p = ∞: 3');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-8a:differ']).toBeTruthy();
  });

  test('a text step never ticks a task, even one that sets x to the maximising direction', async ({ page }) => {
    await page.goto(LESSON);
    // the second step of 1.8א sets the triangular matrix with x at 58°: exactly the stretch-2 answer
    for (const step of await page.locator('.step[data-fig="fig-1-8a"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    expect((await progress(page))?.tasks?.['fig-1-8a:stretch-2']).toBeFalsy();
    expect((await progress(page))?.tasks?.['fig-1-8a:stretch-inf']).toBeFalsy();
  });

  test('the Check has its six bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-1.8-bounded-def', 'Q-1.8-norm-inf', 'Q-1.8-norm-1', 'Q-1.8-cont-zero', 'Q-1.8-lin-cont', 'Q-1.8-deriv']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-1-8-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });
});
