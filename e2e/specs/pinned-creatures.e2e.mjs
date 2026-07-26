import { assert, assertEqual, dock, openDock, waitForData } from '../harness.mjs';

// A pinned creature's HP pool lives in the dock at every size. Where its full
// statblock unfolds does not: on a phone it opens in the dock's panel, because
// there is nowhere else; anywhere wider it goes to the detail window, which can
// be dragged and read at a sensible width.
export default async function ({ page, baseUrl }) {
  // Pin two creatures directly — the store is localStorage-backed, and the pin
  // flow itself is exercised elsewhere.
  await page.evaluate(() => {
    localStorage.setItem(
      'charactersheet.pinnedCreatures',
      JSON.stringify([
        {
          id: 'p1',
          entry: { name: 'Goblin', source: 'MM', size: ['S'], type: 'humanoid', ac: [15], hp: { average: 7, formula: '2d6' }, speed: { walk: 30 }, str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
          params: { spellLevel: 3, spellDc: 15, spellAttack: 7 },
          hp: { current: 5, max: 7, temp: 0 },
          legendaryUsed: 0
        },
        {
          id: 'p2',
          entry: { name: 'Ogre', source: 'MM', size: ['L'], type: 'giant', ac: [11], hp: { average: 59, formula: '7d10+21' }, speed: { walk: 40 }, str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
          params: {},
          hp: { current: 27, max: 59, temp: 0 },
          legendaryUsed: 0
        }
      ])
    );
  });
  await page.goto(`${baseUrl}/local/test`, { waitUntil: 'networkidle' });
  await waitForData(page);
  await page.waitForSelector('.cell', { timeout: 20000 });

  // --- Desktop: the statblock is a window, not a section of the rail ---
  await openDock(page);
  const card = dock(page).locator('.card', { hasText: 'Goblin' }).first();
  assert((await card.count()) === 1, 'the creature is in the rail');
  assertEqual(await card.locator('.full').count(), 0, 'with no statblock unfolded inside it');

  await card.locator('button.cname').click();
  await page.waitForTimeout(400);
  const win = page.locator('.win[role=dialog]');
  assert((await win.count()) === 1, 'clicking the name opens the detail window');
  assert(/goblin/i.test(await win.innerText()), 'showing that creature');
  assertEqual(
    await dock(page).locator('.card .full').count(),
    0,
    'and nothing unfolds in the dock'
  );

  // The window is a window: it can be closed, and it is not inside the dock.
  const outside = await page.evaluate(() => {
    const w = document.querySelector('.win[role=dialog]');
    return !document.querySelector('aside.dock').contains(w);
  });
  assert(outside, 'the window lives outside the dock');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  assertEqual(await win.count(), 0, 'Escape closes it');

  // --- The shut rail's stub opens the same window ---
  await page.keyboard.press('Escape'); // collapse the rail
  await page.waitForTimeout(300);
  await dock(page).locator('.stub', { hasText: 'Ogre' }).first().click();
  await page.waitForTimeout(400);
  assert((await win.count()) === 1, 'a stub opens the window too');
  assert(/ogre/i.test(await win.innerText()), 'for the creature clicked');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // --- Phone: it unfolds in the dock instead ---
  await page.setViewportSize({ width: 420, height: 900 });
  await page.waitForTimeout(500);
  await dock(page).locator('.cb', { hasText: 'Goblin' }).first().click();
  await page.waitForTimeout(400);
  assertEqual(await page.locator('.win[role=dialog]').count(), 0, 'no window on a phone');
  assert(
    (await dock(page).locator('.panel .card .full').count()) === 1,
    'the statblock unfolds in the dock panel'
  );
  assert(/goblin/i.test(await dock(page).locator('.panel').innerText()), 'for the right creature');

  // Tapping it again puts it away.
  await dock(page).locator('.cb', { hasText: 'Goblin' }).first().click();
  await page.waitForTimeout(300);
  assertEqual(await dock(page).locator('.panel .card .full').count(), 0, 'and tapping again closes it');

  await page.setViewportSize({ width: 1200, height: 2100 });
  await page.waitForTimeout(400);
  // Leave nothing pinned for the specs that follow.
  await page.evaluate(() => localStorage.removeItem('charactersheet.pinnedCreatures'));
}
