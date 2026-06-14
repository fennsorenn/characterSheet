import { writable, derived, get } from 'svelte/store';
import {
  buildGraph,
  createCharacter,
  type Ability,
  type CatalogRef,
  type Character,
  type ProficiencyLevel,
  type Skill
} from '../character/index.js';
import { catalogLookup } from './catalog.js';

/**
 * Reactive character document + its derived calc graph.
 *
 * The graph is `derived` from the character, so any edit transparently rebuilds
 * every dependent number (and its explanation). Edits are small helpers that
 * produce a new document object — keeping the door open for undo/redo later.
 * The document is mirrored to localStorage so a refresh keeps your character.
 */

const STORAGE_KEY = 'charactersheet.character';

function load(): Character {
  if (typeof localStorage === 'undefined') return createCharacter();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return createCharacter(JSON.parse(raw));
  } catch {
    // Corrupt or absent — fall back to a fresh character.
  }
  return createCharacter();
}

const store = writable<Character>(load());

store.subscribe((c) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  }
});

/**
 * The live calc graph; recomputed when the character *or* the catalog changes,
 * so equipping a catalog item updates derived numbers (and their explanations).
 */
export const graph = derived([store, catalogLookup], ([$c, $lookup]) =>
  buildGraph($c, $lookup)
);

export const character = { subscribe: store.subscribe };

function update(fn: (c: Character) => Character) {
  store.update(fn);
}

export function setAbilityScore(ability: Ability, score: number) {
  update((c) => ({ ...c, abilities: { ...c.abilities, [ability]: score } }));
}

export function setClassLevel(index: number, level: number) {
  update((c) => {
    const classes = c.classes.map((cl, i) =>
      i === index ? { ...cl, level: Math.max(1, level) } : cl
    );
    return { ...c, classes };
  });
}

export function setName(name: string) {
  update((c) => ({ ...c, name }));
}

export function setAcBase(acBase: number) {
  update((c) => ({ ...c, acBase }));
}

export function toggleSaveProficiency(ability: Ability) {
  update((c) => {
    const has = c.saveProficiencies.includes(ability);
    const saveProficiencies = has
      ? c.saveProficiencies.filter((a) => a !== ability)
      : [...c.saveProficiencies, ability];
    return { ...c, saveProficiencies };
  });
}

/** Cycle a skill through none → proficient → expertise → none. */
export function cycleSkillProficiency(skill: Skill) {
  const order: ProficiencyLevel[] = ['none', 'proficient', 'expertise'];
  update((c) => {
    const current = c.skillProficiencies[skill] ?? 'none';
    const next = order[(order.indexOf(current) + 1) % order.length];
    const skillProficiencies = { ...c.skillProficiencies };
    if (next === 'none') delete skillProficiencies[skill];
    else skillProficiencies[skill] = next;
    return { ...c, skillProficiencies };
  });
}

// --- Inventory & spells (fed by quick import) ---

/** Add a catalog item to the inventory, or bump quantity if already held. */
export function addInventoryItem(ref: CatalogRef) {
  update((c) => {
    const idx = c.inventory.findIndex(
      (i) => i.name === ref.name && i.source === ref.source
    );
    if (idx >= 0) {
      const inventory = c.inventory.map((i, n) =>
        n === idx ? { ...i, quantity: i.quantity + 1 } : i
      );
      return { ...c, inventory };
    }
    return {
      ...c,
      inventory: [...c.inventory, { ...ref, quantity: 1, equipped: false }]
    };
  });
}

export function toggleEquipped(index: number) {
  update((c) => ({
    ...c,
    inventory: c.inventory.map((i, n) =>
      n === index ? { ...i, equipped: !i.equipped } : i
    )
  }));
}

export function setItemQuantity(index: number, quantity: number) {
  update((c) => ({
    ...c,
    inventory: c.inventory
      .map((i, n) => (n === index ? { ...i, quantity: Math.max(0, quantity) } : i))
      .filter((i) => i.quantity > 0)
  }));
}

export function removeInventoryItem(index: number) {
  update((c) => ({ ...c, inventory: c.inventory.filter((_, n) => n !== index) }));
}

/** Add a spell to the known/prepared list, ignoring duplicates. */
export function addSpell(ref: CatalogRef) {
  update((c) => {
    if (c.spells.some((s) => s.name === ref.name && s.source === ref.source)) return c;
    return { ...c, spells: [...c.spells, { ...ref, prepared: false }] };
  });
}

export function togglePrepared(index: number) {
  update((c) => ({
    ...c,
    spells: c.spells.map((s, n) => (n === index ? { ...s, prepared: !s.prepared } : s))
  }));
}

export function removeSpell(index: number) {
  update((c) => ({ ...c, spells: c.spells.filter((_, n) => n !== index) }));
}

export function resetCharacter() {
  store.set(createCharacter());
}

/** Snapshot the current character (for export). */
export function snapshot(): Character {
  return get(store);
}
