import { assert, seedCharacter } from '../harness.mjs';

// Reminders: short notes pinned to an exact spot on the sheet. They are anchored
// to what they annotate rather than to a position, so they survive a template
// switch, a reflow to one column, and any reordering of the block.
export default async function ({ page, baseUrl }) {
  // Match a block by its own heading: filtering cells by text is too loose here
  // (the Attacks empty state mentions "inventory", for one).
  const block = (title) =>
    page.locator('.block-wrap').filter({ has: page.locator('h3', { hasText: new RegExp(`^${title}$`) }) }).first();
  const stealth = () => block('Skills').locator('li', { hasText: 'Stealth' }).first();
  const reminders = () => page.evaluate(() => JSON.parse(localStorage.getItem('cs.char.test')).reminders ?? []);

  await seedCharacter(page, baseUrl, {
    name: 'Test',
    classes: [{ name: 'Fighter', source: 'PHB', level: 8, hitDie: 10 }],
    abilities: { str: 18, dex: 14, con: 16, int: 10, wis: 12, cha: 8 },
    acBase: 18,
    skillProficiencies: { stealth: 'proficient' },
    inventory: [{ name: 'Potion of Healing', source: 'DMG', quantity: 3, equipped: false }]
  });
  await page.waitForSelector('.cell', { timeout: 20000 });

  // --- Pin one right after the Stealth skill ---
  await page.click('.tools button:has-text("Reminders")');
  await page.waitForSelector('.reminder-banner');
  await stealth().locator('button.add').click();
  await stealth().locator('input.text').fill('disadv. in armor');
  await stealth().locator('input.text').press('Enter');
  await page.waitForTimeout(300);

  const pinned = await reminders();
  assert(pinned.length === 1, `one reminder stored; got ${pinned.length}`);
  assert(pinned[0].anchor === 'skill.stealth', `anchored to the skill; got ${pinned[0].anchor}`);
  assert(pinned[0].text === 'disadv. in armor', 'with the text as typed');

  // --- It reads as a margin note once the mode is off ---
  await page.click('.tools button:has-text("Reminders")');
  await page.waitForTimeout(300);
  assert(/disadv\. in armor/.test(await stealth().innerText()), 'the note shows under Stealth');
  assert((await stealth().locator('input.text').count()) === 0, 'and is not editable outside the mode');

  // --- Anchored, not positioned: it follows the row anywhere ---
  await page.selectOption('select.preset', 'mobile-martial');
  await page.waitForTimeout(400);
  assert(/disadv\. in armor/.test(await stealth().innerText()), 'survives a template switch');
  await page.setViewportSize({ width: 430, height: 1400 });
  await page.waitForTimeout(400);
  assert(/disadv\. in armor/.test(await stealth().innerText()), 'survives a reflow to one column');
  await page.setViewportSize({ width: 1200, height: 2100 });
  await page.selectOption('select.preset', 'desktop-martial');
  await page.waitForTimeout(400);

  // --- Other kinds of anchor: an inventory row and a whole block ---
  await page.click('.tools button:has-text("Reminders")');
  await page.waitForSelector('.reminder-banner');
  const potion = block('Inventory').locator('li', { hasText: 'Potion of Healing' }).first();
  await potion.locator('button.add').first().click();
  await potion.locator('input.text').first().fill('bonus action to quaff');
  await potion.locator('input.text').first().press('Enter');
  await page.waitForTimeout(250);

  const blockSlot = block('Defenses & Core').locator('> .body > .reminders').first();
  await blockSlot.locator('button.add').click();
  await blockSlot.locator('input.text').fill('shield in off-hand');
  await blockSlot.locator('input.text').press('Enter');
  await page.waitForTimeout(300);

  const all = await reminders();
  assert(all.length === 3, `three reminders stored; got ${all.length}`);
  assert(all.some((r) => r.anchor === 'item.potion of healing|dmg'), 'an item anchor by name and source');
  assert(all.some((r) => r.anchor === 'block.defenses'), 'a whole-block anchor');

  // --- Editing and deleting in place ---
  await stealth().locator('input.text').fill('disadvantage in heavy armor');
  await stealth().locator('input.text').press('Enter');
  await page.waitForTimeout(250);
  assert(
    (await reminders()).find((r) => r.anchor === 'skill.stealth').text === 'disadvantage in heavy armor',
    'editing the text saves it'
  );

  // --- A longer explanation, opened in a window ---
  // Without one, the note is plain text with nothing to open.
  assert((await stealth().locator('button.text').count()) === 0, 'nothing to open yet');

  await stealth().locator('button.explain').click();
  await page.waitForSelector('.win[role=dialog]');
  assert(
    (await page.locator('.win .title').inputValue()) === 'disadvantage in heavy armor',
    'the window is titled with the one-liner'
  );
  assert(/at Stealth/.test(await page.locator('.win .where').innerText()), 'and says what it is pinned to');
  await page.locator('.win .body').fill('Chain mail imposes disadvantage.\n\nMithral would remove it.');
  await page.locator('.win .body').blur();
  await page.waitForTimeout(300);
  const explained = (await reminders()).find((r) => r.anchor === 'skill.stealth');
  assert(explained.detail?.startsWith('Chain mail'), 'the explanation is saved on the reminder');
  assert(explained.text === 'disadvantage in heavy armor', 'and the one-liner is untouched');
  await page.locator('.win .ic').click();

  // --- Outside the mode, the note itself opens it ---
  await page.click('.tools button:has-text("Reminders")');
  await page.waitForTimeout(300);
  assert((await stealth().locator('button.text').count()) === 1, 'a note with more behind it is clickable');
  await stealth().locator('button.text').click();
  await page.waitForSelector('.win[role=dialog]');
  assert(
    (await page.locator('.win .body').inputValue()).startsWith('Chain mail'),
    'clicking the note reopens the explanation'
  );
  // Notes with nothing behind them stay plain text.
  const potionNote = block('Inventory').locator('li', { hasText: 'Potion of Healing' }).first();
  assert((await potionNote.locator('span.text').count()) === 1, 'a note with no explanation is not a button');
  await page.locator('.win .ic').click();
  await page.click('.tools button:has-text("Reminders")');
  await page.waitForSelector('.reminder-banner');

  // --- A stranded reminder is surfaced, and can be cleared from there ---
  await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('cs.char.test'));
    c.reminders.push({ id: 'ghost', anchor: 'item.wand of fireballs|dmg', text: '3 charges left' });
    localStorage.setItem('cs.char.test', JSON.stringify(c));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.cell', { timeout: 20000 });
  await page.click('.tools button:has-text("Reminders")');
  await page.waitForSelector('.stranded');
  const strandedText = await page.locator('.stranded').innerText();
  assert(/3 charges left/.test(strandedText), 'the stranded note is listed');
  assert(/Wand Of Fireballs/i.test(strandedText), 'with a readable name for where it was pinned');
  await page.locator('.stranded .drop').first().click();
  await page.waitForTimeout(300);
  assert(!(await reminders()).some((r) => r.id === 'ghost'), 'and deleting it there works');
  assert((await reminders()).length === 3, 'leaving the reminders that are still anchored');
}
