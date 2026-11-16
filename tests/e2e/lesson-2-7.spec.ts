import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/2-7/';

/** Set a range input as a student would: the value, then an input event. */
const slide = (s: Locator, v: number) =>
  s.evaluate((el: HTMLInputElement, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);

/** Bring the figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page, fig: string) {
  const f = page.locator(`#${fig}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas'));
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

// Oscillation (src/sims/Oscillation.tsx): osc mode has one range input, the index of δ in DELTAS
// [0.5, 0.3, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001]; cone mode has four: m, L, n, x.
const sliders = (fig: Locator) => fig.locator('input[type=range]');

test.describe('lesson 2.7: G_δ sets and nowhere differentiable functions', () => {
  test('both figures draw, in LTR math space', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['fig-2-7a', 'fig-2-7b']) {
      const c = page.locator(`#${id} .sim-stage canvas`);
      await c.scrollIntoViewIfNeeded();
      await expect(c).toHaveCSS('direction', 'ltr');
      await expect.poll(() => inked(c)).toBeGreaterThan(200);
    }
  });

  test('sgn keeps ω = 2 down to δ = 0.01, which ticks the sgn task; sin(1/x) with f(0) = 5 has ω = 6', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-7a');
    await expect(fig.locator('[data-readout="omega"]')).toContainText('= 2');
    await slide(sliders(fig).nth(0), 6);
    await expect(fig.locator('[data-readout="omega"]')).toContainText('= 2');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-2-7a:sgn-two']).toBeTruthy();
    await fig.getByRole('button', { name: 'sin(1/x), f(0) = 5', exact: true }).click();
    await expect(fig.locator('[data-readout="omega"]')).toContainText('= 6');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-2-7a:value-counts']).toBeTruthy();
  });

  test('Thomae at 3/4: ω = 1/3 at δ = 0.1 and 1/4 at δ = 0.05 (task); at 1/√2, ω = 1/41 at δ = 0.001 (task)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-7a');
    await fig.getByRole('button', { name: 'T, a = 3/4', exact: true }).click();
    await slide(sliders(fig).nth(0), 3);
    await expect(fig.locator('[data-readout="omega"]')).toContainText('0.3333');
    await page.waitForTimeout(200);
    expect((await progress(page))?.tasks?.['fig-2-7a:thomae-rat']).toBeFalsy();
    await slide(sliders(fig).nth(0), 4);
    await expect(fig.locator('[data-readout="omega"]')).toContainText('0.25');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-2-7a:thomae-rat']).toBeTruthy();
    await fig.getByRole('button', { name: 'T, a = 1/√2', exact: true }).click();
    await slide(sliders(fig).nth(0), 7);
    await expect(fig.locator('[data-readout="omega"]')).toContainText('0.05882');
    await page.waitForTimeout(200);
    expect((await progress(page))?.tasks?.['fig-2-7a:thomae-irr']).toBeFalsy();
    await slide(sliders(fig).nth(0), 9);
    await expect(fig.locator('[data-readout="omega"]')).toContainText('0.02439');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-2-7a:thomae-irr']).toBeTruthy();
  });

  test('√x: m = 6 is not within r/2, m = 7 is (task); with m = 7, L = 6 > n + M no grid point stays in the cone (task)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-7b');
    await expect(fig.locator('[data-readout="grid"]')).toContainText('x = 0');
    await slide(sliders(fig).nth(0), 6);
    await page.waitForTimeout(200);
    expect((await progress(page))?.tasks?.['fig-2-7b:polyline-close']).toBeFalsy();
    await slide(sliders(fig).nth(0), 7);
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-2-7b:polyline-close']).toBeTruthy();
    await expect(fig.locator('[data-readout="slopes"]')).toContainText('2.646');
    await slide(sliders(fig).nth(1), 5);
    await expect(fig.locator('[data-readout="slopes"]')).toContainText('L אינו גדול');
    await page.waitForTimeout(200);
    expect((await progress(page))?.tasks?.['fig-2-7b:escape']).toBeFalsy();
    await slide(sliders(fig).nth(1), 6);
    await expect(fig.locator('[data-readout="grid"]')).toContainText('אף נקודה');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-2-7b:escape']).toBeTruthy();
    await slide(sliders(fig).nth(1), 120);
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-2-7b:steep-near']).toBeTruthy();
  });

  test('a text step drives the figure: the second Explore step selects sin(1/x) with f(0) = 5', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-2-7a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const step = page.locator('.step[data-fig="fig-2-7a"]').nth(1);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="omega"]')).toContainText('= 6');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig^="fig-2-7"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['sgn-two', 'value-counts', 'thomae-rat', 'thomae-irr']) expect(tasks[`fig-2-7a:${t}`]).toBeFalsy();
    for (const t of ['polyline-close', 'steep-near', 'escape']) expect(tasks[`fig-2-7b:${t}`]).toBeFalsy();
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-2.7-gdelta-def', 'Q-2.7-osc-sign', 'Q-2.7-osc-open', 'Q-2.7-baire1-xn', 'Q-2.7-En-range']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-2-7-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors other pages link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'gdelta',
      'gdelta-props',
      'closed-gdelta',
      'gdelta-examples',
      'dense-gdelta',
      'q-not-gdelta',
      'residual',
      'oscillation',
      'osc-open',
      'continuity-set',
      'continuity-set-theorem',
      'thomae',
      'no-rational-continuity',
      'baire-one',
      'baire-one-hypotheses',
      'baire-one-completeness',
      'En',
      'En-derivative',
      'En-closed',
      'sawtooth',
      'nowhere-differentiable',
      'residual-meaning',
      'c1-counterexample',
    ]) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה וטענה|הגדרה|למה|טענה|משפט|מסקנה) 2\.7\.(\d+[א-ת]?)(?: \([^)]*\))?\.$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1]);
    expect(numbers).toEqual(Array.from({ length: 22 }, (_, i) => String(i + 1)));
  });
});
