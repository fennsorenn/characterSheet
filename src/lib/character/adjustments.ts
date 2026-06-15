import type { CharacterModifier } from './schema.js';

/**
 * Buff-mode adjustments: one merged modifier per (target, source). Pure so the
 * merge/removal behaviour is testable independently of the store.
 */

/** Apply a delta to the adjustment on a node, merging into a single modifier. */
export function applyAdjustment(
  modifiers: CharacterModifier[],
  target: string,
  source: string,
  delta: number
): CharacterModifier[] {
  if (delta === 0) return modifiers;
  const i = modifiers.findIndex((m) => m.target === target && m.source === source);
  if (i < 0) return [...modifiers, { target, source, value: delta }];

  const value = modifiers[i].value + delta;
  if (value === 0) return modifiers.filter((_, n) => n !== i);
  return modifiers.map((m, n) => (n === i ? { ...m, value } : m));
}

export function adjustmentValue(
  modifiers: CharacterModifier[],
  target: string,
  source: string
): number {
  return modifiers.find((m) => m.target === target && m.source === source)?.value ?? 0;
}
