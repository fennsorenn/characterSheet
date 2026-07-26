import { assert, assertEqual, cell } from '../harness.mjs';

const ABILS = ['Str', 'Dex', 'Con', 'Int', 'Wis', 'Cha'];
const box = (page, abil) =>
  cell(page, 'Ability Scores').locator('.ability', { hasText: abil }).first();
const profs = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('cs.char.test')).saveProficiencies ?? []);

// The "Full + saving throws" variant folds each save into its own ability's box
// rather than repeating all six names in a list underneath. Used by the phone
// templates, where a second list of the same six words is the expensive way to
// say it.
export default async function ({ page }) {
  await page.setViewportSize({ width: 420, height: 900 });
  await page.waitForTimeout(600);

  const ab = cell(page, 'Ability Scores');
  assertEqual(
    await ab.locator('.block').getAttribute('data-variant'),
    'withSaves',
    'the phone template folds the saves in'
  );
  assertEqual(
    await page.locator('.cell', { hasText: 'Saving Throws' }).count(),
    0,
    'so there is no separate saving throws block'
  );
  assertEqual(await ab.locator('.save').count(), 6, 'every ability box carries its save');

  // Each box holds its own save, not somebody else's.
  for (const abil of ABILS) {
    const save = box(page, abil).locator('.save');
    assertEqual(await save.count(), 1, `${abil} has one save row`);
    assertEqual(await save.locator('button.dot').count(), 1, `${abil} has its proficiency dot`);
    assert(/^[+−-]?\d+$/.test((await save.locator('.sval').innerText()).trim()), `${abil} shows a modifier`);
  }

  // --- The dot is the same control it was in the list ---
  const before = await profs(page);
  assert(!before.includes('wis'), `Wisdom starts unproficient (${before.join(', ')})`);
  const wisVal = () => box(page, 'Wis').locator('.save .sval').innerText();
  const was = Number((await wisVal()).replace('−', '-'));
  await box(page, 'Wis').locator('button.dot').click();
  await page.waitForTimeout(300);
  assert((await profs(page)).includes('wis'), 'clicking the dot takes the proficiency');
  assertEqual(
    Number((await wisVal()).replace('−', '-')),
    was + 2,
    'and the save picks up the proficiency bonus'
  );

  // A granted proficiency (the class's own) reads differently from a ticked one.
  const granted = await box(page, 'Con').locator('button.dot.granted').count();
  assert(granted === 1, 'a class-granted save shows as granted rather than ticked');

  // Reading a folded save is still reading: the number explains itself.
  await box(page, 'Wis').locator('.save .stat-value').click();
  await page.waitForTimeout(300);
  assert((await page.locator('.backdrop .modal').count()) > 0, 'the save opens its calculation');
  await page.keyboard.press('Escape');

  // --- A reminder pinned to a save has somewhere to live here ---
  await page.evaluate(() => {
    const key = 'cs.char.test';
    const c = JSON.parse(localStorage.getItem(key));
    c.reminders = [...(c.reminders ?? []), { id: 'r-save', anchor: 'save.wis', text: 'adv. vs charm' }];
    localStorage.setItem(key, JSON.stringify(c));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.cell', { timeout: 20000 });
  await page.waitForTimeout(400);
  assert(
    /adv\. vs charm/.test(await box(page, 'Wis').innerText()),
    'a save reminder shows in the ability box, so folding the block strands nothing'
  );

  // --- Back at desktop the standalone block still holds the same state ---
  await page.setViewportSize({ width: 1200, height: 2100 });
  await page.waitForTimeout(600);
  const saves = cell(page, 'Saving Throws');
  assert((await saves.count()) === 1, 'the wide template still has its own saves block');
  assert(
    (await saves.locator('li', { hasText: 'Wisdom' }).locator('button.dot.on').count()) === 1,
    'showing the proficiency taken on the phone'
  );

  // Leave the character as it was found.
  await saves.locator('li', { hasText: 'Wisdom' }).locator('button.dot').click();
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const key = 'cs.char.test';
    const c = JSON.parse(localStorage.getItem(key));
    c.reminders = (c.reminders ?? []).filter((r) => r.id !== 'r-save');
    localStorage.setItem(key, JSON.stringify(c));
  });
}
