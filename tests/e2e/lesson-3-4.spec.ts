import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/3-4/';

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

// EpsDelta in mode 'uniform' (src/sims/EpsDelta.tsx): range inputs are a, ε, δ (logarithmic: the input holds log₁₀ δ),
// then c (for the functions on [c, 1]) or W (for x² on [−W, W]).
const aOf = (fig: Locator) => fig.locator('input[type=range]').nth(0);
const logDeltaOf = (fig: Locator) => fig.locator('input[type=range]').nth(2);
const parOf = (fig: Locator) => fig.locator('input[type=range]').nth(3);

test.describe('lesson 3.4: continuous functions on compact sets', () => {
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

  test('1/x on [c, 1], ε = 0.5: the common δ stays hidden until a δ under 1/45 at c = 0.2 ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-4a');
    const uni = fig.locator('[data-readout="uniform"]');
    await expect(fig.locator('[data-readout="domain"]')).toContainText('[0.5, 1]');
    // the readout answers the task, so it shows only the verdict until the task is solved
    await expect(uni).toContainText('יופיע אחרי');
    await expect(uni).not.toContainText('0.167');
    await slide(parOf(fig), 0.2);
    await expect(uni).not.toContainText('0.0222');
    await expect(uni).toContainText('גדול מדי');
    await slide(logDeltaOf(fig), Math.log10(0.02));
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-4a:compact-delta']).toBeTruthy();
    // c²ε/(1 − cε) = 0.02/0.9
    await expect(uni).toContainText('0.0222');
    await expect(uni).toContainText('מתאים לכולן');
  });

  test('c = 0.5 is outside the compact-delta task, whose answer the text gives there', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-4a');
    // at c = 0.5 the common δ is 1/6 (step 1 says so): δ = 0.15 works and is over half of it, but c > 0.3
    await slide(logDeltaOf(fig), Math.log10(0.15));
    await page.waitForTimeout(300);
    expect((await progress(page))?.tasks?.['fig-3-4a:compact-delta']).toBeFalsy();
  });

  test('moving c toward 0 breaks a δ that worked on [0.2, 1]: the lose-delta task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-4a');
    await slide(parOf(fig), 0.2);
    await slide(logDeltaOf(fig), Math.log10(0.02));
    await slide(parOf(fig), 0.1);
    // c = 0.1: 0.005/0.95 ≈ 0.00526 < 0.02
    await expect(fig.locator('[data-readout="uniform"]')).toContainText('5.26·10⁻³');
    await expect(fig.locator('[data-readout="uniform"]')).toContainText('גדול מדי');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-4a:lose-delta']).toBeTruthy();
  });

  test('√x keeps a common δ above ε² as c → 0, and finding it ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-4b');
    await slide(parOf(fig), 0.02);
    await expect(fig.locator('[data-readout="uniform"]')).not.toContainText('0.391');
    await slide(logDeltaOf(fig), Math.log10(0.3));
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-4b:sqrt-keeps']).toBeTruthy();
    // 2ε√c + ε² at ε = 0.5, c = 0.02, shown once the task is solved
    await expect(fig.locator('[data-readout="uniform"]')).toContainText('0.391');
  });

  test('x² on [−W, W]: the common δ at W = 5 is W − √(W² − ε) ≈ 0.0503, and a δ under it ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-4b');
    await fig.getByRole('button', { name: 'x²' }).click();
    await slide(parOf(fig), 5);
    await expect(fig.locator('[data-readout="domain"]')).toContainText('[−5, 5]');
    await expect(fig.locator('[data-readout="uniform"]')).not.toContainText('0.0503');
    await slide(logDeltaOf(fig), Math.log10(0.04));
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-4b:window']).toBeTruthy();
    await expect(fig.locator('[data-readout="uniform"]')).toContainText('0.0503');
  });

  test('a moved point a stays inside the domain when c grows past it', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-4a');
    await slide(parOf(fig), 0.2);
    await slide(aOf(fig), 0.3);
    await slide(parOf(fig), 0.5);
    await expect(fig.locator('[data-readout="a"]')).toContainText('a = 0.5');
  });

  test('a text step drives the figure: the second Explore step sets 1/x on [0.2, 1] with a δ that is too large', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-3-4a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const step = page.locator('.step[data-fig="fig-3-4a"]').nth(1);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="domain"]')).toContainText('[0.2, 1]');
    await expect(fig.locator('[data-readout="uniform"]')).toContainText('גדול מדי');
  });

  test('from a text step, moving c alone never ticks lose-delta: the δ must be one the student chose', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-3-4a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    // the first Explore step sets δ = 0.1 on [0.5, 1], which works there (the common δ is 1/6)
    const step = page.locator('.step[data-fig="fig-3-4a"]').nth(0);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="domain"]')).toContainText('[0.5, 1]');
    await freezeSteps(page);
    await slide(parOf(fig), 0.2);
    await expect(fig.locator('[data-readout="uniform"]')).toContainText('גדול מדי');
    await page.waitForTimeout(300);
    expect((await progress(page))?.tasks?.['fig-3-4a:lose-delta']).toBeFalsy();
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig="fig-3-4a"], .step[data-fig="fig-3-4b"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['fig-3-4a:compact-delta', 'fig-3-4a:lose-delta', 'fig-3-4b:sqrt-keeps', 'fig-3-4b:window']) {
      expect(tasks[t]).toBeFalsy();
    }
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-3.4-image', 'Q-3.4-attains', 'Q-3.4-cantor-statement', 'Q-3.4-sin1x', 'Q-3.4-homeo-circle']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-3-4-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors other pages link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['image', 'not-preserved', 'extreme', 'hypotheses', 'inf-positive', 'cantor', 'cantor-fails', 'extension', 'homeo', 'homeo-fails', 'distance', 'c-of-k']) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    // Every statement opens with a bold heading that is the whole label and ends in a period (model: lesson-2-3.spec).
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה וטענה|הגדרה|למה|טענה|משפט|מסקנה) 3\.4\.(\d+[א-ת]?)(?: \([^)]*\))?\.$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1]);
    expect(numbers).toEqual(['1', '2', '3', '4', '5', '6', '7', '7א', '8', '8א', '9', '10', '11']);
  });
});
