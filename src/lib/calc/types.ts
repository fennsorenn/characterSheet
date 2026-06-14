/**
 * Core types for the calculation engine.
 *
 * The engine is deliberately framework-agnostic plain TS: it owns the math and
 * its introspection, while Svelte stores wrap it for reactivity. This keeps the
 * "explain this number" feature, modifier layering, and multiclass math in one
 * unit-testable place that does not depend on the UI.
 */

/**
 * A named, typed contribution to a node's value — an item bonus, a feat, a
 * temporary buff like Bless or Rage, a condition penalty.
 *
 * 5e bonuses generally stack across different sources, so modifiers stack by
 * default. Set `stacks: false` together with a `type` to model the cases that
 * don't (e.g. two sources of the same named bonus, cover) — within a
 * non-stacking type only the largest bonus / smallest penalty applies.
 */
export interface Modifier {
  /** Human-readable origin, shown in explanations. e.g. "Ring of Protection". */
  source: string;
  value: number;
  /** Optional bonus category. Required for non-stacking resolution. */
  type?: string;
  /** Whether this modifier stacks with others of the same type. Defaults true. */
  stacks?: boolean;
}

/** Read-only view passed to a node's formula so it can pull dependency values. */
export interface EvalContext {
  get(id: string): number;
}

/** A formula computes a node's base value from its dependencies. */
export type Formula = (ctx: EvalContext) => number;

/** One modifier paired with whether it survived non-stacking resolution. */
export interface AppliedModifier extends Modifier {
  applied: boolean;
}

/**
 * A node's full computation, as a tree — the data behind the "click AC to see
 * how it's built" modal. Each dependency carries its own explanation, so the UI
 * can drill all the way down to the editable inputs.
 */
export interface Explanation {
  id: string;
  /** Final resolved value (base + applied modifiers). */
  value: number;
  /** Formula result before modifiers. Absent for plain input nodes. */
  base?: number;
  /** True if this node is a user-editable input rather than a formula. */
  isInput: boolean;
  modifiers: AppliedModifier[];
  dependencies: Explanation[];
}
