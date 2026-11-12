import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/3-5/';

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

// UnitBalls in mode 'equiv' has one range input: the radius r of the Euclidean disc (src/sims/UnitBalls.tsx).
const rOf = (fig: Locator) => fig.locator('input[type=range]').first();

test.describe('lesson 3.5: equivalence of norms', () => {
  test('the figure draws, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    const canvases = page.locator('.sim-stage canvas');
    await expect(canvases).toHaveCount(1);
    const c = canvases.first();
    await c.scrollIntoViewIfNeeded();
    await expect(c).toHaveCSS('direction', 'ltr');
    await expect.poll(() => inked(c)).toBeGreaterThan(200);
  });

  test('hexagon norm: r = 0.70 is the largest disc inside the ball (1/M = 1/√2), and finding it ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-5a');
    await expect(fig.locator('[data-readout="norm"]')).toContainText('max(|x₁|, |x₂|, |x₁ − x₂|)');
    await slide(rOf(fig), 0.71);
    await expect(fig.locator('[data-readout="inner"]')).toContainText('בולט');
    expect((await progress(page))?.tasks?.['fig-3-5a:best-inner']).toBeFalsy();
    await slide(rOf(fig), 0.7);
    await expect(fig.locator('[data-readout="r"]')).toContainText('r = 0.700');
    await expect(fig.locator('[data-readout="inner"]')).toContainText('כולו בתוך');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-5a:best-inner']).toBeTruthy();
  });

  test('the norm ‖(x₁+x₂, 2x₂)‖₂: r = 1.15 is the smallest disc containing the ball (1/m ≈ 1.144), and it ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-5a');
    await fig.getByRole('button', { name: '‖(x₁ + x₂, 2x₂)‖₂' }).click();
    await slide(rOf(fig), 1.14);
    await expect(fig.locator('[data-readout="outer"]')).toContainText('בולט');
    await slide(rOf(fig), 1.15);
    await expect(fig.locator('[data-readout="outer"]')).toContainText('מכיל');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-5a:best-outer']).toBeTruthy();
  });

  test('the outer readout prints b’s distance (1/m, the answer) only once the disc contains b', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-5a');
    await expect(fig.locator('[data-readout="outer"]')).toContainText('בולט');
    await expect(fig.locator('[data-readout="outer"]')).not.toContainText('1.414');
    await slide(rOf(fig), 1.42);
    await expect(fig.locator('[data-readout="outer"]')).toContainText('מכיל');
    await expect(fig.locator('[data-readout="outer"]')).toContainText('1.414');
  });

  test('the best-discs toggle opens only after both tasks; then it reports m ≈ 0.874 and M ≈ 2.288 for ‖(x₁+x₂, 2x₂)‖₂', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-5a');
    await expect(fig.locator('[data-readout="mM"]')).toHaveCount(0);
    await expect(fig.getByRole('button', { name: 'העיגולים הטובים ביותר' })).toHaveCount(0);
    await expect(fig.locator('[data-readout="best-locked"]')).toHaveCount(1);
    // best-inner on the hexagon norm, best-outer on the ellipse norm
    await slide(rOf(fig), 0.71);
    await slide(rOf(fig), 0.7);
    await fig.getByRole('button', { name: '‖(x₁ + x₂, 2x₂)‖₂' }).click();
    await slide(rOf(fig), 1.14);
    await slide(rOf(fig), 1.15);
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-5a:best-inner']).toBeTruthy();
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-3-5a:best-outer']).toBeTruthy();
    await expect(fig.locator('[data-readout="best-locked"]')).toHaveCount(0);
    await fig.getByRole('button', { name: 'העיגולים הטובים ביותר' }).click();
    await expect(fig.locator('[data-readout="mM"]')).toContainText('m ≈ 0.874, M ≈ 2.288');
    await expect(fig.locator('[data-readout="mM"]')).toContainText('1/M ≈ 0.437, 1/m ≈ 1.144');
  });

  test('the 1-norm (a standard norm) does not tick the tasks, even at its best radii', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-3-5a');
    await fig.getByRole('button', { name: '‖x‖₁' }).click();
    await slide(rOf(fig), 0.7);
    await expect(fig.locator('[data-readout="inner"]')).toContainText('כולו בתוך');
    await slide(rOf(fig), 1);
    await expect(fig.locator('[data-readout="outer"]')).toContainText('מכיל');
    const tasks = (await progress(page))?.tasks ?? {};
    expect(tasks['fig-3-5a:best-inner']).toBeFalsy();
    expect(tasks['fig-3-5a:best-outer']).toBeFalsy();
  });

  test('a text step drives the figure: the fourth Explore step shows the ∞-norm with the best discs', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-3-5a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const step = page.locator('.step[data-fig="fig-3-5a"]').nth(3);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="norm"]')).toContainText('‖x‖∞');
    await expect(fig.locator('[data-readout="mM"]')).toContainText('m ≈ 0.707, M ≈ 1.000');
  });

  test('an r left by a text step does not tick a task when the student only clicks a norm', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-3-5a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    // the second Explore step sets the 1-norm and r = 0.70; for the hexagon norm 0.70 is also the best inner radius
    const step = page.locator('.step[data-fig="fig-3-5a"]').nth(1);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="norm"]')).toContainText('‖x‖₁');
    await expect(fig.locator('[data-readout="r"]')).toContainText('r = 0.700');
    await freezeSteps(page);
    await fig.getByRole('button', { name: 'max(|x₁|, |x₂|, |x₁ − x₂|)' }).click();
    await expect(fig.locator('[data-readout="norm"]')).toContainText('max(|x₁|, |x₂|, |x₁ − x₂|)');
    await expect(fig.locator('[data-readout="r"]')).toContainText('r = 0.700');
    await page.waitForTimeout(300);
    expect((await progress(page))?.tasks?.['fig-3-5a:best-inner']).toBeFalsy();
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig="fig-3-5a"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['fig-3-5a:best-inner', 'fig-3-5a:best-outer']) expect(tasks[t]).toBeFalsy();
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-3.5-def', 'Q-3.5-const-num', 'Q-3.5-convergence', 'Q-3.5-same-open', 'Q-3.5-why-sphere']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-3-5-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors other pages link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['definition', 'test-spaces', 'preserved', 'all-norms', 'finite-dim', 'linear-maps', 'sup-vs-integral', 'riesz']) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    // Every statement opens with a bold heading that is the whole label and ends in a period (see lesson-2-3.spec.ts).
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה וטענה|הגדרה|למה|טענה|משפט|מסקנה) 3\.5\.(\d+[א-ת]?)(?: \([^)]*\))?\.$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1]);
    expect(numbers).toEqual(['1', '1א', '1ב', '2', '3', '4', '5', '5א', '6', '7', '8', '9', '9א', '10']);
  });
});
