import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/2-5/';
const FIG = 'fig-2-5a';

/** Set a range input as a student would: the value, then an input event. */
const slide = (s: Locator, v: number) =>
  s.evaluate((el: HTMLInputElement, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);

/** Bring the figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page) {
  const f = page.locator(`#${FIG}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas'));
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

test.describe("lesson 2.5: Cantor's intersection theorem and Baire's theorem", () => {
  test('the nested-sets figure draws, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    const canvases = page.locator('.sim-stage canvas');
    await expect(canvases).toHaveCount(1);
    const c = canvases.first();
    await c.scrollIntoViewIfNeeded();
    await expect(c).toHaveCSS('direction', 'ltr');
    await expect.poll(() => inked(c)).toBeGreaterThan(200);
  });

  test('bisection for √2 shrinks to a point in ℝ, and the student reaching k ≥ 10 ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page);
    // the Spread starts at nest bisect, space ℝ, k = 3: diam F_3 = 2^{-2} = 0.25
    await expect(fig.locator('[data-readout="diam"]')).toContainText('0.25');
    await expect(fig.locator('[data-readout="intersection"]')).toContainText('√2');
    await slide(fig.locator('input[type=range]').first(), 10);
    await expect(fig.locator('[data-readout="k"]')).toContainText('k = 10');
    await expect.poll(async () => (await progress(page))?.tasks?.[`${FIG}:shrink-to-point`]).toBeTruthy();
  });

  test('the rays [j, ∞) have infinite diameter and an empty intersection', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page);
    await fig.getByRole('button', { name: '[j, ∞)' }).click();
    await slide(fig.locator('input[type=range]').first(), 10);
    await expect(fig.locator('[data-readout="diam"]')).toContainText('∞');
    await expect(fig.locator('[data-readout="intersection"]')).toContainText('ריק');
    await expect.poll(async () => (await progress(page))?.tasks?.[`${FIG}:unbounded`]).toBeTruthy();
  });

  test('a text step drives the readout, and never ticks a task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator(`#${FIG}`);
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    // the fourth Explore step sets the rays [j, ∞): the diameter readout becomes ∞
    const steps = page.locator(`.step[data-fig="${FIG}"]`);
    const rays = steps.nth(3);
    await rays.scrollIntoViewIfNeeded();
    await rays.click();
    await expect(fig.locator('[data-readout="diam"]')).toContainText('∞');
    // the second Explore step sets bisection in ℚ: the point √2 is missing from the space
    const inQ = steps.nth(1);
    await inQ.scrollIntoViewIfNeeded();
    await inQ.click();
    await expect(fig.locator('[data-readout="intersection"]')).toContainText('אינה במרחב');
    // walking through every step (some set k = 8) must not tick any task
    for (const step of await steps.all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['shrink-to-point', 'lost-point', 'not-closed', 'unbounded']) expect(tasks[`${FIG}:${t}`]).toBeFalsy();
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-2.5-diam', 'Q-2.5-cantor-statement', 'Q-2.5-open-sets', 'Q-2.5-nd-def', 'Q-2.5-nd-discrete']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-2-5-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors the misconceptions link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'diameter',
      'cantor',
      'cantor-hypotheses',
      'converse',
      'nested-balls',
      'nowhere-dense',
      'nd-forms',
      'nd-test-spaces',
      'baire',
      'baire-hypotheses',
      'uncountable',
    ]) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    // one counter: "טענה 2.5.k." or "משפט 2.5.k (name)."; suffixed numbers (2.5.4א, 2.5.9א) and the summary's
    // labels (ending in ":") are not counted.
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה וטענה|הגדרה|למה|טענה|משפט|מסקנה) 2\.5\.(\d+)(?:\.|\s\()/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => Number(m[1]));
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});
