import { describe, it, expect } from 'vitest';
import {
  addBlock,
  removeBlock,
  moveBlock,
  reorderBlock,
  setVariant,
  setSize,
  cycleSize,
  toggleStack,
  setHeight,
  setOption,
  makeBlock
} from './operations.js';
import { resolveOptions } from './blocks.js';
import { defaultLayout } from './defaultLayout.js';
import type { SheetLayout } from './types.js';

const ids = (l: SheetLayout) => l.blocks.map((b) => b.type);

describe('defaultLayout', () => {
  it('produces the standard ordered blocks', () => {
    expect(ids(defaultLayout())).toEqual([
      'abilityScores',
      'defenses',
      'hitPoints',
      'restLevelUp',
      'conditions',
      'effects',
      'saves',
      'skills',
      'attacks',
      'characterBuild',
      'features',
      'traits',
      'inventory',
      'resources',
      'spells',
      'spellSlots',
      'notes'
    ]);
  });

  it('seeds each block with its registered defaults', () => {
    const abilities = defaultLayout().blocks[0];
    expect(abilities.variant).toBe('full');
    expect(abilities.size).toBe('wide');
    expect(abilities.id).toBeTruthy();
  });
});

describe('layout operations', () => {
  it('adds a known block and ignores an unknown one', () => {
    const l = { id: 'x', name: 'X', blocks: [] };
    expect(addBlock(l, 'skills').blocks).toHaveLength(1);
    expect(addBlock(l, 'nope').blocks).toHaveLength(0);
    expect(makeBlock('nope')).toBeNull();
  });

  it('removes by id without touching others', () => {
    const l = defaultLayout();
    const target = l.blocks[2].id;
    const after = removeBlock(l, target);
    expect(after.blocks.find((b) => b.id === target)).toBeUndefined();
    expect(after.blocks).toHaveLength(l.blocks.length - 1);
  });

  it('moves a block up and down, clamping at the ends', () => {
    const l = defaultLayout();
    const second = l.blocks[1].id;
    expect(ids(moveBlock(l, second, -1)).slice(0, 2)).toEqual(['defenses', 'abilityScores']);
    const first = l.blocks[0].id;
    expect(ids(moveBlock(l, first, -1))).toEqual(ids(l)); // already at top: no-op
  });

  it('reorders a block to another position (drag)', () => {
    const l = defaultLayout();
    const fromBlock = l.blocks[l.blocks.length - 1]; // last block
    const to = l.blocks[0].id; // move it to the front
    expect(ids(reorderBlock(l, fromBlock.id, to))[0]).toBe(fromBlock.type);
  });

  it('sets variant and size, and cycles size', () => {
    const l = defaultLayout();
    const id = l.blocks[0].id;
    expect(setVariant(l, id, 'compact').blocks[0].variant).toBe('compact');
    expect(setSize(l, id, 'full').blocks[0].size).toBe('full');
    // wide -> full -> narrow
    expect(cycleSize(l, id).blocks[0].size).toBe('full');
  });

  it('toggles stacking on a block, but never on the first one', () => {
    const l = defaultLayout();
    const second = l.blocks[1].id;
    expect(toggleStack(l, second).blocks[1].stack).toBe(true);
    // Toggling again clears it.
    expect(toggleStack(toggleStack(l, second), second).blocks[1].stack).toBe(false);
    // The first block can't stack (nothing above it).
    const first = l.blocks[0].id;
    expect(toggleStack(l, first).blocks[0].stack).toBe(false);
  });

  it('sets and clears a scrollable block height', () => {
    const l = defaultLayout();
    const id = l.blocks[0].id;
    expect(setHeight(l, id, 320.6).blocks[0].height).toBe(321); // rounded
    // Zero / undefined clears the cap.
    const withH = setHeight(l, id, 300);
    expect(setHeight(withH, id, undefined).blocks[0].height).toBeUndefined();
    expect(setHeight(withH, id, 0).blocks[0].height).toBeUndefined();
  });

  // Options are per-instance content switches; the stored layout records only
  // what its owner disagreed with, so defaults stay live.
  describe('block options', () => {
    const withDefenses = () => {
      const l = addBlock(defaultLayout(), 'defenses');
      return { l, id: l.blocks[l.blocks.length - 1].id };
    };

    it('resolves to the type defaults when nothing is set', () => {
      const { l, id } = withDefenses();
      const b = l.blocks.find((x) => x.id === id)!;
      expect(b.options).toBeUndefined();
      expect(resolveOptions(b)).toMatchObject({ ac: true, passiveInvestigation: false });
    });

    it('records a deviation and drops it again when it agrees', () => {
      const { l, id } = withDefenses();
      const off = setOption(l, id, 'ac', false);
      expect(off.blocks.find((b) => b.id === id)!.options).toEqual({ ac: false });
      expect(resolveOptions(off.blocks.find((b) => b.id === id)!).ac).toBe(false);
      // Back to the default: the entry goes, rather than being written as `true`.
      const back = setOption(off, id, 'ac', true);
      expect(back.blocks.find((b) => b.id === id)!.options).toBeUndefined();
    });

    it('takes the variant into account when deciding what the default is', () => {
      const { l, id } = withDefenses();
      const compact = setVariant(l, id, 'compact');
      const b = compact.blocks.find((x) => x.id === id)!;
      expect(resolveOptions(b).passivePerception).toBe(false); // off in compact
      // Turning it on there is a deviation and is recorded; turning it off is not.
      expect(setOption(compact, id, 'passivePerception', true).blocks.find((x) => x.id === id)!.options)
        .toEqual({ passivePerception: true });
      expect(setOption(compact, id, 'passivePerception', false).blocks.find((x) => x.id === id)!.options)
        .toBeUndefined();
    });

    it('ignores keys the block type does not have', () => {
      const { l, id } = withDefenses();
      expect(setOption(l, id, 'nonsense', true).blocks.find((b) => b.id === id)!.options).toBeUndefined();
    });

    // A saved layout from a future version, or one hand-edited: unknown keys are
    // dropped on read rather than reaching the component as stray truthy values.
    it('drops unknown keys when resolving', () => {
      const { l, id } = withDefenses();
      const b = { ...l.blocks.find((x) => x.id === id)!, options: { ac: false, bogus: true } };
      expect(resolveOptions(b)).not.toHaveProperty('bogus');
      expect(resolveOptions(b).ac).toBe(false);
    });
  });

  it('does not mutate the input layout', () => {
    const l = defaultLayout();
    const snapshot = JSON.stringify(l);
    addBlock(l, 'skills');
    removeBlock(l, l.blocks[0].id);
    cycleSize(l, l.blocks[0].id);
    expect(JSON.stringify(l)).toBe(snapshot);
  });
});
