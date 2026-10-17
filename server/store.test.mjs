import { describe, it, expect } from 'vitest';
import { createStore } from './store.mjs';

describe('user store', () => {
  it('creates a user, rejects duplicates and bad input, and logs in', () => {
    const s = createStore();
    expect(s.createUser('Alice', 'secret1')).toEqual({ username: 'alice' }); // lowercased
    expect(s.createUser('alice', 'other1').error).toMatch(/taken/);
    expect(s.createUser('ab', 'secret1').error).toMatch(/3-32/); // too short
    expect(s.createUser('alice2', 'short').error).toMatch(/6 characters/);
    expect(s.login('alice', 'secret1')).toEqual({ username: 'alice' });
    expect(s.login('alice', 'wrong').error).toMatch(/Wrong/);
    expect(s.login('nobody', 'secret1').error).toMatch(/Wrong/);
  });

  it('manages sessions', () => {
    const s = createStore();
    s.createUser('bob', 'secret1');
    const token = s.createSession('bob');
    expect(s.sessionUser(token)).toBe('bob');
    expect(s.sessionUser('nope')).toBeNull();
    s.deleteSession(token);
    expect(s.sessionUser(token)).toBeNull();
  });

  it('stores characters per user by slug', () => {
    const s = createStore();
    s.createUser('cara', 'secret1');
    expect(s.putCharacter('cara', 'gandalf', 'Gandalf', { id: '1', name: 'Gandalf' })).toMatchObject({ slug: 'gandalf', rev: 1 });
    expect(s.putCharacter('cara', 'Bad Slug', 'x', {}).error).toMatch(/Invalid/);
    expect(s.getCharacter('cara', 'gandalf')).toMatchObject({ name: 'Gandalf' });
    expect(s.listCharacters('cara').map((c) => c.slug)).toEqual(['gandalf']);
    s.deleteCharacter('cara', 'gandalf');
    expect(s.listCharacters('cara')).toEqual([]);
    expect(s.getCharacter('cara', 'gandalf')).toBeNull();
  });

  it("keeps one user's characters private from another", () => {
    const s = createStore();
    s.createUser('u1', 'secret1');
    s.createUser('u2', 'secret1');
    s.putCharacter('u1', 'hero', 'Hero', { x: 1 });
    expect(s.getCharacter('u2', 'hero')).toBeNull();
    expect(s.listCharacters('u2')).toEqual([]);
  });

  it('stores a layout-template library per user', () => {
    const s = createStore();
    s.createUser('dana', 'secret1');
    s.createUser('erin', 'secret1');
    expect(s.getTemplates('dana')).toBeNull();

    const doc = { version: 8, updatedAt: 100, library: { activeId: 'a', layouts: [], preferred: {} } };
    expect(s.putTemplates('dana', doc)).toEqual({ ok: true });
    expect(s.getTemplates('dana')).toEqual(doc);
    // Private to its owner.
    expect(s.getTemplates('erin')).toBeNull();
  });

  it('rejects malformed template documents and unknown users', () => {
    const s = createStore();
    s.createUser('finn', 'secret1');
    expect(s.putTemplates('nobody', { version: 8, updatedAt: 1, library: {} }).error).toMatch(/Unknown/);
    expect(s.putTemplates('finn', null).error).toMatch(/Invalid/);
    expect(s.putTemplates('finn', { updatedAt: 1 }).error).toMatch(/Invalid/);
  });

  it('refuses to overwrite a newer library with a stale one', () => {
    const s = createStore();
    s.createUser('gil', 'secret1');
    const newer = { version: 8, updatedAt: 200, library: { activeId: 'a', layouts: [], preferred: {} } };
    s.putTemplates('gil', newer);

    const stale = { version: 8, updatedAt: 100, library: { activeId: 'b', layouts: [], preferred: {} } };
    expect(s.putTemplates('gil', stale)).toEqual({ stale: true, templates: newer });
    expect(s.getTemplates('gil')).toEqual(newer);

    // Same timestamp or later still wins (a re-save of the current document).
    expect(s.putTemplates('gil', { ...stale, updatedAt: 200 })).toEqual({ ok: true });
    expect(s.getTemplates('gil').library.activeId).toBe('b');
  });

  it('bumps rev on every write and refuses a stale baseRev', () => {
    const s = createStore();
    s.createUser('hal', 'secret1');
    expect(s.putCharacter('hal', 'bran', 'Bran', { id: 'b' }).rev).toBe(1);
    expect(s.putCharacter('hal', 'bran', 'Bran', { id: 'b', n: 2 }, { baseRev: 1 }).rev).toBe(2);
    const stale = s.putCharacter('hal', 'bran', 'Bran', { id: 'b', n: 3 }, { baseRev: 1 });
    expect(stale).toMatchObject({ conflict: true, rev: 2, doc: { id: 'b', n: 2 } });
    expect(s.getCharacterRecord('hal', 'bran')).toMatchObject({ rev: 2, doc: { n: 2 } });
    // No baseRev: last write wins.
    expect(s.putCharacter('hal', 'bran', 'Bran', { id: 'b', n: 4 }).rev).toBe(3);
  });

  it('keeps the stored summary when a save omits it', () => {
    const s = createStore();
    s.createUser('ian', 'secret1');
    s.putCharacter('ian', 'x', 'X', { id: 'x' }, { summary: { ac: 15 } });
    s.putCharacter('ian', 'x', 'X', { id: 'x', more: 1 });
    expect(s.getCharacterRecord('ian', 'x').summary).toEqual({ ac: 15 });
    expect(s.putCharacter('ian', 'x', 'X', { id: 'x' }, { summary: [] }).error).toMatch(/summary/);
  });
});

