import { ABILITIES, type Ability, type ProficiencyLevel, type Skill } from './abilities.js';
import type { Reminder } from './reminders.js';

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

/**
 * Where a content source can be fetched from again.
 *
 * A character references catalog content by `{name, source}` alone, which is
 * enough to *look up* an entry but not to *obtain* one: open a character on a
 * device that never loaded the Obojima brew and every ref from it dangles with
 * no hint about where it came from. Recording the link on the document means
 * the character carries its own dependencies — it travels to another device,
 * another browser, or a local copy without a separate registry to keep in sync.
 *
 * `id` is the catalog source id (an overlay's `sourceId`, e.g.
 * "ObojimaTallGrass"), matched case-insensitively like every other source
 * comparison here.
 */
export interface SourceLink {
  id: string;
  /** Human label for the manager UI, e.g. "Obojima: Tales from the Tall Grass". */
  label?: string;
  /** https URL the source document can be re-fetched from. */
  url: string;
}

export interface ClassEntry {
  name: string;
  source: string;
  level: number;
  subclass?: string;
  /** Hit die faces for this class (d10 → 10), used by rest/level-up. */
  hitDie?: number;
}

/** The five 5e coin denominations, richest first (the order sheets print them). */
export const COINS = ['pp', 'gp', 'ep', 'sp', 'cp'] as const;
export type Coin = (typeof COINS)[number];

/** Coins carried, by denomination. */
export type Currency = Record<Coin, number>;

