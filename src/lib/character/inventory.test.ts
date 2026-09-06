import { describe, it, expect } from 'vitest';
import { createCharacter, type InventoryItem } from './schema.js';
import {
  ensureInventoryIds,
  inventoryTree,
  flatten,
  contentsCount,
  containerOpen,
  containerRows
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
