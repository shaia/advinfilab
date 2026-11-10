import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/1-5/';

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

test.describe('lesson 1.5: sequences in a metric space', () => {
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

  test('x/n with ε = 0.1 is outside the tube at n = 10 and inside from n = 11, and finding it ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-5a');
    const n = fig.locator('input[type=range]').nth(0);
    await slide(n, 10);
    await expect(fig.locator('[data-readout="sup"]')).toContainText('0.1');
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('אינה');
    await slide(n, 11);
    await expect(fig.locator('[data-readout="verdict"]')).not.toContainText('אינה');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-5a:find-n']).toBeTruthy();
  });

  test('xⁿ on [0, 1] stays at sup distance 1 from its pointwise limit, however large n is', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-5a');
    await fig.getByRole('button', { name: 'xⁿ על [0, 1]' }).click();
    const n = fig.locator('input[type=range]').nth(0);
    for (const v of [5, 20, 45]) {
      await slide(n, v);
      await expect(fig.locator('[data-readout="sup"]')).toContainText('sup = 1 (לא מתקבל)');
      await expect(fig.locator('[data-readout="verdict"]')).toContainText('אינה');
    }
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-5a:never']).toBeTruthy();
  });

  test('a text step never ticks a task, even one that sets the figure to the answer', async ({ page }) => {
    await page.goto(LESSON);
    // the second step of 1.5א sets n = 11 on x/n with ε = 0.1: exactly the find-n answer
    for (const step of await page.locator('.step[data-fig="fig-1-5a"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    expect((await progress(page))?.tasks?.['fig-1-5a:find-n']).toBeFalsy();
  });

  test('the Check has its six bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-1.5-def', 'Q-1.5-discrete', 'Q-1.5-coord', 'Q-1.5-unique', 'Q-1.5-closed-seq', 'Q-1.5-xn-sup']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-1-5-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors other pages link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['definition', 'unique', 'bounded', 'discrete', 'closed-seq', 'coordinates', 'sup-convergence', 'norms']) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    // every statement opens with a bold label "משפט 1.5.k." or "משפט 1.5.k (name)."; one counter, in order.
    // The summary's labels end in ":" and are not counted.
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה וטענה|הגדרה|למה|טענה|משפט|מסקנה) 1\.5\.(\d+)(?:\.|\s\()/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => Number(m[1]));
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
});