export function emptyCurrency(): Currency {
  return { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
}

/**
 * A character's coins, defaulting every denomination to zero.
 *
 * The field is optional so documents written before it existed stay valid, and
 * so a character who has never held a coin carries no dead weight; every reader
 * goes through here rather than repeating the fallback.
 */
export function currencyOf(character: Character): Currency {
  return { ...emptyCurrency(), ...(character.currency ?? {}) };
}

/** Whether any coins are held at all — used to keep an empty purse quiet. */
export function hasCoins(character: Character): boolean {
  const c = currencyOf(character);
  return COINS.some((k) => (c[k] ?? 0) > 0);
}

/** A pool of hit dice of one size; `used` are spent (recover on a long rest). */
export interface HitDicePool {
  die: number;
  max: number;
  used: number;
}

export interface InventoryItem extends CatalogRef {
  /**
   * Stable identity for this row, used to say what sits inside what.
   *
   * Name+source would have been enough to *address* a row — it is what the
   * list keys on and what `addInventoryItem` dedupes by — but containment
   * outlives those: swap a Backpack for a Bag of Holding and everything inside
   * should follow, and a future second entry of one name must not silently
   * adopt the other's contents. Optional on the type so documents written
   * before it existed stay valid; `ensureInventoryIds` fills them in on load.
   */
  id?: string;
  /** The `id` of the container this sits inside, or absent for a loose item. */
  container?: string;
  /**
   * Whether this row can hold other rows. Explicit rather than inferred from
   * having children, so an empty pouch is still a pouch you can put things in.
   */
  isContainer?: boolean;
  quantity: number;
  equipped: boolean;
  /** Attuned to (gates magic bonuses on items that require attunement). */
  attuned?: boolean;
  /** Whether the character is proficient with this weapon (defaults true). */
  proficient?: boolean;
  /** User-chosen display name overriding the catalog name (rename). */
  label?: string;
  /**
   * The player's own description. Custom entries have no catalog text behind
   * them, so this is the only place their rules can live; it is written in the
   * item's window and shown there in place of catalog content.
   */
  description?: string;
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
  /** The player's own description — see {@link InventoryItem.description}. */
  description?: string;
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
  /**
   * Coins carried. Optional: absent means an empty purse, so documents written
   * before currency existed need no migration. Read it with {@link currencyOf}.
   */
  currency?: Currency;
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
  /**
   * Download links for the content sources this character references, so a
   * device missing one can fetch it rather than silently rendering unresolved
   * refs. Only sources with a known origin are listed; the base dataset and
   * hand-written `Custom` entries have none.
   */
  sources?: SourceLink[];
  /** Notes: a tree of folders and markdown documents. */
  notes?: NoteNode[];
  /** Open note tabs + active tab, so the notes view is restored on reload. */
  noteTabs?: { open: string[]; active: string | null };
  /**
   * Ids of inventory containers the player has collapsed.
   *
   * Containers default to open, so the *closed* ones are what needs recording:
   * an absent field means everything is expanded, and a container added later
   * shows its contents rather than hiding them. Persisted like {@link noteTabs}
   * so the state follows the character between devices.
   */
  containersCollapsed?: string[];
  /** Features the player wrote themselves; everything else is derived. */
  customFeatures?: CustomFeature[];
  /** Movement, senses and proficiencies added by hand (see CustomGrant). */
  customGrants?: CustomGrant[];
  /** Skills the game doesn't have. */
  customSkills?: CustomSkill[];
  /** Attacks that aren't a weapon in the pack. */
  customAttacks?: CustomAttack[];
  /** Short notes pinned to exact spots on the sheet (see reminders.ts). */
  reminders?: Reminder[];
  /**
   * This character's preferred layout template per screen-size category
   * (`{ mobile: <templateId>, … }`), overriding the library-wide preference.
   * Lives on the document so the choice travels with the character.
   */
  layoutPrefs?: Record<string, string>;
}

export interface FeatureMeta {
  hidden?: boolean;
  tags?: string[];
  /**
   * The player's own description of the feature, shown when it is expanded in
   * place of the catalog text. A custom feature has no catalog text at all, so
   * for one of those this is the only description there is.
   */
  description?: string;
}

/**
 * A feature the player wrote themselves — a homebrew ability, a boon from the
 * DM, anything the catalog has never heard of. Everything else in the Features
 * block is derived from race/class/background/feats, so these are the only ones
 * the document has to carry. Their text lives in `featureMeta`, keyed
 * `name|Custom` like every other feature's overrides.
 */
export interface CustomFeature {
  id: string;
  name: string;
  /** Optional context line, e.g. "Session 12 boon". */
  subtitle?: string;
}

/** The source recorded on custom features, and the second half of their key. */
export const CUSTOM_SOURCE = 'Custom';

/**
 * Movement, a sense, or a proficiency the player adds by hand.
 *
 * Written as a grant rather than as its own kind of thing, so it merges into the
 * same pool a race or feat feeds and every consumer — the traits rows, the
 * weapon-proficiency check, the skill tiers — picks it up with no extra wiring.
 * The category is a plain string here because the typed union lives with the
 * grant engine, which already depends on this module.
 */
export type CustomGrant =
  | { id: string; kind: 'speed' | 'sense'; name: string; feet: number }
  | { id: string; kind: 'set'; category: string; member: string };

/** A custom grant before it has an id — distributed, so the union survives. */
export type NewCustomGrant = CustomGrant extends infer T
  ? T extends CustomGrant
    ? Omit<T, 'id'>
    : never
  : never;

/**
 * A skill the game doesn't have — a homebrew one, or a tool used like a skill.
 * It names its own governing ability, since nothing else knows it.
 */
export interface CustomSkill {
  id: string;
  name: string;
  ability: Ability;
  proficiency: ProficiencyLevel;
}

/**
 * An attack that isn't a weapon in the pack: a natural weapon, a breath weapon,
 * an unarmed strike, something improvised. The to-hit is assembled the same way
 * a weapon's is (ability + proficiency + a flat bonus) so it explains itself;
 * damage stays text, because "2d6 + 3 fire" is what people actually write.
 */
export interface CustomAttack {
  id: string;
  name: string;
  /** Governing ability, or undefined for a flat bonus with no ability behind it. */
  ability?: Ability;
  proficient?: boolean;
  /** Flat bonus on top (magic, a feature). */
  bonus?: number;
  /** Free text, e.g. "2d6 + 3 fire". Rolled if it parses as dice. */
  damage?: string;
  range?: string;
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
    currency: partial.currency,
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
    sources: partial.sources,
    notes: partial.notes,
    noteTabs: partial.noteTabs,
    containersCollapsed: partial.containersCollapsed,
    customFeatures: partial.customFeatures,
    customGrants: partial.customGrants,
    customSkills: partial.customSkills,
    customAttacks: partial.customAttacks,
    reminders: partial.reminders,
    layoutPrefs: partial.layoutPrefs
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
