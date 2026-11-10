import { expect, test } from '@playwright/test';
import { chapters } from '../../src/course';

test.describe('the home page', () => {
  test('lists every chapter and lesson of the course map, in Hebrew RTL', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('h1')).toHaveText('אינפי מתקדם 1');
    await expect(page.locator('.chapters > li.chapter')).toHaveCount(chapters.length);
    await expect(page.locator('[data-lesson-id]')).toHaveCount(chapters.flatMap((c) => c.lessons).length);
    await expect(page.locator('.chapter').filter({ hasText: 'מעבר לסילבוס' })).toHaveCount(chapters.filter((c) => c.beyondSyllabus).length);
  });

  test('the cover: from N on every term lies inside the ε-band, and term N − 1 does not', async ({ page }) => {
    await page.goto('/');
    const svg = page.locator('svg.cover-art');
    await expect(svg).toBeVisible();
    const r = await svg.evaluate((el) => {
      const band = el.querySelector<SVGRectElement>('rect.band')!;
      const top = band.y.baseVal.value;
      const bottom = top + band.height.baseVal.value;
      const N = Number(el.getAttribute('data-n'));
      const terms = [...el.querySelectorAll<SVGCircleElement>('.terms circle')].map((c) => ({
        n: Number(c.dataset.n),
        y: c.cy.baseVal.value,
        inClass: c.classList.contains('in'),
      }));
      return { N, top, bottom, terms };
    });
    expect(r.N).toBe(9);
    for (const t of r.terms) {
      const inside = t.y > r.top && t.y < r.bottom;
      expect(inside, `term ${t.n}`).toBe(t.inClass);
      if (t.n >= r.N) expect(inside, `term ${t.n} past N`).toBe(true);
    }
    expect(r.terms.find((t) => t.n === r.N - 1)?.inClass).toBe(false);
  });

  test('no sideways scroll', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
