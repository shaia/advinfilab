import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/4-4/';

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

// Separable: in polygon mode the range inputs are ε (first) and m by hand (second); in indicator mode s, t, r
// (src/sims/Separable.tsx).
const ranges = (fig: Locator) => fig.locator('input[type=range]');

test.describe('lesson 4.4: separability', () => {
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

  test('the guaranteed mesh: the wave needs m = 22 at ε = 0.2, √x needs 101 there and 401 at ε = 0.1; comparing ticks the task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-4a');
    await expect(fig.locator('[data-readout="m"]')).toContainText('m = 22');
    await expect(fig.locator('[data-readout="eps"]')).toContainText('Q = 6');
    await fig.getByRole('button', { name: '√x', exact: true }).click();
    await expect(fig.locator('[data-readout="m"]')).toContainText('m = 101');
    // the task needs both functions chosen by the student at one ε (the reset state is not a choice)
    await fig.getByRole('button', { name: '0.5 + 0.35·sin 2πx', exact: true }).click();
    await expect(fig.locator('[data-readout="m"]')).toContainText('m = 22');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-4a:compare']).toBeTruthy();
    await fig.getByRole('button', { name: '√x', exact: true }).click();
    await slide(ranges(fig).first(), 0.1);
    await expect(fig.locator('[data-readout="m"]')).toContainText('m = 401');
    await expect(fig.locator('[data-readout="err"]')).toContainText('< ε');
  });

  test('m by hand: √x at ε = 0.1 stays in the tube with m = 8 (smaller task), |x − ½| leaves it with m = 3 (fail task)', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-4a');
    await fig.getByRole('button', { name: '√x', exact: true }).click();
    await slide(ranges(fig).first(), 0.1);
    await slide(ranges(fig).nth(1), 8);
    await expect(fig.locator('[data-readout="m"]')).toContainText('m = 8');
    await expect(fig.locator('[data-readout="err"]')).toContainText('< ε');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-4a:smaller']).toBeTruthy();
    await fig.getByRole('button', { name: '|x − 1/2|', exact: true }).click();
    await slide(ranges(fig).nth(1), 3);
    await expect(fig.locator('[data-readout="err"]')).toContainText('≥');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-4a:fail']).toBeTruthy();
  });

  test('indicators: distance 1 however close s and t are, disjoint balls up to r = ½, and both tasks tick', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-4-4b');
    const [s, t, r] = [ranges(fig).nth(0), ranges(fig).nth(1), ranges(fig).nth(2)];
    await slide(s, 0.5);
    await slide(t, 0.51);
    await expect(fig.locator('[data-readout="dist"]')).toContainText('= 1');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-4b:close']).toBeTruthy();
    await slide(r, 0.5);
    await expect(fig.locator('[data-readout="balls"]')).toContainText('זרים');
    await slide(r, 0.55);
    await expect(fig.locator('[data-readout="balls"]')).toContainText('נחתכים');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-4-4b:radius']).toBeTruthy();
  });

  test('a text step drives the figure: the second Explore step selects √x at ε = 0.2', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-4-4a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const step = page.locator('.step[data-fig="fig-4-4a"]').nth(1);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="m"]')).toContainText('m = 101');
  });

  test('a text step never ticks a task', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig="fig-4-4a"], .step[data-fig="fig-4-4b"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['fig-4-4a:compare', 'fig-4-4a:smaller', 'fig-4-4a:fail', 'fig-4-4b:radius', 'fig-4-4b:close']) {
      expect(tasks[t]).toBeFalsy();
    }
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-4.4-def', 'Q-4.4-which', 'Q-4.4-radius', 'Q-4.4-intersect', 'Q-4.4-compact']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-4-4-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors other pages link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'definition',
      'test-spaces',
      'polygons',
      'preserved',
      'subspaces',
      'totally-bounded',
      'base',
      'nonseparable',
      'separated',
      'bounded-functions',
      'c-of-k',
    ]) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    const labels = await page.locator('strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה וטענה|הגדרה|למה|טענה|משפט|מסקנה) 4\.4\.(\d+[א-ת]?)(?: \([^)]*\))?\.$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1]);
    expect(numbers).toEqual(['1', '1א', '2', '3', '4', '5', '5א', '6', '7', '8', '9']);
  });
});
