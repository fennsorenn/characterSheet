import { CalcGraph, abilityModifier } from '../calc/index.js';
import {
  ABILITIES,
  SKILLS,
  SKILL_ABILITY,
  PROFICIENCY_MULTIPLIER,
  skillNodeId
} from './abilities.js';
import { totalLevel, type Character } from './schema.js';
import {
  computeEquipmentEffects,
  weaponAttacks,
  weaponProficiencySet,
  type CatalogLookup,
  type EquipmentEffects
} from './equipment.js';
import { effectModifiers } from './effects.js';
import { asiModifiers } from './abilityChoices.js';
import { grantNumericModifiers, type GrantPool } from './grants.js';

const EMPTY_POOL: GrantPool = { numeric: [], sets: [], choices: [] };

/**
 * Build a fully-wired {@link CalcGraph} from a character document.
 *
 * Every derived 5e value becomes an introspectable node, so the UI can render it
 * live *and* explain it on demand. The graph is a pure function of the
 * character: rebuilding from the document reconstructs all item/buff modifiers,
 * which is why editing is just "mutate the document, rebuild the graph".
 *
 * Node id conventions:
 *   ability.<abil>.score   input — base ability score
 *   ability.<abil>.mod     derived ability modifier
 *   level.total            input — total character level
 *   prof.bonus             derived proficiency bonus
 *   save.<abil>            derived saving throw bonus
 *   skill.<name>           derived skill bonus
 *   ac, initiative, passive.perception
 *   spell.dc, spell.attack (only if the character is a spellcaster)
 */
export function buildGraph(character: Character, lookup?: CatalogLookup, grants: GrantPool = EMPTY_POOL): CalcGraph {
  const g = new CalcGraph();
  const equipment: EquipmentEffects = lookup
    ? computeEquipmentEffects(character, lookup)
    : { modifiers: [], abilitySets: {} };

  // Feature-granted proficiencies (Resilient's save, a race's skill, …) raise
  // the proficiency tier alongside the character's own, generically.
  const grantedSaves = new Set(grants.sets.filter((s) => s.category === 'saveProf').map((s) => s.member.toLowerCase()));
  const grantedSkills = new Set(grants.sets.filter((s) => s.category === 'skillProf').map((s) => s.member.toLowerCase()));
  const grantedExpertise = new Set(grants.sets.filter((s) => s.category === 'expertise').map((s) => s.member.toLowerCase()));

  // Ability scores and their modifiers. An item that sets a score to a fixed
  // value (e.g. Belt of Giant Strength) overrides only if it's higher.
  for (const abil of ABILITIES) {
    const set = equipment.abilitySets[abil];
    const score = set ? Math.max(character.abilities[abil], set.value) : character.abilities[abil];
    g.set(`ability.${abil}.score`, score);
    g.define(`ability.${abil}.mod`, [`ability.${abil}.score`], (c) =>
      abilityModifier(c.get(`ability.${abil}.score`))
    );
  }

  // Proficiency bonus scales with total level: 2 + floor((level - 1) / 4).
  g.set('level.total', totalLevel(character));
  g.define('prof.bonus', ['level.total'], (c) =>
    2 + Math.floor((c.get('level.total') - 1) / 4)
  );

  // Saving throws: ability mod + proficiency bonus when proficient.
  const saveProf = new Set(character.saveProficiencies);
  for (const abil of ABILITIES) {
    const proficient = saveProf.has(abil) || grantedSaves.has(abil);
    g.set(`save.${abil}.profMult`, proficient ? 1 : 0);
    g.define(
      `save.${abil}`,
      [`ability.${abil}.mod`, 'prof.bonus', `save.${abil}.profMult`],
      (c) =>
        c.get(`ability.${abil}.mod`) +
        Math.floor(c.get('prof.bonus') * c.get(`save.${abil}.profMult`))
    );
  }

  // Skills: governing ability mod + (possibly halved/doubled) proficiency.
  for (const skill of SKILLS) {
    const abil = SKILL_ABILITY[skill];
    let level = character.skillProficiencies[skill] ?? 'none';
    if (grantedExpertise.has(skill)) level = 'expertise';
    else if (grantedSkills.has(skill) && PROFICIENCY_MULTIPLIER[level] < 1) level = 'proficient';
    const id = skillNodeId(skill);
    g.set(`${id}.profMult`, PROFICIENCY_MULTIPLIER[level]);
    g.define(id, [`ability.${abil}.mod`, 'prof.bonus', `${id}.profMult`], (c) =>
      c.get(`ability.${abil}.mod`) +
      Math.floor(c.get('prof.bonus') * c.get(`${id}.profMult`))
    );
  }

  // Initiative and passive perception.
  g.define('initiative', ['ability.dex.mod'], (c) => c.get('ability.dex.mod'));
  g.define('passive.perception', [skillNodeId('perception')], (c) =>
    10 + c.get(skillNodeId('perception'))
  );

  // Armor class: armor base + (dex modifier, capped by armor category). Worn
  // armor overrides the unarmored base; item/buff bonuses layer on as modifiers.
  g.set('ac.armor', equipment.acArmor ?? character.acBase);
  g.set('ac.maxDex', equipment.acMaxDex ?? 99);
  g.define('ac', ['ac.armor', 'ability.dex.mod', 'ac.maxDex'], (c) => {
    const cap = c.get('ac.maxDex');
    const dex = c.get('ability.dex.mod');
    return c.get('ac.armor') + (cap <= 0 ? 0 : Math.min(dex, cap));
  });

  // Spellcasting, when the character has a casting ability.
  if (character.spellcasting) {
    const abil = character.spellcasting.ability;
    g.define('spell.dc', ['prof.bonus', `ability.${abil}.mod`], (c) =>
      8 + c.get('prof.bonus') + c.get(`ability.${abil}.mod`)
    );
    g.define('spell.attack', ['prof.bonus', `ability.${abil}.mod`], (c) =>
      c.get('prof.bonus') + c.get(`ability.${abil}.mod`)
    );
  }

  // Weapon attacks: a to-hit node (ability + proficiency + magic) and a numeric
  // damage-bonus node per equipped weapon, both introspectable in the popover.
  if (lookup) {
    const weaponProfs = weaponProficiencySet(
      grants.sets.filter((s) => s.category === 'weaponProf').map((s) => s.member)
    );
    for (const atk of weaponAttacks(character, lookup, weaponProfs)) {
      const abilMod = `ability.${atk.ability}.mod`;
      g.define(`attack.${atk.id}.hit`, [abilMod, 'prof.bonus'], (c) =>
        c.get(abilMod) + (atk.proficient ? c.get('prof.bonus') : 0) + atk.attackBonus
      );
      g.define(`attack.${atk.id}.dmg`, [abilMod], (c) => c.get(abilMod) + atk.damageBonus);
    }
  }

  // Layer modifiers: equipped items, manual modifiers, then temporary effects
  // (active buffs and exhaustion) — all introspectable in the explain popover.
  for (const mod of [
    ...equipment.modifiers,
    ...character.modifiers,
    ...effectModifiers(character),
    ...asiModifiers(character),
    ...grantNumericModifiers(grants)
  ]) {
    if (mod.active === false) continue;
    if (!g.has(mod.target)) continue;
    g.addModifier(mod.target, {
      source: mod.source,
      value: mod.value,
      type: mod.type,
      stacks: mod.stacks
    });
  }

  return g;
}

export { skillNodeId };
