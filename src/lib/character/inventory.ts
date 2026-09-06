import type { Character, InventoryItem } from './schema.js';

/**
 * Containers in the inventory list.
 *
 * The inventory stays a **flat array** — every mutation in the store addresses a
 * row by its index, and the calc graph walks the same list for equipped effects
 * — so containment is a parent pointer (`item.container` → another row's `id`)
 * rather than nested child arrays. {@link inventoryTree} is the only place that
 * turns those pointers into the shape the list renders, and it hands back the
 * original index with every row so the existing index-based actions keep working
 * untouched.
 */

/** A row plus where it lives in the flat array, and what sits inside it. */
export interface InventoryNode {
  item: InventoryItem;
  /** Index into `character.inventory` — what the store's actions take. */
  index: number;
  children: InventoryNode[];
}

let counter = 0;

/** A fresh row id. Uses randomUUID where available, else a counter. */
function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `inv-${Date.now().toString(36)}-${(counter++).toString(36)}`;
}

/**
 * Give every inventory row an `id`, leaving existing ones alone.
 *
 * Run on load (beside `syncHitDice`) so a document written before ids existed
 * gains them once, rather than every consumer having to cope with their absence.
 * Returns the same object when nothing was missing, so loading a current
 * document marks it unchanged and triggers no save.
 */
export function ensureInventoryIds(character: Character): Character {
  const inventory = character.inventory ?? [];
  // Bail only when every row has an id *and* they are all distinct: a document
  // where two rows share one is as broken as one missing them, and "every row
  // has an id" is true in both cases.
  const ids = inventory.map((i) => i.id).filter(Boolean) as string[];
  if (ids.length === inventory.length && new Set(ids).size === inventory.length) {
    return character;
  }
  const seen = new Set<string>();
  return {
    ...character,
    inventory: inventory.map((i) => {
      // A duplicated id would make two rows indistinguishable; regenerate.
      if (i.id && !seen.has(i.id)) {
        seen.add(i.id);
        return i;
      }
      const id = newId();
      seen.add(id);
      return { ...i, id };
    })
  };
}

/** Whether a container is expanded (they default to open). */
export function containerOpen(character: Character, id: string): boolean {
  return !(character.containersCollapsed ?? []).includes(id);
}

/**
 * The inventory as a tree of containers and their contents.
 *
 * Document order is preserved at every level, so the list only ever *groups*
 * rows — it never reorders them behind the player's back. Rows whose `container`
 * names something that no longer exists (a deleted pouch) surface at the top
 * level rather than vanishing, and a pointer cycle is broken the same way, so a
 * malformed document still renders every row exactly once.
 */
export function inventoryTree(character: Character): InventoryNode[] {
  const inventory = character.inventory ?? [];
  const nodes = new Map<string, InventoryNode>();
  const order: InventoryNode[] = [];

  inventory.forEach((item, index) => {
    const node: InventoryNode = { item, index, children: [] };
    order.push(node);
    if (item.id) nodes.set(item.id, node);
  });

  /** Whether `node` is reachable from itself by following container pointers. */
  const wouldCycle = (node: InventoryNode, parentId: string): boolean => {
    let cur: InventoryNode | undefined = nodes.get(parentId);
    const guard = new Set<string>();
    while (cur) {
      if (cur === node) return true;
      const id: string | undefined = cur.item.id;
      if (id) {
        if (guard.has(id)) return true;
        guard.add(id);
      }
      const next: string | undefined = cur.item.container;
      cur = next ? nodes.get(next) : undefined;
    }
    return false;
  };

  const roots: InventoryNode[] = [];
  for (const node of order) {
    const parentId = node.item.container;
    const parent = parentId ? nodes.get(parentId) : undefined;
    // Dangling pointer, self-reference or a cycle: treat the row as loose.
    if (!parent || parent === node || wouldCycle(node, parentId!)) {
      roots.push(node);
      continue;
    }
    parent.children.push(node);
  }
  return roots;
}

/**
 * Whether `descendantId` sits inside `ancestorId`, at any depth.
 *
 * Walks *up* from the candidate rather than down from the ancestor: containment
 * is stored as a parent pointer, so upward is the direction the data already
 * runs, and a malformed cycle terminates on the guard rather than the shape of
 * the tree.
 */
