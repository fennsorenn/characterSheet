import { describe, it, expect } from 'vitest';
import { appendNewBlocks } from './layout.js';
import type { LayoutLibrary } from '../layout/library.js';

// Upgrading the library should surface newly-shipped blocks (e.g. `traits`,
// introduced in v7) on *every* layout that lacks them — including a user's own
// custom layouts — non-destructively, and never duplicate an existing one.
describe('appendNewBlocks', () => {
  const lib = (): LayoutLibrary => ({
    activeId: 'mine',
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
      layouts: [{ id: 'x', name: 'X', blocks: [{ id: 't', type: 'traits', variant: 'full', size: 'wide' }] }]
    };
    const out = appendNewBlocks(withTraits, 0);
    expect(out.layouts[0].blocks.filter((b) => b.type === 'traits')).toHaveLength(1);
  });
});
