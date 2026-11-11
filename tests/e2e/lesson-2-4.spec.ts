import { expect, test, type Locator, type Page } from '@playwright/test';
import { freezeSteps, hydrated, inked, progress } from './helpers';

const LESSON = '/lessons/2-4/';

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

/** Move the ε slider (the second range input) until the verdict reads the wanted tube width. */
async function setEps(fig: Locator, text: string) {
  const eps = fig.locator('input[type=range]').nth(1);
  const max = Number(await eps.getAttribute('max'));
  for (let i = 0; i <= max; i++) {
    await slide(eps, i);
    if ((await fig.locator('[data-readout="verdict"]').innerText()).includes(text)) return;
  }
  throw new Error(`no ε slider position reads ${text}`);
}

test.describe('lesson 2.4: series in a normed space, the M-test, the Neumann series', () => {
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

  test('Σcos(kx)/2ᵏ: the sup distance after n terms is 2⁻ⁿ, outside the 0.1-tube at n = 3 and inside at n = 4', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-4a');
    const n = fig.locator('input[type=range]').nth(0);
    await slide(n, 3);
    await expect(fig.locator('[data-readout="sup"]')).toContainText('0.125');
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('אינה');
    await slide(n, 4);
    await expect(fig.locator('[data-readout="sup"]')).toContainText('0.0625');
    await expect(fig.locator('[data-readout="verdict"]')).not.toContainText('אינה');
  });

  test('with ε = 0.01 the first n in the tube is 7, and finding it ticks the m-test task', async ({ page }) => {
    await page.goto(LESSON);
    const fig = await ready(page, 'fig-2-4a');
    await setEps(fig, 'ε = 0.01');
    const n = fig.locator('input[type=range]').nth(0);
    await slide(n, 6);
    await expect(fig.locator('[data-readout="verdict"]')).toContainText('אינה');
    await slide(n, 7);
    await expect(fig.locator('[data-readout="sup"]')).toContainText('7.81·10⁻³');
    await expect(fig.locator('[data-readout="verdict"]')).not.toContainText('אינה');
    await expect.poll(async () => (await progress(page))?.tasks?.['fig-2-4a:m-test']).toBeTruthy();
  });

  test('a text step drives the figure: the second Explore step sets n = 4 on the cosine series', async ({ page }) => {
    await page.goto(LESSON);
    const fig = page.locator('#fig-2-4a');
    await fig.scrollIntoViewIfNeeded();
    await hydrated(fig.locator('canvas'));
    const step = page.locator('.step[data-fig="fig-2-4a"]').nth(1);
    await step.scrollIntoViewIfNeeded();
    await step.click();
    await expect(fig.locator('[data-readout="n"]')).toContainText('n = 4');
    await expect(fig.locator('[data-readout="sup"]')).toContainText('0.0625');
  });

  test('a text step never ticks a task', async ({ page }) => {
    await page.goto(LESSON);
    for (const step of await page.locator('.step[data-fig="fig-2-4a"]').all()) {
      await step.scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    expect((await progress(page))?.tasks?.['fig-2-4a:m-test']).toBeFalsy();
  });

  test('the Check has its five bank questions, and worked solutions stay closed until opened', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of ['Q-2.4-def', 'Q-2.4-mtest-meaning', 'Q-2.4-neumann-bound', 'Q-2.4-abs-incomplete', 'Q-2.4-norm-choice']) {
      await expect(page.locator(`[data-qid="${id}"]`)).toHaveCount(1);
    }
    const examples = page.locator('[id^="ex-2-4-"]');
    await expect(examples).toHaveCount(6);
    await expect(examples.first().locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('the anchors the misconceptions link to exist, and the numbered statements appear in order', async ({ page }) => {
    await page.goto(LESSON);
    for (const id of [
      'banach',
      'series-def',
      'series-ops',
      'cauchy-criterion',
      'abs-conv',
      'abs-converse',
      'incomplete-ce',
      'm-test',
      'cos-example',
      'm-test-ce',
      'm-test-not-necessary',
      'op-space',
      'neumann',
      'neumann-bound',
      'neumann-ce',
      'neumann-norm-choice',
      'open-set',
    ]) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    }
    // Only the statement headings of the Explain blocks count: the Summary repeats some labels ("משפט 2.4.7 (מבחן ה-M):").
    // Suffixed inserts (2.4.2א, 2.4.9א) are part of the order.
    const labels = await page.locator('[data-block="explain"] strong').allInnerTexts();
    const numbers = labels
      .map((t) => t.trim().match(/^(?:הגדרה|למה|טענה|משפט|מסקנה) 2\.4\.(\d+[א-ת]?)(?:\.|\s\()/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1]);
    expect(numbers).toEqual(['1', '2', '2א', '3', '4', '5', '6', '7', '8', '9', '9א', '10']);
  });
});
