import { describe, it, expect } from 'vitest';
import {
  addBlock,
  removeBlock,
  moveBlock,
  reorderBlock,
  setVariant,
  setSize,
  cycleSize,
  makeBlock
} from './operations.js';
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

  it('does not mutate the input layout', () => {
    const l = defaultLayout();
    const snapshot = JSON.stringify(l);
    addBlock(l, 'skills');
    removeBlock(l, l.blocks[0].id);
    cycleSize(l, l.blocks[0].id);
    expect(JSON.stringify(l)).toBe(snapshot);
  });
});
