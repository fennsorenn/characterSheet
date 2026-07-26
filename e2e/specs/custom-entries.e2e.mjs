import { assert, seedCharacter } from '../harness.mjs';

// Items, spells and features added by hand have no catalog text behind them, so
// their window holds a description you write yourself. Catalog entries still
// show catalog content — unless you have written your own, which never gets
// hidden behind it.
export default async function ({ page, baseUrl }) {
  const block = (title) =>
    page.locator('.block-wrap').filter({ has: page.locator('h3', { hasText: new RegExp(`^${title}$`) }) }).first();
  const doc = () => page.evaluate(() => JSON.parse(localStorage.getItem('cs.char.test')));
  const win = () => page.locator('.win[role=dialog]');
  const feats = () => block('Features & Traits');

  await seedCharacter(page, baseUrl, {
    name: 'Test',
    classes: [{ name: 'Wizard', source: 'PHB', level: 5, hitDie: 6 }],
    abilities: { str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 10 },
    spellcasting: { ability: 'int' },
    inventory: [{ name: 'Longsword', source: 'PHB', quantity: 1, equipped: true, proficient: true }],
    spells: [{ name: 'Magic Missile', source: 'PHB', status: 'prepared' }]
  });
  await page.waitForSelector('.cell', { timeout: 20000 });

  // --- A custom item: typed in, nothing in the catalog matches ---
  const inv = block('Inventory');
  await inv.locator('.quickadd input').fill('Shard of the Hollow Star');
  await inv.locator('.quickadd input').press('Enter');
  await page.waitForTimeout(400);
  const added = (await doc()).inventory.find((i) => i.source === 'Custom');
  assert(added?.name === 'Shard of the Hollow Star', 'the custom item is on the character');
  assert(added.description === undefined, 'with no description yet');

  const row = inv.locator('li', { hasText: 'Shard of the Hollow Star' }).first();
  assert(
    (await row.locator('button.name').getAttribute('title')) === 'Describe this item',
    'the row says there is a description to write'
  );

  // Clicking it opens a window that can be written in — this used to do nothing.
  await row.locator('button.name').click();
  await win().waitFor();
  assert((await win().locator('.title').innerText()) === 'Shard of the Hollow Star', 'titled with the name');
  assert(/Item · Custom/.test(await win().locator('.where').innerText()), 'and says what it is');
  await win().locator('.body').fill('A splinter of cold starlight.\n\nMisty Step once per long rest.');
  await win().locator('.body').blur();
  await page.waitForTimeout(350);
  const described = (await doc()).inventory.find((i) => i.source === 'Custom');
  assert(described.description?.startsWith('A splinter'), 'the description saves onto the item');

  // It comes back on reopening, and Escape closes the window.
  await win().locator('.ic').click();
  await row.locator('button.name').click();
  await win().waitFor();
  assert((await win().locator('.body').inputValue()).startsWith('A splinter'), 'reopens with the text');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  assert((await win().count()) === 0, 'Escape closes it');

  // --- A catalog item is unaffected: it still shows catalog content ---
  await inv.locator('li', { hasText: 'Longsword' }).first().locator('button.name').click();
  await win().waitFor();
  assert(/weapon/i.test(await win().innerText()), 'known items still show the catalog entry');
  await win().locator('.ic').first().click();
  await page.waitForTimeout(200);

  // --- A custom spell behaves the same ---
  const spells = block('Spells');
  await spells.locator('.quickadd input').fill('Ancestral Whisper');
  await spells.locator('.quickadd input').press('Enter');
  await page.waitForTimeout(400);
  const srow = spells.locator('li', { hasText: 'Ancestral Whisper' }).first();
  await srow.locator('button.name').click();
  await win().waitFor();
  assert(/Spell · Custom/.test(await win().locator('.where').innerText()), 'a spell window says so');
  await win().locator('.body').fill('1 action, 30 ft, V. Save or be frightened.');
  await win().locator('.body').blur();
  await page.waitForTimeout(350);
  const spell = (await doc()).spells.find((s) => s.source === 'Custom');
  assert(spell.description?.startsWith('1 action'), 'the spell description saves');
  await win().locator('.ic').click();

  // --- Your own description is never hidden behind catalog text ---
  await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('cs.char.test'));
    c.spells.find((s) => s.name === 'Magic Missile').description = 'House rule: 4 darts at level 1.';
    localStorage.setItem('cs.char.test', JSON.stringify(c));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.cell', { timeout: 20000 });
  await block('Spells').locator('li', { hasText: 'Magic Missile' }).first().locator('button.name').click();
  await win().waitFor();
  assert(
    (await win().locator('.body').inputValue()) === 'House rule: 4 darts at level 1.',
    'a catalog entry you have described opens on your own text'
  );

  // --- Clearing it hands the entry back to the catalog ---
  await win().locator('.body').fill('   ');
  await win().locator('.body').blur();
  await page.waitForTimeout(350);
  assert(
    (await doc()).spells.find((s) => s.name === 'Magic Missile').description === undefined,
    'a blank description is dropped from the document'
  );
  await page.keyboard.press('Escape');
  await block('Spells').locator('li', { hasText: 'Magic Missile' }).first().locator('button.name').click();
  await win().waitFor();
  assert(/level|evocation|dart/i.test(await win().innerText()), 'and the catalog entry is back');

  // --- Features: the same, for something the catalog has never heard of ---
  await page.keyboard.press('Escape');
  page.once('dialog', (d) => d.accept('Oath of the Long Road'));
  await feats().locator('.line.custom button.choose').click();
  await page.waitForTimeout(400);
  assert((await doc()).customFeatures?.length === 1, 'the custom feature is on the character');

  const own = feats().locator('li', { hasText: 'Oath of the Long Road' }).first();
  // innerText is the rendered text, and the group tag is uppercased in CSS.
  assert(/^custom$/i.test(await own.locator('.grp').innerText()), 'it lists in its own group');

  await own.locator('button.describe').click();
  await win().waitFor();
  assert(/Feature · Custom/.test(await win().locator('.where').innerText()), 'the window says what it is');
  await win().locator('.body').fill('Advantage on saves against exhaustion while travelling.');
  await win().locator('.body').blur();
  await page.waitForTimeout(350);
  assert(
    (await doc()).featureMeta['Oath of the Long Road|Custom']?.description?.startsWith('Advantage'),
    'the description saves with the feature’s other overrides'
  );
  await page.keyboard.press('Escape');

  await own.locator('button.fname').click();
  await page.waitForTimeout(300);
  assert(/Advantage on saves/.test(await own.locator('.fbody').innerText()), 'expanding shows your text');

  // --- A catalog feature takes one too, and yours wins over the rules text ---
  const known = feats().locator('li', { hasText: 'Arcane Recovery' }).first();
  await known.locator('button.describe').click();
  await win().waitFor();
  await win().locator('.body').fill('House rule: also recovers one 6th-level slot.');
  await win().locator('.body').blur();
  await page.waitForTimeout(350);
  await page.keyboard.press('Escape');
  await known.locator('button.fname').click();
  await page.waitForTimeout(300);
  assert(/House rule/.test(await known.locator('.fbody').innerText()), 'your text replaces the catalog text');

  // Clearing it hands the feature back to the catalog and drops the override.
  await known.locator('button.describe').click();
  await win().waitFor();
  await win().locator('.body').fill('   ');
  await win().locator('.body').blur();
  await page.waitForTimeout(350);
  await page.keyboard.press('Escape');
  const restored = await known.locator('.fbody').innerText();
  assert(!/House rule/.test(restored) && restored.length > 10, 'the catalog text is back');
  assert(
    (await doc()).featureMeta['Arcane Recovery|PHB'] === undefined,
    'and the emptied override is dropped from the document'
  );

  // --- Removing a custom feature takes its description with it ---
  await feats().locator('.line.custom .ctag .x').first().click();
  await page.waitForTimeout(350);
  const end = await doc();
  assert(!end.customFeatures, 'the feature is gone');
  assert(!end.featureMeta['Oath of the Long Road|Custom'], 'and so is its description');
}
