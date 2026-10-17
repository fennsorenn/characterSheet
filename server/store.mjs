import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { scryptSync, randomBytes, timingSafeEqual, randomUUID, createHash } from 'node:crypto';
import { applyStatusPatch } from './status.mjs';

/**
 * Tiny JSON-file-backed store for multi-user character sync. Intentionally
 * basic: usernames + scrypt-hashed passwords (no email/verification), in-memory
 * sessions, and per-user character documents keyed by slug. Pass no `file` for
 * an in-memory store (tests).
 *
 * State shape:
 *   { users: { [username]: { salt, hash,
 *                            characters: { [slug]: { name, doc, updatedAt, rev, summary? } },
 *                            templates: { version, updatedAt, library } } },
 *     sessions: { [token]: username },
 *     links: { [linkId]: { id, owner, slug, characterId, access, label, tokenHash,
 *                          createdAt, lastUsedAt } } }
 *
 * `rev` is bumped on every write to a character, by its owner or through a GM
 * link, so a client that saves with a stale `baseRev` can be told to rebase
 * instead of silently overwriting a change it never saw.
 *
 * GM links: the owner mints a short one-time *link code*; a GM tool exchanges
 * it (server to server) for a long-lived bearer token bound to one character
 * and one access level. Only the token's SHA-256 is stored. Codes live in
 * memory only — they are good for 15 minutes, so a restart losing one is fine.
 */

