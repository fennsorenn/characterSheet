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
  /** Attuned to (gates magic bonuses on items that require attunement). */
  attuned?: boolean;
  /** Whether the character is proficient with this weapon (defaults true). */
  proficient?: boolean;
  /** User-chosen display name overriding the catalog name (rename). */
  label?: string;
}

/** Max items a character can be attuned to at once (5e). */
export const ATTUNEMENT_LIMIT = 3;

/** How a spell sits in the spellbook (mutually exclusive). */
export type SpellStatus = 'known' | 'prepared' | 'favorite';

export interface SpellRef extends CatalogRef {
  /** Preparation status; defaults to 'known'. */
  status?: SpellStatus;
  /** If granted by a feature/item: the source. Doesn't count toward limits. */
  grantedBy?: string;
  /** @deprecated legacy flag, migrated to `status` on read. */
  prepared?: boolean;
}

/** Effective status, migrating the legacy `prepared` flag. */
export function spellStatus(ref: SpellRef): SpellStatus {
  return ref.status ?? (ref.prepared ? 'prepared' : 'known');
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
  race?: CatalogRef;
  background?: CatalogRef;
  feats: CatalogRef[];
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
  /** Spent uses of implicit class/subclass resources, keyed by their stable key. */
  featureResourceUsed: Record<string, number>;
  /** Spell slots for levels 1-9 (index 0 = level 1). */
  spellSlots: SpellSlotLevel[];
  /** When true, slot maxes are computed from class levels (the default). */
  spellSlotsAuto: boolean;
  /** Expended Warlock Pact Magic slots (count, recovers on a short rest). */
  pactSlotsExpended: number;
  /** Toggleable temporary effects feeding the modifier stack. */
  buffs: Buff[];
  /** Active 5e condition names (display/status tracking). */
  conditions: string[];
  /** Exhaustion level (0-6); applies a d20 penalty under 2024 rules. */
  exhaustion: number;
  /** Hit dice pools by die size, for short-rest healing. */
  hitDice: HitDicePool[];
  /** Player-picked spells for "choose a spell" features, keyed by choice slot. */
  spellChoices: Record<string, CatalogRef>;
  /** Picked option for multi-block features (e.g. Magic Initiate class), by key. */
  featureOptions: Record<string, string>;
  /** Ability score increases chosen per ASI feature (key -> ability deltas). */
  abilityChoices: Record<string, Partial<Record<Ability, number>>>;
  /** Picked members for set-valued grant `choose` blocks (skills, resistances, …). */
  grantChoices: Record<string, string[]>;
  /** Picked optional features (maneuvers, invocations, metamagic, …) by slot key. */
  optionalChoices: Record<string, CatalogRef>;
  /** Feats taken in an ASI-or-feat slot, keyed by that slot (cascade into feats). */
  featChoices: Record<string, CatalogRef>;
  /** Per-feature UI overrides (hidden / custom tags), keyed by `name|source`. */
  featureMeta: Record<string, FeatureMeta>;
  /** Enabled optional class-feature variants (isClassFeatureVariant), keyed by
   * `name|source|level`. Off by default; enabling adds the variant as a feature. */
  variantChoices: Record<string, boolean>;
  /** Notes: a tree of folders and markdown documents. */
  notes?: NoteNode[];
  /** Open note tabs + active tab, so the notes view is restored on reload. */
  noteTabs?: { open: string[]; active: string | null };
}

export interface FeatureMeta {
  hidden?: boolean;
  tags?: string[];
}

/** A single notes document (markdown content). */
export interface NoteDoc {
  id: string;
  name: string;
  content: string;
}

/** A folder in the notes tree, which may contain docs or sub-folders. */
export interface NoteFolder {
  id: string;
  name: string;
  /** Mix of NoteDoc and NoteFolder entries. */
  children: NoteNode[];
}

export type NoteNode = NoteDoc | NoteFolder;

export function isNoteFolder(n: NoteNode): n is NoteFolder {
  return 'children' in n;
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
    race: partial.race,
    background: partial.background,
    feats: partial.feats ?? [],
    // Save proficiencies come from the class grant pool; the manual set only
    // layers extras on top, so a fresh character seeds none.
    saveProficiencies: partial.saveProficiencies ?? [],
    skillProficiencies: partial.skillProficiencies ?? {},
    spellcasting: partial.spellcasting,
    hp: partial.hp ?? { max: 10, current: 10, temp: 0 },
    acBase: partial.acBase ?? 10,
    inventory: partial.inventory ?? [],
    spells: partial.spells ?? [],
    modifiers: partial.modifiers ?? [],
    resources: partial.resources ?? [],
    featureResourceUsed: partial.featureResourceUsed ?? {},
    spellSlots: partial.spellSlots ?? emptySpellSlots(),
    spellSlotsAuto: partial.spellSlotsAuto ?? true,
    pactSlotsExpended: partial.pactSlotsExpended ?? 0,
    buffs: partial.buffs ?? [],
    conditions: partial.conditions ?? [],
    exhaustion: partial.exhaustion ?? 0,
    hitDice: partial.hitDice ?? [{ die: 10, max: 1, used: 0 }],
    spellChoices: partial.spellChoices ?? {},
    featureOptions: partial.featureOptions ?? {},
    abilityChoices: partial.abilityChoices ?? {},
    grantChoices: partial.grantChoices ?? {},
    optionalChoices: partial.optionalChoices ?? {},
    featChoices: partial.featChoices ?? {},
    featureMeta: partial.featureMeta ?? {},
    variantChoices: partial.variantChoices ?? {},
    notes: partial.notes,
    noteTabs: partial.noteTabs
  };
}

/** Total character level across all classes. */
export function totalLevel(character: Character): number {
  return character.classes.reduce((sum, c) => sum + c.level, 0) || 1;
}

/**
 * Every feat the character has, from the explicit feat list (race/background/
 * manual) and from ASI-or-feat slots, deduped by name+source. This is the union
 * feature resolution and spell-granting iterate, so a feat taken in an ASI slot
 * cascades into its own feature row and sub-choices like any other feat.
 */
export function allFeatRefs(character: Character): CatalogRef[] {
  const out: CatalogRef[] = [];
  const seen = new Set<string>();
  for (const ref of [...character.feats, ...Object.values(character.featChoices ?? {})]) {
    if (!ref) continue;
    const k = `${ref.name}|${ref.source}`.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(ref);
  }
  return out;
}
