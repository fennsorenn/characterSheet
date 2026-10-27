import { assert, assertEqual, cell, dockMenu } from '../harness.mjs';

// Sharing an account character with a GM tool: the player makes a code in
// "Share with GM", the tool (played here by plain fetches from the test, as the
// rpg_manager server would) trades it for a token, reads the sheet's summary,
// and writes hit points. The open sheet shows the write within a second, and
// the player's next edit autosaves on top of it rather than reverting it.
// Revoking from the panel cuts the token off.

const hpField = (page, label) => cell(page, 'Hit Points').locator(`[aria-label="${label}"]`);
const fieldValue = (loc) => loc.evaluate((el) => ('value' in el ? el.value : el.textContent).trim());

async function ext(baseUrl, method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(baseUrl + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function until(fn, what, timeout = 5000) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > timeout) throw new Error(`timed out: ${what}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

export default async function ({ page, baseUrl }) {
  const user = 'gm' + Math.floor(Math.random() * 1e9);
  page.on('dialog', (d) => d.accept());

  // --- An account character, open on its sheet ---
  await page.goto(`${baseUrl}/signup`, { waitUntil: 'networkidle' });
  await page.fill('input[autocomplete=username]', user);
  await page.fill('input[type=password]', 'secret123');
  await page.click('button.primary');
  await page.waitForTimeout(400);
  await page.fill('.new input', 'Bran');
  await page.click('.new button.primary');
  await page.waitForSelector('.cell', { timeout: 10000 });

  // --- Share with GM: read & write, make a code ---
  await dockMenu(page, 'Share with GM');
  const panel = page.locator('[role=region][aria-label="Share with GM"]');
  await panel.waitFor({ timeout: 5000 });
  await panel.locator('label', { hasText: 'Read & write' }).click();
  await panel.locator('button', { hasText: 'Create link code' }).click();
  const shown = await panel.locator('[aria-label="Link code"]').innerText();
  assert(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(shown), `a code like ABCD-EFGH is shown (got ${shown})`);
  assert(/expires in 1[45]:\d\d/.test(await panel.locator('[data-testid=gm-link-code]').innerText()), 'with a 15-minute countdown');

  // --- The GM tool exchanges it (dash and all, as typed) ---
  const ex = await ext(baseUrl, 'POST', '/api/ext/links/exchange', { body: { code: shown.toLowerCase(), label: 'Tuesday campaign' } });
  assertEqual(ex.status, 200, 'the code exchanges for a token');
  assertEqual(ex.body.access, 'write', 'at the access the player chose');
  const again = await ext(baseUrl, 'POST', '/api/ext/links/exchange', { body: { code: shown } });
  assertEqual(again.status, 400, 'a second exchange of the same code fails');
  const { token } = ex.body;

  // The panel notices the code was used and lists the link.
  await until(async () => (await panel.locator('.links li', { hasText: 'Tuesday campaign' }).count()) === 1, 'the link is listed', 8000);

  // --- The sheet saved a summary the GM can read (the dataset is loaded) ---
  const read = await until(async () => {
    const r = await ext(baseUrl, 'GET', '/api/ext/character', { token });
    return r.body.summary ? r : null;
  }, 'a summary was saved');
  assertEqual(read.body.name, 'Bran', 'the GM reads the character');
  assert(typeof read.body.summary.ac === 'number' && read.body.summary.level === 1, 'with its AC and level');
  const max = read.body.status.hp.max;

  // --- A GM write shows on the open sheet within a second ---
  const patched = await ext(baseUrl, 'PATCH', '/api/ext/character/status', {
    token,
    body: { hp: { current: 3 }, conditions: ['Poisoned'] }
  });
  assertEqual(patched.status, 200, 'the GM can write status');
  const t0 = Date.now();
  await until(async () => (await fieldValue(hpField(page, 'Current hit points'))) === '3', 'the sheet shows the new HP', 1000);
  assert(Date.now() - t0 <= 1000, 'within a second');

  // --- The player's next edit saves on top of it, not over it ---
  const temp = hpField(page, 'Temporary hit points');
  await temp.click();
  await temp.fill('5');
  await temp.press('Enter');
  const after = await until(async () => {
    const r = await ext(baseUrl, 'GET', '/api/ext/character', { token });
    return r.body.status.hp.temp === 5 ? r : null;
  }, "the player's edit was saved");
  assertEqual(after.body.status.hp, { current: 3, max, temp: 5 }, "the GM's HP survived the autosave");
  assertEqual(after.body.status.conditions, ['Poisoned'], 'and so did the condition');

  // --- With the sheet's stream cut, a GM write lands as a 409 on the next
  // autosave instead — and the sheet rebases onto it rather than reverting it ---
  await page.route('**/api/characters/*/events*', (route) => route.abort());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.cell', { timeout: 10000 });
  await ext(baseUrl, 'PATCH', '/api/ext/character/status', { token, body: { hp: { current: 7 }, exhaustion: 2 } });
  await page.waitForTimeout(300);
  assertEqual(await fieldValue(hpField(page, 'Current hit points')), '3', 'without the stream the sheet has not heard');
  const temp2 = hpField(page, 'Temporary hit points');
  await temp2.click();
  await temp2.fill('9');
  await temp2.press('Enter');
  const rebased = await until(async () => {
    const r = await ext(baseUrl, 'GET', '/api/ext/character', { token });
    return r.body.status.hp.temp === 9 ? r : null;
  }, "the player's edit was saved after the conflict");
  assertEqual(rebased.body.status.hp, { current: 7, max, temp: 9 }, "the stale save did not revert the GM's HP");
  assertEqual(rebased.body.status.exhaustion, 2, 'or exhaustion');
  await until(async () => (await fieldValue(hpField(page, 'Current hit points'))) === '7', 'the sheet took the rebased HP');
  await page.unroute('**/api/characters/*/events*');

  // --- Revoke from the panel: the token stops working ---
  await dockMenu(page, 'Share with GM');
  await panel.waitFor({ timeout: 5000 });
  await panel.locator('.links li', { hasText: 'Tuesday campaign' }).locator('button', { hasText: 'Revoke' }).click();
  await until(async () => (await panel.locator('.links li').count()) === 0, 'the link is gone from the list');
  assertEqual((await ext(baseUrl, 'GET', '/api/ext/character', { token })).status, 401, 'a revoked token is refused');
}
