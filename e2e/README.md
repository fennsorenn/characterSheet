# End-to-end tests

Browser tests that drive the real app (Vite + a headless Chromium) and assert
on rendered behaviour the unit tests can't reach — pickers opening, proficiency
dots lighting up, blocks appearing, the grant pool flowing through the UI.

## Seeding data

The app loads its 5etools dataset at runtime, and that data is **not** bundled
in the repo (copyrighted). The suite is therefore seeded from a zip you point to
with an env var:

```bash
# local path
E2E_DATA_ZIP=/path/to/5etools.zip npm run e2e

# or a URL (downloaded to a temp file first)
E2E_DATA_ZIP=https://example.com/5etools.zip npm run e2e
```

If `E2E_DATA_ZIP` is unset the suite **skips** (exit 0), so CI without data is a
no-op rather than a failure.

## Other env vars

| var            | default                  | meaning                                              |
| -------------- | ------------------------ | ---------------------------------------------------- |
| `E2E_DATA_ZIP` | —                        | URL or path to the data zip (required, else skip)    |
| `E2E_BASE_URL` | spawns `vite`            | reuse an already-running server instead of spawning  |
| `E2E_PORT`     | `4321`                   | port to spawn `vite` on                              |
| `E2E_SPEC`     | —                        | substring filter, e.g. `E2E_SPEC=grants`             |

## Running

```bash
E2E_DATA_ZIP=/tmp/5etools.zip npm run e2e            # all specs, own server
E2E_DATA_ZIP=/tmp/5etools.zip E2E_SPEC=maneuvers npm run e2e
```

Playwright must be resolvable. It's preinstalled globally in the dev container
(the runner falls back to the global install); elsewhere run `npm i -D
playwright && npx playwright install chromium` first. It's intentionally not a
manifest dependency.

## Layout

- `harness.mjs` — server/zip/Playwright plumbing, seeding, shared UI helpers, assertions.
- `run.mjs` — discovers and runs `specs/*.e2e.mjs`, one fresh page each, reports pass/fail.
- `specs/*.e2e.mjs` — one default-exported `async ({ page, baseUrl, errors }) => {}` per flow.
- `archive/` — raw, unmaintained snapshots of exploratory scripts (env-specific
  paths, run by hand). Kept so the original verifications aren't lost; not part
  of `npm run e2e`.

## Writing a spec

```js
import { cell, browseAdd, assert } from '../harness.mjs';

export default async function ({ page }) {
  await browseAdd(page, 'feat', 'Actor');
  const cha = await page.locator('.ability', { hasText: 'Cha' }).first().locator('.eff .value').innerText();
  assert(cha === '11', `Actor +1 Cha (got ${cha})`);
}
```

The page is already seeded and reset to defaults. A spec fails if it throws or if
the page logged any console/page errors.
