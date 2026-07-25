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
    expect(s.putCharacter('cara', 'gandalf', 'Gandalf', { id: '1', name: 'Gandalf' })).toEqual({ slug: 'gandalf' });
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
});
