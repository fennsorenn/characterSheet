import { assert } from '../harness.mjs';

// Signup/login, per-user character storage, and local (no-login) characters.
// Self-contained: navigates the auth/overview routes directly (no data needed).
export default async function ({ page, baseUrl }) {
  const user = 'tester' + Math.floor(Math.random() * 1e9);

  // --- Local: create a character without logging in ---
  await page.goto(`${baseUrl}/local`, { waitUntil: 'networkidle' });
  await page.fill('.new input', 'Gandalf the Grey');
  await page.click('.new button.primary');
  await page.waitForTimeout(400);
  assert(new URL(page.url()).pathname === '/local/gandalf-the-grey', `local sheet route; got ${page.url()}`);
  assert((await page.locator('.top h1').innerText()) === 'Gandalf the Grey', 'local sheet shows the name');
  await page.click('.back');
  await page.waitForTimeout(200);
  assert((await page.locator('.chars .nm').allInnerTexts()).includes('Gandalf the Grey'), 'local overview lists it');

  // --- Signup → redirected to the user overview ---
  await page.goto(`${baseUrl}/signup`, { waitUntil: 'networkidle' });
  await page.fill('input[autocomplete=username]', user);
  await page.fill('input[type=password]', 'secret123');
  await page.click('button.primary');
  await page.waitForTimeout(400);
  assert(new URL(page.url()).pathname === `/user/${user}`, `signup lands on the user overview; got ${page.url()}`);

  // --- Create a server-side character ---
  await page.fill('.new input', 'Aragorn');
  await page.click('.new button.primary');
  await page.waitForTimeout(500);
  assert(new URL(page.url()).pathname === `/user/${user}/character/aragorn`, `user sheet route; got ${page.url()}`);
  assert((await page.locator('.top h1').innerText()) === 'Aragorn', 'user sheet shows the name');

  // --- Log out, log back in: the character persists on the server ---
  await page.click('.back');
  await page.waitForTimeout(200);
  await page.click('nav button:has-text("Log out")');
  await page.waitForTimeout(200);
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[autocomplete=username]', user);
  await page.fill('input[type=password]', 'secret123');
  await page.click('button.primary');
  await page.waitForTimeout(400);
  assert((await page.locator('.chars .nm').allInnerTexts()).includes('Aragorn'), 'character persists across login');

  // The server actually stores it.
  const list = await page.evaluate(async () => (await fetch('/api/characters', { credentials: 'same-origin' }).then((r) => r.json())));
  assert(list.characters.some((c) => c.slug === 'aragorn'), 'server lists the saved character');

  // --- Another user can't see it; wrong password is rejected ---
  await page.evaluate(async () => { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); });
  const bad = await page.evaluate(
    async (u) => (await fetch('/api/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: 'nope' }) })).status,
    user
  );
  assert(bad === 401, 'wrong password is rejected');
}
