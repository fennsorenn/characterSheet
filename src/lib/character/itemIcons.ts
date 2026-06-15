import type { NamedEntry } from '../data/catalog.js';

/**
 * Resolve an item to an icon name (see Icon.svelte / SLOT_ICONS), driven mainly
 * by 5etools' structured fields — item `type` code and weapon `dmgType` — with
 * name heuristics for weapon subtypes and the slot of "wondrous" items (which
 * carry no slot data). Falls back to a generic `gear` icon; `magic` is reserved
 * for non-item magical effects.
 */

/** Type/damage codes carry a source suffix ("M|XPHB"); take the bare code. */
function bare(code: unknown): string {
  return typeof code === 'string' ? code.split('|')[0] : '';
}

export function iconForItem(item: Pick<NamedEntry, 'name'> & Record<string, unknown>): string {
  const name = item.name.toLowerCase();
  const type = bare(item.type);

  if (type === 'M') return meleeIcon(name, bare(item.dmgType));
  if (type === 'R') return /sling/.test(name) ? 'sling' : 'bow';
  if (type === 'A') return 'arrow';
  if (type === 'LA' || type === 'MA' || type === 'HA') return 'body';
  if (type === 'S') return 'shield';
  if (type === 'P') return 'potion';
  if (type === 'SC') return 'scroll';
  if (type === 'WD' || type === 'RD') return 'wand';
  if (type === 'ST') return 'staff';
  if (type === 'RG') return 'ring';
  if (type === 'SCF') return 'focus';
  if (type === 'INS') return 'instrument';
  if (type === 'AT' || type === 'T' || type === 'GS') return 'tools';
  if (type === '$') return 'treasure';
  if (type === 'FD') return 'food';

  // Name-based extras for items typed only as "Wondrous"/generic.
  if (/poison|venom/.test(name)) return 'poison';
  if (/potion|elixir|\boil\b|philter|draught/.test(name)) return 'potion';
  if (/scroll/.test(name)) return 'scroll';
  if (/\bstaff\b/.test(name)) return 'staff';
  if (/\bwand\b/.test(name)) return 'wand';
  if (/spellbook|\btome\b|grimoire|\bbook\b/.test(name)) return 'scroll';

  const slot = slotIcon(name);
  if (slot) return slot;
  return 'gear';
}

/** Pick a melee-weapon icon by recognisable subtype, then by damage type. */
function meleeIcon(name: string, dmgType: string): string {
  if (/sickle/.test(name)) return 'sickle';
  if (/scythe/.test(name)) return 'scythe';
  if (/whip/.test(name)) return 'whip';
  if (/flail|morningstar|morning star/.test(name)) return 'flail';
  if (/\bnet\b/.test(name)) return 'net';
  if (/trident/.test(name)) return 'trident';
  if (/halberd|glaive|pike|lance|polearm|naginata|guisarme|bardiche/.test(name)) return 'polearm';
  if (/spear|javelin|harpoon/.test(name)) return 'spear';
  if (/club|cudgel/.test(name)) return 'club';
  if (/mace|hammer|maul/.test(name)) return 'mace';
  if (/axe/.test(name)) return 'axe';
  if (/dagger|knife|dart|stiletto|kukri|shiv/.test(name)) return 'dagger';
  if (/sword|rapier|scimitar|blade|katana|sabre|saber|cutlass|falchion/.test(name)) return 'sword';
  if (dmgType === 'S') return 'sword';
  if (dmgType === 'P') return 'spear';
  if (dmgType === 'B') return 'mace';
  return 'sword';
}

/** Equipment slot of a worn "wondrous" item, by name; null if none recognised. */
export function slotIcon(name: string): string | null {
  if (/belt|girdle|sash/.test(name)) return 'waist';
  if (/boots|slippers|shoes|sandals|footwear/.test(name)) return 'feet';
  if (/gauntlet|glove/.test(name)) return 'hands';
  if (/bracers|vambrace|armband/.test(name)) return 'arms';
  if (/cloak|cape|mantle|shawl/.test(name)) return 'shoulders';
  if (/goggles|lenses|spectacles|glasses|\beyes\b|monocle/.test(name)) return 'eyes';
  if (/helm|circlet|crown|tiara|diadem|\bhat\b|\bcap\b|hood|headband|mask/.test(name)) return 'head';
  if (/amulet|necklace|periapt|medallion|talisman|pendant|brooch|scarab|torc/.test(name))
    return 'neck';
  if (/\bring\b|bracelet/.test(name)) return 'ring';
  if (/robe|vestment|garb/.test(name)) return 'body';
  return null;
}

/** Spell-school letter (5etools: A/C/D/E/V/I/N/T) → icon name. */
const SCHOOL_ICONS: Record<string, string> = {
  A: 'abjuration',
  C: 'conjuration',
  D: 'divination',
  E: 'enchantment',
  V: 'evocation',
  I: 'illusion',
  N: 'necromancy',
  T: 'transmutation'
};

export function iconForSchool(school: unknown): string {
  return SCHOOL_ICONS[bare(school).toUpperCase()] ?? 'magic';
}

/** Damage type → icon name. Accepts full words (spells) or weapon codes S/P/B. */
const DAMAGE_WORDS = new Set([
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder'
]);
const DAMAGE_CODES: Record<string, string> = { S: 'slashing', P: 'piercing', B: 'bludgeoning' };

export function iconForDamageType(damage: unknown): string | null {
  if (typeof damage !== 'string' || !damage) return null;
  const lower = damage.toLowerCase();
  if (DAMAGE_WORDS.has(lower)) return lower;
  return DAMAGE_CODES[damage.toUpperCase()] ?? null;
}
