import { expect, test } from '@playwright/test';
import { hydrated, inked } from './helpers';

const LESSON = '/lessons/2-6/';
const FIG = 'fig-2-6a';

test.describe('lesson 2.6: the completion of a metric space', () => {
  test('the CauchyTail figure draws, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    const canvases = page.locator(`#${FIG} .sim-stage canvas`);
    await expect(canvases.first()).toBeVisible();
    const c = canvases.first();
    await c.scrollIntoViewIfNeeded();
    await hydrated(c);
    await expect(c).toHaveCSS('direction', 'ltr');
    await expect.poll(() => inked(c)).toBeGreaterThan(200);
  });

  test('a text step drives the figure: √2 compared with Newton in ℚ, then 1/n in (0, 1)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator(`#${FIG}`);
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas').first());
    const steps = page.locator(`.step[data-fig="${FIG}"]`);
    // Explore step 2 sets sqrt2-dec with compare: 'newton' (the |x_N − y_N| readout appears);
    // Explore step 3 sets inv-n in open01 with N = 10 and no comparison (its limit 0 is not in the space).
    await steps.nth(1).click();
    await expect(fig.locator('[data-readout="gap"]')).toHaveCount(1);
    await steps.nth(2).click();
    await expect(fig.locator('[data-readout="gap"]')).toHaveCount(0);
    await expect(fig.locator('[data-readout="N"]')).toContainText('N = 10');
    await expect(fig.locator('[data-readout="limit"]')).toContainText('אינו נמצא במרחב');
  });

  test('the Check has its five bank questions, and the six worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-2.6-def', 'Q-2.6-identify', 'Q-2.6-equiv-relation', 'Q-2.6-metric-value', 'Q-2.6-closure']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-2-6-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors the misconceptions link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'definition',
      'isometry-tests',
      'def-completion',
      'depends-on-metric',
      'construction',
      'equivalence',
      'well-defined',
      'not-reals',
      'uniqueness',
      'uniqueness-cor',
    ]) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    // every statement opens with a bold label "טענה 2.6.k." or "טענה 2.6.k (name)."; one counter, in order.
    // The summary's labels end in ":" and are not counted.
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה וטענה|הגדרה|למה|טענה|משפט|מסקנה) 2\.6\.(\d+)(?:\.|\s\()/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => Number(m[1]));
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
});
