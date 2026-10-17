# GM link API

How a GM tool (rpg_manager) reads and updates a player's character on this
server. The player grants access to **one character** at a time, choosing
**read** or **write**; the tool gets a bearer token bound to that character and
access level. There is no shared account: the two apps only ever talk server to
server, so no CORS is involved and the player's browser never contacts the GM
tool.

Implementation: `server/api.mjs` (routes), `server/store.mjs` (codes, links,
`rev`), `server/status.mjs` (status view + patch validation),
`server/events.mjs` (SSE fan-out). Tests: `server/*.test.mjs`,
`e2e/specs/gm-link.e2e.mjs`.

## The grant flow

1. On their sheet (account characters only) the player opens **Share with GM**
   in the dock menu, picks *Read only* or *Read & write*, and gets a code such
   as `YKA7-XXYC`: 8 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, valid
   for **15 minutes**, usable **once**. Codes are case-insensitive; dashes and
   spaces are ignored.
2. The GM enters the sheet's base URL and the code in their tool, whose server
   calls [`POST /api/ext/links/exchange`](#post-apiextlinksexchange) and stores
   the returned token (encrypted, on its side).
3. From then on the tool uses `Authorization: Bearer <token>` on every
   `/api/ext/*` call.
4. The player sees each link (with the label the tool gave it, when it was made
   and last used) and can revoke it. Revocation is immediate: the token answers
   401 and any open event stream receives `revoked` and is closed. Deleting the
   character revokes its links the same way.

Tokens look like `csl_<43 base64url chars>` and do not expire on their own.
Only their SHA-256 is stored here.

## Conventions

- JSON in and out. Errors are `{ "error": "<human message>", "code": "<machine code>" }`.
- Responses to `/api/ext/*` carry `Cache-Control: no-store`.
- The character is identified by its stable document id (`id`, a UUID), not
  its slug or name. A copy of a character has a new id and is not linked.
- **`rev`** is an integer bumped on every write to the character, by the player
  or through any link. It orders events and lets a writer detect that it is
  working from a stale copy.

| HTTP | `code`            | meaning                                                    |
| ---- | ----------------- | ---------------------------------------------------------- |
| 400  | `invalid_request` | body missing / not JSON / no code                          |
| 400  | `invalid_code`    | link code unknown, already used, or expired                |
| 400  | `invalid_patch`   | status patch failed validation (message says why)          |
| 401  | `invalid_token`   | missing, unknown or revoked token — drop the link          |
| 403  | `read_only`       | write attempted with a read-only link                      |
| 404  | `character_gone`  | the character no longer exists (normally revoked as well)  |
| 404  | `not_found`       | unknown `/api/ext` endpoint                                |
| 405  | `method_not_allowed` |                                                         |
| 409  | `conflict`        | `baseRev` given and stale; body carries current `rev` + `status` |

## Endpoints

### `POST /api/ext/links/exchange`

No auth. Body:

```json
{ "code": "YKA7-XXYC", "label": "Tuesday campaign" }
```

`label` (optional, ≤ 80 chars) is shown to the player next to the link — use
the campaign name.

`200`:

```json
{
  "token": "csl_…",
  "linkId": "4f0c…",
  "characterId": "9b1e…",
  "characterName": "Bran",
  "access": "write"
}
```

`400 invalid_code` for an unknown, used or expired code (indistinguishable on
purpose). A code is consumed by the first exchange that names it.

### `GET /api/ext/character`

```json
{
  "id": "9b1e…",
  "linkId": "4f0c…",
  "access": "read",
  "name": "Bran",
  "rev": 12,
  "updatedAt": 1792236767276,
  "summary": { … } ,
  "status": { … },
  "doc": { … }
}
```

- `doc` — the full character document as the sheet stores it
  (`src/lib/character/schema.ts`). Opaque to the GM tool; provided for
  completeness.
- `summary` — see [Summary](#summary). `null` until the player's sheet has
  saved once with a dataset loaded.
- `status` — see [Status](#status).

### `PATCH /api/ext/character/status`

Write links only (`403 read_only` otherwise). All fields optional; absolute
values, not deltas:

```json
{
  "hp": { "current": 12, "temp": 5 },
  "conditions": ["Poisoned", "Prone"],
  "exhaustion": 1,
  "resources": [{ "key": "short|Fighter|Action Surge", "used": 1 }],
  "spellSlots": [{ "level": 1, "expended": 2 }],
  "pact": { "expended": 1 },
  "baseRev": 12
}
```

Validation:

- Unknown top-level or `hp` keys, wrong types, negative or non-integer numbers
  → `400 invalid_patch`.
- `hp.current` is clamped to `[0, hp.max]`; `hp.temp` to `≥ 0`. `hp.max` is
  not writable (it is part of the build, not status).
- `conditions` replaces the whole list. Names must be one of the 14 standard
  conditions (Blinded, Charmed, Deafened, Frightened, Grappled, Incapacitated,
  Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned,
  Unconscious), case-insensitive; they are stored in that canonical casing.
- `exhaustion` is clamped to `0–6`.
- `resources[].key` must be a key from `status.resources` (a custom resource's
  id or a class resource's key); `used` is clamped to `[0, max]`. Unknown key →
  400.
- `spellSlots[].level` is `1–9`; `expended` is clamped to that level's max.
- `pact.expended` is clamped to the pact slot count (0 when there is none).
- `baseRev` (optional): if given and not equal to the current `rev`, nothing is
  written and you get `409 conflict` with `{ rev, status }`. Without it the
  write is last-write-wins per field — the v1 default.

`200`:

```json
{ "rev": 13, "changed": ["hp", "conditions"], "status": { … } }
```

A patch that changes nothing returns `changed: []` and does **not** bump `rev`
or emit events.

The player's open sheet shows the change within about a second (it follows its
own event stream), and its next autosave builds on it rather than reverting it.

### `DELETE /api/ext/link`

The GM side unlinking: revokes the calling token. `200 { "ok": true }`. The
link disappears from the player's list.

### `GET /api/ext/character/events` (SSE)

`Content-Type: text/event-stream`. The stream opens with `retry: 3000`, then
sends:

| event      | when                                   | data |
| ---------- | -------------------------------------- | ---- |
| `snapshot` | immediately on connect                 | `{ id, access, name, rev, updatedAt, summary, status }` |
| `status`   | a write changed any status field       | `{ rev, source: "owner" \| "gm", self, changed: [...], status }` |
| `summary`  | a player save changed the name or summary | `{ rev, name, summary }` |
| `revoked`  | the link was revoked / unlinked / character deleted; the stream then closes | `{ reason: "revoked" \| "unlinked" \| "deleted" }` |

- `changed` lists status field names: `hp`, `conditions`, `exhaustion`,
  `resources`, `spellSlots`, `pact`. `status` is always the full status view.
- `source` is `owner` for a player save and `gm` for a write through any link;
  `self` is true when it came through *this* link (your own PATCH echoing back).
- A player save that touches neither status nor summary (notes, say) sends
  nothing. `rev` can therefore jump between events.
- A comment line `: ping` every 25 s keeps proxies from timing the stream out.
- An invalid or revoked token gets a plain `401` JSON response instead of a
  stream. On reconnect you get a fresh `snapshot`, so no catch-up logic is
  needed: treat each `snapshot` as authoritative.

Suggested client behaviour: reconnect with backoff on network errors; on `401`
or a `revoked` event, mark the link dead and stop reconnecting.

## Status

What changes at the table. Computed by `statusOf()` in `server/status.mjs`
from the document plus the stored summary (for maxima the server cannot derive
without the rules data):

```json
{
  "hp": { "current": 22, "max": 30, "temp": 0 },
  "conditions": ["Prone"],
  "exhaustion": 0,
  "resources": [
    { "key": "r-uuid", "name": "Luck", "max": 3, "used": 1, "recharge": "long", "kind": "custom" },
    { "key": "short|Fighter|Action Surge", "name": "Action Surge", "max": 1, "used": 0, "recharge": "short", "kind": "feature" }
  ],
  "spellSlots": [{ "level": 1, "max": 4, "expended": 1 }],
  "pact": { "level": 3, "max": 2, "expended": 0 }
}
```

- `spellSlots` lists only levels with slots (or with expended slots).
- `pact` is `null` without warlock levels.
- `kind: "feature"` resources (Channel Divinity, Rage, …) and slot maxima come
  from the summary; before the first summary is saved they are missing / 0.

## Summary

Computed by the player's sheet from its calc graph on save
(`src/lib/character/summary.ts`) and stored beside the document. It is exactly
as fresh as the last save from an open sheet, and absent until a sheet with the
dataset loaded has saved. Shape (`v: 1`):

```json
{
  "v": 1,
  "name": "Brakka",
  "level": 5,
  "classes": [{ "name": "Cleric", "subclass": "Life", "level": 5 }],
  "race": "Dwarf",
  "background": "Acolyte",
  "ac": 18,
  "maxHp": 38,
  "initiative": 2,
  "profBonus": 3,
  "speed": { "walk": 30 },
  "senses": { "darkvision": 60 },
  "passive": { "perception": 16, "insight": 13, "investigation": 10 },
  "abilities": { "str": { "score": 10, "mod": 0 }, "dex": { "score": 14, "mod": 2 }, "…": {} },
  "saves": { "str": 0, "dex": 2, "con": 3, "int": 0, "wis": 6, "cha": 2 },
  "skills": { "acrobatics": 2, "…": 0, "perception": 6 },
  "spell": { "dc": 14, "attack": 6 },
  "languages": ["Common", "Dwarvish"],
  "resistances": ["Poison"],
  "immunities": [],
  "conditionImmunities": [],
  "resources": [{ "key": "…", "name": "…", "max": 2, "recharge": "short", "kind": "feature" }],
  "spellSlots": [{ "level": 1, "max": 4 }],
  "pact": null
}
```

`race`, `background`, `spell` and `subclass` are omitted when absent. Numbers
include active buffs and exhaustion, as the sheet shows them. Treat unknown
fields as additive; a breaking change bumps `v`.

## Owner-side routes (the sheet itself; cookie session)

Listed for completeness — the GM tool never calls these.

- `GET /api/characters/:slug` → `{ doc, rev, summary }`
- `PUT /api/characters/:slug` `{ name, doc, baseRev?, summary?, clientId? }` →
  `200 { slug, rev }`, or `409 { conflict: true, rev, doc }` when `baseRev` is
  stale. Without `baseRev`: last-write-wins. Without `summary`: the stored one
  is kept.
- `GET /api/characters/:slug/events?client=<id>` (SSE) → `ready { rev }` on
  connect, `change { rev, source, doc }` whenever someone other than that client
  wrote the character, `deleted {}`.
- `GET /api/characters/:slug/links` → `{ links: [{ id, access, label, createdAt, lastUsedAt }], pending: [{ id, access, expiresAt }] }`
- `POST /api/characters/:slug/links` `{ access: "read" | "write" }` → `201 { id, code, access, expiresAt }`
- `DELETE /api/characters/:slug/links/:id` → revokes a link or withdraws a pending code; `200 { ok: true }` or `404`.

## Operational notes

- State lives in the same JSON file as accounts (`CS_DATA_FILE`), under
  `links`. Pending codes are memory-only: a restart invalidates unused codes
  (the player makes a new one).
- SSE streams pass through Traefik unbuffered; `X-Accel-Buffering: no` is set
  for nginx. Each open stream is one held connection on the single Node
  process.
- There is no rate limit on code exchange; at 32⁸ codes with a 15-minute life a
  guess is not practical, but a limiter would be cheap to add if needed.
