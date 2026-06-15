import { ABILITY_NAMES, type Ability } from './abilities.js';

/**
 * Turn an internal calc-node id into a human label for the explanation UI.
 * Falls back to a title-cased version of the id so new nodes still read sensibly.
 */
export function labelForNode(id: string): string {
  const exact: Record<string, string> = {
    'prof.bonus': 'Proficiency Bonus',
    'level.total': 'Total Level',
    ac: 'Armor Class',
    'ac.armor': 'Armor',
    'ac.maxDex': 'Max Dex Bonus',
    initiative: 'Initiative',
    'passive.perception': 'Passive Perception',
    'spell.dc': 'Spell Save DC',
    'spell.attack': 'Spell Attack Bonus'
  };
  if (exact[id]) return exact[id];

  const abilityMod = id.match(/^ability\.(\w+)\.mod$/);
  if (abilityMod) return `${ABILITY_NAMES[abilityMod[1] as Ability]} Modifier`;

  const abilityScore = id.match(/^ability\.(\w+)\.score$/);
  if (abilityScore) return `${ABILITY_NAMES[abilityScore[1] as Ability]} Score`;

  const save = id.match(/^save\.(\w+)$/);
  if (save) return `${ABILITY_NAMES[save[1] as Ability]} Save`;

  if (/^attack\.\w+\.hit$/.test(id)) return 'Attack Bonus';
  if (/^attack\.\w+\.dmg$/.test(id)) return 'Damage Bonus';
  if (id.endsWith('.profMult')) return 'Proficiency Multiplier';

  const skill = id.match(/^skill\.(.+)$/);
  if (skill) return titleCase(skill[1].replace(/\./g, ' '));

  return titleCase(id.replace(/\./g, ' '));
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (ch) => ch.toUpperCase());
}
