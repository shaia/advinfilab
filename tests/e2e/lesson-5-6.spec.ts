import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/5-6/';

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

// MeanValue's range inputs (src/sims/MeanValue.tsx). Mode 'real': a₁, a₂, b₁, b₂ (step 0.05 in [−2, 2]).
// Mode 'vector': t₀, t₁ as indices on the curve's grid (the circle: t = k·π/24, k = 0…48; the others:
// t = −1.5 + k/32, k = 0…96).
const ends = (fig: Locator) => {
  const r = fig.locator('input[type=range]');
  return { a1: r.nth(0), a2: r.nth(1), b1: r.nth(2), b2: r.nth(3) };
};
const times = (fig: Locator) => {
  const r = fig.locator('input[type=range]');
  return { k0: r.nth(0), k1: r.nth(1) };
};
const pick = (fig: Locator, formula: string) => fig.getByRole('button', { name: formula, exact: true }).click();

test.describe('lesson 5.6: the mean value theorem in several variables', () => {
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

  test('x³ − y² from (0,0) to (1,1): τ = 2/3 (the Predict), and moving b there ticks cubic-23', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-6a');
    const s = ends(fig);
    await expect(fig.locator('[data-readout="fn"]')).toContainText('x³ − y²');
    await slide(s.b2, 1);
    await expect(fig.locator('[data-readout="tau"]')).toContainText('τ = 0.666667');
    await expect(fig.locator('[data-readout="slope"]')).toContainText('= 0');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-5-6a:cubic-23']).toBeTruthy();
  });

  test('the quadratic: the midpoint τ = 1/2 on a segment of length ≥ 3 ticks quad-long', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-6a');
    const s = ends(fig);
    await pick(fig, 'f = x² − xy + 2y²');
    await slide(s.a1, -1.5);
    await slide(s.a2, -1);
    await slide(s.b1, 1.5);
    await slide(s.b2, 1);
    await expect(fig.locator('[data-readout="tau"]')).toContainText('τ = 0.5,');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-5-6a:quad-long']).toBeTruthy();
  });

  test('sin(2x)·cos(y) from (−2,−2) to (1,1): three mean value points tick wave-three', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-6a');
    const s = ends(fig);
    await pick(fig, 'f = sin(2x)·cos(y)');
    await slide(s.a1, -2);
    await slide(s.a2, -2);
    await slide(s.b1, 1);
    await slide(s.b2, 1);
    await expect(fig.locator('[data-readout="tau"]')).toContainText('3 נקודות');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-5-6a:wave-three']).toBeTruthy();
  });

  test('the half circle: mean speed 2/π ≈ 0.6366 and no common point; the full circle ticks circle-zero', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-6b');
    const t = times(fig);
    await expect(fig.locator('[data-readout="curve"]')).toContainText('[0, π]');
    await expect(fig.locator('[data-readout="ratio"]')).toContainText('0.6366');
    await expect(fig.locator('[data-readout="common"]')).toContainText('אין');
    await slide(t.k1, 48);
    await expect(fig.locator('[data-readout="curve"]')).toContainText('[0, 2π]');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-5-6b:circle-zero']).toBeTruthy();
  });

  test('a short arc of the circle: mean speed ≈ 0.9993 ≥ 0.99 of sup‖γ′‖ = 1 ticks circle-sharp', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-6b');
    const t = times(fig);
    await slide(t.k1, 1);
    await expect(fig.locator('[data-readout="ratio"]')).toContainText('0.9993');
    await expect(fig.locator('[data-readout="ratio"]')).toContainText('sup‖γ′‖ = 1');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-5-6b:circle-sharp']).toBeTruthy();
  });

  test('the cusp (t², t³) on [−1.5, 1.5]: c₁ = 0, c₂ ≈ ±0.866, so the points are 0.866 apart and cusp-apart ticks', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-6b');
    const t = times(fig);
    await pick(fig, 'γ(t) = (t², t³)');
    await slide(t.k0, 0);
    await slide(t.k1, 96);
    await expect(fig.locator('[data-readout="components"]')).toContainText('0.866');
    await expect(fig.locator('[data-readout="common"]')).toContainText('אין');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-5-6b:cusp-apart']).toBeTruthy();
  });

  test('a text step drives the figure: the third step of the vector figure shows the cusp', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-5-6b');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const step = page.locator('.step[data-fig="fig-5-6b"]').nth(2);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="curve"]')).toContainText('(t², t³)');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig="fig-5-6a"], .step[data-fig="fig-5-6b"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const id of ['fig-5-6a:cubic-23', 'fig-5-6a:quad-long', 'fig-5-6a:wave-three', 'fig-5-6b:circle-zero', 'fig-5-6b:circle-sharp', 'fig-5-6b:cusp-apart']) {
      expect(tasks[id]).toBeFalsy();
    }
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-5.6-statement', 'Q-5.6-circle', 'Q-5.6-constant', 'Q-5.6-find', 'Q-5.6-inequality']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-5-6-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors other pages link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['segment', 'mvt', 'mvt-proof', 'quadratic', 'vector', 'inequality', 'lipschitz', 'nonconvex', 'zero-derivative']) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה וטענה|הגדרה|למה|טענה|משפט|מסקנה) 5\.6\.(\d+[א-ת]?)(?: \([^)]*\))?\.$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1]);
    expect(numbers).toEqual(['1', '1א', '2', '2א', '3', '4', '5', '6', '7', '8', '9', '10']);
  });
});
