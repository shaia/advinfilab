import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/5-4/';

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

// GradientField's range inputs, in order (src/sims/GradientField.tsx): the direction of v in degrees, then a₁ and a₂.
const sliders = (fig: Locator) => {
  const r = fig.locator('input[type=range]');
  return { deg: r.nth(0), a1: r.nth(1), a2: r.nth(2) };
};
const preset = (fig: Locator, formula: string) => fig.getByRole('button', { name: formula, exact: true }).click();
const task = async (page: Page, id: string) => (await progress(page))?.tasks?.[id];

test.describe('lesson 5.4: the sufficient condition and the gradient', () => {
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

  test('x² + 4y² at (2,1): ∇f = (4,8); 63° is the steepest direction and 153° is tangent to the ellipse', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-4a');
    const s = sliders(fig);
    await expect(fig.locator('[data-readout="grad"]')).toContainText('∇f(a) = (4, 8)');
    await expect(fig.locator('[data-readout="grad"]')).toContainText('8.944');
    await slide(s.deg, 30);
    await page.waitForTimeout(200);
    expect(await task(page, 'fig-5-4a:steepest')).toBeFalsy();
    await slide(s.deg, 63);
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('העלייה המהירה ביותר');
    await expect.poll(() => task(page, 'fig-5-4a:steepest')).toBeTruthy();
    await slide(s.deg, 153);
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('המשיק לקו הגובה');
    await expect.poll(() => task(page, 'fig-5-4a:level')).toBeTruthy();
  });

  test('xy at (4,3): the maximal rate is 5, at 53°, and it ticks rate-5', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-4a');
    const s = sliders(fig);
    await preset(fig, 'f = xy');
    await slide(s.a1, 4);
    await slide(s.a2, 3);
    await expect(fig.locator('[data-readout="grad"]')).toContainText('∇f(a) = (3, 4)');
    await expect(fig.locator('[data-readout="grad"]')).toContainText('‖∇f(a)‖₂ = 5');
    await slide(s.deg, 53);
    await expect(fig.locator('[data-readout="rate"]')).toContainText('D_v f(a) = ∇f(a)·v = 5');
    await expect.poll(() => task(page, 'fig-5-4a:rate-5')).toBeTruthy();
  });

  test('x² − y² at the origin: the gradient vanishes, every rate is 0, and it ticks zero-grad', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-4a');
    const s = sliders(fig);
    await preset(fig, 'f = x² − y²');
    await slide(s.a1, 0);
    await page.waitForTimeout(200);
    expect(await task(page, 'fig-5-4a:zero-grad')).toBeFalsy();
    await slide(s.a2, 0);
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('הגרדיאנט מתאפס');
    await expect(fig.locator('[data-readout="rate"]')).toContainText('D_v f(a) = ∇f(a)·v = 0');
    await expect.poll(() => task(page, 'fig-5-4a:zero-grad')).toBeTruthy();
  });

  test('the second figure: descent at 233° for xy at (4,3), and a tangent direction on y − sin x', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-5-4b');
    const s = sliders(fig);
    await slide(s.deg, 233);
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('הירידה המהירה ביותר');
    await expect.poll(() => task(page, 'fig-5-4b:descent')).toBeTruthy();
    await preset(fig, 'f = y − sin x');
    // at (4,3) the gradient is (−cos 4, 1) ≈ (0.6536, 1), at 56.8°; 147° is orthogonal to it within 3°
    await expect(fig.locator('[data-readout="grad"]')).toContainText('(0.6536, 1)');
    await slide(s.deg, 147);
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('המשיק לקו הגובה');
    await expect.poll(() => task(page, 'fig-5-4b:wave-level')).toBeTruthy();
  });

  test('a text step drives the figure: the second Explore step turns v to 120°', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-5-4a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const step = page.locator('.step[data-fig="fig-5-4a"]').nth(1);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="rate"]')).toContainText('120°');
    await expect(fig.locator('[data-readout="point"]')).toContainText('f = x² + 4y²');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig="fig-5-4a"], .step[data-fig="fig-5-4b"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['fig-5-4a:steepest', 'fig-5-4a:level', 'fig-5-4a:rate-5', 'fig-5-4a:zero-grad', 'fig-5-4b:descent', 'fig-5-4b:wave-level']) {
      expect(tasks[t]).toBeFalsy();
    }
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-5.4-c1', 'Q-5.4-converse', 'Q-5.4-descent', 'Q-5.4-orthogonal', 'Q-5.4-plane']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-5-4-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors other pages link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['sufficient', 'not-c1', 'gradient', 'steepest', 'test-spaces', 'orthogonal', 'tangent-plane', 'level-plane', 'cone']) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה וטענה|הגדרה|למה|טענה|משפט|מסקנה) 5\.4\.(\d+[א-ת]?)(?: \([^)]*\))?\.$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1]);
    expect(numbers).toEqual(['1', '2', '3', '4', '5', '6', '6א', '7', '8', '9', '10', '11']);
  });
});
