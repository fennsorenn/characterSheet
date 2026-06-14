import type { Modifier, AppliedModifier } from './types.js';

export interface ModifierResolution {
  /** Sum of all modifiers that actually apply. */
  total: number;
  /** Every modifier, flagged with whether it survived stacking rules. */
  applied: AppliedModifier[];
}

/**
 * Resolve a list of modifiers into a single total, honouring 5e-style stacking:
 *
 * - Stacking modifiers (the default) all add together.
 * - Within a non-stacking `type`, only the most favourable applies: the largest
 *   bonus among positives, the smallest (most negative) among penalties. This
 *   mirrors how same-named bonuses and things like cover behave.
 *
 * The returned `applied` list preserves input order and marks which modifiers
 * were dropped, so explanations can show "(superseded)" entries.
 */
export function resolveModifiers(modifiers: Modifier[]): ModifierResolution {
  // Within each non-stacking type only the largest value applies.
  const winners = new Map<string, Modifier>();
  for (const mod of modifiers) {
    if (mod.stacks === false && mod.type) {
      const current = winners.get(mod.type);
      if (current === undefined || mod.value > current.value) {
        winners.set(mod.type, mod);
      }
    }
  }

  let total = 0;
  const applied: AppliedModifier[] = modifiers.map((mod) => {
    const nonStacking = mod.stacks === false && mod.type !== undefined;
    const isApplied = !nonStacking || winners.get(mod.type!) === mod;
    if (isApplied) total += mod.value;
    return { ...mod, applied: isApplied };
  });

  return { total, applied };
}
