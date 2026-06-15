import { ABILITIES, type Ability } from './abilities.js';
import type { Character, CharacterModifier } from './schema.js';
import { GRANT_PREFIX } from './grants.js';

/**
 * Ability Score Improvements are stored per ASI feature as ability deltas
 * (e.g. {str: 2} or {str: 1, dex: 1}). They're applied non-destructively as
 * modifiers on the ability score nodes, so the base scores stay editable and
 * the increase is introspectable (and reflected as an effective-score override).
 *
 * Feat half-feat bonuses share the same `abilityChoices` map but under a
 * namespaced key (see featAbilities); those are owned by featAbilityModifiers
 * and skipped here.
 */

/** Source label for an ASI modifier, from its choice key (`name|source|subtitle`). */
function labelFor(key: string): string {
  const parts = key.split('|');
  return parts[2] || parts[0] || 'Ability Score Improvement';
}

export function asiModifiers(character: Character): CharacterModifier[] {
  const out: CharacterModifier[] = [];
  for (const [key, increases] of Object.entries(character.abilityChoices ?? {})) {
    if (key.startsWith(GRANT_PREFIX)) continue; // owned by the grant pool (grants.ts)
    const source = labelFor(key);
    for (const a of ABILITIES) {
      const amount = increases[a];
      if (typeof amount === 'number' && amount !== 0) {
        out.push({ target: `ability.${a}.score`, source, value: amount });
      }
    }
  }
  return out;
}

/** Total ASI applied to one ability across all features (for summaries). */
export function asiTotal(character: Character, ability: Ability): number {
  let n = 0;
  for (const [key, inc] of Object.entries(character.abilityChoices ?? {})) {
    if (key.startsWith(GRANT_PREFIX)) continue;
    n += inc[ability] ?? 0;
  }
  return n;
}
