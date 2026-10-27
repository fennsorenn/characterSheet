import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createStore } from './store.mjs';
import { createHub, sseHeaders, sseSend } from './events.mjs';
import { statusOf, statusDiff } from './status.mjs';

/**
 * Connect-style API middleware shared by the Vite dev server and the Express
 * production server, so `/api/auth/*` and `/api/characters/*` behave the same
 * in dev, tests, and prod. Anything else falls through to `next()`.
 */

const SESSION_DAYS = 30;

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj ?? {});
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(body);
}
/** Parsed JSON body; `{}` when empty, `undefined` when it isn't JSON. */
function readJson(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve(undefined);
      }
    });
    req.on('error', () => resolve(undefined));
  });
}
const readBody = async (req) => (await readJson(req)) ?? {};
function getCookie(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}
function setSession(res, token) {
  res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`);
}
function clearSession(res) {
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
}

/**
 * Build the middleware around a store. Tests pass an in-memory store; the app
 * uses the default {@link apiMiddleware} over the JSON file.
 */
export function createApi({ store, hub = createHub() }) {
  const middleware = (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    if (path === '/api/fetch') {
      proxyFetch(req, res, url).catch((e) => sendJson(res, 502, { error: `Proxy fetch failed: ${e?.message ?? e}` }));
      return;
    }
    const known =
      path.startsWith('/api/auth') || path.startsWith('/api/characters') || path === '/api/templates' || path.startsWith('/api/ext/');
    if (!known) return next?.();
    const run = path.startsWith('/api/ext/') ? handleExt(store, hub, req, res, path) : handle(store, hub, req, res, path, url);
    run.catch((e) => {
      if (!res.headersSent) sendJson(res, 500, { error: String(e?.message ?? e) });
      else res.end();
    });
  };
  middleware.store = store;
  middleware.hub = hub;
  return middleware;
}

let defaultApi;
/** The app's API over `CS_DATA_FILE` (or data/users.json), created on first use. */
export function apiMiddleware(req, res, next) {
  if (!defaultApi) {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const file = process.env.CS_DATA_FILE || join(__dirname, '..', 'data', 'users.json');
    defaultApi = createApi({ store: createStore({ file }) });
  }
  return defaultApi(req, res, next);
}

/**
 * CORS-bypass proxy so the frontend can load a release zip or a prerelease/brew
 * JSON supplied by URL. Only https URLs are proxied; the upstream body is
 * streamed straight back to the browser. Lives here (not just in the Express
 * entry) so it works under the Vite dev server too.
 */
async function proxyFetch(req, res, url) {
  const target = url.searchParams.get('url');
  if (typeof target !== 'string' || !/^https:\/\//i.test(target)) {
    return sendJson(res, 400, { error: 'A valid https url is required.' });
  }
  const upstream = await fetch(target, { redirect: 'follow' });
  if (!upstream.ok || !upstream.body) {
    return sendJson(res, 502, { error: `Upstream responded ${upstream.status}` });
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/octet-stream');
  const length = upstream.headers.get('content-length');
  if (length) res.setHeader('Content-Length', length);
  const reader = upstream.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

async function handle(store, hub, req, res, path, url) {
  const method = req.method;
  const me = store.sessionUser(getCookie(req, 'sid'));

  // --- auth ---
  if (path === '/api/auth/me') return sendJson(res, 200, { username: me });

  if (path === '/api/auth/signup' && method === 'POST') {
    const { username, password } = await readBody(req);
    const r = store.createUser(username, password);
    if (r.error) return sendJson(res, 400, r);
    setSession(res, store.createSession(r.username));
    return sendJson(res, 200, { username: r.username });
  }
  if (path === '/api/auth/login' && method === 'POST') {
    const { username, password } = await readBody(req);
    const r = store.login(username, password);
    if (r.error) return sendJson(res, 401, r);
    setSession(res, store.createSession(r.username));
    return sendJson(res, 200, { username: r.username });
  }
  if (path === '/api/auth/logout' && method === 'POST') {
    store.deleteSession(getCookie(req, 'sid'));
    clearSession(res);
    return sendJson(res, 200, {});
  }

  // --- layout templates (auth required) ---
  if (path === '/api/templates') {
    if (!me) return sendJson(res, 401, { error: 'Not signed in.' });
    if (method === 'GET') return sendJson(res, 200, { templates: store.getTemplates(me) });
    if (method === 'PUT') {
      const { templates } = await readBody(req);
      const r = store.putTemplates(me, templates);
      return r.error ? sendJson(res, 400, r) : sendJson(res, 200, r);
    }
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  // --- characters (auth required) ---
  if (path.startsWith('/api/characters')) {
    if (!me) return sendJson(res, 401, { error: 'Not signed in.' });
    const [slug, sub, subId, ...rest] = path.slice('/api/characters'.length).split('/').filter(Boolean);
    if (rest.length) return sendJson(res, 404, { error: 'Unknown endpoint.' });
    if (!slug) {
      if (method === 'GET') return sendJson(res, 200, { characters: store.listCharacters(me) });
      return sendJson(res, 405, { error: 'Method not allowed.' });
    }
    if (sub === 'events') {
      if (method !== 'GET' || subId) return sendJson(res, 405, { error: 'Method not allowed.' });
      return ownerEvents(store, hub, req, res, me, slug, url.searchParams.get('client') ?? undefined);
    }
    if (sub === 'links') return linkRoutes(store, hub, req, res, me, slug, subId);
    if (sub) return sendJson(res, 404, { error: 'Unknown endpoint.' });

    if (method === 'GET') {
      const rec = store.getCharacterRecord(me, slug);
      return rec ? sendJson(res, 200, { doc: rec.doc, rev: rec.rev, summary: rec.summary }) : sendJson(res, 404, { error: 'Not found.' });
    }
    if (method === 'PUT') {
      const { name, doc, baseRev, summary, clientId } = await readBody(req);
      const before = store.getCharacterRecord(me, slug);
      const r = store.putCharacter(me, slug, name, doc, { baseRev, summary });
      if (r.error) return sendJson(res, 400, { error: r.error });
      if (r.conflict) {
        return sendJson(res, 409, { error: 'The character changed since it was loaded.', conflict: true, rev: r.rev, doc: r.doc });
      }
      publishWrite(hub, me, slug, before, r.record, { source: 'owner', origin: typeof clientId === 'string' ? clientId : undefined });
      return sendJson(res, 200, { slug: r.slug, rev: r.rev });
    }
    if (method === 'DELETE') {
      const r = store.deleteCharacter(me, slug);
      for (const id of r.revoked) hub.closeLink(id, 'revoked', { reason: 'deleted' });
      hub.closeCharacter(me, slug, 'deleted', {});
      return sendJson(res, 200, { slug });
    }
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  return sendJson(res, 404, { error: 'Unknown endpoint.' });
}

// --- change fan-out ----------------------------------------------------------

/**
 * Tell everyone watching a character that it was written. The owner's other
 * sheets get the whole document (they rebase onto it); GM links get only the
 * slices they care about, and only when those moved.
 */
function publishWrite(hub, owner, slug, before, after, { source, origin, linkId }) {
  const prevStatus = before ? statusOf(before.doc ?? {}, before.summary) : null;
  const status = statusOf(after.doc ?? {}, after.summary);
  const changed = prevStatus ? statusDiff(prevStatus, status) : Object.keys(status);
  const summaryMoved =
    !before || before.name !== after.name || JSON.stringify(before.summary) !== JSON.stringify(after.summary);
  hub.forCharacter(owner, slug, (c) => {
    if (c.kind === 'owner') {
      if (origin && c.clientId === origin) return; // the sheet that saved it already has it
      sseSend(c.res, 'change', { rev: after.rev, source, doc: after.doc });
      return;
    }
    if (changed.length) sseSend(c.res, 'status', { rev: after.rev, source, self: !!linkId && c.linkId === linkId, changed, status });
    if (summaryMoved) sseSend(c.res, 'summary', { rev: after.rev, name: after.name, summary: after.summary ?? null });
  });
}

function ownerEvents(store, hub, req, res, me, slug, clientId) {
  const rec = store.getCharacterRecord(me, slug);
  if (!rec) return sendJson(res, 404, { error: 'Not found.' });
  sseHeaders(res);
  hub.addOwner(req, res, { owner: me, slug, clientId });
  sseSend(res, 'ready', { rev: rec.rev });
}

async function linkRoutes(store, hub, req, res, me, slug, id) {
  const method = req.method;
  if (!store.getCharacterRecord(me, slug)) return sendJson(res, 404, { error: 'Not found.' });
  if (!id) {
    if (method === 'GET') return sendJson(res, 200, store.listLinks(me, slug));
    if (method === 'POST') {
      const { access } = await readBody(req);
      const r = store.createLinkCode(me, slug, access);
      if (r.error) return sendJson(res, r.notFound ? 404 : 400, { error: r.error });
      return sendJson(res, 201, r);
    }
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }
  if (method === 'DELETE') {
    const r = store.revokeLink(me, slug, id);
    if (!r.revoked) return sendJson(res, 404, { error: 'No such link.' });
    if (r.kind === 'link') hub.closeLink(id, 'revoked', { reason: 'revoked' });
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 405, { error: 'Method not allowed.' });
}

// --- GM-link API (bearer token, server to server) -----------------------------

/**
 * The document as a GM tool sees it: everything but the player's notes, which
 * are a journal rather than part of the sheet.
 */
function shareableDoc(doc) {
  const { notes: _notes, noteTabs: _tabs, ...rest } = doc ?? {};
  return rest;
}

const extError = (res, code, error, reason, extra) => sendJson(res, code, { error, code: reason, ...extra });

function bearer(req) {
  const h = req.headers.authorization;
  const m = typeof h === 'string' && /^Bearer\s+(\S+)$/i.exec(h.trim());
  return m ? m[1] : undefined;
}

async function handleExt(store, hub, req, res, path) {
  const method = req.method;
  res.setHeader('Cache-Control', 'no-store');

  if (path === '/api/ext/links/exchange') {
    if (method !== 'POST') return extError(res, 405, 'Method not allowed.', 'method_not_allowed');
    const body = await readJson(req);
    if (!body || typeof body.code !== 'string') return extError(res, 400, 'A link code is required.', 'invalid_request');
    const r = store.exchangeLinkCode(body.code, body.label);
    if (r.error) return extError(res, 400, r.error, 'invalid_code');
    return sendJson(res, 200, {
      token: r.token,
      linkId: r.link.id,
      characterId: r.link.characterId,
      characterName: r.characterName,
      access: r.link.access
    });
  }

  const link = store.linkForToken(bearer(req));
  if (!link) return extError(res, 401, 'Missing, invalid or revoked token.', 'invalid_token');
  store.touchLink(link.id);

  if (path === '/api/ext/link') {
    if (method !== 'DELETE') return extError(res, 405, 'Method not allowed.', 'method_not_allowed');
    store.revokeLink(link.owner, link.slug, link.id);
    hub.closeLink(link.id, 'revoked', { reason: 'unlinked' });
    return sendJson(res, 200, { ok: true });
  }

  const found = store.linkedCharacter(link);
  if (!found) return extError(res, 404, 'The linked character no longer exists.', 'character_gone');
  const { slug, record } = found;

  if (path === '/api/ext/character') {
    if (method !== 'GET') return extError(res, 405, 'Method not allowed.', 'method_not_allowed');
    return sendJson(res, 200, {
      id: link.characterId,
      linkId: link.id,
      access: link.access,
      name: record.name,
      rev: record.rev,
      updatedAt: record.updatedAt,
      summary: record.summary ?? null,
      status: statusOf(record.doc, record.summary),
      doc: shareableDoc(record.doc)
    });
  }

  if (path === '/api/ext/character/status') {
    if (method !== 'PATCH') return extError(res, 405, 'Method not allowed.', 'method_not_allowed');
    if (link.access !== 'write') return extError(res, 403, 'This link is read-only.', 'read_only');
    const patch = await readJson(req);
    if (patch === undefined) return extError(res, 400, 'Body must be JSON.', 'invalid_request');
    const r = store.patchLinkedStatus(link, patch);
    if (r.gone) return extError(res, 404, 'The linked character no longer exists.', 'character_gone');
    if (r.error) return extError(res, 400, r.error, 'invalid_patch');
    if (r.conflict) {
      return extError(res, 409, 'The character changed since baseRev.', 'conflict', {
        rev: r.record.rev,
        status: statusOf(r.record.doc, r.record.summary)
      });
    }
    if (r.changed.length) publishWrite(hub, link.owner, r.slug, record, r.record, { source: 'gm', linkId: link.id });
    return sendJson(res, 200, { rev: r.record.rev, changed: r.changed, status: statusOf(r.record.doc, r.record.summary) });
  }

  if (path === '/api/ext/character/events') {
    if (method !== 'GET') return extError(res, 405, 'Method not allowed.', 'method_not_allowed');
    sseHeaders(res);
    hub.addLink(req, res, { owner: link.owner, slug, linkId: link.id });
    sseSend(res, 'snapshot', {
      id: link.characterId,
      access: link.access,
      name: record.name,
      rev: record.rev,
      updatedAt: record.updatedAt,
      summary: record.summary ?? null,
      status: statusOf(record.doc, record.summary)
    });
    return;
  }

  return extError(res, 404, 'Unknown endpoint.', 'not_found');
}
