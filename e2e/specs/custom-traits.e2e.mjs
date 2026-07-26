import { assert, assertEqual, block } from '../harness.mjs';

const doc = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('cs.char.test')));
const chips = (block) => block.locator('.chip').allInnerTexts();

// Movement, senses, proficiencies, skills and attacks a player adds by hand.
// They are not a parallel world: a typed proficiency lands in the same grant
// pool a race feeds, and a typed skill or attack is a node on the same graph.
export default async function ({ page }) {
  // --- Movement and senses ---
  const traits = block(page, 'Traits & Proficiencies');
  const add = traits.locator('form.add');
  await add.locator('select').selectOption('speed');
  await add.locator('input[aria-label=Name]').fill('fly');
  await add.locator('input[aria-label="Distance in feet"]').fill('60');
  await add.locator('button[type=submit]').click();
  await page.waitForTimeout(300);
  assert(
    (await chips(traits)).some((c) => /Fly 60 ft/.test(c)),
    `the speed appears (${(await chips(traits)).join(' | ')})`
  );

  await add.locator('select').selectOption('sense');
  await add.locator('input[aria-label=Name]').fill('tremorsense');
  await add.locator('input[aria-label="Distance in feet"]').fill('30');
  await add.locator('button[type=submit]').click();
  await page.waitForTimeout(300);
  assert((await chips(traits)).some((c) => /Tremorsense 30 ft/.test(c)), 'and the sense');

  // --- Proficiencies, into their own categories ---
  for (const [kind, name] of [
    ['language', 'Thieves Cant'],
    ['toolProf', 'Bagpipes'],
    ['weaponProf', 'Harpoon']
  ]) {
    await add.locator('select').selectOption(kind);
    await add.locator('input[aria-label=Name]').fill(name);
    await add.locator('button[type=submit]').click();
    await page.waitForTimeout(250);
  }
  const rowFor = (label) => traits.locator('.row', { hasText: label });
  assert(/Thieves Cant/.test(await rowFor('Languages').innerText()), 'the language is under Languages');
  assert(/Bagpipes/.test(await rowFor('Tools').innerText()), 'the tool under Tools');
  assert(/Harpoon/.test(await rowFor('Weapons').innerText()), 'the weapon under Weapons');

  // They are stored on the character, not just drawn.
  const stored = (await doc(page)).customGrants;
  assertEqual(stored.length, 5, 'all five are on the document');
  assert(
    stored.some((g) => g.kind === 'speed' && g.name === 'fly' && g.feet === 60),
    'with what was typed'
  );

  // --- Removing one takes only that one ---
  await traits.locator('.chip', { hasText: 'Bagpipes' }).locator('button.x').click();
  await page.waitForTimeout(300);
  assert(!(await chips(traits)).some((c) => /Bagpipes/.test(c)), 'the removed chip is gone');
  assert((await chips(traits)).some((c) => /Harpoon/.test(c)), 'and the others stay');
  assertEqual((await doc(page)).customGrants.length, 4, 'the document agrees');

  // A granted chip is not the player's to delete.
  const granted = traits.locator('.chip', { hasText: 'Common' });
  if (await granted.count()) {
    assertEqual(await granted.locator('button.x').count(), 0, 'a granted chip offers no remove');
  }

  // --- A skill the game does not have ---
  const skills = block(page, 'Skills');
  await skills.locator('.quickadd input').fill('Piloting');
  await skills.locator('.quickadd button').click();
  await page.waitForTimeout(300);
  const row = skills.locator('li', { hasText: 'Piloting' });
  assertEqual(await row.count(), 1, 'the skill is listed');
  await row.locator('select').selectOption('dex');
  await page.waitForTimeout(300);

  // It is a real node: the value tracks the ability and the proficiency tier.
  const valueOf = async () => Number((await row.locator('.stat-value').innerText()).replace('−', '-'));
  const dexMod = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('cs.char.test')).abilities.dex;
    return Math.floor((s - 10) / 2);
  });
  assertEqual(await valueOf(), dexMod + 2, 'proficient by default: dex mod + proficiency');
  await row.locator('button.dot').click(); // → expertise
  await page.waitForTimeout(300);
  assertEqual(await valueOf(), dexMod + 4, 'and expertise doubles it');

  // Reading it is reading a computed value, so it explains itself.
  await row.locator('.stat-value').click();
  await page.waitForTimeout(300);
  assert((await page.locator('.backdrop .modal').count()) > 0, 'the custom skill explains itself');
  await page.keyboard.press('Escape');

  // --- An attack that is not a weapon in the pack ---
  const attacks = block(page, 'Attacks');
  await attacks.locator('.quickadd input').fill('Bite');
  await attacks.locator('.quickadd button').click();
  await page.waitForTimeout(300);
  // The row names itself in a field, not in text, so it is found by the field.
  const bite = attacks.locator('li', { has: page.locator('input.name') });
  assertEqual(await bite.count(), 1, 'the attack is listed');
  assertEqual(await bite.locator('input.name').inputValue(), 'Bite', 'under the name given');
  await bite.locator('input.dmgedit').fill('2d6 + 3 fire');
  await bite.locator('input.dmgedit').blur();
  await bite.locator('input.bonus').fill('2');
  await bite.locator('input.bonus').blur();
  await page.waitForTimeout(300);

  const strMod = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('cs.char.test')).abilities.str;
    return Math.floor((s - 10) / 2);
  });
  const hit = Number((await bite.locator('.hit .stat-value').innerText()).replace('−', '-'));
  assertEqual(hit, strMod + 2 + 2, 'to hit is ability + proficiency + the flat bonus');

  // Rolling it goes through the dice log like a weapon's.
  await bite.locator('button.roll').click();
  await page.waitForTimeout(500);
  const log = await page.locator('.roller').first().innerText();
  assert(/bite/i.test(log), `the roll is logged (${log.slice(0, 80)}…)`);

  // --- All of it survives a reload ---
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.cell', { timeout: 20000 });
  await page.waitForTimeout(400);
  assert((await chips(block(page, 'Traits & Proficiencies'))).some((c) => /Fly 60 ft/.test(c)), 'the speed survives');
  assertEqual(await block(page, 'Skills').locator('li', { hasText: 'Piloting' }).count(), 1, 'the skill survives');
  assertEqual(
    await block(page, 'Attacks').locator('input.name').inputValue(),
    'Bite',
    'the attack survives'
  );

  // --- Outside edit mode they are readable, not editable ---
  const modeBtn = page.locator('aside.dock .db.mode').first();
  for (let i = 0; i < 4; i++) {
    if ((await modeBtn.locator('.lb').innerText()).toLowerCase() === 'play') break;
    await modeBtn.click();
    await page.waitForTimeout(200);
  }
  assertEqual(await block(page, 'Traits & Proficiencies').locator('form.add').count(), 0, 'no add row in play');
  assertEqual(await block(page, 'Skills').locator('.quickadd').count(), 0, 'no skill add bar in play');
  assertEqual(await block(page, 'Attacks').locator('.quickadd').count(), 0, 'no attack add bar in play');
  assertEqual(await block(page, 'Attacks').locator('input.dmgedit').count(), 0, 'and the attack fields are gone');
  assert(
    /Bite/.test(await block(page, 'Attacks').innerText()),
    'though the attack itself still reads'
  );

  // Leave the character as it was found.
  for (let i = 0; i < 4; i++) {
    if ((await modeBtn.locator('.lb').innerText()).toLowerCase() === 'edit') break;
    await modeBtn.click();
    await page.waitForTimeout(200);
  }
  await page.evaluate(() => {
    const key = 'cs.char.test';
    const c = JSON.parse(localStorage.getItem(key));
    delete c.customGrants;
    delete c.customSkills;
    delete c.customAttacks;
    localStorage.setItem(key, JSON.stringify(c));
  });
}
