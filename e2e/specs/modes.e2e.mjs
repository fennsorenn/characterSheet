import { assert, assertEqual, cell, dock, dockControl, openDock, closeDock } from '../harness.mjs';

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

  // Locked numbers are text, not dead fields: a disabled input still looks
  // like somewhere to type.
  const maxHp = cell(page, 'Hit Points').locator('[aria-label="Maximum hit points"]');
  assertEqual(
    await maxHp.evaluate((el) => el.tagName.toLowerCase()),
    'span',
    'max HP reads as text in play mode'
  );
  assert((await maxHp.innerText()).trim().length > 0, 'and still shows its value');

  // Affordances you cannot use are gone rather than greyed out.
  assertEqual(await page.locator('.cell .quickadd').count(), 0, 'no quick-add bars in play');
  // Looking something up is not editing, so the import bar and the dock's
  // Notes and Add controls work in every mode; only adding is gated.
  assertEqual(await page.locator('.search .bar input').count(), 1, 'the import bar stays');
  for (const label of ['Notes', 'Add']) {
    assert(
      !(await dock(page).locator('.db', { has: page.locator(`.lb:text-is("${label}")`) }).first().isDisabled()),
      `${label} works in play mode`
    );
  }
  // Add opens the browse overlay, which is a catalog reference in any mode.
  await dockControl(page, 'Add');
  await page.waitForSelector('.overlay', { timeout: 5000 });
  assert(true, 'browse opens in play mode');
  assert(
    await page.locator('.overlay button.add').first().isDisabled(),
    'though its add buttons stay locked outside edit mode'
  );
  await page.locator('.overlay .close').click();
  await page.waitForSelector('.overlay', { state: 'detached', timeout: 5000 });
  assertEqual(await page.locator('.cell button.rm').count(), 0, 'no remove buttons in play');
  assertEqual(await page.locator('.cell .mini.describe').count(), 0, 'no per-feature edit buttons');
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
  // The build block reads as a summary rather than a disabled form.
  const build = cell(page, 'Race, Class & Feats');
  assertEqual(
    await build.locator('input, select').count(),
    0,
    'the build block has no fields outside edit mode'
  );
  assert(
    (await build.locator('.classchip .lvltext').first().innerText()).trim().length > 0,
    'the class level shows as text'
  );

  // --- The mode sticks across a reload ---
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.cell', { timeout: 20000 });
  assertEqual((await modeOf(page)).toLowerCase(), 'play', 'the mode survives a reload');

  await setMode(page, 'edit');
  assert((await openFields(page)).length > 5, 'edit mode gives everything back');
  assert((await page.locator('.cell .quickadd').count()) > 0, 'and the quick-add bars return');
  assert((await page.locator('.search .bar input').count()) === 1, 'along with the import bar');
  assertEqual(
    await cell(page, 'Hit Points')
      .locator('[aria-label="Maximum hit points"]')
      .evaluate((el) => el.tagName.toLowerCase()),
    'input',
    'max HP is a field again'
  );

  // --- The rail keeps its controls reachable on a short viewport ---
  await page.setViewportSize({ width: 1440, height: 500 });
  await page.waitForTimeout(300);
  await dock(page).locator('button[title="More"]').click();
  await page.waitForTimeout(300);
  const rail = await page.evaluate(() => {
    const d = document.querySelector('aside.dock');
    const s = d.querySelector('.railscroll');
    return {
      dockScrolls: d.scrollHeight > d.clientHeight + 1,
      pinned: d.querySelectorAll(':scope > .db').length,
      railScrolls: s.scrollHeight > s.clientHeight + 1
    };
  });
  assert(!rail.dockScrolls, 'the rail itself does not scroll');
  assert(rail.pinned >= 5, `the controls stay put (${rail.pinned} pinned)`);
  assert(rail.railScrolls, 'the overflow goes to the scrolling section instead');

  // --- No phantom scrollbars anywhere on the page ---
  // Naming one overflow axis leaves the other computing to `auto`, so a couple
  // of stray pixels render a scrollbar nobody asked for — invisible under
  // overlay scrollbars, obvious on Windows and Linux. It bit the dock rail, the
  // notes tab bar and the notes editor. A real scrolling region overflows by
  // far more than a few pixels, so a tiny overflow is always a mistake.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(400);
  const scan = () =>
    page.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll('body *')) {
        const s = getComputedStyle(el);
        const name = `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}`;
        const dx = el.scrollWidth - el.clientWidth;
        const dy = el.scrollHeight - el.clientHeight;
        if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && dx > 0 && dx <= 4) bad.push(`${name} x+${dx}`);
        if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && dy > 0 && dy <= 4) bad.push(`${name} y+${dy}`);
      }
      return bad;
    });

  // Both dock states: the rail's narrow column only exists while it is shut,
  // which is exactly where its phantom scrollbar was.
  await closeDock(page);
  const shutPhantoms = await scan();
  assertEqual(shutPhantoms, [], `dock shut: ${shutPhantoms.join(', ')}`);
  await openDock(page);
  await page.waitForTimeout(300);
  const openPhantoms = await scan();
  assertEqual(openPhantoms, [], `dock open: ${openPhantoms.join(', ')}`);
}
