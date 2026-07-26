import { assert, assertEqual, cell, dock, dockControl } from '../harness.mjs';

/** Every field inside the sheet that is still editable, by block. */
async function openFields(page) {
  return page.evaluate(() => {
    const out = [];
    for (const c of document.querySelectorAll('.cell')) {
      const title = c.querySelector('h3')?.textContent?.trim() ?? '(untitled)';
      for (const f of c.querySelectorAll('input, select, textarea')) {
        if (f.disabled || f.readOnly) continue;
        if (f.closest('[inert]')) continue;
        out.push(`${title}: ${f.getAttribute('aria-label') || f.getAttribute('placeholder') || f.className || f.type}`);
      }
    }
    return out;
  });
}

const modeOf = (page) =>
  dock(page).locator('.db.mode .lb').first().innerText();

async function setMode(page, want) {
  for (let i = 0; i < 4; i++) {
    if ((await modeOf(page)).toLowerCase() === want) return;
    await dockControl(page, await modeOf(page));
  }
  throw new Error(`could not reach ${want} mode`);
}

// Three modes, one control. Edit is everything; play keeps what the character
// *is* out of reach while a session runs; read locks the lot without stopping
// you reading, rolling or tracing a value.
export default async function ({ page }) {
  assertEqual((await modeOf(page)).toLowerCase(), 'edit', 'starts in edit mode');
  const editable = await openFields(page);
  assert(editable.length > 5, `edit mode leaves fields open (${editable.length})`);

  // --- Read mode: nothing in the sheet accepts input ---
  await setMode(page, 'read');
  const stillOpen = await openFields(page);
  assertEqual(stillOpen, [], `read mode locks every field, left open:\n  ${stillOpen.join('\n  ')}`);

  // The mutating buttons are shut too — fields are only half the surface.
  for (const [block, sel, what] of [
    ['Conditions', 'button.chip', 'a condition'],
    ['Rest & Level Up', 'button.long', 'a long rest'],
    ['Rest & Level Up', 'button.levelup', 'levelling up'],
    ['Skills', 'button.dot', 'a proficiency'],
    ['Spell Slots', '.pips button.pip', 'a spell slot']
  ]) {
    const b = cell(page, block).locator(sel).first();
    if (await b.count()) assert(await b.isDisabled(), `${what} cannot be changed in read mode`);
  }

  // Reading is not editing: values still open their calculation.
  await cell(page, 'Skills').locator('.stat-value').first().click();
  await page.waitForTimeout(300);
  assert((await page.locator('.backdrop .modal').count()) > 0, 'a value still explains itself');
  await page.keyboard.press('Escape');

  // --- Play mode: the session state moves, the character does not ---
  await setMode(page, 'play');
  const playable = await openFields(page);
  const has = (s) => playable.some((f) => f.toLowerCase().includes(s));

  assert(has('current hit points'), `current HP is editable in play (${playable.join(' | ')})`);
  assert(!has('maximum hit points'), 'max HP is not');
  assert(
    !playable.some((f) => f.startsWith('Ability Scores:')),
    `ability scores are locked in play (${playable.filter((f) => f.startsWith('Ability Scores:')).join(', ')})`
  );

  // Spending a slot works; the pool's size does not move.
  const hp = cell(page, 'Hit Points').locator('input:not([readonly])').first();
  await hp.fill('7');
  await hp.press('Enter');
  await page.waitForTimeout(300);
  const current = await page.evaluate(
    () => JSON.parse(localStorage.getItem('cs.char.test')).hp.current
  );
  assertEqual(current, 7, 'current HP took the edit');

  // Conditions are play state, proficiencies are not.
  assert(
    !(await cell(page, 'Conditions').locator('button.chip').first().isDisabled()),
    'conditions can be toggled in play'
  );
  assert(
    await cell(page, 'Skills').locator('button.dot').first().isDisabled(),
    'skill proficiency cannot'
  );
  assert(
    await cell(page, 'Race, Class & Feats').locator('.setup').getAttribute('inert') !== null,
    'and neither can the build block'
  );

  // --- The mode sticks across a reload ---
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.cell', { timeout: 20000 });
  assertEqual((await modeOf(page)).toLowerCase(), 'play', 'the mode survives a reload');

  await setMode(page, 'edit');
  assert((await openFields(page)).length > 5, 'edit mode gives everything back');
}
