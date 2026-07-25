# Character Sheet

A lightweight, modular, calculation-transparent character sheet editor/viewer
for 5e characters. Built with **Svelte + Vite + TypeScript**; served by a thin
**Express** static server. Frontend-first, offline-capable.

## Status

Early scaffold. The framework-agnostic **calculation engine** (`src/lib/calc`)
is implemented and tested — it is the core that powers transparent, editable,
introspectable derived values (AC, save DCs, attack bonuses, …) and modifier
layering (items, feats, conditions, temporary buffs).

## Data

The app does **not** bundle 5e content. It is designed to load the
[5etools data](https://github.com/5etools-mirror-3/5etools-src) **supplied by
the user at runtime** (and cache it in the browser). No copyrighted data lives
in this repo.

## Scripts

| Command            | Description                          |
| ------------------ | ------------------------------------ |
| `npm run dev`      | Vite dev server with HMR             |
| `npm test`         | Run the engine test suite (Vitest)   |
| `npm run check`    | Type-check Svelte + TS               |
| `npm run build`    | Production build to `dist/`          |
| `npm start`        | Build, then serve via Express        |

## Architecture

- **`src/lib/calc/`** — plain-TS dependency graph of named values. Inputs are
  editable; computed nodes derive from dependencies and layer typed modifiers.
  `explain()` returns the full computation tree behind any number. Reactive
  Svelte wrappers sit on top; the framework owns the UI, not the math.
- **`src/lib/layout/`** — a sheet is data, not markup: an ordered list of sized
  block instances. Arrangements are named **templates**. Eight are built in —
  one per screen-size category (mobile / tablet / desktop / ultrawide) × play
  style (martial / caster), each built for that breakpoint's column arithmetic.
  Built-ins are fixed: they live in code rather than in the saved library, so
  they can't be renamed, deleted or drifted, and editing blocks while one is
  active silently forks it into a copy of your own that the edit lands on. A
  template — built-in or yours — can be designated the preferred one per
  screen-size category, either for every character or for one character alone,
  and the sheet follows the viewport as it resizes. Signed in, your own
  templates sync to the server (last-write-wins on `updatedAt`) so they follow
  you between devices; signed out they live in localStorage.
- **Custom entries** — an item, spell or feature added by hand has no catalog
  text behind it, so its window holds a description you write instead, stored on
  the character. A description you have written always wins over catalog content,
  so your own text is never hidden; clearing it hands the entry back to the
  catalog. Features are otherwise derived from race/class/background/feats, so
  custom ones are the only features the document carries.
- **`src/lib/character/reminders.ts`** — short notes pinned to an exact spot on
  the sheet ("disadv. in armor" under Stealth). A reminder names an *anchor* —
  a skill, save, ability, attack, item, spell, or a whole block — rather than a
  position, so it stays attached through a template switch or a reflow to one
  column. A reminder can carry a longer explanation behind its one-liner, opened
  in a small floating window — from a button in reminder mode, or by clicking the
  note itself. They live on the character document, since what they say is
  usually a fact about that character's build or gear.

## CI & deployment

The CI workflow type-checks, unit-tests and builds every push and pull request.
The browser suite runs in the same job, but only where a dataset is available:
the repo ships without 5e content, so the step is a no-op unless an
`E2E_DATA_ZIP` repository secret points at a data zip. It ships as
[`deploy/ci.yml`](deploy/ci.yml) and needs moving to `.github/workflows/ci.yml`
once to take effect — see [`deploy/README.md`](deploy/README.md).

Deployment is pull-based. A systemd timer on the server follows the **`deploy`**
branch and rebuilds when it moves, so pushing there ships it:

```sh
git push origin main:deploy
```

Nothing pushes to the server — no webhook, no runner, and no credentials to it
held by GitHub. A commit that fails to build never displaces the running site,
and one that builds but comes up unhealthy is rolled back automatically. Setup
and operating notes are in [`deploy/README.md`](deploy/README.md).

### Planned phases

1. Data pipeline (user-supplied), inline-tag renderer, IndexedDB cache, quick import
2. Character schema + calc engine wiring + modifier/buff stack
3. Layout/block system + responsive default templates + frameless editing
4. Resources, rest/levelup utilities, edit shortcuts (delta input, scroll/drag)
5. Print/PDF export (Paged.js + pdf-lib)
6. PWA, homebrew content, party management, optional cloud sync