const USER_RE = /^[a-z0-9][a-z0-9_-]{2,31}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const LINK_CODE_TTL_MS = 15 * 60 * 1000;
export const LINK_ACCESS = ['read', 'write'];
/** No 0/O or 1/I: a code is read aloud and typed by hand. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 8;
const LABEL_MAX = 80;
const SUMMARY_MAX_BYTES = 32 * 1024;

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
/** Normalize a typed code: case-insensitive, dashes and spaces ignored. */
export const normalizeCode = (code) => String(code ?? '').toUpperCase().replace(/[\s-]/g, '');
function newCode() {
  const bytes = randomBytes(CODE_LEN);
  let out = '';
  for (const b of bytes) out += CODE_ALPHABET[b & 31];
  return out;
}
const cleanLabel = (v) => (typeof v === 'string' ? v.trim().slice(0, LABEL_MAX) : '');

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
  let state = { users: {}, sessions: {}, links: {} };
  if (file && existsSync(file)) {
    try {
      state = { users: {}, sessions: {}, links: {}, ...JSON.parse(readFileSync(file, 'utf8')) };
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

  /** code → pending link-code entry. Memory only (see the header). */
  const codes = new Map();

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
    /** The whole stored record: `{ name, doc, updatedAt, rev, summary }`, or null. */
    getCharacterRecord(username, slug) {
      const rec = state.users[username]?.characters?.[slug];
      return rec ? { ...rec, rev: rec.rev ?? 0, summary: rec.summary ?? null } : null;
    },
    /**
     * Save a character. With a numeric `baseRev` the write only lands if the
     * stored `rev` still equals it; otherwise the caller gets `{ conflict }`
     * with the current record to rebase onto. Without one it is last-write-wins
     * (copies into the account, and clients from before `rev` existed).
     * `summary` replaces the stored one when given and is kept when omitted —
     * a device without the dataset loaded cannot compute it.
     */
    putCharacter(username, slug, name, doc, { baseRev, summary } = {}) {
      if (!state.users[username]) return { error: 'Unknown user.' };
      if (!SLUG_RE.test(slug)) return { error: 'Invalid character id.' };
      if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { error: 'Invalid character document.' };
      if (summary !== undefined && summary !== null) {
        if (typeof summary !== 'object' || Array.isArray(summary)) return { error: 'Invalid summary.' };
        if (JSON.stringify(summary).length > SUMMARY_MAX_BYTES) return { error: 'Summary too large.' };
      }
      const cur = state.users[username].characters[slug];
      const curRev = cur?.rev ?? 0;
      if (typeof baseRev === 'number' && cur && baseRev !== curRev) {
        return { conflict: true, rev: curRev, doc: cur.doc, name: cur.name, updatedAt: cur.updatedAt };
      }
      const rec = {
        name: String(name || slug),
        doc,
        updatedAt: Date.now(),
        rev: curRev + 1,
        summary: summary === undefined ? cur?.summary ?? null : summary
      };
      state.users[username].characters[slug] = rec;
      persist();
      return { slug, rev: rec.rev, record: rec };
    },
    deleteCharacter(username, slug) {
      const chars = state.users[username]?.characters;
      const revoked = [];
      if (chars && chars[slug]) {
        const id = chars[slug].doc?.id;
        delete chars[slug];
        // A link outliving its character would only ever answer 404.
        for (const l of Object.values(state.links)) {
          if (l.owner === username && (l.slug === slug || (id && l.characterId === id))) {
            delete state.links[l.id];
            revoked.push(l.id);
          }
        }
        for (const [code, c] of codes) if (c.owner === username && c.slug === slug) codes.delete(code);
        persist();
      }
      return { slug, revoked };
    },

    // --- GM links -----------------------------------------------------------

    /** Mint a one-time link code for one of the user's characters. */
    createLinkCode(username, slug, access, now = Date.now()) {
      if (!LINK_ACCESS.includes(access)) return { error: 'access must be "read" or "write".' };
      const rec = state.users[username]?.characters?.[slug];
      if (!rec) return { error: 'Not found.', notFound: true };
      if (!rec.doc?.id) return { error: 'This character has no id yet; save it once and try again.' };
      for (const [k, c] of codes) if (c.expiresAt <= now) codes.delete(k);
      let code;
      do code = newCode();
      while (codes.has(code));
      const entry = { id: randomUUID(), owner: username, slug, characterId: rec.doc.id, access, createdAt: now, expiresAt: now + LINK_CODE_TTL_MS };
      codes.set(code, entry);
      return { id: entry.id, code, access, expiresAt: entry.expiresAt };
    },

    /**
     * Trade a link code for a bearer token. One-time: the code is gone after
     * the first attempt that names it, successful or not, and an expired one
     * fails the same way an unknown one does.
     */
    exchangeLinkCode(code, label, now = Date.now()) {
      const key = normalizeCode(code);
      const entry = codes.get(key);
      if (entry) codes.delete(key);
      if (!entry || entry.expiresAt <= now) return { error: 'Invalid or expired link code.' };
      const rec = state.users[entry.owner]?.characters?.[entry.slug];
      if (!rec || rec.doc?.id !== entry.characterId) return { error: 'Invalid or expired link code.' };
      const token = 'csl_' + randomBytes(32).toString('base64url');
      const link = {
        id: randomUUID(),
        owner: entry.owner,
        slug: entry.slug,
        characterId: entry.characterId,
        access: entry.access,
        label: cleanLabel(label),
        tokenHash: sha256(token),
        createdAt: now,
        lastUsedAt: null
      };
      state.links[link.id] = link;
      persist();
      return { token, link, characterName: rec.name };
    },

    /** The live link a bearer token belongs to, or null. */
    linkForToken(token) {
      if (typeof token !== 'string' || !token) return null;
      const h = sha256(token);
      for (const l of Object.values(state.links)) if (l.tokenHash === h) return l;
      return null;
    },

    touchLink(id, now = Date.now()) {
      const l = state.links[id];
      if (!l) return;
      // Coarse on purpose: an SSE reconnect loop shouldn't rewrite the file.
      if (!l.lastUsedAt || now - l.lastUsedAt > 60_000) {
        l.lastUsedAt = now;
        persist();
      }
    },

    /**
     * The character a link points at: `{ slug, record }`, or null once it is
     * gone. Looked up by the stable document id, so the slug is only a hint.
     */
    linkedCharacter(link) {
      const chars = state.users[link.owner]?.characters ?? {};
      const hinted = chars[link.slug];
      if (hinted && hinted.doc?.id === link.characterId) return { slug: link.slug, record: { ...hinted, rev: hinted.rev ?? 0 } };
      for (const [slug, rec] of Object.entries(chars)) {
        if (rec.doc?.id === link.characterId) {
          link.slug = slug;
          return { slug, record: { ...rec, rev: rec.rev ?? 0 } };
        }
      }
      return null;
    },

    /** Active links and unexpired codes for one character, for its owner. */
    listLinks(username, slug, now = Date.now()) {
      const links = Object.values(state.links)
        .filter((l) => l.owner === username && l.slug === slug)
        .map(({ id, access, label, createdAt, lastUsedAt }) => ({ id, access, label, createdAt, lastUsedAt }))
        .sort((a, b) => a.createdAt - b.createdAt);
      const pending = [...codes.values()]
        .filter((c) => c.owner === username && c.slug === slug && c.expiresAt > now)
        .map(({ id, access, expiresAt }) => ({ id, access, expiresAt }));
      return { links, pending };
    },

    /** Revoke a link (or withdraw a pending code) by id. Returns whether one went. */
    revokeLink(username, slug, id) {
      const l = state.links[id];
      if (l && l.owner === username && l.slug === slug) {
        delete state.links[id];
        persist();
        return { revoked: true, kind: 'link' };
      }
      for (const [code, c] of codes) {
        if (c.id === id && c.owner === username && c.slug === slug) {
          codes.delete(code);
          return { revoked: true, kind: 'code' };
        }
      }
      return { revoked: false };
    },

    /**
     * Apply a GM's status patch through a link. Same `rev` rules as an owner
     * save: bumps it, and refuses a stale `baseRev` with the current state.
     */
    patchLinkedStatus(link, patch) {
      const found = api.linkedCharacter(link);
      if (!found) return { gone: true };
      const { slug, record } = found;
      if (patch && typeof patch.baseRev === 'number' && patch.baseRev !== record.rev) {
        return { conflict: true, slug, record };
      }
      const r = applyStatusPatch(record.doc, record.summary, patch);
      if (r.error) return r;
      if (!r.changed.length) return { slug, record, changed: [] };
      const rec = { ...record, doc: r.doc, updatedAt: Date.now(), rev: record.rev + 1 };
      state.users[link.owner].characters[slug] = rec;
      persist();
      return { slug, record: rec, changed: r.changed };
    },

    /**
     * The user's layout-template library. The document is opaque here — the
     * client owns its shape and resolves local-vs-remote by `updatedAt`, so the
     * server only refuses a write that would replace a newer copy with an older
     * one (which is what a stale second tab would try to do).
     */
    getTemplates(username) {
      return state.users[username]?.templates ?? null;
    },
    putTemplates(username, doc) {
      if (!state.users[username]) return { error: 'Unknown user.' };
      if (!doc || typeof doc !== 'object' || typeof doc.library !== 'object' || !doc.library) {
        return { error: 'Invalid template document.' };
      }
      const updatedAt = Number(doc.updatedAt) || 0;
      const current = state.users[username].templates;
      if (current && (current.updatedAt ?? 0) > updatedAt) {
        return { stale: true, templates: current };
      }
      state.users[username].templates = {
        version: Number(doc.version) || 0,
        updatedAt,
        library: doc.library
      };
      persist();
      return { ok: true };
    }
  };
  return api;
}
