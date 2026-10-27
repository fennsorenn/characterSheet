import { describe, it, expect } from 'vitest';
import {
  activeLayout,
  selectLayout,
  addLayout,
  createLayout,
  renameLayout,
  deleteLayout,
  duplicateLayout,
  editActive,
  allTemplates,
  isBuiltin,
  findTemplate,
  copyName,
  setPreferred,
  resolveLayoutId,
  prunePreferred,
  type LayoutLibrary
} from './library.js';
import { addBlock, setSize } from './operations.js';
import { allBlockTypes, BLOCK_META, resolveOptions } from './blocks.js';
import { SCREEN_CATEGORIES } from './screen.js';
import {
  defaultTemplate,
  defaultTemplates,
  parseTemplateId,
  starterBlocks,
  templateId,
  STARTERS,
  TEMPLATE_STYLES
} from './presets.js';

const ID = (c: string, s: string) => `${c}-${s}`;
const BLOCK_VARIANTS = Object.fromEntries(
  Object.entries(BLOCK_META).map(([type, meta]) => [type, meta.variants.map((v) => v.key)])
);

/** A library as a new user has it: no templates of their own yet. */
function lib(): LayoutLibrary {
  return { activeId: 'desktop-martial', layouts: [], preferred: {} };
}

/** …and one that also holds a template the user made. */
function withOwn(): LayoutLibrary {
  return {
    activeId: 'mine',
    layouts: [{ id: 'mine', name: 'Mine', blocks: [] }],
    preferred: {}
  };
}

describe('shipped templates', () => {
  it('ships one per screen size and play style', () => {
    const templates = defaultTemplates();
    expect(templates).toHaveLength(SCREEN_CATEGORIES.length * TEMPLATE_STYLES.length);
    for (const c of SCREEN_CATEGORIES) {
      for (const s of TEMPLATE_STYLES) {
        const t = templates.find((l) => l.id === ID(c, s));
        expect(t, `${c}/${s} exists`).toBeDefined();
        expect(t!.name).toMatch(/ — /);
      }
    }
    // Ids and names are unique, so the switcher never shows two of the same.
    expect(new Set(templates.map((t) => t.id)).size).toBe(templates.length);
    expect(new Set(templates.map((t) => t.name)).size).toBe(templates.length);
  });

  it('reaches every block exactly once, with valid variants', () => {
    for (const t of defaultTemplates()) {
      const present = t.blocks.map((b) => b.type);
      expect(new Set(present).size, `${t.id} has no duplicate block`).toBe(present.length);
      // Nothing is unreachable: the only block a template may omit is `saves`,
      // and only when the abilities block already folds saving throws in.
      const missing = allBlockTypes().filter((type) => !present.includes(type));
      const foldsSaves = t.blocks.some((b) => b.type === 'abilityScores' && b.variant === 'withSaves');
      // Currency is a row the inventory block carries as an option, so a
      // template showing it there needs no separate block — the same absorption
      // the abilities block performs for saves.
      const foldsCurrency = t.blocks.some(
        (b) => b.type === 'inventory' && resolveOptions(b).currency
      );
      const absorbed = [
        ...(foldsSaves ? ['saves'] : []),
        ...(foldsCurrency ? ['currency'] : [])
      ].sort();
      expect([...missing].sort(), `${t.id} omits only what it absorbs`).toEqual(absorbed);
      for (const b of t.blocks) {
        expect(BLOCK_VARIANTS[b.type], `${t.id}: ${b.type} variant ${b.variant}`).toContain(b.variant);
      }
    }
  });

  it('builds desktop and ultrawide rows that fill the 12-column grid', () => {
    // The spans must tile exactly or blocks reflow into ragged rows. A stacked
    // block shares the previous block's cell, so it claims no columns of its own
    // — and can never be the first block, which has nothing to stack under.
    const span = { desktop: { narrow: 3, wide: 6, full: 12 }, ultrawide: { narrow: 2, wide: 4, full: 12 } };
    for (const category of ['desktop', 'ultrawide'] as const) {
      for (const style of TEMPLATE_STYLES) {
        const blocks = defaultTemplate(category, style).blocks;
        expect(blocks[0].stack, `${category}/${style} does not open with a stack`).toBeFalsy();
        const total = blocks.reduce((n, b) => n + (b.stack ? 0 : span[category][b.size]), 0);
        expect(total % 12, `${category}/${style} tiles the grid`).toBe(0);
      }
    }
  });

  it('puts the play style’s own blocks above the other’s', () => {
    for (const c of SCREEN_CATEGORIES) {
      const martial = defaultTemplate(c, 'martial').blocks.map((b) => b.type);
      const caster = defaultTemplate(c, 'caster').blocks.map((b) => b.type);
      expect(martial.indexOf('attacks'), `${c}: martial leads with attacks`).toBeLessThan(
        martial.indexOf('spells')
      );
      expect(caster.indexOf('spells'), `${c}: caster leads with spells`).toBeLessThan(
        caster.indexOf('attacks')
      );
    }
  });

  it('rebuilds identically every time, so block identity is stable', () => {
    // Built-ins are re-derived from code rather than stored, so two builds must
    // be interchangeable — otherwise keyed renders churn and copies diverge.
    expect(defaultTemplate('mobile', 'caster')).toEqual(defaultTemplate('mobile', 'caster'));
    const ids = defaultTemplates().flatMap((t) => t.blocks.map((b) => b.id));
    expect(new Set(ids).size, 'block ids are unique across the whole set').toBe(ids.length);
  });

  it('round-trips template ids and resolves starters', () => {
    expect(parseTemplateId(templateId('tablet', 'caster'))).toEqual({
      category: 'tablet',
      style: 'caster'
    });
    expect(parseTemplateId('nope')).toBeNull();
    expect(starterBlocks('ultrawide-martial').length).toBeGreaterThan(0);
    expect(starterBlocks('blank')).toEqual([]);
    expect(starterBlocks('current')).toEqual([]); // resolved by the caller
    // Every offered starter is either caller-resolved or a shipped template.
    for (const s of STARTERS) {
      if (s.key === 'blank' || s.key === 'current') continue;
      expect(starterBlocks(s.key).length, s.key).toBeGreaterThan(0);
    }
  });
});