export function containsDeep(
  character: Character,
  ancestorId: string,
  descendantId: string
): boolean {
  const byId = new Map((character.inventory ?? []).map((i) => [i.id, i] as const));
  const seen = new Set<string>();
  let cur = byId.get(descendantId);
  while (cur?.container) {
    if (cur.container === ancestorId) return true;
    if (seen.has(cur.container)) return false;
    seen.add(cur.container);
    cur = byId.get(cur.container);
  }
  return false;
}

/** Where a dropped row lands relative to the row under the pointer. */
export type DropPosition = 'inside' | 'before' | 'after';

/** Clear the container flag on `id` if nothing is left inside it. */
function pruneIfEmpty(inventory: InventoryItem[], id: string | undefined): InventoryItem[] {
  if (!id) return inventory;
  if (inventory.some((i) => i.container === id)) return inventory;
  return inventory.map((i) => (i.id === id && i.isContainer ? { ...i, isContainer: false } : i));
}

/**
 * Move the row at `fromIndex` relative to the row at `ontoIndex`, or out to the
 * top level with `ontoIndex` of `null`.
 *
 * `position` is what separates the two gestures a tree has to support from one
 * pointer: dropping *on* a row puts the item inside it — which is also what
 * makes that row a container, since the only reason to call something a
 * container is that you are putting something in it — while dropping just above
 * or below a row places the item beside it as a sibling, reordering the list.
 *
 * A container that loses its last occupant stops being a container, so an
 * emptied bag does not linger as a bag with `(0)` beside it.
 *
 * Returns the character unchanged when the move is a no-op or illegal (onto
 * itself, into its own contents), so callers need no guards and the store
 * writes nothing.
 */
export function dropItem(
  character: Character,
  fromIndex: number,
  ontoIndex: number | null,
  position: DropPosition = 'inside'
): Character {
  const inventory = character.inventory ?? [];
  const from = inventory[fromIndex];
  if (!from) return character;

  if (ontoIndex === null) {
    if (!from.container) return character;
    const cleared = inventory.map((it, n) =>
      n === fromIndex ? { ...it, container: undefined } : it
    );
    return { ...character, inventory: pruneIfEmpty(cleared, from.container) };
  }

  const onto = inventory[ontoIndex];
  if (!onto || fromIndex === ontoIndex) return character;
  if (!from.id || !onto.id) return character;
  // Putting a bag inside something it already holds would strand both.
  if (containsDeep(character, from.id, onto.id)) return character;

  const previousParent = from.container;

  if (position === 'inside') {
    if (from.container === onto.id) return character;
    const next = inventory.map((it, n) => {
      if (n === fromIndex) return { ...it, container: onto.id };
      if (n === ontoIndex) return it.isContainer ? it : { ...it, isContainer: true };
      return it;
    });
    return { ...character, inventory: pruneIfEmpty(next, previousParent) };
  }

  // Sibling of the target: same parent, and moved next to it in the array,
  // which is what the rendered order follows.
  const rest = inventory.filter((_, n) => n !== fromIndex);
  const targetAt = rest.findIndex((i) => i.id === onto.id);
  if (targetAt < 0) return character;
  const insertAt = position === 'before' ? targetAt : targetAt + 1;
  const moved = { ...from, container: onto.container };
  const next = [...rest.slice(0, insertAt), moved, ...rest.slice(insertAt)];
  // Nothing actually moved: same parent, same slot. Compared by id and parent
  // rather than by object identity — `moved` is a fresh object either way, so
  // an identity check would never see a no-op.
  const sameOrder = next.every((it, n) => it.id === inventory[n]?.id);
  if (sameOrder && moved.container === from.container) return character;
  return { ...character, inventory: pruneIfEmpty(next, previousParent) };
}

/** Rows that can accept contents — every explicit container. */
export function containerRows(character: Character): InventoryNode[] {
  return flatten(inventoryTree(character)).filter((n) => n.item.isContainer);
}

/** Depth-first walk of a tree, parents before their children. */
export function flatten(nodes: InventoryNode[]): InventoryNode[] {
  const out: InventoryNode[] = [];
  const visit = (list: InventoryNode[]) => {
    for (const n of list) {
      out.push(n);
      visit(n.children);
    }
  };
  visit(nodes);
  return out;
}

/** How many rows a container holds, counting nested ones. */
export function contentsCount(node: InventoryNode): number {
  return node.children.reduce((n, c) => n + 1 + contentsCount(c), 0);
}
