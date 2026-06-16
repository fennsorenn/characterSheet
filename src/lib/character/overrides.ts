/**
 * Pure classification of score / AC modifiers into PERSISTENT vs FLEETING.
 *
 * Persistent = permanent character-build changes (ASI increases, feat/racial/
 * background/class ability grants). These read as simply the character's score:
 * a plain number, no badge, no colour.
 *
 * Fleeting = equipment and temporary effects (items that set/boost a score,
 * active buffs, conditions/exhaustion). These show a badge — a buff contribution
 * is coloured (green positive / red negative), an equipment contribution uses a
 * neutral grey badge with normal-colour text.
 *
 * Keeping the classification here — separate from Svelte — makes it unit-testable
 * without rendering components.
 */

/** Which flavour of fleeting contribution dominates the displayed badge. */
export type OverrideKind = 'none' | 'buff' | 'equipment';

/** A single fleeting contribution to a score (an item bonus, a buff, …). */
export interface FleetingContribution {
  /** Signed delta this contribution adds to the score. */
  value: number;
  /** Whether this is equipment (grey badge) or a buff/effect (coloured badge). */
  kind: 'buff' | 'equipment';
}

export interface AbilityClassification {
  /** base + every persistent delta — the number we show when there's no badge. */
  persistentEffective: number;
  /** persistentEffective + every fleeting contribution — the true effective score. */
  fleetingEffective: number;
  /**
   * The badge flavour: 'none' when the delta from base is purely persistent (no
   * badge), else 'buff' (coloured) or 'equipment' (grey). A buff anywhere in the
   * mix wins the colour, since a temporary effect is the noteworthy thing.
   */
  kind: OverrideKind;
}

/**
 * Classify one ability score.
 *
 * @param base                 the raw editable base score
 * @param persistentDelta      summed ASI + ability-grant deltas for this ability
 * @param fleeting             equipment sets / item bonuses / buffs for this ability
 * @param equipmentSetValue    a fixed score an item sets (Belt of Giant Strength = 21),
 *                             applied as `max(persistentEffective, value)` like the graph
 */
export function classifyAbility(
  base: number,
  persistentDelta: number,
  fleeting: FleetingContribution[],
  equipmentSetValue?: number
): AbilityClassification {
  const persistentEffective = base + persistentDelta;

  let effective = persistentEffective;
  let buffDelta = 0;
  let equipmentDelta = 0;

  for (const c of fleeting) {
    effective += c.value;
    if (c.kind === 'buff') buffDelta += c.value;
    else equipmentDelta += c.value;
  }

  // An item that *sets* a score (no effect if the score is already higher).
  if (typeof equipmentSetValue === 'number' && equipmentSetValue > effective) {
    equipmentDelta += equipmentSetValue - effective;
    effective = equipmentSetValue;
  }

  const fleetingEffective = effective;
  let kind: OverrideKind = 'none';
  if (fleetingEffective !== persistentEffective) {
    // A buff anywhere in the mix takes the coloured badge; otherwise grey equipment.
    kind = buffDelta !== 0 ? 'buff' : 'equipment';
  }

  return { persistentEffective, fleetingEffective, kind };
}

/** A single applied modifier on the AC node (from the graph explain). */
export interface AcContribution {
  value: number;
  /** Equipment (shield / magic item) → grey; buff / temporary → coloured. */
  kind: 'buff' | 'equipment';
}

export interface AcClassification {
  /** The plain armor base (worn armor or unarmored) — never badged. */
  base: number;
  /** base + dex (the AC before equipment/buff modifiers). */
  baseEffective: number;
  /** The full effective AC including every modifier. */
  effective: number;
  kind: OverrideKind;
}

/**
 * Classify the Armor Class. Worn armor + dex is the baseline (no badge). A shield
 * or other equipment AC modifier shows a grey badge; a buff/temporary bonus shows
 * a coloured badge. A buff anywhere wins the colour.
 *
 * @param baseEffective  AC from armor + dex, before layered modifiers
 * @param contributions  the applied AC modifiers (shield, magic, buffs, …)
 */
export function classifyAc(baseEffective: number, contributions: AcContribution[]): AcClassification {
  let effective = baseEffective;
  let buffDelta = 0;
  let equipmentDelta = 0;
  for (const c of contributions) {
    effective += c.value;
    if (c.kind === 'buff') buffDelta += c.value;
    else equipmentDelta += c.value;
  }
  let kind: OverrideKind = 'none';
  if (effective !== baseEffective) kind = buffDelta !== 0 ? 'buff' : 'equipment';
  return { base: baseEffective, baseEffective, effective, kind };
}
