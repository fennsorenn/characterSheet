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

### Planned phases

1. Data pipeline (user-supplied), inline-tag renderer, IndexedDB cache, quick import
2. Character schema + calc engine wiring + modifier/buff stack
3. Layout/block system + responsive default templates + frameless editing
4. Resources, rest/levelup utilities, edit shortcuts (delta input, scroll/drag)
5. Print/PDF export (Paged.js + pdf-lib)
6. PWA, homebrew content, party management, optional cloud sync
