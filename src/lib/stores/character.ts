import { writable, derived, get } from 'svelte/store';
import {
  ABILITIES,
  applyRest,
  applyAdjustment,
  adjustmentValue,
  applyLevelUp,
  spendHitDie as spendHitDiePure,
  ATTUNEMENT_LIMIT,
  buildGraph,
  computeEquipmentEffects,
  createCharacter,
  type Ability,
  type Buff,
  type CatalogRef,
  type Character,
  type LevelUpPlan,
  type ProficiencyLevel,
  type Resource,
  type RestType,
  type Skill,
  type SpellStatus
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

/** Per-ability score overrides from items (effective value differs from base). */
export interface AbilityOverride {
  base: number;
  effective: number;
  source: string;
  icon: string;
  delta: number;
}

export const abilityOverrides = derived([store, catalogLookup], ([$c, $lookup]) => {
  const sets = computeEquipmentEffects($c, $lookup).abilitySets;
  const out = {} as Partial<Record<Ability, AbilityOverride>>;
  for (const a of ABILITIES) {
    const set = sets[a];
    if (set && set.value !== $c.abilities[a]) {
      const effective = Math.max($c.abilities[a], set.value);
      out[a] = {
        base: $c.abilities[a],
        effective,
        source: set.source,
        icon: set.icon,
        delta: effective - $c.abilities[a]
      };
    }
  }
  return out;
});

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

// --- Race / background / feats / subclass ---

export function setRace(race: CatalogRef | undefined) {
  update((c) => ({ ...c, race }));
}
export function setBackground(background: CatalogRef | undefined) {
  update((c) => ({ ...c, background }));
}
export function addFeat(feat: CatalogRef) {
  update((c) =>
    c.feats.some((f) => f.name === feat.name && f.source === feat.source)
      ? c
      : { ...c, feats: [...c.feats, feat] }
  );
}
export function removeFeat(index: number) {
  update((c) => ({ ...c, feats: c.feats.filter((_, n) => n !== index) }));
}
export function setSubclass(classIndex: number, subclass: string | undefined) {
  update((c) => ({
    ...c,
    classes: c.classes.map((cl, i) => (i === classIndex ? { ...cl, subclass } : cl))
  }));
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

/** Toggle attunement, refusing to exceed the attunement limit. */
export function toggleAttuned(index: number) {
  update((c) => {
    const item = c.inventory[index];
    if (!item) return c;
    const attuning = !item.attuned;
    const count = c.inventory.filter((i) => i.attuned).length;
    if (attuning && count >= ATTUNEMENT_LIMIT) return c; // at the limit
    return {
      ...c,
      inventory: c.inventory.map((i, n) => (n === index ? { ...i, attuned: attuning } : i))
    };
  });
}

export function setItemProficient(index: number, proficient: boolean) {
  update((c) => ({
    ...c,
    inventory: c.inventory.map((i, n) => (n === index ? { ...i, proficient } : i))
  }));
}

/** Add a spell to the known/prepared list, ignoring duplicates. */
export function addSpell(ref: CatalogRef) {
  update((c) => {
    if (c.spells.some((s) => s.name === ref.name && s.source === ref.source)) return c;
    return { ...c, spells: [...c.spells, { ...ref, status: 'known' as const }] };
  });
}

export function setSpellStatus(index: number, status: SpellStatus) {
  update((c) => ({
    ...c,
    spells: c.spells.map((s, n) =>
      n === index ? { ...s, status, prepared: undefined } : s
    )
  }));
}

/** Mark/unmark a spell as granted by a feature/item (sets the source label). */
export function setSpellGranted(index: number, grantedBy: string | undefined) {
  update((c) => ({
    ...c,
    spells: c.spells.map((s, n) => (n === index ? { ...s, grantedBy: grantedBy || undefined } : s))
  }));
}

export function removeSpell(index: number) {
  update((c) => ({ ...c, spells: c.spells.filter((_, n) => n !== index) }));
}

// --- Hit points ---

export function setHp(field: 'current' | 'max' | 'temp', value: number) {
  update((c) => ({ ...c, hp: { ...c.hp, [field]: Math.max(0, value) } }));
}

// --- Resources (limited-use features) ---

export function addResource(resource: Omit<Resource, 'id'>) {
  update((c) => ({
    ...c,
    resources: [...c.resources, { ...resource, id: crypto.randomUUID() }]
  }));
}

export function removeResource(id: string) {
  update((c) => ({ ...c, resources: c.resources.filter((r) => r.id !== id) }));
}

/** Spend (+1) or restore (-1) a use, clamped to [0, max]. */
export function adjustResource(id: string, delta: number) {
  update((c) => ({
    ...c,
    resources: c.resources.map((r) =>
      r.id === id ? { ...r, used: Math.min(r.max, Math.max(0, r.used + delta)) } : r
    )
  }));
}

export function setResourceMax(id: string, max: number) {
  update((c) => ({
    ...c,
    resources: c.resources.map((r) =>
      r.id === id ? { ...r, max: Math.max(0, max), used: Math.min(r.used, Math.max(0, max)) } : r
    )
  }));
}

// --- Spell slots ---

export function setSlotMax(level: number, max: number) {
  update((c) => ({
    ...c,
    spellSlots: c.spellSlots.map((s, i) =>
      i === level - 1
        ? { max: Math.max(0, max), expended: Math.min(s.expended, Math.max(0, max)) }
        : s
    )
  }));
}

/** Expend (+1) or recover (-1) a slot at a level, clamped to [0, max]. */
export function adjustSlot(level: number, delta: number) {
  update((c) => ({
    ...c,
    spellSlots: c.spellSlots.map((s, i) =>
      i === level - 1
        ? { ...s, expended: Math.min(s.max, Math.max(0, s.expended + delta)) }
        : s
    )
  }));
}

// --- Buffs & effects ---

export function addBuff(buff: Omit<Buff, 'id'>) {
  update((c) => ({ ...c, buffs: [...c.buffs, { ...buff, id: crypto.randomUUID() }] }));
}

export function removeBuff(id: string) {
  update((c) => ({ ...c, buffs: c.buffs.filter((b) => b.id !== id) }));
}

/**
 * Toggle a buff. Activating a concentration buff drops any other concentration
 * buff, since you can only concentrate on one effect at a time.
 */
export function toggleBuff(id: string) {
  update((c) => {
    const target = c.buffs.find((b) => b.id === id);
    if (!target) return c;
    const activating = !target.active;
    const buffs = c.buffs.map((b) => {
      if (b.id === id) return { ...b, active: activating };
      // Turning on a concentration buff ends other concentration effects.
      if (activating && target.concentration && b.concentration && b.active) {
        return { ...b, active: false };
      }
      return b;
    });
    return { ...c, buffs };
  });
}

// --- Conditions & exhaustion ---

export function toggleCondition(name: string) {
  update((c) => {
    const has = c.conditions.includes(name);
    const conditions = has
      ? c.conditions.filter((n) => n !== name)
      : [...c.conditions, name];
    return { ...c, conditions };
  });
}

export function setExhaustion(level: number) {
  update((c) => ({ ...c, exhaustion: Math.min(6, Math.max(0, level)) }));
}

// --- Rest & level up ---

export function rest(type: RestType) {
  update((c) => applyRest(c, type));
}

export function levelUp(plan: LevelUpPlan) {
  update((c) => applyLevelUp(c, plan));
}

export function spendHitDie(die: number, heal: number) {
  update((c) => spendHitDiePure(c, die, heal));
}

/** Manually adjust a hit-die pool's spent count (for ad-hoc tracking). */
export function adjustHitDie(die: number, delta: number) {
  update((c) => ({
    ...c,
    hitDice: c.hitDice.map((p) =>
      p.die === die ? { ...p, used: Math.min(p.max, Math.max(0, p.used + delta)) } : p
    )
  }));
}

export function resetCharacter() {
  store.set(createCharacter());
}

// --- Manual buffs/debuffs (buff mode) ---

/** Source label marking a modifier created by buff-mode editing. */
export const MANUAL_SOURCE = 'Manual buff';

/**
 * Apply a delta to a node's manual adjustment (one merged modifier per node).
 * This is how buff mode turns an edit into a temporary buff/debuff on the calc
 * graph instead of changing a base value.
 */
export function adjustNode(nodeId: string, delta: number) {
  update((c) => ({ ...c, modifiers: applyAdjustment(c.modifiers, nodeId, MANUAL_SOURCE, delta) }));
}

/** Net manual adjustment currently on a node (0 if none). */
export function manualAdjustment(c: Character, nodeId: string): number {
  return adjustmentValue(c.modifiers, nodeId, MANUAL_SOURCE);
}

export function clearManualModifier(nodeId: string) {
  update((c) => ({
    ...c,
    modifiers: c.modifiers.filter((m) => !(m.target === nodeId && m.source === MANUAL_SOURCE))
  }));
}

export function clearAllManualModifiers() {
  update((c) => ({ ...c, modifiers: c.modifiers.filter((m) => m.source !== MANUAL_SOURCE) }));
}

/** Snapshot the current character (for export). */
export function snapshot(): Character {
  return get(store);
}
