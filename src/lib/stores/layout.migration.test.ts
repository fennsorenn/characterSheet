import { describe, it, expect } from 'vitest';
import { appendNewBlocks, adoptLibrary } from './layout.js';
import { defaultTemplates } from '../layout/presets.js';
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
    expect(out.layouts[1].blocks.map((b) => b.type)).toEqual(['skills', 'traits']);
  });

  it('does nothing when already at/after the introducing version', () => {
    const out = appendNewBlocks(lib(), 7);
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
  it('keeps a pre-v8 library whole and adds the shipped per-screen-size set', () => {
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
    // Nothing is treated as a built-in any more: all three survive as the user's,
    // in place, with the shipped templates appended after them.
    expect(out.layouts.slice(0, 3).map((l) => l.id)).toEqual(['default', 'caster', 'mine']);
    expect(out.layouts.map((l) => l.id)).toContain('desktop-caster');
    expect(out.activeId).toBe('caster');
    // …and each screen size starts out pointing at a shipped template.
    expect(out.preferred).toEqual({
      mobile: 'mobile-martial',
      tablet: 'tablet-martial',
      desktop: 'desktop-martial',
      ultrawide: 'ultrawide-martial'
    });
  });

  it('leaves a current-version library alone, deletions included', () => {
    const kept = defaultTemplates().filter((t) => t.id !== 'mobile-caster');
    const out = adoptLibrary(
      { activeId: 'desktop-martial', layouts: kept, preferred: { mobile: 'mobile-martial' } },
      8
    )!;
    expect(out.layouts.map((l) => l.id)).not.toContain('mobile-caster');
    expect(out.preferred).toEqual({ mobile: 'mobile-martial' });
  });

  it('re-points an active id that no longer exists and prunes stale preferences', () => {
    const out = adoptLibrary(
      {
        activeId: 'gone',
        preferred: { mobile: 'x', desktop: 'gone' },
        layouts: [{ id: 'x', name: 'X', blocks: [] }]
      },
      8
    )!;
    expect(out.activeId).toBe('x');
    expect(out.preferred).toEqual({ mobile: 'x' });
  });

  it('rejects empty or malformed documents', () => {
    expect(adoptLibrary(undefined, 8)).toBeNull();
    expect(adoptLibrary({ layouts: [] }, 8)).toBeNull();
    expect(adoptLibrary({ layouts: [{ name: 'no id' }] as never }, 8)).toBeNull();
  });
});