describe('GM links', () => {
  const setup = () => {
    const s = createStore();
    s.createUser('pat', 'secret1');
    s.putCharacter('pat', 'bran', 'Bran', { id: 'char-1', hp: { max: 20, current: 20, temp: 0 } });
    return s;
  };

  it('mints 8-character codes from an unambiguous alphabet', () => {
    const s = setup();
    const c = s.createLinkCode('pat', 'bran', 'read');
    expect(c.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(c.expiresAt - Date.now()).toBeGreaterThan(14 * 60 * 1000);
    expect(s.createLinkCode('pat', 'bran', 'admin').error).toMatch(/access/);
    expect(s.createLinkCode('pat', 'nope', 'read').notFound).toBe(true);
  });

  it('exchanges a code once, for a token bound to the character and access', () => {
    const s = setup();
    const { code } = s.createLinkCode('pat', 'bran', 'write');
    const r = s.exchangeLinkCode(code.toLowerCase().slice(0, 4) + '-' + code.slice(4), 'Tuesday group');
    expect(r.error).toBeUndefined();
    expect(r.token).toMatch(/^csl_/);
    expect(r.link).toMatchObject({ characterId: 'char-1', access: 'write', label: 'Tuesday group' });
    expect(r.link.tokenHash).not.toContain(r.token);
    expect(s.linkForToken(r.token).id).toBe(r.link.id);
    expect(s.exchangeLinkCode(code).error).toMatch(/Invalid or expired/);
  });

  it('refuses an expired code', () => {
    const s = setup();
    const t0 = Date.now();
    const { code, expiresAt } = s.createLinkCode('pat', 'bran', 'read', t0);
    expect(s.exchangeLinkCode(code, '', expiresAt).error).toMatch(/expired/);
  });

  it('lists links and pending codes, and revokes either', () => {
    const s = setup();
    const a = s.createLinkCode('pat', 'bran', 'read');
    const b = s.createLinkCode('pat', 'bran', 'write');
    const { token, link } = s.exchangeLinkCode(a.code);
    const list = s.listLinks('pat', 'bran');
    expect(list.links.map((l) => l.id)).toEqual([link.id]);
    expect(list.links[0]).not.toHaveProperty('tokenHash');
    expect(list.pending.map((p) => p.id)).toEqual([b.id]);
    expect(s.revokeLink('pat', 'bran', b.id)).toEqual({ revoked: true, kind: 'code' });
    expect(s.exchangeLinkCode(b.code).error).toBeTruthy();
    expect(s.revokeLink('pat', 'bran', link.id)).toEqual({ revoked: true, kind: 'link' });
    expect(s.linkForToken(token)).toBeNull();
    expect(s.revokeLink('pat', 'bran', link.id)).toEqual({ revoked: false });
  });

  it('patches status through a link, bumping rev', () => {
    const s = setup();
    const { link } = s.exchangeLinkCode(s.createLinkCode('pat', 'bran', 'write').code);
    const r = s.patchLinkedStatus(link, { hp: { current: 5 } });
    expect(r.changed).toEqual(['hp']);
    expect(r.record.rev).toBe(2);
    expect(s.getCharacter('pat', 'bran').hp.current).toBe(5);
    expect(s.patchLinkedStatus(link, { hp: { current: 4 }, baseRev: 1 }).conflict).toBe(true);
    expect(s.patchLinkedStatus(link, { hp: { current: 5 } }).changed).toEqual([]); // no-op: no bump
    expect(s.getCharacterRecord('pat', 'bran').rev).toBe(2);
  });

  it('follows the character by id and drops links when it is deleted', () => {
    const s = setup();
    const { token, link } = s.exchangeLinkCode(s.createLinkCode('pat', 'bran', 'read').code);
    expect(s.linkedCharacter(link).slug).toBe('bran');
    // Same slug, different character: the link does not follow the slug.
    s.putCharacter('pat', 'bran', 'Other', { id: 'char-2' });
    expect(s.linkedCharacter(link)).toBeNull();
    s.putCharacter('pat', 'bran', 'Bran', { id: 'char-1' });
    expect(s.deleteCharacter('pat', 'bran').revoked).toEqual([link.id]);
    expect(s.linkForToken(token)).toBeNull();
  });
});
