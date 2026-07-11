import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createStore } from './store.mjs';

/**
 * Connect-style API middleware shared by the Vite dev server and the Express
 * production server, so `/api/auth/*` and `/api/characters/*` behave the same
 * in dev, tests, and prod. Anything else falls through to `next()`.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = process.env.CS_DATA_FILE || join(__dirname, '..', 'data', 'users.json');
const store = createStore({ file });

const SESSION_DAYS = 30;

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj ?? {});
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}
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

export function apiMiddleware(req, res, next) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;
  if (path === '/api/fetch') {
    proxyFetch(req, res, url).catch((e) => sendJson(res, 502, { error: `Proxy fetch failed: ${e?.message ?? e}` }));
    return;
  }
  if (!path.startsWith('/api/auth') && !path.startsWith('/api/characters')) return next();
  handle(req, res, path).catch((e) => sendJson(res, 500, { error: String(e?.message ?? e) }));
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

async function handle(req, res, path) {
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

  // --- characters (auth required) ---
  if (path.startsWith('/api/characters')) {
    if (!me) return sendJson(res, 401, { error: 'Not signed in.' });
    const slug = path.slice('/api/characters'.length).replace(/^\//, '');
    if (!slug) {
      if (method === 'GET') return sendJson(res, 200, { characters: store.listCharacters(me) });
      return sendJson(res, 405, { error: 'Method not allowed.' });
    }
    if (method === 'GET') {
      const doc = store.getCharacter(me, slug);
      return doc ? sendJson(res, 200, { doc }) : sendJson(res, 404, { error: 'Not found.' });
    }
    if (method === 'PUT') {
      const { name, doc } = await readBody(req);
      const r = store.putCharacter(me, slug, name, doc);
      return r.error ? sendJson(res, 400, r) : sendJson(res, 200, r);
    }
    if (method === 'DELETE') return sendJson(res, 200, store.deleteCharacter(me, slug));
  }

  return sendJson(res, 404, { error: 'Unknown endpoint.' });
}
