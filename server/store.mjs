import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { scryptSync, randomBytes, timingSafeEqual, randomUUID } from 'node:crypto';

/**
 * Tiny JSON-file-backed store for multi-user character sync. Intentionally
 * basic: usernames + scrypt-hashed passwords (no email/verification), in-memory
 * sessions, and per-user character documents keyed by slug. Pass no `file` for
 * an in-memory store (tests).
 *
 * State shape:
 *   { users: { [username]: { salt, hash, characters: { [slug]: { name, doc, updatedAt } } } },
 *     sessions: { [token]: username } }
 */

const USER_RE = /^[a-z0-9][a-z0-9_-]{2,31}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(password, salt, 64).toString('hex') };
}
function verifyPassword(password, salt, hash) {
  const candidate = scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createStore({ file } = {}) {
  let state = { users: {}, sessions: {} };
  if (file && existsSync(file)) {
    try {
      state = { users: {}, sessions: {}, ...JSON.parse(readFileSync(file, 'utf8')) };
    } catch {
      /* corrupt — start fresh */
    }
  }
  let timer;
  const persist = () => {
    if (!file) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, JSON.stringify(state));
      } catch {
        /* best effort */
      }
    }, 300);
  };

  const api = {
    createUser(username, password) {
      const u = String(username || '').toLowerCase();
      if (!USER_RE.test(u)) return { error: 'Username must be 3-32 chars: letters, digits, _ or -.' };
      if (String(password || '').length < 6) return { error: 'Password must be at least 6 characters.' };
      if (state.users[u]) return { error: 'That username is taken.' };
      state.users[u] = { ...hashPassword(password), characters: {} };
      persist();
      return { username: u };
    },

    login(username, password) {
      const u = String(username || '').toLowerCase();
      const rec = state.users[u];
      if (!rec || !verifyPassword(password, rec.salt, rec.hash)) return { error: 'Wrong username or password.' };
      return { username: u };
    },

    createSession(username) {
      const token = randomUUID();
      state.sessions[token] = username;
      persist();
      return token;
    },
    sessionUser(token) {
      return (token && state.sessions[token]) || null;
    },
    deleteSession(token) {
      if (token && state.sessions[token]) {
        delete state.sessions[token];
        persist();
      }
    },

    listCharacters(username) {
      const chars = state.users[username]?.characters ?? {};
      return Object.entries(chars).map(([slug, c]) => ({ slug, name: c.name, updatedAt: c.updatedAt }));
    },
    getCharacter(username, slug) {
      return state.users[username]?.characters?.[slug]?.doc ?? null;
    },
    putCharacter(username, slug, name, doc) {
      if (!state.users[username]) return { error: 'Unknown user.' };
      if (!SLUG_RE.test(slug)) return { error: 'Invalid character id.' };
      state.users[username].characters[slug] = { name: String(name || slug), doc, updatedAt: Date.now() };
      persist();
      return { slug };
    },
    deleteCharacter(username, slug) {
      const chars = state.users[username]?.characters;
      if (chars && chars[slug]) {
        delete chars[slug];
        persist();
      }
      return { slug };
    }
  };
  return api;
}
