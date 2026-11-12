import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/4-3/';
const FIG = 'fig-4-3a';

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

// Diagonal (src/sims/Diagonal.tsx): the range inputs are, in order, the number of rows and the probe point x.
const rowsSlider = (fig: Locator) => fig.locator('input[type=range]').nth(0);
const xSlider = (fig: Locator) => fig.locator('input[type=range]').nth(1);
const rowButton = (fig: Locator, j: number) => fig.getByRole('button', { name: `S${'₀₁₂₃₄₅₆'[j]}`, exact: true });

test.describe('lesson 4.3: the Arzelà–Ascoli theorem', () => {
  test('the figure draws, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    const c = page.locator('.sim-stage canvas');
    await expect(c).toHaveCount(1);
    await c.scrollIntoViewIfNeeded();
    await expect(c).toHaveCSS('direction', 'ltr');
    await expect.poll(() => inked(c)).toBeGreaterThan(200);
  });

  test('the shifts sin(x + n): six nested rows and the diagonal 4, 5, 10, 11, 17, 23 marked in the table', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page);
    await expect(fig.locator('[data-readout="diag"]')).toContainText('n₆ = 23');
    await expect(fig.locator('[data-readout="table"] tr')).toHaveCount(6);
    await expect(fig.locator('[data-readout="table"] td[data-diag="true"]')).toHaveText(['[4]', '[5]', '[10]', '[11]', '[17]', '[23]']);
    await slide(rowsSlider(fig), 2);
    await expect(fig.locator('[data-readout="table"] tr')).toHaveCount(2);
    await expect(fig.locator('[data-readout="diag"]')).toContainText('n₂ = 5');
  });

  test('the oscillations sin(nx): the diagonal 2, 16, 40, 66, 267, 468; close on D from place 4 on, far apart at x = 0.3, and the tail and gap tasks tick', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page);
    await fig.getByRole('button', { name: 'sin(nx)', exact: true }).click();
    await expect(fig.locator('[data-readout="diag"]')).toContainText('n₆ = 468');
    // place 3 is not the first place from which every circle is filled (g_3 = f_40 leaves the windows of q_4, q_5)
    await rowButton(fig, 3).click();
    await page.waitForTimeout(300);
    expect((await progress(page))?.tasks?.[`${FIG}:tail`]).toBeFalsy();
    await rowButton(fig, 4).click();
    await expect.poll(async () => (await progress(page))?.tasks?.[`${FIG}:tail`]).toBeTruthy();
    await expect(fig.locator('[data-readout="ond"]')).toContainText('0.072');
    await slide(xSlider(fig), 0.3);
    await expect(fig.locator('[data-readout="at-x"]')).toContainText('1.826');
    await expect.poll(async () => (await progress(page))?.tasks?.[`${FIG}:gap`]).toBeTruthy();
  });

  test('choosing row 3 of the shifts ticks the close task (sup spread 0.463 < 0.5), and not the tail task, which is set on sin(nx)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page);
    await rowButton(fig, 3).click();
    await expect(fig.locator('[data-readout="sup"]')).toContainText('0.463');
    await expect.poll(async () => (await progress(page))?.tasks?.[`${FIG}:close`]).toBeTruthy();
    expect((await progress(page))?.tasks?.[`${FIG}:tail`]).toBeFalsy();
  });

  test('the gap task does not tick from row 1 of sin(nx), where the spread is large without any closeness on D', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page);
    await fig.getByRole('button', { name: 'sin(nx)', exact: true }).click();
    await slide(xSlider(fig), 0.9);
    await page.waitForTimeout(300);
    expect((await progress(page))?.tasks?.[`${FIG}:gap`]).toBeFalsy();
  });

  test('a text step drives the figure: the first Explore step shows one row of the shifts', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator(`#${FIG}`);
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const step = page.locator(`.step[data-fig="${FIG}"]`).first();
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="table"] tr')).toHaveCount(1);
    await expect(fig.locator('[data-readout="sizes"]')).toContainText('6676');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator(`.step[data-fig="${FIG}"]`).all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['tail', 'gap', 'close']) expect(tasks[`${FIG}:${t}`]).toBeFalsy();
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-4.3-statement', 'Q-4.3-x-over-n', 'Q-4.3-constants', 'Q-4.3-dense-enough', 'Q-4.3-diagonal-index']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-4-3-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors other pages link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'definitions',
      'relatively-compact',
      'three-forms',
      'countable-dense',
      'pointwise-to-uniform',
      'diagonal',
      'diagonal-why',
      'theorem',
      'corollaries',
      'hypotheses',
      'applications',
    ]) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    // Every statement opens with a bold heading that is the whole label and ends in a period (see lesson-2-3.spec.ts).
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה וטענה|הגדרה|למה|טענה|משפט|מסקנה) 4\.3\.(\d+[א-ת]?)(?: \([^)]*\))?\.$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1]);
    expect(numbers).toEqual(['1', '1א', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
  });
});
