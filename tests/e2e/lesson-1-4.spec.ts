import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/1-4/';

/** Bring a figure into view, wait for its island, stop text steps from driving it, and reset it. */
async function ready(page: Page, fig: string) {
  const f = page.locator(`#${fig}`);
  await f.scrollIntoViewIfNeeded();
  await hydrated(f.locator('canvas'));
  await freezeSteps(page);
  await f.getByRole('button', { name: 'איפוס' }).click();
  return f;
}

/** Move the probe with the keyboard: the canvas takes arrow keys in steps of 0.05. */
async function press(canvas: Locator, key: string, times: number) {
  await canvas.focus();
  // focus once, then raw keys: locator.press re-runs its actionability checks on every call, which under a loaded
  // suite cost ~200 ms a key and timed out a 75-key walk
  for (let i = 0; i < times; i++) await canvas.page().keyboard.press(key);
}

/**
 * Start the page with the prediction of 1.4 already committed: the interior/exterior/boundary row of figure 1.4א is
 * hidden until then (it would answer the prediction), and these tests are about the figure, not the prediction.
 */
async function withPrediction(page: Page) {
  await page.addInitScript(() => {
    try {
      const key = 'advinfilab:v1';
      if (!localStorage.getItem(key)) {
        const at = Date.now();
        localStorage.setItem(key, JSON.stringify({ version: 1, createdAt: at, predictions: { 'pred-1-4': { choice: '1', at } }, attempts: [], lessons: {}, tasks: {} }));
      }
    } catch {
      /* storage refused: the test then fails on the hidden row, which is the honest outcome */
    }
  });
}

/**
 * Keep every text step away from the figures for the whole page life: the step bus stores the last state per figure
 * before it dispatches (late figures read it on hydration), so freezing the dispatch alone is not enough here.
 */
async function blockSteps(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, '__advinfilabSteps', { get: () => ({}), set: () => {}, configurable: true });
    const dispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = (e: Event) => (e.type === 'advinfilab:step' ? true : dispatch(e));
  });
}

test.describe('lesson 1.4: interior, closure, boundary and density', () => {
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

  test('figure 1.4א hides the classification until the prediction is committed', async ({ page }) => {
    await blockSteps(page);
    await page.goto(LESSON);
    const fig = page.locator('#fig-1-4a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    await expect(fig.locator('[data-readout="kind-hidden"]')).toBeVisible();
    await expect(fig.locator('[data-readout="kind"]')).toHaveCount(0);
    await expect(fig.locator('[data-readout="acc"]')).toHaveCount(0);
    const predict = page.locator('[data-predict-id="pred-1-4"]');
    await predict.scrollIntoViewIfNeeded();
    await hydrated(predict);
    await predict.locator('.q-choice').nth(1).click();
    await predict.getByRole('button', { name: 'זה החיזוי שלי' }).click();
    await expect(fig.locator('[data-readout="kind"]')).toContainText('נקודה פנימית');
    await expect(fig.locator('[data-readout="kind-hidden"]')).toHaveCount(0);
    // the second row uses Definition 1.4.7, which figure 1.4א never reaches
    await expect(fig.locator('[data-readout="acc"]')).toHaveCount(0);
  });

  test('an edge point of the open square is a boundary point outside the set', async ({ page }) => {
    await withPrediction(page);
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-4a');
    // the probe starts at (0.5, 0.5) inside the open square: interior
    await expect(fig.locator('[data-readout="kind"]')).toContainText('נקודה פנימית');
    await press(fig.locator('canvas'), 'ArrowRight', 10);
    await expect(fig.locator('[data-readout="point"]')).toContainText('(1, 0.5)');
    await expect(fig.locator('[data-readout="kind"]')).toContainText('נקודת שפה');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-4a:boundary-out']).toBeTruthy();
  });

  test('the separate point (1.5, 0) is in the set and a boundary point, and finding it ticks the task', async ({ page }) => {
    await withPrediction(page);
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-4a');
    const canvas = fig.locator('canvas');
    await press(canvas, 'ArrowRight', 20);
    await press(canvas, 'ArrowDown', 10);
    await expect(fig.locator('[data-readout="point"]')).toContainText('(1.5, 0)');
    await expect(fig.locator('[data-readout="kind"]')).toContainText('נקודת שפה');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-4a:isolated']).toBeTruthy();
  });

  test('every point of the segment in the plane is a boundary point; in the discrete metric none is', async ({ page }) => {
    await withPrediction(page);
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-1-4a');
    await fig.getByRole('button', { name: 'קטע על הציר' }).click();
    await press(fig.locator('canvas'), 'ArrowDown', 10);
    await expect(fig.locator('[data-readout="point"]')).toContainText('(0.5, 0)');
    await expect(fig.locator('[data-readout="kind"]')).toContainText('נקודת שפה');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-1-4a:segment-boundary']).toBeTruthy();
    await fig.getByRole('button', { name: 'בדידה' }).click();
    await expect(fig.locator('[data-readout="kind"]')).toContainText('נקודה פנימית');
  });

  test('the second row of figure 1.4ב appears only from Definition 1.4.7', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-1-4b');
    const steps = page.locator('.step[data-fig="fig-1-4b"]');
    // the figure itself must come into view to hydrate (client:visible); on a phone a step's position does not do it
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    await steps.first().dispatchEvent('click');
    await expect(fig.locator('[data-readout="kind"]')).toBeVisible();
    await expect(fig.locator('[data-readout="acc"]')).toHaveCount(0);
    const def = steps.filter({ hasText: 'הגדרה 1.4.7.' });
    await def.scrollIntoViewIfNeeded();
    await def.dispatchEvent('click');
    // that step puts the probe on (1.5, 0), the point of the set with a ball around it that holds no other point
    await expect(fig.locator('[data-readout="acc"]')).toContainText('מבודדת');
  });

  test('a text step never ticks a task, even one that puts the probe on the answer', async ({ page }) => {
    await page.goto(LESSON);
    // steps of 1.4א put the probe at (1, 0.5) and at (1.5, 0): the boundary-out and isolated answers
    for (const step of await page.locator('.step[data-fig="fig-1-4a"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    const tasks = (await progress(page))?.tasks ?? {};
    for (const t of ['boundary-out', 'isolated', 'segment-boundary']) expect(tasks[`fig-1-4a:${t}`]).toBeFalsy();
  });

  test('the Check has its six bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-1.4-boundary-def', 'Q-1.4-interval', 'Q-1.4-count', 'Q-1.4-closure-char', 'Q-1.4-acc', 'Q-1.4-dense-tf']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-1-4-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
    // the Explain cites worked examples by number, so the kicker carries it (from the id ex-1-4-<n>)
    await expect(examples.nth(3).locator('.kicker')).toHaveText('דוגמה פתורה 4');
  });

  test('the anchors that misconceptions and the chapter summary link to exist, and the statements are numbered', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['interior', 'closure', 'set-operations', 'boundary', 'thin-boundary', 'accumulation', 'balls', 'dense']) {
      await expect(page.locator(`[id="${id}"]`).first()).toBeAttached();
    }
    // the formal spine: the first and the last numbered statement of the lesson
    await expect(page.getByText('טענה 1.4.2 (הפתוחה הגדולה ביותר).')).toHaveCount(1);
    await expect(page.getByText('משפט 1.4.18 (קירוב בקווים שבורים).')).toHaveCount(1);
  });
});
