import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/2-1/';

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

// CauchyTail (tail mode): the first range input is N, the second the index of ε in
// [0.5, 0.3, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.001].
const EPS_001 = 6;

test.describe('lesson 2.1: Cauchy sequences and complete spaces', () => {
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

  test('1/n with ε = 0.1: D_10 = 0.1 is not below ε, D_11 is, and finding N = 11 ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-1a');
    const N = fig.locator('input[type=range]').nth(0);
    await slide(N, 10);
    await expect(fig.locator('[data-readout="D"]')).toContainText('D_N = 0.1');
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('לא');
    await slide(N, 11);
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('כן');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-2-1a:find-N']).toBeTruthy();
  });

  test('the harmonic partial sums have an unbounded tail for every N', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-1a');
    await fig.getByRole('button', { name: 'הטור ההרמוני', exact: true }).click();
    const N = fig.locator('input[type=range]').nth(0);
    for (const v of [5, 20, 45]) {
      await slide(N, v);
      await expect(fig.locator('[data-readout="D"]')).toContainText('D_N = ∞');
    }
    await expect(fig.locator('[data-readout="limit"]')).toContainText('אין גבול');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-2-1a:not-cauchy']).toBeTruthy();
  });

  test('the decimal truncations of √2 in ℚ: a narrow tail and a limit outside the space', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-1a');
    await fig.getByRole('button', { name: 'קטיעות עשרוניות של √2' }).click();
    await fig.getByRole('button', { name: 'ℚ', exact: true }).click();
    const [N, eps] = [fig.locator('input[type=range]').nth(0), fig.locator('input[type=range]').nth(1)];
    await slide(eps, EPS_001);
    await slide(N, 3);
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('כן');
    await expect(fig.locator('[data-readout="limit"]')).toContainText('אינו נמצא במרחב');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-2-1a:missing-limit']).toBeTruthy();
  });

  test('a text step drives the figure: the harmonic step shows D_N = ∞', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-2-1a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    // the third Explore step sets seq: 'harmonic'
    const step = page.locator('.step[data-fig="fig-2-1a"]').nth(2);
    await step.scrollIntoViewIfNeeded();
    await expect(fig.locator('[data-readout="D"]')).toContainText('D_N = ∞');
  });

  test('a text step never ticks a task, even one that sets the figure to the answer', async ({ page }) => {
    await page.goto(LESSON);
    // the second step of 2.1א sets N = 11 on 1/n with ε = 0.1: exactly the find-N answer
    for (const step of await page.locator('.step[data-fig="fig-2-1a"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['find-N', 'not-cauchy', 'bounded-not-cauchy', 'missing-limit']) expect(tasks[`fig-2-1a:${t}`]).toBeFalsy();
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-2.1-def', 'Q-2.1-neg', 'Q-2.1-which-complete', 'Q-2.1-Neps', 'Q-2.1-subseq-proof']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-2-1-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors the misconceptions link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'definition', 'test-spaces', 'equivalent-forms', 'negation', 'smallest-n', 'convergent-cauchy', 'bounded', 'steps',
      'summable', 'subsequence', 'complete', 'real-line', 'euclidean', 'lipschitz-invariance', 'discrete', 'incomplete',
      'not-size', 'arctan',
    ]) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    // every statement opens with a bold label "טענה 2.1.k." or "טענה 2.1.k (name)."; one counter, in order.
    // The summary's labels end in ":" and are not counted.
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה וטענה|הגדרה|למה|טענה|משפט|מסקנה) 2\.1\.(\d+)(?:\.|\s\()/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => Number(m[1]));
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });
});
