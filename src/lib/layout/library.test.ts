import { describe, it, expect } from 'vitest';
import {
  activeLayout,
  selectLayout,
  addLayout,
  renameLayout,
  deleteLayout,
  duplicateLayout,
  updateActiveLayout,
  type LayoutLibrary
} from './library.js';
import { addBlock } from './operations.js';
import { builtinPresets } from './presets.js';

function lib(): LayoutLibrary {
  return { activeId: 'default', layouts: builtinPresets() };
}

describe('builtinPresets', () => {
  it('provides distinct, non-empty presets', () => {
    const presets = builtinPresets();
    expect(presets.map((p) => p.id)).toEqual(['default', 'caster', 'martial', 'compact']);
    expect(presets.every((p) => p.blocks.length > 0)).toBe(true);
  });
});

describe('layout library', () => {
  it('selects an existing layout and ignores unknown ids', () => {
    expect(selectLayout(lib(), 'caster').activeId).toBe('caster');
    expect(selectLayout(lib(), 'nope').activeId).toBe('default');
  });

  it('updates only the active layout', () => {
    const before = activeLayout(lib()).blocks.length;
    const after = updateActiveLayout(lib(), (l) => addBlock(l, 'skills'));
    expect(activeLayout(after).blocks.length).toBe(before + 1);
    // Other presets untouched.
    expect(after.layouts.find((l) => l.id === 'caster')!.blocks.length).toBe(
      builtinPresets()[1].blocks.length
    );
  });

  it('adds a layout and activates it', () => {
    const after = addLayout(lib(), { id: 'x', name: 'X', blocks: [] });
    expect(after.activeId).toBe('x');
    expect(after.layouts).toHaveLength(5);
  });

  it('renames a layout', () => {
    expect(renameLayout(lib(), 'default', 'Home').layouts[0].name).toBe('Home');
  });

  it('never deletes the last layout, and re-points active', () => {
    const after = deleteLayout(lib(), 'default'); // active deleted
    expect(after.layouts.find((l) => l.id === 'default')).toBeUndefined();
    expect(after.activeId).toBe(after.layouts[0].id);

    const single: LayoutLibrary = { activeId: 'a', layouts: [{ id: 'a', name: 'A', blocks: [] }] };
    expect(deleteLayout(single, 'a')).toEqual(single);
  });

  it('duplicates with fresh ids', () => {
    const after = duplicateLayout(lib(), 'default', 'Copy');
    const copy = after.layouts[after.layouts.length - 1];
    expect(copy.name).toBe('Copy');
    expect(copy.id).not.toBe('default');
    const originalBlockIds = builtinPresets()[0].blocks.map((b) => b.id);
    expect(copy.blocks.every((b) => !originalBlockIds.includes(b.id))).toBe(true);
    expect(after.activeId).toBe(copy.id);
  });
});
