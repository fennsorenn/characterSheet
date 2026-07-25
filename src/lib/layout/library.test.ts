import { describe, it, expect } from 'vitest';
import {
  activeLayout,
  selectLayout,
  addLayout,
  createLayout,
  renameLayout,
  deleteLayout,
  duplicateLayout,
  updateActiveLayout,
  setPreferred,
  resolveLayoutId,
  prunePreferred,
  type LayoutLibrary
} from './library.js';
import { addBlock } from './operations.js';
import { builtinPresets, starterBlocks, STARTERS } from './presets.js';

function lib(): LayoutLibrary {
  return { activeId: 'default', layouts: builtinPresets(), preferred: {} };
}

describe('starting points', () => {
  it('offers distinct, non-empty preset arrangements', () => {
    const presets = builtinPresets();
    expect(presets.map((p) => p.id)).toEqual(['default', 'caster', 'martial', 'compact']);
    expect(presets.every((p) => p.blocks.length > 0)).toBe(true);
  });

  it('resolves starter keys to blocks, with blank/unknown empty', () => {
    expect(starterBlocks('caster').length).toBeGreaterThan(0);
    expect(starterBlocks('blank')).toEqual([]);
    expect(starterBlocks('nope')).toEqual([]);
    // Every offered starter is either handled by the caller or a known preset.
    for (const s of STARTERS) {
      if (s.key === 'blank' || s.key === 'current') continue;
      expect(starterBlocks(s.key).length).toBeGreaterThan(0);
    }
  });
});

describe('template library', () => {
  it('selects an existing template and ignores unknown ids', () => {
    expect(selectLayout(lib(), 'caster').activeId).toBe('caster');
    expect(selectLayout(lib(), 'nope').activeId).toBe('default');
  });

  it('updates only the active template', () => {
    const before = activeLayout(lib()).blocks.length;
    const after = updateActiveLayout(lib(), (l) => addBlock(l, 'skills'));
    expect(activeLayout(after).blocks.length).toBe(before + 1);
    // Other templates untouched.
    expect(after.layouts.find((l) => l.id === 'caster')!.blocks.length).toBe(
      builtinPresets()[1].blocks.length
    );
  });

  it('adds a template and activates it', () => {
    const after = addLayout(lib(), { id: 'x', name: 'X', blocks: [] });
    expect(after.activeId).toBe('x');
    expect(after.layouts).toHaveLength(5);
  });

  it('creates a template from starter blocks with fresh ids', () => {
    const blocks = starterBlocks('caster');
    const after = createLayout(lib(), '  Nightly  ', blocks);
    const made = after.layouts[after.layouts.length - 1];
    expect(made.name).toBe('Nightly'); // trimmed
    expect(after.activeId).toBe(made.id);
    expect(made.blocks.map((b) => b.type)).toEqual(blocks.map((b) => b.type));
    expect(made.blocks.every((b) => !blocks.some((s) => s.id === b.id))).toBe(true);
  });

  it('creates a blank, named template when given no blocks', () => {
    const after = createLayout(lib(), '');
    const made = after.layouts[after.layouts.length - 1];
    expect(made.name).toBe('Untitled');
    expect(made.blocks).toEqual([]);
  });

  it('renames a template', () => {
    expect(renameLayout(lib(), 'default', 'Home').layouts[0].name).toBe('Home');
  });

  it('never deletes the last template, and re-points active', () => {
    const after = deleteLayout(lib(), 'default'); // active deleted
    expect(after.layouts.find((l) => l.id === 'default')).toBeUndefined();
    expect(after.activeId).toBe(after.layouts[0].id);

    const single: LayoutLibrary = {
      activeId: 'a',
      layouts: [{ id: 'a', name: 'A', blocks: [] }],
      preferred: {}
    };
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

describe('per-screen-size preferences', () => {
  it('sets, replaces and clears a preference, ignoring unknown templates', () => {
    let l = setPreferred(lib(), 'mobile', 'compact');
    expect(l.preferred.mobile).toBe('compact');
    l = setPreferred(l, 'mobile', 'caster');
    expect(l.preferred.mobile).toBe('caster');
    expect(setPreferred(l, 'mobile', undefined).preferred.mobile).toBeUndefined();
    expect(setPreferred(l, 'tablet', 'ghost').preferred.tablet).toBeUndefined();
  });

  it('drops a preference when its template is deleted', () => {
    const l = deleteLayout(setPreferred(lib(), 'mobile', 'compact'), 'compact');
    expect(l.preferred.mobile).toBeUndefined();
  });

  it('resolves character choice over library preference over active', () => {
    const l = setPreferred(lib(), 'mobile', 'compact');
    expect(resolveLayoutId(l, 'mobile', { mobile: 'martial' })).toBe('martial');
    expect(resolveLayoutId(l, 'mobile')).toBe('compact');
    expect(resolveLayoutId(l, 'desktop')).toBe('default'); // no preference → active
  });

  it('ignores preferences pointing at templates that no longer exist', () => {
    const l = lib();
    expect(resolveLayoutId(l, 'mobile', { mobile: 'ghost' })).toBe('default');
    const stale: LayoutLibrary = { ...l, preferred: { mobile: 'ghost' } };
    expect(resolveLayoutId(stale, 'mobile')).toBe('default');
    // A missing active template still resolves to something renderable.
    expect(resolveLayoutId({ ...l, activeId: 'ghost' }, 'desktop')).toBe(l.layouts[0].id);
  });

  it('prunes unknown categories and dangling ids', () => {
    const l = prunePreferred({
      ...lib(),
      preferred: { mobile: 'caster', desktop: 'ghost', watch: 'default' } as LayoutLibrary['preferred']
    });
    expect(l.preferred).toEqual({ mobile: 'caster' });
  });
});
