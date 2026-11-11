import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/2-2/';

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

test.describe('lesson 2.2: complete subspaces and spaces of functions', () => {
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

  test('the ramps: the area to the step shrinks like 1/(2n) while the sup distance stays 1, and the student ticks ramp-area', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-2a');
    // fig-2-2a starts on the ramp with the area hidden; the student turns it on
    await fig.getByRole('button', { name: 'השטח בין fₙ לגבול' }).click();
    const n = fig.locator('input[type=range]').nth(0);
    await slide(n, 10);
    await expect(fig.locator('[data-readout="area"]')).toContainText('0.05');
    await expect(fig.locator('[data-readout="sup"]')).toContainText('sup = 1 (לא מתקבל)');
    await slide(n, 20);
    await expect(fig.locator('[data-readout="area"]')).toContainText('0.025');
    await expect(fig.locator('[data-readout="sup"]')).toContainText('sup = 1 (לא מתקבל)');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-2-2a:ramp-area']).toBeTruthy();
  });

  test('a text step drives the second figure: the smoothed corner is at sup distance 1/n', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-2-2b');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    // the step of טענה 2.2.9 sets smooth-abs with n = 10
    await page.locator('#c1-space').click();
    await expect(fig.locator('[data-readout="sup"]')).toContainText('sup = 0.1');
    await expect(fig.locator('[data-readout="n"]')).toContainText('n = 10');
    // the step of the proof of 2.2.7(ב) sets the ramp with n = 40 and the area shown: 1/(2·40)
    await page.locator('#no-continuous-limit').click();
    await expect(fig.locator('[data-readout="area"]')).toContainText('0.0125');
  });

  test('a text step never ticks a task', async ({ page }) => {
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig="fig-2-2a"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    expect(tasks['fig-2-2a:ramp-area']).toBeFalsy();
    expect(tasks['fig-2-2a:smooth-corner']).toBeFalsy();
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-2.2-closed-sub', 'Q-2.2-C-closed', 'Q-2.2-L1-dist', 'Q-2.2-closed-in-Q', 'Q-2.2-complete-closed']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-2-2-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors the misconceptions link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    const anchors = [
      'subspaces',
      'subspace-theorem',
      'counterexample-q',
      'complete-iff-closed',
      'bounded-functions',
      'bx-complete',
      'uniform-limit',
      'cb-closed',
      'ramps',
      'no-continuous-limit',
      'xn-warning',
      'two-norms',
      'c1-space',
      'polynomials',
    ];
    for (const id of anchors) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    // every statement opens with a bold label "משפט 2.2.k." or "משפט 2.2.k (name)."; one counter, in order.
    // The summary's labels end in ":" and are not counted.
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה וטענה|הגדרה|למה|טענה|משפט|מסקנה) 2\.2\.(\d+)(?:\.|\s\()/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => Number(m[1]));
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
