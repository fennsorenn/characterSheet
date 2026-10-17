import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'node:http';
import { createApi } from './api.mjs';
import { createStore } from './store.mjs';
import { createHub } from './events.mjs';

/**
 * The HTTP contract: owner saves with `rev`/`baseRev`, link management, and the
 * bearer-token GM API including its event stream. A real server on a loopback
 * port, so SSE framing and connection teardown are exercised for real.
 */

let server;
let base;
let api;

beforeEach(async () => {
  api = createApi({ store: createStore(), hub: createHub({ heartbeatMs: 50 }) });
  server = createServer((req, res) => api(req, res, () => {
    res.statusCode = 404;
    res.end();
  }));
  await new Promise((r) => server.listen(0, '127.0.0.5', r));
  base = `http://127.0.0.5:${server.address().port}`;
});
afterEach(async () => {
  api.hub.stop();
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
});

async function call(method, path, { body, cookie, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json, headers: res.headers };
}

async function signup(username = 'player') {
  const res = await fetch(base + '/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'secret123' })
  });
  return res.headers.get('set-cookie').split(';')[0];
}

const charDoc = (over = {}) => ({
  id: 'char-1',
  name: 'Bran',
  hp: { max: 30, current: 30, temp: 0 },
  conditions: [],
  exhaustion: 0,
  resources: [],
  featureResourceUsed: {},
  spellSlots: Array.from({ length: 9 }, () => ({ max: 0, expended: 0 })),
  spellSlotsAuto: true,
  pactSlotsExpended: 0,
  ...over
});
const summary = { v: 1, level: 3, ac: 16, maxHp: 30, spellSlots: [{ level: 1, max: 2 }], resources: [], pact: null };

/** Open an SSE stream and pull parsed events from it on demand. */
async function sse(path, { cookie, token } = {}) {
  const ctrl = new AbortController();
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + path, { headers, signal: ctrl.signal });
  const queue = [];
  const waiters = [];
  let buf = '';
  let ended = false;
  let comments = 0;
  const decoder = new TextDecoder();
  (async () => {
    try {
      for await (const chunk of res.body) {
        buf += decoder.decode(chunk, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const frame = buf.slice(0, i);
          buf = buf.slice(i + 2);
          let event = 'message';
          let data = '';
          let isComment = true;
          for (const line of frame.split('\n')) {
            if (line.startsWith('event: ')) (event = line.slice(7)), (isComment = false);
            else if (line.startsWith('data: ')) (data += line.slice(6)), (isComment = false);
            else if (line.startsWith('retry:')) isComment = false;
          }
          if (isComment) {
            comments++;
            continue;
          }
          if (!data) continue;
          queue.push({ event, data: JSON.parse(data) });
          waiters.shift()?.();
        }
      }
    } catch {
      /* aborted */
    }
    ended = true;
    while (waiters.length) waiters.shift()();
  })();
  return {
    status: res.status,
    contentType: res.headers.get('content-type'),
    async next(timeout = 1000) {
      const t0 = Date.now();
      while (!queue.length) {
        if (ended) throw new Error('stream ended');
        if (Date.now() - t0 > timeout) throw new Error('timed out waiting for an event');
        await new Promise((r) => {
          waiters.push(r);
          setTimeout(r, 50);
        });
      }
      return queue.shift();
    },
    async ended(timeout = 1000) {
      const t0 = Date.now();
      while (!ended && Date.now() - t0 < timeout) await new Promise((r) => setTimeout(r, 20));
      return ended;
    },
    get comments() {
      return comments;
    },
    pending: () => queue.length,
    close: () => ctrl.abort()
  };
}

async function linkedToken(cookie, access = 'write', label = 'Campaign') {
  const code = await call('POST', '/api/characters/bran/links', { cookie, body: { access } });
  expect(code.status).toBe(201);
  const ex = await call('POST', '/api/ext/links/exchange', { body: { code: code.body.code, label } });
  expect(ex.status).toBe(200);
  return ex.body;
}

