import type { NamedEntry } from '../data/catalog.js';
import { iconForSchool, iconForDamageType } from './itemIcons.js';

/**
 * Extract scannable tags from a spell's 5etools data — damage types, healing,
 * inflicted conditions, attack/save, targeting (single/multi/area), and
 * properties (concentration, ritual, summon). Each tag has a stable id (for
 * filtering), an icon name, and a human label (for the tooltip).
 *
 * Note: 5etools tags debuffs (conditionInflict) and healing (miscTags), but has
 * no generic "buff" tag, so buffs aren't represented here.
 */
export interface SpellTag {
  id: string;
  icon: string;
  label: string;
}

const SCHOOL_NAMES: Record<string, string> = {
  A: 'Abjuration',
  C: 'Conjuration',
  D: 'Divination',
  E: 'Enchantment',
  V: 'Evocation',
  I: 'Illusion',
  N: 'Necromancy',
  T: 'Transmutation'
};

/** Conditions with a dedicated icon; others fall back to a generic affliction. */
const CONDITION_ICONS: Record<string, string> = {
  blinded: 'blinded',
  charmed: 'charmed',
  frightened: 'frightened',
  grappled: 'grappled',
  incapacitated: 'incapacitated',
  invisible: 'invisible',
  petrified: 'petrified',
  poisoned: 'poison',
  prone: 'prone',
  restrained: 'restrained',
  unconscious: 'unconscious'
};

export function conditionIcon(condition: string): string {
  return CONDITION_ICONS[condition.toLowerCase()] ?? 'affliction';
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
const AREA_SHAPES = new Set(['C', 'N', 'S', 'L', 'W', 'Y', 'Q', 'R', 'H']);

export function spellTags(spell: NamedEntry): SpellTag[] {
  const tags: SpellTag[] = [];
  const misc = arr(spell.miscTags);
  const area = arr(spell.areaTags);

  if (typeof spell.school === 'string') {
    const code = spell.school.toUpperCase();
    tags.push({ id: `school:${code}`, icon: iconForSchool(code), label: SCHOOL_NAMES[code] ?? 'Spell' });
  }

  for (const dt of arr(spell.damageInflict)) {
    tags.push({ id: `damage:${dt}`, icon: iconForDamageType(dt) ?? 'magic', label: `${cap(dt)} damage` });
  }

  if (misc.includes('HL') || misc.includes('THP')) {
    tags.push({ id: 'prop:heal', icon: 'heal', label: 'Healing / temp HP' });
  }

  for (const cond of arr(spell.conditionInflict)) {
    tags.push({ id: `cond:${cond}`, icon: conditionIcon(cond), label: `Inflicts ${cond}` });
  }

  if (arr(spell.spellAttack).length) {
    const ranged = arr(spell.spellAttack).includes('R');
    tags.push({ id: 'prop:attack', icon: 'spellattack', label: `${ranged ? 'Ranged' : 'Melee'} spell attack` });
  }
  if (arr(spell.savingThrow).length) {
    const abilities = arr(spell.savingThrow).map(cap).join(', ');
    tags.push({ id: 'prop:save', icon: 'save', label: `Saving throw: ${abilities}` });
  }

  if (area.some((a) => AREA_SHAPES.has(a))) {
    tags.push({ id: 'prop:area', icon: 'area', label: 'Area of effect' });
  } else if (area.includes('MT')) {
    tags.push({ id: 'prop:multi', icon: 'multitarget', label: 'Multiple targets' });
  } else if (area.includes('ST')) {
    tags.push({ id: 'prop:single', icon: 'singletarget', label: 'Single target' });
  }

  if (hasConcentration(spell)) {
    tags.push({ id: 'prop:conc', icon: 'concentration', label: 'Concentration' });
  }
  if ((spell.meta as { ritual?: boolean } | undefined)?.ritual) {
    tags.push({ id: 'prop:ritual', icon: 'ritual', label: 'Ritual' });
  }
  if (misc.includes('SMN')) {
    tags.push({ id: 'prop:summon', icon: 'summon', label: 'Summons a creature' });
  }

  // Buff sub-tags. 5etools has no generic "buff" flag, but the effects are
  // formulaic: some are structured (miscTags ADV/MAC), the rest are detected
  // from the spell text with high-signal phrasings.
  for (const tag of buffTags(spell)) tags.push(tag);

  return tags;
}

const BUFF_TEXT: { id: string; icon: string; label: string; re: RegExp }[] = [
  { id: 'buff:resistance', icon: 'resistance', label: 'Grants damage resistance', re: /\bresistance to\b/i },
  {
    id: 'buff:condimmune',
    icon: 'ward',
    label: 'Grants condition immunity',
    re: /can(?:not|’t|'t) be (?:charmed|frightened|poisoned|paralyzed|blinded|deafened|stunned|put to sleep|grappled|restrained)|immun\w* to (?:being )?(?:charmed|frightened|poison)/i
  },
  {
    id: 'buff:movement',
    icon: 'movement',
    label: 'Grants or boosts movement',
    re: /gains? a (?:fly|flying|swim|swimming|climb|climbing|burrow|burrowing) speed|speed increases|your speed is doubled/i
  },
  { id: 'buff:vision', icon: 'vision', label: 'Grants special vision', re: /\bdarkvision\b|\bblindsight\b|\btruesight\b|\btremorsense\b/i },
  {
    id: 'buff:bonusdie',
    icon: 'dice',
    label: 'Adds a die / reroll',
    re: /\breroll|roll an additional|(?:add|adding) (?:a |an |the |one )?(?:\d?d\d+|number rolled)[^.]{0,30}to (?:your |the )?(?:attack|saving throw|ability check|d20|roll)/i
  }
];

/** Detect buff sub-tags from structured miscTags and formulaic spell text. */
function buffTags(spell: NamedEntry): SpellTag[] {
  const out: SpellTag[] = [];
  const misc = arr(spell.miscTags);
  if (misc.includes('ADV')) out.push({ id: 'buff:advantage', icon: 'advantage', label: 'Grants advantage' });
  if (misc.includes('MAC')) out.push({ id: 'buff:ac', icon: 'shield', label: 'Modifies AC' });

  const body = entriesText(spell);
  for (const t of BUFF_TEXT) {
    if (t.re.test(body)) out.push({ id: t.id, icon: t.icon, label: t.label });
  }
  return out;
}

/** Flatten a spell's entry text (with {@tags} reduced to their display word). */
function entriesText(spell: NamedEntry): string {
  const parts: string[] = [];
  const walk = (x: unknown) => {
    if (typeof x === 'string') parts.push(x);
    else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      walk(o.entries);
      walk(o.items);
      walk(o.entry);
    }
  };
  walk(spell.entries);
  walk((spell as Record<string, unknown>).entriesHigherLevel);
  return parts.join(' ').replace(/\{@\w+ ([^}|]+)(\|[^}]*)?\}/g, '$1');
}

function hasConcentration(spell: NamedEntry): boolean {
  return arr(spell.duration).some(
    (d) => typeof d === 'object' && d !== null && (d as { concentration?: boolean }).concentration
  );
}
