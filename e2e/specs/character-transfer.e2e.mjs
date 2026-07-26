import { assert, assertEqual } from '../harness.mjs';

const names = (page) => page.locator('.chars .nm').allInnerTexts();

// Copying a character between the two libraries — this device's localStorage
// and a signed-in account — from the selection screen, both directions.
// Self-contained: the auth and overview routes need no 5e data.
export default async function ({ page, baseUrl }) {
  const user = 'copier' + Math.floor(Math.random() * 1e9);

  // --- A local character, edited so the copy has something to carry ---
  await page.goto(`${baseUrl}/local`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.removeItem('cs.local.index');
    for (const k of Object.keys(localStorage)) if (k.startsWith('cs.char.')) localStorage.removeItem(k);
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.fill('.new input', 'Bran');
  await page.click('.new button.primary');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const doc = JSON.parse(localStorage.getItem('cs.char.bran'));
    doc.hp = { max: 42, current: 37, temp: 0 };
    localStorage.setItem('cs.char.bran', JSON.stringify(doc));
  });

  // Signed out there is nothing to copy to, so the control is not offered.
  await page.goto(`${baseUrl}/local`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.chars li');
  assertEqual(await page.locator('.chars button.cp').count(), 0, 'no copy control while signed out');

  // --- Sign up, then copy the local character up to the account ---
  await page.goto(`${baseUrl}/signup`, { waitUntil: 'networkidle' });
  await page.fill('input[autocomplete=username]', user);
  await page.fill('input[type=password]', 'secret123');
  await page.click('button.primary');
  await page.waitForTimeout(500);

  await page.goto(`${baseUrl}/local`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.chars button.cp');
  await page.locator('.chars li', { hasText: 'Bran' }).locator('button.cp').click();
  await page.waitForSelector('.notice');
  assert(/Copied to .+ characters as "Bran"/.test(await page.locator('.notice').innerText()), 'it says where it went');
  assert(!(await page.locator('.notice').getAttribute('class')).includes('err'), 'and it is not an error');
  assert((await names(page)).filter((n) => n === 'Bran').length === 1, 'the local list is unchanged');

  // The copy is a whole character on the server, not just a name.
  const stored = await page.evaluate(async () => {
    const list = await (await fetch('/api/characters', { credentials: 'same-origin' })).json();
    const one = await (await fetch(`/api/characters/${list.characters[0].slug}`, { credentials: 'same-origin' })).json();
    return { count: list.characters.length, slug: list.characters[0].slug, doc: one.doc };
  });
  assertEqual(stored.count, 1, 'the account holds exactly one character');
  assertEqual(stored.slug, 'bran', 'under a slug from its name');
  assertEqual(stored.doc.hp.max, 42, 'carrying the edited document');
  const localId = await page.evaluate(() => JSON.parse(localStorage.getItem('cs.char.bran')).id);
  assert(stored.doc.id !== localId, 'the copy is a separate character, not the same one in two places');

  // --- And back down: the same character copied to this device ---
  await page.goto(`${baseUrl}/user/${user}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.chars button.cp');
  await page.locator('.chars li', { hasText: 'Bran' }).locator('button.cp').click();
  await page.waitForSelector('.notice');
  assert(/Copied to this device as "Bran \(2\)"/.test(await page.locator('.notice').innerText()), 'the name is freed on the way in');

  const local = await page.evaluate(() => JSON.parse(localStorage.getItem('cs.local.index')));
  assertEqual(local.length, 2, 'the device now holds two');
  const copy = local.find((e) => e.name === 'Bran (2)');
  assert(copy && copy.slug === 'bran-2', `the copy got its own slug (${copy?.slug})`);
  const docs = await page.evaluate(() => ({
    original: JSON.parse(localStorage.getItem('cs.char.bran')),
    copy: JSON.parse(localStorage.getItem('cs.char.bran-2'))
  }));
  assertEqual(docs.copy.hp.max, 42, 'the copy carries the document');
  assertEqual(docs.copy.name, 'Bran (2)', 'and its document knows its new name');
  // Against the document it was actually copied from — the account's, which is
  // itself already a copy and so has its own id.
  assert(
    docs.copy.id !== stored.doc.id && docs.copy.id !== docs.original.id,
    'and its own id, distinct from every character it came from'
  );

  // --- Both are listed, and the copy opens as its own sheet ---
  await page.goto(`${baseUrl}/local`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.chars li');
  const listed = await names(page);
  assert(listed.includes('Bran') && listed.includes('Bran (2)'), `both are listed (${listed.join(', ')})`);
  await page.locator('.chars li', { hasText: 'Bran (2)' }).locator('button.open').click();
  await page.waitForTimeout(400);
  assertEqual(new URL(page.url()).pathname, '/local/bran-2', 'the copy opens at its own route');

  // Editing the copy leaves the original alone — they are not linked.
  await page.evaluate(() => {
    const doc = JSON.parse(localStorage.getItem('cs.char.bran-2'));
    doc.hp.max = 99;
    localStorage.setItem('cs.char.bran-2', JSON.stringify(doc));
  });
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('cs.char.bran')).hp.max);
  assertEqual(after, 42, 'the original is untouched');

  // Leave nothing behind for the specs that follow.
  await page.evaluate(async () => {
    localStorage.removeItem('cs.local.index');
    for (const k of Object.keys(localStorage)) if (k.startsWith('cs.char.')) localStorage.removeItem(k);
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  });
}
