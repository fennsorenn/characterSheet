# Archived exploratory scripts

Raw, unmaintained snapshots of the ad-hoc Playwright scripts used to verify
features as they were built. They are kept so the original verifications aren't
lost, but they are **not** part of `npm run e2e` and are not maintained:

- they hardcode environment-specific paths (e.g. `/tmp/5etools.zip`, the global
  Playwright install, `http://localhost:3000`);
- they mostly `console.log` observations rather than assert;
- selectors may have drifted since they were written.

To run one by hand in the dev container (with a server on :3000 and the data zip
present):

```bash
NODE_PATH=$(npm root -g) node e2e/archive/grants.mjs
```

Maintained, asserting versions of the important flows live in `../specs/`. When
porting one here into a real spec, delete the archived copy.
