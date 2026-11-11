import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/2-3/';

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

// Contraction: the first range input is x₀, the second is n (src/sims/Contraction.tsx).
const x0Of = (fig: Locator) => fig.locator('input[type=range]').nth(0);
const nOf = (fig: Locator) => fig.locator('input[type=range]').nth(1);

test.describe('lesson 2.3: the Banach fixed point theorem', () => {
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

  test('cos from x₀ = 0.7: the a-priori bound drops below 10⁻³ first at n = 35, and finding it ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-3a');
    await fig.getByRole('button', { name: 'חסמי שגיאה' }).click();
    await slide(x0Of(fig), 0.7);
    await slide(nOf(fig), 34);
    await expect(fig.locator('[data-readout="bound-prior"]')).toContainText('1.156·10⁻³');
    await slide(nOf(fig), 35);
    await expect(fig.locator('[data-readout="bound-prior"]')).toContainText('9.73·10⁻⁴');
    await expect(fig.locator('[data-readout="fixed"]')).toContainText('0.739085');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-2-3a:reach-tol']).toBeTruthy();
  });

  test('x + 1/x on [1, ∞) has no fixed point and no q < 1, and running it ticks the escape task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-3b');
    await fig.getByRole('button', { name: 'x + 1/x, [1, ∞)' }).click();
    await fig.getByRole('button', { name: 'חסמי שגיאה' }).click();
    await slide(nOf(fig), 20);
    await expect(fig.locator('[data-readout="fixed"]')).toContainText('אין נקודת שבת');
    await expect(fig.locator('[data-readout="no-q"]')).toBeVisible();
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-2-3b:escape']).toBeTruthy();
  });

  test('x/2 + 1 on [0, 1] leaves X at the second step', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-3b');
    await fig.getByRole('button', { name: 'x/2 + 1, [0, 1]' }).click();
    await slide(nOf(fig), 2);
    await expect(fig.locator('[data-readout="escape"]')).toContainText('יצאה');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-2-3b:leave']).toBeTruthy();
  });

  test('a text step drives the figure: the second Explore step sets n = 20 on cos from x₀ = 0', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-2-3a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const step = page.locator('.step[data-fig="fig-2-3a"]').nth(1);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="n"]')).toContainText('n = 20');
    await expect(fig.locator('[data-readout="xn"]')).toContainText('0.738938');
  });

  test('a text step never ticks a task', async ({ page }) => {
    // the lesson has two figures with many steps; scrolling through all of them outlasts the default 30 s
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig="fig-2-3a"], .step[data-fig="fig-2-3b"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['fig-2-3a:reach-tol', 'fig-2-3a:any-start', 'fig-2-3b:hole', 'fig-2-3b:escape', 'fig-2-3b:leave']) {
      expect(tasks[t]).toBeFalsy();
    }
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-2.3-def', 'Q-2.3-statement', 'Q-2.3-start', 'Q-2.3-q', 'Q-2.3-shrink']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-2-3-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors other pages link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'definition',
      'test-spaces',
      'unique',
      'banach',
      'iterates',
      'error-bounds',
      'images',
      'hypotheses',
      'shrinking',
      'self-map',
      'derivative-test',
      'iterate-contraction',
      'volterra',
    ]) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    // Every statement opens with a bold heading that is the whole label and ends in a period: "טענה 2.3.k." or
    // "משפט 2.3.k (name)." or a suffixed "טענה 2.3.kא (name).". The summary's labels end in ":" and a bold phrase
    // that merely cites a number ("משפט 2.3.4 הוא המנוע …:") does not end in "." right after the label, so neither
    // matches. One counter, in order, suffixes included.
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה וטענה|הגדרה|למה|טענה|משפט|מסקנה) 2\.3\.(\d+[א-ת]?)(?: \([^)]*\))?\.$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1]);
    expect(numbers).toEqual(['1', '1א', '2', '3', '4', '4א', '5', '6', '6א', '7', '7א', '7ב']);
  });
});
