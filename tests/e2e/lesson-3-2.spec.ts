import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/3-2/';

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

// CoverGame (src/sims/CoverGame.tsx): in a prefix preset the first range input is N; in `blocks` with the probe on the
// range inputs are x, then δ.
const ranges = (fig: Locator) => fig.locator('input[type=range]');

test.describe('lesson 3.2: open covers and the Heine–Borel theorem', () => {
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

  test('U₂ … U_N cover [0.03, 0.97] first at N = 34, and finding it ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-2a');
    await slide(ranges(fig).nth(0), 33);
    await expect(fig.locator('[data-readout="covers"]')).toContainText('[0.03, 1/33]');
    await slide(ranges(fig).nth(0), 34);
    await expect(fig.locator('[data-readout="covers"]')).toContainText('הן מכסות');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-2a:inner-min']).toBeTruthy();
  });

  test('(0, 1) with U₂ … U₂₀₀ leaves (0, 0.005] uncovered, and moving N to 200 ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-2a');
    await fig.getByRole('button', { name: /^\(0, 1\):/ }).click();
    await slide(ranges(fig).nth(0), 200);
    await expect(fig.locator('[data-readout="covers"]')).toContainText('(0, 0.005]');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-2a:open-gap']).toBeTruthy();
  });

  test('K = {0} ∪ {1/n}: V₀, V₁, …, V₆ cover, V₀ … V₅ miss 1/6', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-2a');
    await fig.getByRole('button', { name: /^K = \{0\}/ }).click();
    await slide(ranges(fig).nth(0), 5);
    await expect(fig.locator('[data-readout="covers"]')).toContainText('1/6');
    await slide(ranges(fig).nth(0), 6);
    await expect(fig.locator('[data-readout="covers"]')).toContainText('הן מכסות');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-2a:K-min']).toBeTruthy();
  });

  test('blocks: W₁, W₂, W₃ is the fewest subcover; with all five the largest Lebesgue number is 0.125', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-2b');
    // with all five chosen and the Lebesgue readout off, moving δ to 0.125 ticks the task
    await slide(ranges(fig).nth(0), 0.425);
    await slide(ranges(fig).nth(1), 0.13);
    await expect(fig.locator('[data-readout="probe"]')).toContainText('אינו מוכל');
    await slide(ranges(fig).nth(1), 0.125);
    await expect(fig.locator('[data-readout="probe"]')).toContainText('⊆');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-2b:lebesgue']).toBeTruthy();
    await fig.getByRole('button', { name: 'מספר לבג' }).click();
    await expect(fig.locator('[data-readout="lebesgue"]')).toContainText('0.125');
    // drop W₄ and W₅: still a cover, with three sets
    await fig.getByRole('button', { name: 'W₄ = (0.15, 0.55)' }).click();
    await fig.getByRole('button', { name: 'W₅ = (0.45, 0.85)' }).click();
    await expect(fig.locator('[data-readout="covers"]')).toContainText('הן מכסות');
    await expect(fig.locator('[data-readout="lebesgue"]')).toContainText('0.05');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-2b:fewest']).toBeTruthy();
  });

  test('a text step drives the figure: the second Explore step shows (0, 1) with N = 20', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-3-2a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const step = page.locator('.step[data-fig="fig-3-2a"]').nth(1);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="set"]')).toContainText('(0, 1)');
    await expect(fig.locator('[data-readout="covers"]')).toContainText('(0, 0.05]');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig="fig-3-2a"], .step[data-fig="fig-3-2b"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['fig-3-2a:inner-min', 'fig-3-2a:open-gap', 'fig-3-2a:K-min', 'fig-3-2b:fewest', 'fig-3-2b:lebesgue']) {
      expect(tasks[t]).toBeFalsy();
    }
  });

  test('a step that sets the subcover W₁, W₂, W₃, then the student dragging x, does not tick `fewest`', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-3-2b');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    // the step of theorem 3.2.10 (⇐) sets picks [1, 2, 3]
    const step = page.locator('.step[data-fig="fig-3-2b"]').nth(4);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="count"]')).toContainText('W₁, W₂, W₃');
    await freezeSteps(page);
    await slide(ranges(fig).nth(0), 0.2);
    await slide(ranges(fig).nth(1), 0.07);
    await expect(fig.locator('[data-readout="probe"]')).toContainText('B(0.2, 0.07)');
    await page.waitForTimeout(300);
    expect((await progress(page))?.tasks?.['fig-3-2b:fewest']).toBeFalsy();
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-3.2-def', 'Q-3.2-open-interval', 'Q-3.2-lebesgue-num', 'Q-3.2-hb-apply', 'Q-3.2-fip-def']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-3-2-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors other pages link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'covers',
      'why-open',
      'intrinsic',
      'examples',
      'closed-bounded',
      'lebesgue',
      'finite-balls',
      'equivalence',
      'heine-borel',
      'interval',
      'applications',
      'fip',
      'nested',
    ]) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.replace(/\s+/g, ' ').trim().match(/^(?:הגדרה וטענה|הגדרה|למה|טענה|משפט|מסקנה) 3\.2\.(\d+[א-ת]?)(?: \(.*\))?\.$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1]);
    expect(numbers).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '11א', '11ב', '12', '13', '14']);
  });
});
