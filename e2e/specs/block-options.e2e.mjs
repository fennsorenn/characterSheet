import { assert, assertEqual, cell } from '../harness.mjs';

const core = (page, n = 0) => page.locator('.cell', { hasText: 'Defenses & Core' }).nth(n);
// textContent, not innerText: the labels are uppercased by CSS, and comparing
// against what the stylesheet did rather than what the block says is brittle.
const statNames = (page, n = 0) =>
  core(page, n).locator('.stat .k').evaluateAll((els) => els.map((e) => e.textContent.trim()));

// Edit mode is a session thing, not a saved one, so a reload drops it.
async function enterEditMode(page) {
  if (await page.locator('.editbar').count()) return;
  await page.locator('aside.dock button[title="More"]').click();
  await page.waitForTimeout(200);
  await page.locator('aside.dock .db', { hasText: 'Edit layout' }).first().click();
  await page.waitForSelector('.editbar', { timeout: 5000 });
  await page.waitForTimeout(200);
}

async function openOptions(page, n = 0) {
  const wrap = page.locator('.block-wrap', { has: page.locator('h3:text-is("Defenses & Core")') }).nth(n);
  const btn = wrap.locator('button.opts');
  if ((await btn.getAttribute('aria-expanded')) !== 'true') await btn.click();
  await page.waitForTimeout(150);
  return wrap.locator('.optpanel');
}

async function setOption(page, label, on, n = 0) {
  const panel = await openOptions(page, n);
  const box = panel.locator('label', { hasText: label }).locator('input');
  if ((await box.isChecked()) !== on) await box.click();
  await page.waitForTimeout(250);
}

// Blocks carry individual content switches, not just whole variants: a variant
// is an arrangement, an option is one line item. Two instances of the same block
// with different options do the work a second block type would need.
export default async function ({ page }) {
  // A caster, so the spell pair has something to say — and a *class* one, with
  // nothing written on the document: a cleric's sheet says "Cleric", never
  // "wisdom", and the casting ability has to come from the class data.
  await page.evaluate(() => {
    const key = 'cs.char.test';
    const c = JSON.parse(localStorage.getItem(key));
    delete c.spellcasting;
    c.classes = [{ name: 'Cleric', source: 'PHB', level: 5, hitDie: 8 }];
    localStorage.setItem(key, JSON.stringify(c));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.cell', { timeout: 20000 });
  await page.waitForTimeout(400);
  const spellStats = (await statNames(page)).filter((n) => n.startsWith('Spell'));
  assertEqual(
    spellStats,
    ['Spell DC', 'Spell Atk'],
    `a cleric gets the spell pair from its class (${(await statNames(page)).join(', ')})`
  );

  // Edit mode is where the layout is arranged.
  await enterEditMode(page);
  assert((await page.locator('.block-wrap button.opts').count()) > 0, 'blocks with options offer them');

  const before = await statNames(page);
  assert(before.includes('Passive Perc.'), `the full block shows passive perception (${before.join(', ')})`);
  assert(!before.includes('Passive Inv.'), 'and not passive investigation, which is off by default');

  // --- Turning one on adds exactly that stat ---
  await setOption(page, 'Passive Investigation', true);
  const withInv = await statNames(page);
  assert(withInv.includes('Passive Inv.'), `passive investigation appears (${withInv.join(', ')})`);
  assertEqual(withInv.length, before.length + 1, 'and nothing else moved');
  const inv = core(page).locator('.stat', { hasText: 'Passive Inv.' }).locator('.stat-value');
  assert(/^\d+$/.test((await inv.innerText()).trim()), 'with a computed value');

  // --- And turning one off removes it ---
  await setOption(page, 'Armor Class', false);
  assert(!(await statNames(page)).includes('AC'), 'AC can be switched off like anything else');
  await setOption(page, 'Armor Class', true);
  assert((await statNames(page)).includes('AC'), 'and back on');

  // --- The choice is stored, and survives a reload ---
  const stored = await page.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem('charactersheet.layouts'));
    const layout = lib.library.layouts.find((l) => l.id === lib.library.activeId);
    return layout.blocks.find((b) => b.type === 'defenses').options;
  });
  assertEqual(stored, { passiveInvestigation: true }, 'only the deviation is written down');

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.cell', { timeout: 20000 });
  await page.waitForTimeout(400);
  assert((await statNames(page)).includes('Passive Inv.'), 'the option survives a reload');

  // --- A second instance with only the spell pair is the spellcasting block ---
  await enterEditMode(page);
  await page.locator('.editbar select').first().selectOption('defenses');
  await page.waitForTimeout(400);
  assertEqual(
    await page.locator('.cell', { hasText: 'Defenses & Core' }).count(),
    2,
    'a second instance of the same block is placed'
  );

  for (const [label, on] of [
    ['Armor Class', false],
    ['Initiative', false],
    ['Proficiency bonus', false],
    ['Passive Perception', false],
    ['Level', false]
  ]) {
    await setOption(page, label, on, 1);
  }
  const spellOnly = await statNames(page, 1);
  assertEqual(spellOnly, ['Spell DC', 'Spell Atk'], `the second block is the spell pair alone (${spellOnly.join(', ')})`);

  // The two instances are independent: the first still has everything.
  const first = await statNames(page, 0);
  assert(first.includes('AC') && first.includes('Initiative'), `the first block is untouched (${first.join(', ')})`);

  // A non-caster has no spell pair to show, option or not.
  await page.evaluate(() => {
    const key = 'cs.char.test';
    const c = JSON.parse(localStorage.getItem(key));
    delete c.spellcasting;
    c.classes = [{ name: 'Fighter', source: 'PHB', level: 5, hitDie: 10 }];
    localStorage.setItem(key, JSON.stringify(c));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.cell', { timeout: 20000 });
  await page.waitForTimeout(400);
  assertEqual(await statNames(page, 1), [], 'a non-caster sees no spell stats');
}
