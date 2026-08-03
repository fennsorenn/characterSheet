# Working notes

## Testing cadence

Do **not** run the whole browser suite after every small change — it takes
several minutes and most of it is unrelated to whatever just moved.

- While iterating, and before any ordinary commit: `npm run check`, `npm test`
  (unit, seconds), and the **relevant** spec(s) only —
  `E2E_DATA_ZIP=/tmp/5etools.zip E2E_SPEC=<name> npm run e2e`. This is the
  default; do not reach past it because a change "feels" wide-reaching.
- The full `E2E_DATA_ZIP=/tmp/5etools.zip npm run e2e` is for **deploys**, or
  when explicitly asked for. It takes minutes and sometimes gets OOM-killed.

The dataset lives at `/tmp/5etools.zip`; without `E2E_DATA_ZIP` the browser
suite skips itself, so a "pass" with no output means nothing ran.

## Verifying a fix

A spec that passes the first time has not been shown to work. Break the thing it
covers (invert a condition, drop a term) and confirm the spec fails, then put it
back. Several assertions in this repo passed for the wrong reason until that was
done.
