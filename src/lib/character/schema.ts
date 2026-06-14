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
}

export interface InventoryItem extends CatalogRef {
  quantity: number;
  equipped: boolean;
}

export interface SpellRef extends CatalogRef {
  prepared?: boolean;
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
    classes: partial.classes ?? [{ name: 'Fighter', source: 'PHB', level: 1 }],
    saveProficiencies: partial.saveProficiencies ?? ['str', 'con'],
    skillProficiencies: partial.skillProficiencies ?? {},
    spellcasting: partial.spellcasting,
    hp: partial.hp ?? { max: 10, current: 10, temp: 0 },
    acBase: partial.acBase ?? 10,
    inventory: partial.inventory ?? [],
    spells: partial.spells ?? [],
    modifiers: partial.modifiers ?? []
  };
}

/** Total character level across all classes. */
export function totalLevel(character: Character): number {
  return character.classes.reduce((sum, c) => sum + c.level, 0) || 1;
}
