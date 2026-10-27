import { describe, it, expect } from 'vitest';
import { createCharacter, type InventoryItem } from './schema.js';
import {
  ensureInventoryIds,
  inventoryTree,
  flatten,
  contentsCount,
  containerOpen,
  containerRows,
  containsDeep,
  dropItem
} from './inventory.js';

const item = (over: Partial<InventoryItem>): InventoryItem => ({
  name: 'Thing',
  source: 'XPHB',
  quantity: 1,
  equipped: false,
  ...over
});

const packed = () =>
  createCharacter({
    inventory: [
      item({ id: 'pack', name: 'Backpack', isContainer: true }),
      item({ id: 'oil', name: 'Oil', container: 'pack' }),
      item({ id: 'book', name: 'Book', container: 'pack' }),
      item({ id: 'sword', name: 'Sword' })
    ]
  });

describe('ensureInventoryIds', () => {
  it('fills in ids only where missing', () => {
    const c = createCharacter({
      inventory: [item({ id: 'keep', name: 'A' }), item({ name: 'B' })]
    });
    const out = ensureInventoryIds(c);
    expect(out.inventory[0].id).toBe('keep');
    expect(out.inventory[1].id).toBeTruthy();
  });

  it('returns the same object when every row already has one', () => {
    const c = packed();
    // Identity matters: a new object here would mark the document dirty and
    // save it on every load.
    expect(ensureInventoryIds(c)).toBe(c);
  });

  it('regenerates a duplicated id, which would make two rows the same row', () => {
    const c = createCharacter({
      inventory: [item({ id: 'same', name: 'A' }), item({ id: 'same', name: 'B' })]
    });
    const ids = ensureInventoryIds(c).inventory.map((i) => i.id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('inventoryTree', () => {
  it('groups contents under their container, keeping document order', () => {
    const tree = inventoryTree(packed());
    expect(tree.map((n) => n.item.name)).toEqual(['Backpack', 'Sword']);
    expect(tree[0].children.map((n) => n.item.name)).toEqual(['Oil', 'Book']);
  });

  it('reports the original flat index for every row', () => {
    const tree = inventoryTree(packed());
    expect(tree[0].index).toBe(0);
    expect(tree[0].children.map((n) => n.index)).toEqual([1, 2]);
    expect(tree[1].index).toBe(3);
  });

  it('surfaces a row whose container no longer exists, rather than losing it', () => {
    const c = createCharacter({
      inventory: [item({ id: 'a', name: 'Orphan', container: 'deleted-pouch' })]
    });
    const tree = inventoryTree(c);
    expect(tree.map((n) => n.item.name)).toEqual(['Orphan']);
  });

  it('renders every row exactly once even when pointers form a cycle', () => {
    const c = createCharacter({
      inventory: [
        item({ id: 'a', name: 'A', isContainer: true, container: 'b' }),
        item({ id: 'b', name: 'B', isContainer: true, container: 'a' })
      ]
    });
    expect(flatten(inventoryTree(c))).toHaveLength(2);
  });

  it('ignores a row that claims to contain itself', () => {
    const c = createCharacter({
      inventory: [item({ id: 'a', name: 'A', isContainer: true, container: 'a' })]
    });
    expect(inventoryTree(c).map((n) => n.item.name)).toEqual(['A']);
  });

  it('nests containers within containers', () => {
    const c = createCharacter({
      inventory: [
        item({ id: 'pack', name: 'Backpack', isContainer: true }),
        item({ id: 'pouch', name: 'Pouch', isContainer: true, container: 'pack' }),
        item({ id: 'herb', name: 'Herb', container: 'pouch' })
      ]
    });
    const tree = inventoryTree(c);
    expect(tree).toHaveLength(1);
    expect(contentsCount(tree[0])).toBe(2);
  });
});

describe('containerOpen', () => {
  it('defaults to open, so a new container never hides its contents', () => {
    expect(containerOpen(packed(), 'pack')).toBe(true);
  });

  it('is closed once collapsed', () => {
    const c = { ...packed(), containersCollapsed: ['pack'] };
    expect(containerOpen(c, 'pack')).toBe(false);
  });
});

describe('containerRows', () => {
  it('lists explicit containers, including empty ones', () => {
    const c = createCharacter({
      inventory: [item({ id: 'flask', name: 'Flask', isContainer: true })]
    });
    expect(containerRows(c).map((n) => n.item.name)).toEqual(['Flask']);
  });
});

describe('containsDeep', () => {
  it('sees a direct child', () => {
    expect(containsDeep(packed(), 'pack', 'oil')).toBe(true);
  });

  it('sees a grandchild', () => {
    const c = createCharacter({
      inventory: [
        item({ id: 'pack', name: 'Backpack', isContainer: true }),
        item({ id: 'pouch', name: 'Pouch', isContainer: true, container: 'pack' }),
        item({ id: 'herb', name: 'Herb', container: 'pouch' })
      ]
    });
    expect(containsDeep(c, 'pack', 'herb')).toBe(true);
  });

  it('is false for an unrelated row, and does not hang on a cycle', () => {
    expect(containsDeep(packed(), 'pack', 'sword')).toBe(false);
    const cyc = createCharacter({
      inventory: [
        item({ id: 'a', name: 'A', container: 'b' }),
        item({ id: 'b', name: 'B', container: 'a' })
      ]
    });
    expect(containsDeep(cyc, 'zzz', 'a')).toBe(false);
  });
});

describe('dropItem', () => {
  it('makes the target a container and puts the row inside it', () => {
    const c = createCharacter({
      inventory: [item({ id: 'sack', name: 'Sack' }), item({ id: 'rope', name: 'Rope' })]
    });
    const out = dropItem(c, 1, 0);
    expect(out.inventory[0].isContainer).toBe(true);
    expect(out.inventory[1].container).toBe('sack');
  });

  it('takes a row back out when dropped on nothing', () => {
    const out = dropItem(packed(), 1, null);
    expect(out.inventory[1].container).toBeUndefined();
  });

  it('leaves the document untouched when the move changes nothing', () => {
    const c = packed();
    // Already in that container, dropped on itself, and a loose row taken out.
    expect(dropItem(c, 1, 0)).toBe(c);
    expect(dropItem(c, 1, 1)).toBe(c);
    expect(dropItem(c, 3, null)).toBe(c);
  });

  it('refuses to put a container inside its own contents', () => {
    const c = packed();
    // Backpack (0) dropped onto Oil (1), which is inside it.
    expect(dropItem(c, 0, 1)).toBe(c);
  });

  it('stops being a container when its last occupant leaves', () => {
    const c = createCharacter({
      inventory: [item({ id: 'sack', name: 'Sack' }), item({ id: 'rope', name: 'Rope' })]
    });
    const filled = dropItem(c, 1, 0);
    expect(filled.inventory[0].isContainer).toBe(true);
    const emptied = dropItem(filled, 1, null);
    expect(emptied.inventory[0].isContainer).toBe(false);
  });

  it('keeps a container that still holds something', () => {
    const emptied = dropItem(packed(), 1, null);
    // Backpack still has Book in it.
    expect(emptied.inventory[0].isContainer).toBe(true);
  });

  it('demotes the old container when the row moves into a different one', () => {
    const c = createCharacter({
      inventory: [
        item({ id: 'sack', name: 'Sack', isContainer: true }),
        item({ id: 'rope', name: 'Rope', container: 'sack' }),
        item({ id: 'chest', name: 'Chest' })
      ]
    });
    const out = dropItem(c, 1, 2);
    expect(out.inventory.find((i) => i.id === 'sack')!.isContainer).toBe(false);
    expect(out.inventory.find((i) => i.id === 'chest')!.isContainer).toBe(true);
  });

  it('moves a row straight from one container to another', () => {
    const c = createCharacter({
      inventory: [
        item({ id: 'pack', name: 'Backpack', isContainer: true }),
        item({ id: 'oil', name: 'Oil', container: 'pack' }),
        item({ id: 'chest', name: 'Chest' })
      ]
    });
    const out = dropItem(c, 1, 2);
    expect(out.inventory[1].container).toBe('chest');
    expect(out.inventory[2].isContainer).toBe(true);
  });

  it('does not mutate the character it was given', () => {
    const c = createCharacter({
      inventory: [item({ id: 'sack', name: 'Sack' }), item({ id: 'rope', name: 'Rope' })]
    });
    dropItem(c, 1, 0);
    expect(c.inventory[0].isContainer).toBeUndefined();
    expect(c.inventory[1].container).toBeUndefined();
  });
});

describe('dropItem reordering', () => {
  const list = () =>
    createCharacter({
      inventory: [
        item({ id: 'a', name: 'A' }),
        item({ id: 'b', name: 'B' }),
        item({ id: 'c', name: 'C' })
      ]
    });

  it('places a row before the target when dropped above it', () => {
    const out = dropItem(list(), 2, 0, 'before');
    expect(out.inventory.map((i) => i.name)).toEqual(['C', 'A', 'B']);
  });

  it('places a row after the target when dropped below it', () => {
    const out = dropItem(list(), 0, 2, 'after');
    expect(out.inventory.map((i) => i.name)).toEqual(['B', 'C', 'A']);
  });

  it('reorders without nesting — the target does not become a container', () => {
    const out = dropItem(list(), 2, 0, 'before');
    expect(out.inventory.every((i) => !i.isContainer)).toBe(true);
    expect(out.inventory.every((i) => !i.container)).toBe(true);
  });

  it('adopts the target\'s parent, so dropping beside a nested row joins it', () => {
    const c = createCharacter({
      inventory: [
        item({ id: 'pack', name: 'Backpack', isContainer: true }),
        item({ id: 'oil', name: 'Oil', container: 'pack' }),
        item({ id: 'rope', name: 'Rope' })
      ]
    });
    const out = dropItem(c, 2, 1, 'after');
    expect(out.inventory.find((i) => i.id === 'rope')!.container).toBe('pack');
  });

  it('lifts a row out of its container when dropped beside a top-level row', () => {
    const out = dropItem(packed(), 1, 3, 'before');
    const oil = out.inventory.find((i) => i.id === 'oil')!;
    expect(oil.container).toBeUndefined();
  });

  it('leaves the document alone when the row is already in that slot', () => {
    const c = list();
    expect(dropItem(c, 0, 1, 'before')).toBe(c);
  });

  it('still refuses to reorder a container in among its own contents', () => {
    const c = packed();
    expect(dropItem(c, 0, 1, 'before')).toBe(c);
  });
});
