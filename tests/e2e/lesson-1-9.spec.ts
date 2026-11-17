import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/1-9/';

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

/** The sliders of OperatorConvergence, in order: k, then ε. */
const kSlider = (fig: Locator) => fig.locator('input[type=range]').nth(0);
const epsSlider = (fig: Locator) => fig.locator('input[type=range]').nth(1);
const task = async (page: Page, id: string) => (await progress(page))?.tasks?.[id];

test.describe('lesson 1.9: convergence of a sequence of linear maps', () => {
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

  test('the triangular sequence enters the ε-ball at k = 6 for ε = 0.2 (‖Aₖ − I‖ = 1/k; k = 5 is a tie, not inside)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-9a');
    await fig.getByRole('button', { name: 'משולשת' }).click();
    await slide(epsSlider(fig), 0.2);
    await slide(kSlider(fig), 5);
    const show = fig.getByRole('button', { name: /הראו את השגיאה/ });
    if ((await show.getAttribute('aria-pressed')) !== 'true') await show.click();
    const err = fig.locator('[data-readout="err"]');
    await expect(err).toContainText('= 0.2;');
    await expect(err).toContainText('יוצאת');
    expect(await task(page, 'fig-1-9a:enter-eps')).toBeFalsy();
    await slide(kSlider(fig), 6);
    await expect(err).toContainText('0.1667');
    await expect(err).toContainText('בתוך');
    await expect.poll(() => task(page, 'fig-1-9a:enter-eps')).toBeTruthy();
  });

  test('the alternating sequence: for odd k, ‖Aₖ‖ = ‖I‖ = 1 while ‖Aₖ − I‖ = 2; for even k the difference is 0', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-9a');
    // an even k first, so that choosing the sequence does not already land on an odd k
    await slide(kSlider(fig), 2);
    await fig.getByRole('button', { name: 'סימן מתחלף' }).click();
    const err = fig.locator('[data-readout="err"]');
    await expect(err).toContainText('= 0;');
    expect(await task(page, 'fig-1-9a:norms-not-maps')).toBeFalsy();
    await slide(kSlider(fig), 3);
    await expect(err).toContainText('= 2;');
    await expect(fig.locator('[data-readout="norms"]')).toContainText('‖Aₖ‖ = 1');
    await expect(fig.locator('[data-readout="norms"]')).toContainText('‖I‖ = 1');
    await expect.poll(() => task(page, 'fig-1-9a:norms-not-maps')).toBeTruthy();
  });

  test('Tₖ√x = 1/√k drops below ε = 0.2 from k = 26 on (k = 25 is a tie)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-9b');
    await fig.getByRole('button', { name: '√x' }).click();
    await slide(epsSlider(fig), 0.2);
    await slide(kSlider(fig), 25);
    const tf = fig.locator('[data-readout="tf"]');
    await expect(tf).toContainText('= 0.2.');
    expect(await task(page, 'fig-1-9b:pointwise-small')).toBeFalsy();
    await slide(kSlider(fig), 26);
    await expect(tf).toContainText('0.1961');
    await expect.poll(() => task(page, 'fig-1-9b:pointwise-small')).toBeTruthy();
  });

  test('the witness gₖ has sup norm 1 and Tₖgₖ = 2, ticked by turning it on with k ≥ 10', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-9b');
    const toggle = fig.getByRole('button', { name: /הראו את פונקציית העד/ });
    // the reset may leave the witness on (if the figure's props turn it on): start from off
    if ((await toggle.getAttribute('aria-pressed')) === 'true') {
      await slide(kSlider(fig), 1);
      await toggle.click();
    }
    await slide(kSlider(fig), 12);
    await expect(fig.locator('[data-readout="witness"]')).toHaveCount(0);
    expect(await task(page, 'fig-1-9b:witness-2')).toBeFalsy();
    await toggle.click();
    const w = fig.locator('[data-readout="witness"]');
    await expect(w).toContainText('‖gₖ‖∞ = 1');
    await expect(w).toContainText('Tₖgₖ = 2');
    await expect.poll(() => task(page, 'fig-1-9b:witness-2')).toBeTruthy();
  });

  test('a text step never ticks a task', async ({ page }) => {
    await page.goto(LESSON);
    for (const fig of ['fig-1-9a', 'fig-1-9b']) {
      for (const step of await page.locator(`.step[data-fig="${fig}"]`).all()) {
        await step.scrollIntoViewIfNeeded();
        await page.waitForTimeout(120);
      }
    }
    await page.waitForTimeout(400);
    for (const id of ['fig-1-9a:enter-eps', 'fig-1-9a:norms-not-maps', 'fig-1-9b:pointwise-small', 'fig-1-9b:witness-2']) {
      expect(await task(page, id)).toBeFalsy();
    }
  });

  test('the reset button brings back the starting k and ε', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['fig-1-9a', 'fig-1-9b']) {
      const fig = await ready(page, id);
      const k = fig.locator('[data-readout="k"]');
      const start = (await k.textContent()) ?? '';
      const startEps = await epsSlider(fig).inputValue();
      await slide(kSlider(fig), 37);
      await slide(epsSlider(fig), 0.85);
      await expect(k).toContainText('k = 37');
      await fig.getByRole('button', { name: 'איפוס' }).click();
      await expect(k).toHaveText(start);
      await expect(epsSlider(fig)).toHaveValue(startEps);
    }
  });
});
