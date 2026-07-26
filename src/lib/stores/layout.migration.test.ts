import { describe, it, expect } from 'vitest';
import { appendNewBlocks, adoptLibrary, unstoreBuiltins, LIBRARY_VERSION } from './layout.js';
import { defaultTemplate } from '../layout/presets.js';
import { addBlock } from '../layout/operations.js';
import type { LayoutLibrary } from '../layout/library.js';

// Upgrading the library should surface newly-shipped blocks (e.g. `traits`,
// introduced in v7) on *every* template that lacks them — including a user's own
// — non-destructively, and never duplicate an existing one.
describe('appendNewBlocks', () => {
  const lib = (): LayoutLibrary => ({
    activeId: 'mine',
    preferred: {},
    layouts: [
      { id: 'default', name: 'Default', blocks: [{ id: 'a', type: 'abilityScores', variant: 'full', size: 'narrow' }] },
      { id: 'mine', name: 'My Sheet', blocks: [{ id: 'b', type: 'skills', variant: 'full', size: 'wide' }] }
    ]
  });

  it('adds traits to layouts missing it when upgrading from before v7', () => {
    const out = appendNewBlocks(lib(), 6);
    for (const l of out.layouts) {
      expect(l.blocks.some((b) => b.type === 'traits')).toBe(true);
    }
    // Existing blocks are preserved and the new one is appended at the end.
    expect(out.layouts[1].blocks.map((b) => b.type).slice(0, 2)).toEqual(['skills', 'traits']);
  });

  it('adds characterBuild to layouts missing it when upgrading from before v10', () => {
    // v10 split the race/class/feat selector out of Features into its own block;
    // a template made before that has no way to pick a class without it.
    const out = appendNewBlocks(lib(), 9);
    for (const l of out.layouts) {
      expect(l.blocks.some((b) => b.type === 'characterBuild')).toBe(true);
    }
    // Only the blocks introduced *after* the stored version are added.
    expect(out.layouts[1].blocks.map((b) => b.type)).toEqual(['skills', 'characterBuild']);
  });

  it('does nothing when already at/after the introducing version', () => {
    const out = appendNewBlocks(lib(), 10);
    expect(out.layouts.flatMap((l) => l.blocks.map((b) => b.type))).toEqual(['abilityScores', 'skills']);
  });

  it('never duplicates a block the layout already has', () => {
    const withTraits: LayoutLibrary = {
      activeId: 'x',
      preferred: {},
      layouts: [{ id: 'x', name: 'X', blocks: [{ id: 't', type: 'traits', variant: 'full', size: 'wide' }] }]
    };
    const out = appendNewBlocks(withTraits, 0);
    expect(out.layouts[0].blocks.filter((b) => b.type === 'traits')).toHaveLength(1);
  });
});

// Reading a library — from localStorage or from another device via the server —
// has to survive older shapes and partial corruption without losing templates.
describe('adoptLibrary', () => {
  it('keeps a pre-v8 library whole and prefers a built-in per screen size', () => {
    const out = adoptLibrary(
      {
        activeId: 'caster',
        layouts: [
          { id: 'default', name: 'Default', blocks: [{ id: 'a', type: 'skills', variant: 'full', size: 'wide' }] },
          { id: 'caster', name: 'Caster', blocks: [{ id: 'b', type: 'spells', variant: 'full', size: 'wide' }] },
          { id: 'mine', name: 'Mine', blocks: [{ id: 'c', type: 'notes', variant: 'full', size: 'full' }] }
        ]
      },
      7
    )!;
    // The old presets were never built-ins under these ids: they survive intact
    // as the user's own templates, and stay active.
    expect(out.layouts.map((l) => l.id)).toEqual(['default', 'caster', 'mine']);
    expect(out.activeId).toBe('caster');
  });

  it('re-points an active id that no longer exists and prunes stale preferences', () => {
    const out = adoptLibrary(
      {
        activeId: 'gone',
        preferred: { mobile: 'x', desktop: 'gone' },
        layouts: [{ id: 'x', name: 'X', blocks: [] }]
      },
      9
    )!;
    expect(out.activeId).toBe('desktop-martial'); // falls back to a built-in
    expect(out.preferred).toEqual({ mobile: 'x' });
  });

  it('adopts a document that holds only preferences', () => {
    // A new user who never made a template still has screen-size preferences
    // worth syncing between devices.
    const out = adoptLibrary({ activeId: 'mobile-caster', layouts: [], preferred: { mobile: 'mobile-caster' } }, 9)!;
    expect(out.activeId).toBe('mobile-caster');
    expect(out.preferred).toEqual({ mobile: 'mobile-caster' });
  });

  it('rejects empty or malformed documents', () => {
    expect(adoptLibrary(undefined, 9)).toBeNull();
    expect(adoptLibrary({ layouts: [] }, 9)).toBeNull();
    expect(adoptLibrary({ layouts: [{ name: 'no id' }] as never }, 9)).toBeNull();
  });
});

// v8 stored copies of the shipped templates in the library; v9 rebuilds them
// from code. The upgrade has to retire the stored copies without discarding any
// edit a user had made to one.
describe('unstoreBuiltins', () => {
  const stored = (...layouts: ReturnType<typeof defaultTemplate>[]): LayoutLibrary => ({
    activeId: layouts[0].id,
    layouts,
    preferred: { desktop: 'desktop-martial', mobile: 'mobile-martial' }
  });

  it('drops untouched copies — the built-in stands in for them', () => {
    const out = unstoreBuiltins(
      stored(defaultTemplate('desktop', 'martial'), defaultTemplate('mobile', 'martial')),
      8
    );
    expect(out.layouts).toEqual([]);
    expect(out.activeId).toBe('desktop-martial');
    expect(out.preferred).toEqual({ desktop: 'desktop-martial', mobile: 'mobile-martial' });
  });

  it('keeps an edited copy as the user’s own and repoints everything at it', () => {
    const edited = addBlock(defaultTemplate('desktop', 'martial'), 'notes');
    const out = unstoreBuiltins(stored(edited, defaultTemplate('mobile', 'martial')), 8);

    expect(out.layouts).toHaveLength(1);
    const kept = out.layouts[0];
    expect(kept.id).not.toBe('desktop-martial');
    expect(kept.name).toBe('Desktop — Martial (copy)');
    expect(kept.blocks).toHaveLength(edited.blocks.length);
    // Active template and the preference that named it both follow the copy.
    expect(out.activeId).toBe(kept.id);
    expect(out.preferred.desktop).toBe(kept.id);
    expect(out.preferred.mobile).toBe('mobile-martial'); // untouched one still points at the built-in
  });

  it('leaves the user’s own templates alone and only runs on the upgrade', () => {
    const mine: LayoutLibrary = {
      activeId: 'mine',
      layouts: [{ id: 'mine', name: 'Mine', blocks: [] }],
      preferred: {}
    };
    expect(unstoreBuiltins(mine, 8)).toEqual(mine);
    // At the current version there is nothing to retire, even if ids collide.
    // Pinned to LIBRARY_VERSION rather than a literal so a later bump doesn't
    // silently turn this into a test of the upgrade path.
    const current = stored(defaultTemplate('desktop', 'martial'));
    expect(unstoreBuiltins(current, LIBRARY_VERSION)).toEqual(current);
  });
});
