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
- **Variants vs. options** (`src/lib/layout/types.ts`) — a **variant** is an
  arrangement (a row of chips instead of a grid of boxes); an **option** is one
  line item the block shows or hides. Variants multiply badly — "full", "full
  without the passives", "full plus passive investigation" is a list nobody wants
  to pick from — so anything that is really just *another row* is an option
  instead, ticked per placed block. Two instances of one block with different
  options then cover what a second block type would otherwise be for: Defenses &
  Core with everything off but the spell pair *is* the spellcasting block. A
  layout stores only the options its owner disagreed with, so a default that
  changes later still reaches everyone who never had an opinion about it.
- **The dock** (`src/lib/components/Dock.svelte`) — one edge-anchored surface
  holding what used to be three separate bars. It takes the right edge on a
  desktop and the bottom on a phone, and slides open in place rather than
  opening a menu somewhere else. Its first layer is what you touch mid-session
  — dice, buff mode, reminders, quick add — and everything to do with building
  or exporting the sheet sits one expand away. Pinned creatures live in it too,
  so an open statblock and the controls share a surface instead of competing for
  the same corner — though the statblock itself only unfolds *inside* the dock
  on a phone; anywhere wider it opens in the draggable detail window, since a
  statblock in a 310px rail is a column of two-word lines. Turning buff mode on opens it onto the list of buffs it is
  applying, each clearable on its own. On a phone the dice roller opens in the
  dock as well — a 300px floating window on a 420px screen spent its life over
  the dock beneath it — while on wider screens it stays a window you can drag
  wherever you like.
- **Edit / Play / Read** (`src/lib/stores/mode.ts`) — one control in the dock
  decides how much of the sheet accepts input. **Edit** is everything. **Play**
  keeps what the character *is* out of reach — ability scores, max HP, class
  levels, proficiencies, what is in the pack — while leaving what it currently
  *has* editable: hit points, expended slots and uses, conditions, effects,
  notes. **Read** locks the lot, but rolling, tracing a number and expanding an
  entry still work, because reading a sheet is not editing it. The split is a
  property of each control, so the two tiers are named in the code
  (`canEditBuild` / `canEditPlay`) rather than inferred from the block.
- **Choosing vs. reading** — picking what a character *is* and reading what that
  gave them are separate blocks. **Race, Class & Feats** holds the selectors;
  **Features & Traits** lists what they granted, with the choices each feature
  still wants. A finished character can shrink or drop the former without losing
  the latter.
- **The value dial** (`src/lib/components/numberDial.ts`) — a phone's keyboard
  covers half the sheet to type a number that is nearly always a small nudge from
  the one already there. Where the pointer is coarse, a number opens a dial
  instead: an arrow above and below each digit, the new value and the change it
  would make shown together, nothing written until Apply. Stepping carries rather
  than cycling — ▲ over the tens of 99 gives 109, not 9. Digit counts come from
  each field's own bounds, and the ceiling is what sizes it (a field with `min: 0`
  and no maximum is not one digit wide). The mode lives under **More** in the dock:
  on touch (the default), always, or never — and even forced on, a fine pointer
  can still type the value straight into the dial.
- **Rules tooltips** (`src/lib/components/rulesTip.ts`) — a condition chip
  explains itself: hover it with a mouse, hold it on a touchscreen, or focus it
  with a keyboard. Hold rather than tap, because tapping a chip already toggles
  the condition — so the press that opens the rules swallows the click it would
  otherwise fire. The wording is catalog content looked up by name (2024 printing
  first, since that is the edition the sheet's own rules follow), so it is absent
  until a dataset is imported and the chips simply have nothing to explain.
  Chips are `aria-disabled` rather than `disabled` outside play, because a
  browser dispatches no pointer events at a disabled control and read mode is
  exactly when someone wants to look a condition up.
- **Two libraries** (`src/lib/stores/transfer.ts`) — characters live either on
  this device (localStorage) or in an account on the server. The selection screen
  copies a character either way: *To account* on a local one while signed in, *To
  device* on one of yours. It is a copy, not a link — the two diverge from that
  moment, since there is no sane merge for a character edited in both places — so
  it takes a fresh id and a name free in the library it lands in ("Bran (2)").
- **Your own movement, proficiencies, skills and attacks** — a speed, a sense,
  a language, a tool, a weapon or armor proficiency, a resistance or immunity
  typed by hand becomes a **grant from "Custom"**, joining the same pool a race
  or feat feeds. Nothing downstream knows the difference: a typed weapon
  proficiency reaches the attack rows, a typed skill proficiency reaches the
  graph, a typed swim speed reaches the traits row, and a chip the player added
  is the only kind with a ✕ on it. Skills and attacks the game doesn't have are
  documents of their own — a custom skill names its governing ability, a custom
  attack its ability, proficiency and flat bonus — and both become **nodes on the
  same calc graph**, so they explain themselves in the popover and take Bless and
  exhaustion like anything else. Their node ids are keyed by entry id rather than
  name, so renaming one doesn't strand the reminders pinned to it.
- **Custom entries** — an item, spell or feature added by hand has no catalog
  text behind it, so its window holds a description you write instead, stored on
  the character. A description you have written always wins over catalog content,
  so your own text is never hidden; clearing it hands the entry back to the
  catalog. All three lists take one the same way — type a name into the quick-add
  bar at the foot of the list and press Enter. Features are otherwise derived
  from race/class/background/feats, so custom ones are the only features the
  document carries, and the only ones a row offers to delete.
- **`src/lib/character/reminders.ts`** — short notes pinned to an exact spot on
  the sheet ("disadv. in armor" under Stealth). A reminder names an *anchor* —
  a skill, save, ability, attack, item, spell, or a whole block — rather than a
  position, so it stays attached through a template switch or a reflow to one
  column. A reminder can carry a longer explanation behind its one-liner, opened
  in a small floating window — from a button in reminder mode, or by clicking the
  note itself. They live on the character document, since what they say is
  usually a fact about that character's build or gear.

## CI & deployment

`.github/workflows/ci.yml` type-checks, unit-tests and builds every push and
pull request. The browser suite runs in the same job, but only where a dataset
is available: the repo ships without 5e content, so the step is a no-op unless
an `E2E_DATA_ZIP` repository secret points at a data zip.

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