describe('built-ins are fixed', () => {
  it('offers the built-ins without storing them', () => {
    const l = withOwn();
    expect(l.layouts.map((t) => t.id)).toEqual(['mine']); // only the user's is persisted
    expect(allTemplates(l).map((t) => t.id)).toContain('desktop-martial');
    expect(allTemplates(l).at(-1)!.id).toBe('mine'); // the user's come last
    expect(isBuiltin('desktop-martial')).toBe(true);
    expect(isBuiltin('mine')).toBe(false);
  });

  it('resolves and activates a built-in that was never stored', () => {
    const l = selectLayout(lib(), 'ultrawide-caster');
    expect(l.activeId).toBe('ultrawide-caster');
    expect(activeLayout(l).name).toBe('Ultrawide — Caster');
    expect(l.layouts).toEqual([]);
  });

  it('refuses to rename or delete one', () => {
    expect(renameLayout(lib(), 'desktop-martial', 'Nope')).toEqual(lib());
    expect(deleteLayout(lib(), 'desktop-martial')).toEqual(lib());
    // …and the user's own are still renameable and deletable.
    expect(renameLayout(withOwn(), 'mine', 'Yours').layouts[0].name).toBe('Yours');
    expect(deleteLayout(withOwn(), 'mine').layouts).toEqual([]);
  });

  it('always leaves something to fall back to when the active one is deleted', () => {
    const after = deleteLayout(withOwn(), 'mine');
    expect(after.layouts).toEqual([]);
    expect(isBuiltin(after.activeId)).toBe(true);
    expect(activeLayout(after)).toBeDefined();
  });
});

describe('editing a built-in forks it', () => {
  it('copies it, applies the edit to the copy, and activates the copy', () => {
    const before = activeLayout(lib()).blocks.length;
    const after = editActive(lib(), (l) => addBlock(l, 'skills'));

    expect(after.layouts).toHaveLength(1);
    const copy = after.layouts[0];
    expect(after.activeId).toBe(copy.id);
    expect(isBuiltin(copy.id)).toBe(false);
    expect(copy.name).toBe('Desktop — Martial (copy)');
    expect(copy.blocks).toHaveLength(before + 1);
    // The built-in itself is untouched, ids included.
    expect(findTemplate(after, 'desktop-martial')).toEqual(defaultTemplate('desktop', 'martial'));
    expect(copy.blocks.every((b) => !b.id.startsWith('desktop-martial:'))).toBe(true);
  });

  // The fork mints new block ids. An edit that names a block by id — every one
  // of them except adding — has to be applied before that happens, or the first
  // click on a built-in silently does nothing and only the second one takes.
  it('applies an edit aimed at a block by id, not just a whole-layout one', () => {
    const source = activeLayout(lib());
    const i = source.blocks.findIndex((b) => b.size !== 'full');
    const after = editActive(lib(), (l) => setSize(l, source.blocks[i].id, 'full'));
    expect(activeLayout(after).blocks[i].size).toBe('full');
    // Still a genuine copy: the built-in keeps its own ids and its old size.
    expect(activeLayout(after).blocks[i].id).not.toBe(source.blocks[i].id);
    expect(defaultTemplate('desktop', 'martial').blocks[i].size).not.toBe('full');
  });

  it('carries preferences that named the built-in over to the copy', () => {
    // Otherwise the next screen-size change snaps back and the edit looks lost.
    let l: LayoutLibrary = { activeId: 'desktop-martial', layouts: [], preferred: {
      mobile: 'mobile-martial',
      desktop: 'desktop-martial'
    } };
    l = editActive(l, (x) => addBlock(x, 'skills'));
    expect(l.preferred.desktop).toBe(l.activeId);
    expect(l.preferred.mobile).toBe('mobile-martial'); // other sizes untouched
    expect(resolveLayoutId(l, 'desktop')).toBe(l.activeId);
  });

  it('edits the user\u2019s own templates in place, without copying', () => {
    const after = editActive(withOwn(), (l) => addBlock(l, 'skills'));
    expect(after.layouts).toHaveLength(1);
    expect(after.activeId).toBe('mine');
    expect(after.layouts[0].blocks).toHaveLength(1);
  });

  it('numbers copies so repeated forks stay distinguishable', () => {
    const once = editActive(lib(), (l) => addBlock(l, 'skills'));
    const twice = editActive(selectLayout(once, 'desktop-martial'), (l) => addBlock(l, 'notes'));
    expect(twice.layouts.map((l) => l.name)).toEqual([
      'Desktop — Martial (copy)',
      'Desktop — Martial (copy) 2'
    ]);
    expect(copyName(twice, 'Desktop — Martial')).toBe('Desktop — Martial (copy) 3');
  });
});

