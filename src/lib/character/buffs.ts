import type { Character } from './schema.js';
import { ABILITY_NAMES, type Ability } from './abilities.js';

/**
 * The buffs currently riding the calc graph, ready to list.
 *
 * Buff mode writes one merged modifier per calc node (see `adjustNode`), so a
 * buff is identified by the node it sits on — which is a graph id like
 * `ability.str.score`, not something you would show a player. `buffLabel` turns
 * those back into English; anything unrecognised falls back to a tidied form of
 * the id rather than being hidden, so a buff can never become invisible and
 * therefore unclearable.
 */

export interface ActiveBuff {
  /** Calc-node id — the key `clearManualModifier` takes. */
  nodeId: string;
  label: string;
  /** Net adjustment: always non-zero (a merged modifier of 0 is dropped). */
  value: number;
}

const FIXED: Record<string, string> = {
  ac: 'Armour Class',
  'ac.armor': 'Armour worn',
  'ac.maxDex': 'Max Dex to AC',
  initiative: 'Initiative',
  'passive.perception': 'Passive Perception',
  'prof.bonus': 'Proficiency Bonus',
  'spell.attack': 'Spell Attack',
  'spell.dc': 'Spell Save DC',
  'level.total': 'Level'
};

/** Title-case a name that arrives lowercased from a node id ("sleight of hand"). */
function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

const abilityName = (a: string): string =>
  ABILITY_NAMES[a as Ability] ?? titleCase(a);

/**
 * A human label for a calc node. Attack nodes carry an id rather than a name,
 * so they read as "Attack roll"/"Attack damage" unless a name is supplied.
 */
export function buffLabel(nodeId: string, attackName?: (id: string) => string | undefined): string {
  const fixed = FIXED[nodeId];
  if (fixed) return fixed;

  const ability = /^ability\.([a-z]+)\.(score|mod)$/.exec(nodeId);
  if (ability) {
    return `${abilityName(ability[1])} ${ability[2] === 'score' ? 'score' : 'modifier'}`;
  }

  const save = /^save\.([a-z]+)$/.exec(nodeId);
  if (save) return `${abilityName(save[1])} save`;

  // Skill ids replace spaces with dots: `skill.sleight.of.hand`.
  const skill = /^skill\.(.+)$/.exec(nodeId);
  if (skill) return titleCase(skill[1].replace(/\./g, ' '));

  const attack = /^attack\.(.+?)(?:\.(hit|dmg))?$/.exec(nodeId);
  if (attack) {
    const name = attackName?.(attack[1]);
    const what = attack[2] === 'dmg' ? 'damage' : 'attack';
    return name ? `${name} ${what}` : `Attack ${what}`;
  }

  // Unknown node: show something rather than nothing.
  return titleCase(nodeId.replace(/[.]/g, ' '));
}

/**
 * Every manual buff on the character, in the order they were applied, labelled
 * and ready to render. `source` is the marker buff mode stamps on its modifiers.
 */
export function activeBuffs(
  character: Character,
  source: string,
  attackName?: (id: string) => string | undefined
): ActiveBuff[] {
  return character.modifiers
    .filter((m) => m.source === source && m.value !== 0)
    .map((m) => ({ nodeId: m.target, label: buffLabel(m.target, attackName), value: m.value }));
}
