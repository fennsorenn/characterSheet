import { CalcGraph, abilityModifier } from '../calc/index.js';
import {
  ABILITIES,
  SKILLS,
  SKILL_ABILITY,
  PROFICIENCY_MULTIPLIER
} from './abilities.js';
import { totalLevel, type Character } from './schema.js';

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
export function buildGraph(character: Character): CalcGraph {
  const g = new CalcGraph();

  // Ability scores and their modifiers.
  for (const abil of ABILITIES) {
    g.set(`ability.${abil}.score`, character.abilities[abil]);
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
    g.set(`save.${abil}.profMult`, saveProf.has(abil) ? 1 : 0);
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
    const level = character.skillProficiencies[skill] ?? 'none';
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

  // Armor class: base + dex modifier (modifiers layer item/buff bonuses on top).
  g.set('ac.base', character.acBase);
  g.define('ac', ['ac.base', 'ability.dex.mod'], (c) =>
    c.get('ac.base') + c.get('ability.dex.mod')
  );

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

  // Layer the character's own modifiers (equipped items, active buffs) on top.
  for (const mod of character.modifiers) {
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

/** Stable node id for a skill (spaces → dots). */
export function skillNodeId(skill: string): string {
  return `skill.${skill.replace(/\s+/g, '.')}`;
}
