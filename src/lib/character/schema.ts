import { ABILITIES, type Ability, type ProficiencyLevel, type Skill } from './abilities.js';

/**
 * The serializable character document.
 *
 * This is the single source of truth: the calc graph is a *pure function* of it
 * (see buildGraph), so anything that affects a number — scores, class levels,
 * proficiencies, equipped items, temporary buffs — lives here and the graph is
 * rebuilt from it. That keeps persistence, undo, and sharing trivial (it's just
 * JSON) and makes every calculation reproducible.
 */

export const CHARACTER_SCHEMA_VERSION = 1;

/** A reference into the catalog by name + source, never an inlined copy. */
export interface CatalogRef {
  name: string;
  source: string;
}

export interface ClassEntry {
  name: string;
  source: string;
  level: number;
  subclass?: string;
  /** Hit die faces for this class (d10 → 10), used by rest/level-up. */
  hitDie?: number;
}

/** A pool of hit dice of one size; `used` are spent (recover on a long rest). */
export interface HitDicePool {
  die: number;
  max: number;
  used: number;
}

export interface InventoryItem extends CatalogRef {
  quantity: number;
  equipped: boolean;
}

export interface SpellRef extends CatalogRef {
  prepared?: boolean;
}

/** When a spent resource recovers. */
export type RestType = 'short' | 'long';

/**
 * A limited-use feature tracked as a pool of uses — Action Surge, Channel
 * Divinity, Bardic Inspiration, Ki, Rage, etc. `used` counts spent uses;
 * remaining = max - used. Recovers on the matching rest.
 */
export interface Resource {
  id: string;
  name: string;
  max: number;
  used: number;
  recharge: RestType;
}

/** One spell-slot level: how many slots and how many are spent. */
export interface SpellSlotLevel {
  max: number;
  expended: number;
}

/** A flat numeric contribution a buff makes to a calc node. */
export interface BuffModifier {
  target: string;
  value: number;
  type?: string;
}

/**
 * A toggleable temporary effect (Shield of Faith, Haste, cover, a custom
 * bonus). When active, its modifiers feed the calc graph like any other; only
 * one concentration effect can be active at a time.
 */
export interface Buff {
  id: string;
  name: string;
  modifiers: BuffModifier[];
  active: boolean;
  concentration?: boolean;
}

/**
 * An ad-hoc contribution the user (or an equipped item / active buff) layers
 * onto a calc node — e.g. a +1 ring on `ac`, or Bless on attack rolls. Targeted
 * by node id so it flows through the same introspectable graph.
 */
export interface CharacterModifier {
  /** Calc node id this applies to, e.g. "ac" or "save.dex". */
  target: string;
  source: string;
  value: number;
  type?: string;
  stacks?: boolean;
  /** Optional toggle for temporary effects (Rage, Bless) without deleting them. */
  active?: boolean;
}

export interface Character {
  schemaVersion: number;
  id: string;
  name: string;
  abilities: Record<Ability, number>;
  classes: ClassEntry[];
  saveProficiencies: Ability[];
  skillProficiencies: Partial<Record<Skill, ProficiencyLevel>>;
  spellcasting?: { ability: Ability };
  hp: { max: number; current: number; temp: number };
  /** Base armor class before dex/modifiers, e.g. 10 unarmored, 14 chain shirt. */
  acBase: number;
  inventory: InventoryItem[];
  spells: SpellRef[];
  modifiers: CharacterModifier[];
  /** Limited-use features (uses tracked as a spent pool). */
  resources: Resource[];
  /** Spell slots for levels 1-9 (index 0 = level 1). */
  spellSlots: SpellSlotLevel[];
  /** Toggleable temporary effects feeding the modifier stack. */
  buffs: Buff[];
  /** Active 5e condition names (display/status tracking). */
  conditions: string[];
  /** Exhaustion level (0-6); applies a d20 penalty under 2024 rules. */
  exhaustion: number;
  /** Hit dice pools by die size, for short-rest healing. */
  hitDice: HitDicePool[];
}

/** Nine empty spell-slot levels. */
export function emptySpellSlots(): SpellSlotLevel[] {
  return Array.from({ length: 9 }, () => ({ max: 0, expended: 0 }));
}

/** A fresh level-1 character with sensible defaults. */
export function createCharacter(partial: Partial<Character> = {}): Character {
  const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  for (const a of ABILITIES) {
    if (partial.abilities?.[a] !== undefined) abilities[a] = partial.abilities[a];
  }
  return {
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    id: partial.id ?? crypto.randomUUID(),
    name: partial.name ?? 'New Character',
    abilities,
    classes: partial.classes ?? [{ name: 'Fighter', source: 'PHB', level: 1, hitDie: 10 }],
    saveProficiencies: partial.saveProficiencies ?? ['str', 'con'],
    skillProficiencies: partial.skillProficiencies ?? {},
    spellcasting: partial.spellcasting,
    hp: partial.hp ?? { max: 10, current: 10, temp: 0 },
    acBase: partial.acBase ?? 10,
    inventory: partial.inventory ?? [],
    spells: partial.spells ?? [],
    modifiers: partial.modifiers ?? [],
    resources: partial.resources ?? [],
    spellSlots: partial.spellSlots ?? emptySpellSlots(),
    buffs: partial.buffs ?? [],
    conditions: partial.conditions ?? [],
    exhaustion: partial.exhaustion ?? 0,
    hitDice: partial.hitDice ?? [{ die: 10, max: 1, used: 0 }]
  };
}

/** Total character level across all classes. */
export function totalLevel(character: Character): number {
  return character.classes.reduce((sum, c) => sum + c.level, 0) || 1;
}
