import { cell, assert } from '../harness.mjs';

// Implicit class/subclass resources (Channel Divinity, Rage, …) auto-appear with
// the right pool size and recharge, and rest resets the right ones.
export default async function ({ page, baseUrl }) {
  async function setC(patch) {
    await page.evaluate((pt) => {
      const c = JSON.parse(localStorage.getItem('charactersheet.character'));
      Object.assign(c, pt);
      localStorage.setItem('charactersheet.character', JSON.stringify(c));
    }, patch);
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });
  }

  await setC({
    classes: [
      { name: 'Cleric', source: 'XPHB', level: 6, hitDie: 8 },
      { name: 'Barbarian', source: 'XPHB', level: 5, hitDie: 12 }
    ]
  });

  const res = cell(page, 'Resources');
  const cd = res.locator('li.auto', { hasText: 'Channel Divinity' });
  const rage = res.locator('li.auto', { hasText: 'Rages' });
  assert((await cd.count()) === 1, 'Channel Divinity auto-resource present (Cleric)');
  assert((await cd.locator('.tag').innerText()).toLowerCase().includes('short'), 'Channel Divinity recharges on a short rest');
  assert((await rage.count()) === 1, 'Rages auto-resource present (Barbarian)');
  assert((await rage.locator('.tag').innerText()).toLowerCase().includes('long'), 'Rages recharges on a long rest');

  // Spend one of each, then SHORT rest: the short pool resets, the long one persists.
  await setC({ featureResourceUsed: { 'short|Cleric|Channel Divinity': 2, 'long|Barbarian|Rages': 1 } });
  await cell(page, 'Rest & Level Up').locator('button', { hasText: /short/i }).first().click();
  await page.waitForTimeout(300);
  const used = await page.evaluate(() => JSON.parse(localStorage.getItem('charactersheet.character')).featureResourceUsed);
  assert(used['short|Cleric|Channel Divinity'] === undefined, 'short rest clears Channel Divinity');
  assert(used['long|Barbarian|Rages'] === 1, 'short rest keeps long-recharge Rages');

  // Stat-scaled pool: Bardic Inspiration = CHA modifier, live with the score.
  await setC({ classes: [{ name: 'Bard', source: 'PHB', level: 3, hitDie: 8 }], abilities: { ...{}, cha: 16 }, featureResourceUsed: {} });
  await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('charactersheet.character'));
    c.abilities.cha = 16;
    localStorage.setItem('charactersheet.character', JSON.stringify(c));
  });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });
  const bi = res.locator('li.auto', { hasText: 'Bardic Inspiration' });
  assert((await bi.count()) === 1, 'Bardic Inspiration auto-resource present (Bard)');
  assert((await bi.locator('.max').innerText()).trim() === '3', 'Bardic Inspiration max = CHA mod (+3 at 16)');

  await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('charactersheet.character'));
    c.abilities.cha = 20;
    localStorage.setItem('charactersheet.character', JSON.stringify(c));
  });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.data-toggle:has-text("Data ✓")', { timeout: 60000 });
  assert(
    (await res.locator('li.auto', { hasText: 'Bardic Inspiration' }).locator('.max').innerText()).trim() === '5',
    'Bardic Inspiration tracks CHA (5 at 20)'
  );
}
