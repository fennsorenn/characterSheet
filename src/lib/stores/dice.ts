import { writable } from 'svelte/store';
import {
  rollTerms,
  rollD20,
  rollExpression,
  parseDice,
  type AdvMode,
  type RollGroup,
  type RollPart
} from '../dice/dice.js';

/** Whether the floating roller is shown. */
export const diceOpen = writable(false);
/** Advantage mode for d20 attack/check rolls. */
export const diceMode = writable<AdvMode>('normal');
/** Detailed ([d]+[d]+mod=total) vs concise (just totals) display. */
export const diceDetailed = writable(true);
/** Most-recent rolls first, capped. */
export const diceLog = writable<RollGroup[]>([]);

const LOG_CAP = 30;
let seq = 0;

function record(title: string, parts: RollPart[]) {
  const group: RollGroup = { id: `r${++seq}`, title, parts, at: Date.now() };
  diceLog.update((l) => [group, ...l].slice(0, LOG_CAP));
  diceOpen.set(true);
  return group;
}

/** Roll a prepared set of parts together (e.g. attack d20 + damage). */
export function rollParts(title: string, parts: RollPart[]) {
  return record(title, parts);
}

/** Roll a single die (quick buttons). */
export function rollOneDie(faces: number) {
  return record(`d${faces}`, [rollTerms([{ count: 1, faces }], 0, `d${faces}`)]);
}

/**
 * Roll a free-form expression like "2d6+3". `title` overrides the log label
 * (e.g. a symbolic breakdown "2d6 + 2 + Spell Level (5)") while the math still
 * runs on `expr`.
 */
export function rollExpr(expr: string, title?: string) {
  const trimmed = expr.trim();
  if (!trimmed) return;
  const { terms } = parseDice(trimmed);
  if (!terms.length) return;
  const label = title?.trim() || trimmed;
  return record(label, [rollExpression(trimmed, label)]);
}

export function clearLog() {
  diceLog.set([]);
}

export { rollD20, type AdvMode, type RollGroup, type RollPart };
