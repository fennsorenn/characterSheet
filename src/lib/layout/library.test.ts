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
import { allBlockTypes, BLOCK_META } from './blocks.js';
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

function lib(): LayoutLibrary {
  return { activeId: 'desktop-martial', layouts: defaultTemplates(), preferred: {} };
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
      expect(missing, `${t.id} omits only what it absorbs`).toEqual(foldsSaves ? ['saves'] : []);
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

  it('makes fresh block ids on every call', () => {
    const a = defaultTemplate('mobile', 'caster');
    const b = defaultTemplate('mobile', 'caster');
    expect(a.blocks.every((x, i) => x.id !== b.blocks[i].id)).toBe(true);
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

describe('template library', () => {
  const ACTIVE = 'desktop-martial';
  const OTHER = 'mobile-caster';

  it('selects an existing template and ignores unknown ids', () => {
    expect(selectLayout(lib(), OTHER).activeId).toBe(OTHER);
    expect(selectLayout(lib(), 'nope').activeId).toBe(ACTIVE);
  });

  it('updates only the active template', () => {
    const before = activeLayout(lib()).blocks.length;
    const after = updateActiveLayout(lib(), (l) => addBlock(l, 'skills'));
    expect(activeLayout(after).blocks.length).toBe(before + 1);
    // Other templates untouched.
    expect(after.layouts.find((l) => l.id === OTHER)!.blocks.length).toBe(
      defaultTemplate('mobile', 'caster').blocks.length
    );
  });

  it('adds a template and activates it', () => {
    const before = lib().layouts.length;
    const after = addLayout(lib(), { id: 'x', name: 'X', blocks: [] });
    expect(after.activeId).toBe('x');
    expect(after.layouts).toHaveLength(before + 1);
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

  it('renames a template', () => {
    expect(renameLayout(lib(), ACTIVE, 'Home').layouts.find((l) => l.id === ACTIVE)!.name).toBe('Home');
  });

  it('never deletes the last template, and re-points active', () => {
    const after = deleteLayout(lib(), ACTIVE); // active deleted
    expect(after.layouts.find((l) => l.id === ACTIVE)).toBeUndefined();
    expect(after.activeId).toBe(after.layouts[0].id);

    const single: LayoutLibrary = {
      activeId: 'a',
      layouts: [{ id: 'a', name: 'A', blocks: [] }],
      preferred: {}
    };
    expect(deleteLayout(single, 'a')).toEqual(single);
  });

  it('duplicates with fresh ids', () => {
    const source = lib().layouts.find((l) => l.id === ACTIVE)!;
    const after = duplicateLayout(lib(), ACTIVE, 'Copy');
    const copy = after.layouts[after.layouts.length - 1];
    expect(copy.name).toBe('Copy');
    expect(copy.id).not.toBe(ACTIVE);
    expect(copy.blocks.every((b) => !source.blocks.some((s) => s.id === b.id))).toBe(true);
    expect(after.activeId).toBe(copy.id);
  });
});

describe('per-screen-size preferences', () => {
  const PHONE = 'mobile-caster';
  const DESK = 'desktop-caster';

  it('sets, replaces and clears a preference, ignoring unknown templates', () => {
    let l = setPreferred(lib(), 'mobile', PHONE);
    expect(l.preferred.mobile).toBe(PHONE);
    l = setPreferred(l, 'mobile', DESK);
    expect(l.preferred.mobile).toBe(DESK);
    expect(setPreferred(l, 'mobile', undefined).preferred.mobile).toBeUndefined();
    expect(setPreferred(l, 'tablet', 'ghost').preferred.tablet).toBeUndefined();
  });

  it('drops a preference when its template is deleted', () => {
    const l = deleteLayout(setPreferred(lib(), 'mobile', PHONE), PHONE);
    expect(l.preferred.mobile).toBeUndefined();
  });

  it('resolves character choice over library preference over active', () => {
    const l = setPreferred(lib(), 'mobile', PHONE);
    expect(resolveLayoutId(l, 'mobile', { mobile: 'mobile-martial' })).toBe('mobile-martial');
    expect(resolveLayoutId(l, 'mobile')).toBe(PHONE);
    expect(resolveLayoutId(l, 'desktop')).toBe('desktop-martial'); // no preference → active
  });

  it('ignores preferences pointing at templates that no longer exist', () => {
    const l = lib();
    expect(resolveLayoutId(l, 'mobile', { mobile: 'ghost' })).toBe('desktop-martial');
    const stale: LayoutLibrary = { ...l, preferred: { mobile: 'ghost' } };
    expect(resolveLayoutId(stale, 'mobile')).toBe('desktop-martial');
    // A missing active template still resolves to something renderable.
    expect(resolveLayoutId({ ...l, activeId: 'ghost' }, 'desktop')).toBe(l.layouts[0].id);
  });

  it('prunes unknown categories and dangling ids', () => {
    const l = prunePreferred({
      ...lib(),
      preferred: { mobile: PHONE, desktop: 'ghost', watch: DESK } as LayoutLibrary['preferred']
    });
    expect(l.preferred).toEqual({ mobile: PHONE });
  });
});
