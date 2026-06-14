export { CalcGraph } from './CalcGraph.js';
export { resolveModifiers } from './modifiers.js';
export type {
  Modifier,
  AppliedModifier,
  Formula,
  EvalContext,
  Explanation
} from './types.js';

/** Standard 5e ability modifier: floor((score - 10) / 2). */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}
