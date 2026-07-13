import type { NamedEntry } from '../data/catalog.js';

/**
 * A spell's material component, normalized from 5etools' `components.m`, which is
 * one of: `true` (unspecified), a plain string (the component text), or an object
 * `{ text, cost, consume }` where `cost` is in copper pieces and `consume` is
 * `true`/`"optional"` when the material is used up.
 */
export interface SpellMaterial {
  text: string;
  /** Cost in gold pieces (0 when the component is free / has no listed cost). */
  costGp: number;
  /** Whether casting consumes the material (includes 5etools' "optional"). */
  consumed: boolean;
}

export function spellMaterial(entry: NamedEntry | undefined): SpellMaterial | null {
  const m = (entry?.components as { m?: unknown } | undefined)?.m;
  if (!m) return null;
  if (typeof m === 'string') return { text: m, costGp: 0, consumed: false };
  if (typeof m === 'object') {
    const o = m as { text?: string; cost?: number; consume?: boolean | string };
    const cost = typeof o.cost === 'number' ? o.cost : 0;
    return {
      text: o.text ?? '',
      costGp: cost / 100,
      consumed: o.consume === true || o.consume === 'optional'
    };
  }
  return { text: '', costGp: 0, consumed: false };
}

/**
 * The material to surface in the spell list for a given display mode. Only
 * costly materials are relevant (a component pouch covers the rest), so both
 * modes require a gp cost; `consumed` additionally requires it be used up.
 */
export function displayedMaterial(
  entry: NamedEntry | undefined,
  mode: 'off' | 'always' | 'consumed'
): SpellMaterial | null {
  if (mode === 'off') return null;
  const mat = spellMaterial(entry);
  if (!mat || mat.costGp <= 0) return null;
  if (mode === 'consumed' && !mat.consumed) return null;
  return mat;
}
