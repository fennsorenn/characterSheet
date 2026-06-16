import type { Character, RestType } from './schema.js';
import { recoverHitDice } from './levelup.js';
import { resetFeatureResources } from './featureResources.js';

/**
 * Rest utilities — pure functions returning a new character.
 *
 * Short rest: features that recharge on a short rest refill; HP and spell slots
 * are unchanged (they require hit dice / a long rest in the base rules).
 * Long rest: everything refills — all features, all spell slots, and HP to max.
 * A long rest also satisfies anything that recharges on a short rest.
 */
export function applyRest(character: Character, type: RestType): Character {
  const isLong = type === 'long';

  const resources = character.resources.map((r) =>
    isLong || r.recharge === 'short' ? { ...r, used: 0 } : r
  );
  const featureResourceUsed = resetFeatureResources(character.featureResourceUsed, type);

  if (!isLong) {
    // Warlock Pact Magic slots recover on a short rest.
    return { ...character, resources, featureResourceUsed, pactSlotsExpended: 0 };
  }

  return {
    ...character,
    resources,
    featureResourceUsed,
    spellSlots: character.spellSlots.map((s) => ({ ...s, expended: 0 })),
    pactSlotsExpended: 0,
    hp: { ...character.hp, current: character.hp.max },
    hitDice: recoverHitDice(character.hitDice)
  };
}