describe('owner saves', () => {
  it('returns rev on GET/PUT and 409s a stale baseRev with the current doc', async () => {
    const cookie = await signup();
    let r = await call('PUT', '/api/characters/bran', { cookie, body: { name: 'Bran', doc: charDoc() } });
    expect(r).toMatchObject({ status: 200, body: { slug: 'bran', rev: 1 } });
    r = await call('GET', '/api/characters/bran', { cookie });
    expect(r.body).toMatchObject({ rev: 1, doc: { id: 'char-1' } });
    r = await call('PUT', '/api/characters/bran', { cookie, body: { name: 'Bran', doc: charDoc({ exhaustion: 1 }), baseRev: 1 } });
    expect(r.body.rev).toBe(2);
    r = await call('PUT', '/api/characters/bran', { cookie, body: { name: 'Bran', doc: charDoc({ exhaustion: 3 }), baseRev: 1 } });
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ conflict: true, rev: 2, doc: { exhaustion: 1 } });
  });

  it('streams other writers’ changes to the open sheet, not its own', async () => {
    const cookie = await signup();
    await call('PUT', '/api/characters/bran', { cookie, body: { name: 'Bran', doc: charDoc(), summary } });
    const s = await sse('/api/characters/bran/events?client=tab-a', { cookie });
    expect(s.status).toBe(200);
    expect(s.contentType).toMatch(/text\/event-stream/);
    expect(await s.next()).toEqual({ event: 'ready', data: { rev: 1 } });

    // Its own save is not echoed back…
    await call('PUT', '/api/characters/bran', { cookie, body: { name: 'Bran', doc: charDoc({ exhaustion: 1 }), baseRev: 1, clientId: 'tab-a' } });
    // …another tab's is, with the whole document.
    await call('PUT', '/api/characters/bran', { cookie, body: { name: 'Bran', doc: charDoc({ exhaustion: 2 }), baseRev: 2, clientId: 'tab-b' } });
    const ev = await s.next();
    expect(ev.event).toBe('change');
    expect(ev.data).toMatchObject({ rev: 3, source: 'owner', doc: { exhaustion: 2 } });
    expect(s.pending()).toBe(0);
    s.close();
  });

  it('requires a session for sheet events and links', async () => {
    expect((await call('GET', '/api/characters/bran/events')).status).toBe(401);
    expect((await call('POST', '/api/characters/bran/links', { body: { access: 'read' } })).status).toBe(401);
  });
});

describe('link management', () => {
  it('creates codes, lists links and pending codes, and revokes', async () => {
    const cookie = await signup();
    await call('PUT', '/api/characters/bran', { cookie, body: { name: 'Bran', doc: charDoc() } });
    expect((await call('POST', '/api/characters/bran/links', { cookie, body: { access: 'owner' } })).status).toBe(400);
    expect((await call('POST', '/api/characters/ghost/links', { cookie, body: { access: 'read' } })).status).toBe(404);

    const code = await call('POST', '/api/characters/bran/links', { cookie, body: { access: 'read' } });
    expect(code.body).toMatchObject({ access: 'read', code: expect.stringMatching(/^[A-Z2-9]{8}$/) });
    let list = await call('GET', '/api/characters/bran/links', { cookie });
    expect(list.body.pending).toHaveLength(1);
    expect(list.body.links).toHaveLength(0);

    const ex = await call('POST', '/api/ext/links/exchange', { body: { code: code.body.code, label: 'Tuesday' } });
    expect(ex.body).toMatchObject({ characterId: 'char-1', characterName: 'Bran', access: 'read', token: expect.any(String) });
    list = await call('GET', '/api/characters/bran/links', { cookie });
    expect(list.body.pending).toHaveLength(0);
    expect(list.body.links).toEqual([expect.objectContaining({ id: ex.body.linkId, access: 'read', label: 'Tuesday' })]);

    expect((await call('DELETE', `/api/characters/bran/links/${ex.body.linkId}`, { cookie })).status).toBe(200);
    expect((await call('GET', '/api/ext/character', { token: ex.body.token })).status).toBe(401);
    expect((await call('DELETE', `/api/characters/bran/links/${ex.body.linkId}`, { cookie })).status).toBe(404);
  });

  it("does not let another user see or revoke a character's links", async () => {
    const owner = await signup('owner');
    await call('PUT', '/api/characters/bran', { cookie: owner, body: { name: 'Bran', doc: charDoc() } });
    const link = await linkedToken(owner);
    const other = await signup('other');
    expect((await call('GET', '/api/characters/bran/links', { cookie: other })).status).toBe(404);
    expect((await call('DELETE', `/api/characters/bran/links/${link.linkId}`, { cookie: other })).status).toBe(404);
    expect((await call('GET', '/api/ext/character', { token: link.token })).status).toBe(200);
  });
});

