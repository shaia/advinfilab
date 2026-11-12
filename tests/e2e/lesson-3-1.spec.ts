import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/3-1/';

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

// BolzanoBox: the first range input is the index into N_CHOICES = [50, 200, 1000, 5000, 20000], the second the depth
// (src/sims/BolzanoBox.tsx, src/math/bolzano.ts).
const nOf = (fig: Locator) => fig.locator('input[type=range]').nth(0);
const depthOf = (fig: Locator) => fig.locator('input[type=range]').nth(1);

test.describe('lesson 3.1: sequential compactness', () => {
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

  test('four corners, 1000 terms, three halvings: n₁, n₂, n₃ = 3, 7, 11 and Q₃ has side 0.25', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-1a');
    await slide(depthOf(fig), 3);
    await expect(fig.locator('[data-readout="picks"]')).toContainText('3, 7, 11');
    await expect(fig.locator('[data-readout="side"]')).toContainText('0.25');
    await expect(fig.locator('[data-readout="gap"]')).toContainText('0.02597');
  });

  test('the irrational spread reaches a square of side 1/32 < 0.05 with 1000 terms, and that ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-1a');
    await fig.getByRole('button', { name: 'פיזור אי-רציונלי' }).click();
    await slide(depthOf(fig), 6);
    await expect(fig.locator('[data-readout="picks"]')).toContainText('3, 10, 51, 290, 529, 570');
    await expect(fig.locator('[data-readout="side"]')).toContainText('0.03125');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-1a:small-square']).toBeTruthy();
    // one more halving: the 1000 drawn terms are used up, and the figure says so
    await slide(depthOf(fig), 7);
    await expect(fig.locator('[data-readout="ran-out"]')).toBeVisible();
  });

  test('the unbounded sequence has no starting square, drawing 200 terms of it ticks the task, and only then the readout says so', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-1a');
    await slide(nOf(fig), 0);
    await fig.getByRole('button', { name: 'סדרה לא חסומה' }).click();
    // 50 terms: the task is open, and the readout gives the distance but not the answer
    await expect(fig.locator('[data-readout="escape"]')).toContainText('50/20 = 2.5');
    await expect(fig.locator('[data-readout="escape-verdict"]')).toHaveCount(0);
    await slide(nOf(fig), 1);
    await expect(fig.locator('[data-readout="escape"]')).toContainText('200/20 = 10');
    await expect(fig.locator('[data-readout="picks"]')).toHaveCount(0);
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-1a:escape']).toBeTruthy();
    await expect(fig.locator('[data-readout="escape-verdict"]')).toBeVisible();
  });

  test('in the discrete metric the last two picked terms are at distance 1, and switching it on ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-1a');
    await slide(depthOf(fig), 3);
    await fig.getByRole('button', { name: 'מטריקה בדידה' }).click();
    await expect(fig.locator('[data-readout="gap"]')).toContainText('d(x₇, x₁₁) = 1');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-1a:discrete']).toBeTruthy();
  });

  test('a text step drives the figure: the third Explore step shows three halvings of the four corners', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-3-1a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const step = page.locator('.step[data-fig="fig-3-1a"]').nth(2);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="depth"]')).toContainText('j = 3');
    await expect(fig.locator('[data-readout="picks"]')).toContainText('3, 7, 11');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig="fig-3-1a"], .step[data-fig="fig-3-1b"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['fig-3-1a:small-square', 'fig-3-1a:escape', 'fig-3-1a:discrete']) expect(tasks[t]).toBeFalsy();
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-3.1-def', 'Q-3.1-negate', 'Q-3.1-which', 'Q-3.1-closed-proof', 'Q-3.1-discrete']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-3-1-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors other pages link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'definition',
      'negation',
      'intrinsic',
      'test-spaces',
      'separated',
      'closed-bounded',
      'operations',
      'bolzano',
      'separate-subsequences',
      'quartering',
      'heine-borel',
      'not-compact',
      'tents',
      'complete',
      'cantor',
      'product',
    ]) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    // Every statement opens with a bold heading that is the whole label and ends in a period ("משפט 3.1.7 (name)."). The
    // summary's labels end in ":" and do not match. One counter, in order.
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה וטענה|הגדרה|למה|טענה|משפט|מסקנה) 3\.1\.(\d+[א-ת]?)(?: \([^)]*\))?\.$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1]);
    expect(numbers).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
  });
});