describe('template library', () => {
  it('selects an existing template and ignores unknown ids', () => {
    expect(selectLayout(lib(), 'mobile-caster').activeId).toBe('mobile-caster');
    expect(selectLayout(lib(), 'nope').activeId).toBe('desktop-martial');
  });

  it('adds a template and activates it', () => {
    const after = addLayout(lib(), { id: 'x', name: 'X', blocks: [] });
    expect(after.activeId).toBe('x');
    expect(after.layouts).toHaveLength(1);
  });

  it('creates a template from starter blocks with fresh ids', () => {
    const blocks = starterBlocks('tablet-caster');
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

  it('duplicates a built-in with fresh ids', () => {
    const after = duplicateLayout(lib(), 'desktop-martial', 'Copy');
    const copy = after.layouts[0];
    expect(copy.name).toBe('Copy');
    expect(isBuiltin(copy.id)).toBe(false);
    const originalIds = defaultTemplate('desktop', 'martial').blocks.map((b) => b.id);
    expect(copy.blocks.every((b) => !originalIds.includes(b.id))).toBe(true);
    expect(after.activeId).toBe(copy.id);
  });
});

describe('per-screen-size preferences', () => {
  it('sets, replaces and clears a preference, ignoring unknown templates', () => {
    let l = setPreferred(lib(), 'mobile', 'mobile-caster');
    expect(l.preferred.mobile).toBe('mobile-caster');
    l = setPreferred(l, 'mobile', 'desktop-caster');
    expect(l.preferred.mobile).toBe('desktop-caster');
    expect(setPreferred(l, 'mobile', undefined).preferred.mobile).toBeUndefined();
    expect(setPreferred(l, 'tablet', 'ghost').preferred.tablet).toBeUndefined();
  });

  it('drops a preference when the user deletes its template', () => {
    const l = setPreferred(withOwn(), 'mobile', 'mine');
    expect(deleteLayout(l, 'mine').preferred.mobile).toBeUndefined();
  });

  it('resolves character choice over library preference over active', () => {
    const l = setPreferred(lib(), 'mobile', 'mobile-caster');
    expect(resolveLayoutId(l, 'mobile', { mobile: 'mobile-martial' })).toBe('mobile-martial');
    expect(resolveLayoutId(l, 'mobile')).toBe('mobile-caster');
    expect(resolveLayoutId(l, 'desktop')).toBe('desktop-martial'); // no preference → active
  });

  it('ignores preferences pointing at templates that no longer exist', () => {
    const l = lib();
    expect(resolveLayoutId(l, 'mobile', { mobile: 'ghost' })).toBe('desktop-martial');
    const stale: LayoutLibrary = { ...l, preferred: { mobile: 'ghost' } };
    expect(resolveLayoutId(stale, 'mobile')).toBe('desktop-martial');
    // A missing active template still resolves to something renderable.
    expect(isBuiltin(resolveLayoutId({ ...l, activeId: 'ghost' }, 'desktop'))).toBe(true);
  });

  it('prunes unknown categories and dangling ids', () => {
    const l = prunePreferred({
      ...withOwn(),
      preferred: { mobile: 'mine', desktop: 'ghost', watch: 'tablet-caster' } as LayoutLibrary['preferred']
    });
    expect(l.preferred).toEqual({ mobile: 'mine' });
  });
});
