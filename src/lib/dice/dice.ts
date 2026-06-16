/**
 * Pure dice engine for the roller. A roll is one or more {@link RollPart}s
 * (e.g. an attack's d20 + its damage) evaluated together. Randomness is injected
 * so rolls are deterministic in tests.
 */

export type AdvMode = 'normal' | 'adv' | 'disadv';
export type RNG = () => number;

export interface Die {
  faces: number;
  value: number;
  /** Dropped by advantage/disadvantage (rolled but not counted). */
  dropped?: boolean;
}

export interface RollPart {
  label: string;
  dice: Die[];
  modifier: number;
  /** How the modifier is built (tooltip in the detailed view). */
  modifierLabel?: string;
  total: number;
}

export interface RollGroup {
  id: string;
  title: string;
  parts: RollPart[];
  at: number;
}

export interface DiceTerm {
  count: number;
  faces: number;
}

const defaultRng: RNG = Math.random;
export function rollDie(faces: number, rng: RNG = defaultRng): number {
  return Math.floor(rng() * Math.max(1, faces)) + 1;
}

/** Parse "2d6 + 3", "1d20", "d8-1" → dice terms + flat modifier. */
export function parseDice(expr: string): { terms: DiceTerm[]; modifier: number } {
  const terms: DiceTerm[] = [];
  let modifier = 0;
  const cleaned = expr.replace(/\s+/g, '');
  // Match signed dice groups (NdM) and flat numbers.
  const re = /([+-]?)(\d*)d(\d+)|([+-]?\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned))) {
    if (m[3]) {
      const sign = m[1] === '-' ? -1 : 1;
      terms.push({ count: sign * (m[2] ? parseInt(m[2], 10) : 1), faces: parseInt(m[3], 10) });
    } else if (m[4]) {
      modifier += parseInt(m[4], 10);
    }
  }
  return { terms, modifier };
}

/** Roll a set of dice terms + modifier into one part (all dice counted). */
export function rollTerms(
  terms: DiceTerm[],
  modifier: number,
  label: string,
  opts: { modifierLabel?: string; rng?: RNG } = {}
): RollPart {
  const rng = opts.rng ?? defaultRng;
  const dice: Die[] = [];
  let sum = 0;
  for (const t of terms) {
    const n = Math.abs(t.count);
    const sign = t.count < 0 ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const value = rollDie(t.faces, rng);
      dice.push({ faces: t.faces, value: sign < 0 ? -value : value });
      sum += sign * value;
    }
  }
  return { label, dice, modifier, modifierLabel: opts.modifierLabel, total: sum + modifier };
}

/** Roll a single expression string into one part. */
export function rollExpression(expr: string, label: string, rng: RNG = defaultRng): RollPart {
  const { terms, modifier } = parseDice(expr);
  return rollTerms(terms, modifier, label || expr, { rng });
}

/**
 * A d20 check/attack: rolls two dice and keeps the higher (adv) / lower (disadv)
 * / first (normal); the other is marked dropped so the breakdown shows both.
 */
export function rollD20(
  mode: AdvMode,
  modifier: number,
  label: string,
  opts: { modifierLabel?: string; rng?: RNG } = {}
): RollPart {
  const rng = opts.rng ?? defaultRng;
  const a = rollDie(20, rng);
  const b = rollDie(20, rng);
  let keptIdx: 0 | 1;
  if (mode === 'adv') keptIdx = a >= b ? 0 : 1;
  else if (mode === 'disadv') keptIdx = a <= b ? 0 : 1;
  else keptIdx = 0; // normal → first
  const dice: Die[] = [
    { faces: 20, value: a, dropped: keptIdx !== 0 },
    { faces: 20, value: b, dropped: keptIdx !== 1 }
  ];
  const kept = keptIdx === 0 ? a : b;
  return { label, dice, modifier, modifierLabel: opts.modifierLabel, total: kept + modifier };
}

/** The detailed "[d1] + [d2] + mod = total" string (used for the concise tooltip). */
export function partDetail(p: RollPart): string {
  const dice = p.dice.map((d) => (d.dropped ? `(${Math.abs(d.value)})` : `${Math.abs(d.value)}`));
  let s = dice.join(' + ');
  if (p.modifier) s += ` ${p.modifier >= 0 ? '+' : '−'} ${Math.abs(p.modifier)}`;
  return `${s} = ${p.total}`;
}
