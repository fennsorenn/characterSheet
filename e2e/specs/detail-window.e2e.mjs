import { cell, assert } from '../harness.mjs';

// Clicking a spell/item opens a floating detail window, placed beside the list
// (not over it), draggable, with a pop-out button.
export default async function ({ page, baseUrl }) {
  await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('charactersheet.character'));
    c.classes = [{ name: 'Wizard', source: 'PHB', level: 5, hitDie: 6 }];
    c.spells = [{ name: 'Fireball', source: 'PHB', status: 'prepared' }];
    c.inventory = [{ name: 'Longsword', source: 'PHB', quantity: 1, equipped: true }];
    localStorage.setItem('charactersheet.character', JSON.stringify(c));
  });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });

  const spells = cell(page, 'Spells').filter({ has: page.locator('button.name') }).first();
  const cellBox = await spells.boundingBox();
  await spells.locator('button.name', { hasText: 'Fireball' }).first().click();
  await page.waitForSelector('.win', { timeout: 5000 });
  const win = page.locator('.win');

  assert((await win.locator('.title').innerText()) === 'Fireball', 'detail window titled Fireball');
  assert((await win.locator('.sub').innerText()).includes('Evocation'), 'shows level/school subtitle');
  assert((await win.locator('.meta p').count()) >= 4, 'shows spell meta lines');
  assert((await win.locator('button[aria-label="Pop out"]').count()) === 1, 'has a pop-out button');

  // Placed beside the list (no horizontal overlap with the Spells block).
  const wb = await win.boundingBox();
  const beside = wb.x >= cellBox.x + cellBox.width - 2 || wb.x + wb.width <= cellBox.x + 2;
  assert(beside, `window opens beside the list, not over it (win ${Math.round(wb.x)}, cell ${Math.round(cellBox.x)})`);

  // Draggable by the header.
  const bar = await win.locator('.bar').boundingBox();
  await page.mouse.move(bar.x + 40, bar.y + 10);
  await page.mouse.down();
  await page.mouse.move(bar.x + 140, bar.y + 80, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(120);
  const moved = await win.boundingBox();
  assert(Math.abs(moved.x - wb.x) > 50, 'window is draggable');

  // Clicking an item updates the same window; close works.
  await cell(page, 'Inventory').locator('button.name', { hasText: 'Longsword' }).first().click();
  await page.waitForTimeout(150);
  assert((await win.locator('.title').innerText()) === 'Longsword', 'window switches to the item detail');

  // A weapon name in the Attacks block opens its detail too.
  await cell(page, 'Attacks').locator('button.name', { hasText: 'Longsword' }).first().click();
  await page.waitForTimeout(150);
  assert((await win.locator('.title').innerText()) === 'Longsword', 'attack name opens the item detail');
  await win.locator('button[aria-label="Close"]').click();
  await page.waitForTimeout(120);
  assert((await page.locator('.win').count()) === 0, 'close button closes the window');
}