describe('GM API', () => {
  it('exchanges a code only once', async () => {
    const cookie = await signup();
    await call('PUT', '/api/characters/bran', { cookie, body: { name: 'Bran', doc: charDoc() } });
    const code = await call('POST', '/api/characters/bran/links', { cookie, body: { access: 'read' } });
    expect((await call('POST', '/api/ext/links/exchange', { body: { code: code.body.code } })).status).toBe(200);
    const again = await call('POST', '/api/ext/links/exchange', { body: { code: code.body.code } });
    expect(again).toMatchObject({ status: 400, body: { code: 'invalid_code' } });
    expect((await call('POST', '/api/ext/links/exchange', { body: {} })).status).toBe(400);
  });

  it('reads the character with summary and status', async () => {
    const cookie = await signup();
    await call('PUT', '/api/characters/bran', { cookie, body: { name: 'Bran', doc: charDoc(), summary } });
    const { token } = await linkedToken(cookie, 'read');
    const r = await call('GET', '/api/ext/character', { token });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      id: 'char-1',
      name: 'Bran',
      rev: 1,
      access: 'read',
      summary: { ac: 16 },
      status: { hp: { current: 30, max: 30, temp: 0 }, spellSlots: [{ level: 1, max: 2, expended: 0 }] },
      doc: { id: 'char-1' }
    });
    expect((await call('GET', '/api/ext/character')).status).toBe(401);
    expect((await call('GET', '/api/ext/character', { token: 'csl_nope' })).body.code).toBe('invalid_token');
  });

  it('refuses writes through a read-only link', async () => {
    const cookie = await signup();
    await call('PUT', '/api/characters/bran', { cookie, body: { name: 'Bran', doc: charDoc() } });
    const { token } = await linkedToken(cookie, 'read');
    const r = await call('PATCH', '/api/ext/character/status', { token, body: { hp: { current: 1 } } });
    expect(r).toMatchObject({ status: 403, body: { code: 'read_only' } });
    expect((await call('GET', '/api/characters/bran', { cookie })).body.doc.hp.current).toBe(30);
  });

  it('patches status, bumps rev, validates, and honours baseRev', async () => {
    const cookie = await signup();
    await call('PUT', '/api/characters/bran', { cookie, body: { name: 'Bran', doc: charDoc(), summary } });
    const { token } = await linkedToken(cookie);
    let r = await call('PATCH', '/api/ext/character/status', { token, body: { hp: { current: 12, temp: 3 }, conditions: ['poisoned'] } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ rev: 2, changed: ['hp', 'conditions'], status: { hp: { current: 12, temp: 3 }, conditions: ['Poisoned'] } });
    expect((await call('GET', '/api/characters/bran', { cookie })).body).toMatchObject({ rev: 2, doc: { hp: { current: 12 } } });

    r = await call('PATCH', '/api/ext/character/status', { token, body: { conditions: ['Hangry'] } });
    expect(r).toMatchObject({ status: 400, body: { code: 'invalid_patch' } });
    r = await call('PATCH', '/api/ext/character/status', { token, body: { exhaustion: 1, baseRev: 1 } });
    expect(r).toMatchObject({ status: 409, body: { code: 'conflict', rev: 2, status: { exhaustion: 0 } } });
    r = await call('PATCH', '/api/ext/character/status', { token, body: { exhaustion: 1, baseRev: 2 } });
    expect(r.body.rev).toBe(3);

    // The owner's next save from the old rev now conflicts instead of reverting it.
    r = await call('PUT', '/api/characters/bran', { cookie, body: { name: 'Bran', doc: charDoc(), baseRev: 1 } });
    expect(r.status).toBe(409);
    expect(r.body.doc).toMatchObject({ hp: { current: 12, temp: 3 }, exhaustion: 1 });
  });

  it('streams a snapshot, then status and summary changes from either side', async () => {
    const cookie = await signup();
    await call('PUT', '/api/characters/bran', { cookie, body: { name: 'Bran', doc: charDoc(), summary } });
    const { token } = await linkedToken(cookie);
    const gm = await sse('/api/ext/character/events', { token });
    const sheet = await sse('/api/characters/bran/events?client=tab-a', { cookie });
    expect(await sheet.next()).toMatchObject({ event: 'ready' });

    const snap = await gm.next();
    expect(snap.event).toBe('snapshot');
    expect(snap.data).toMatchObject({ id: 'char-1', rev: 1, access: 'write', summary: { ac: 16 }, status: { hp: { current: 30 } } });

    // GM writes: the sheet gets the whole doc, the GM stream a status event.
    await call('PATCH', '/api/ext/character/status', { token, body: { hp: { current: 7 } } });
    const change = await sheet.next();
    expect(change).toMatchObject({ event: 'change', data: { rev: 2, source: 'gm', doc: { hp: { current: 7 } } } });
    expect(await gm.next()).toMatchObject({ event: 'status', data: { rev: 2, source: 'gm', self: true, changed: ['hp'] } });

    // Player writes: status (healed) and summary (AC up) both reach the GM.
    await call('PUT', '/api/characters/bran', {
      cookie,
      body: { name: 'Bran', doc: charDoc({ hp: { max: 30, current: 30, temp: 0 } }), baseRev: 2, summary: { ...summary, ac: 18 }, clientId: 'tab-a' }
    });
    expect(await gm.next()).toMatchObject({ event: 'status', data: { rev: 3, source: 'owner', self: false, status: { hp: { current: 30 } } } });
    expect(await gm.next()).toMatchObject({ event: 'summary', data: { rev: 3, name: 'Bran', summary: { ac: 18 } } });

    // A save that changes neither (notes, say) says nothing to the GM.
    await call('PUT', '/api/characters/bran', {
      cookie,
      body: { name: 'Bran', doc: charDoc({ notes: [{ id: 'n' }] }), baseRev: 3, summary: { ...summary, ac: 18 }, clientId: 'tab-a' }
    });
    await new Promise((r) => setTimeout(r, 150));
    expect(gm.pending()).toBe(0);
    expect(gm.comments).toBeGreaterThan(0); // heartbeats
    gm.close();
    sheet.close();
  });

  it('ends the stream and kills the token on revoke', async () => {
    const cookie = await signup();
    await call('PUT', '/api/characters/bran', { cookie, body: { name: 'Bran', doc: charDoc() } });
    const { token, linkId } = await linkedToken(cookie);
    const gm = await sse('/api/ext/character/events', { token });
    expect((await gm.next()).event).toBe('snapshot');
    await call('DELETE', `/api/characters/bran/links/${linkId}`, { cookie });
    expect(await gm.next()).toEqual({ event: 'revoked', data: { reason: 'revoked' } });
    expect(await gm.ended()).toBe(true);
    expect((await call('PATCH', '/api/ext/character/status', { token, body: { hp: { current: 1 } } })).status).toBe(401);
    const again = await sse('/api/ext/character/events', { token });
    expect(again.status).toBe(401);
    again.close();
  });

  it('lets the GM unlink, and drops links with their character', async () => {
    const cookie = await signup();
    await call('PUT', '/api/characters/bran', { cookie, body: { name: 'Bran', doc: charDoc() } });
    const a = await linkedToken(cookie);
    expect((await call('DELETE', '/api/ext/link', { token: a.token })).status).toBe(200);
    expect((await call('GET', '/api/ext/character', { token: a.token })).status).toBe(401);
    expect((await call('GET', '/api/characters/bran/links', { cookie })).body.links).toEqual([]);

    const b = await linkedToken(cookie);
    const gm = await sse('/api/ext/character/events', { token: b.token });
    await gm.next();
    await call('DELETE', '/api/characters/bran', { cookie });
    expect(await gm.next()).toEqual({ event: 'revoked', data: { reason: 'deleted' } });
    expect((await call('GET', '/api/ext/character', { token: b.token })).status).toBe(401);
  });
});
