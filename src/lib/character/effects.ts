import { ABILITIES, SKILLS, skillNodeId } from './abilities.js';
import type { Character, CharacterModifier } from './schema.js';

/**
 * Temporary-effect modifiers — active buffs and exhaustion — flattened into the
 * same {@link CharacterModifier} shape the calc graph already understands. Kept
 * pure so the effect math is testable and the graph stays a function of the
 * document.
 */

/** The 5e conditions, tracked as toggleable status chips. */
export const CONDITIONS = [
  'Blinded',
  'Charmed',
  'Deafened',
  'Frightened',
  'Grappled',
  'Incapacitated',
  'Invisible',
  'Paralyzed',
  'Petrified',
  'Poisoned',
  'Prone',
  'Restrained',
  'Stunned',
  'Unconscious'
] as const;

/** Modifiers from every active buff. */
export function buffModifiers(character: Character): CharacterModifier[] {
  const out: CharacterModifier[] = [];
  for (const buff of character.buffs) {
    if (!buff.active) continue;
    for (const mod of buff.modifiers) {
      out.push({ target: mod.target, source: buff.name, value: mod.value, type: mod.type });
    }
  }
  return out;
}

/**
 * Exhaustion (2024 rules): each level imposes a -2 penalty to all d20 tests —
 * saving throws, ability checks (skills), initiative, and spell attacks.
 */
export function exhaustionModifiers(character: Character): CharacterModifier[] {
  const level = character.exhaustion ?? 0;
  if (level <= 0) return [];
  const penalty = -2 * level;
  const source = `Exhaustion ${level}`;
  const targets = [
    ...ABILITIES.map((a) => `save.${a}`),
    ...SKILLS.map((s) => skillNodeId(s)),
    'initiative',
    'spell.attack'
  ];
  return targets.map((target) => ({ target, source, value: penalty }));
}

/** All temporary-effect modifiers for the character. */
export function effectModifiers(character: Character): CharacterModifier[] {
  return [...buffModifiers(character), ...exhaustionModifiers(character)];
}
