import type { Modifier, Formula, Explanation, EvalContext } from './types.js';
import { resolveModifiers } from './modifiers.js';

interface InputNode {
  kind: 'input';
  value: number;
  modifiers: Modifier[];
}

interface ComputedNode {
  kind: 'computed';
  deps: string[];
  formula: Formula;
  modifiers: Modifier[];
}

type Node = InputNode | ComputedNode;

/**
 * A dependency graph of named values. Inputs are user-editable numbers; computed
 * nodes derive a base value from their dependencies via a formula, then layer
 * modifiers on top. Every node is introspectable through {@link explain}, which
 * is what powers the "show me how this number is built" UI.
 *
 * Values are memoised per mutation generation, so reads are cheap and a single
 * `set`/modifier change transparently invalidates everything downstream.
 */
export class CalcGraph {
  private nodes = new Map<string, Node>();
  private cache = new Map<string, number>();
  private generation = 0;
  private cachedGen = -1;

  /** Declare or replace a user-editable input value. */
  set(id: string, value: number): this {
    const existing = this.nodes.get(id);
    if (existing && existing.kind === 'computed') {
      throw new Error(`Cannot set "${id}": it is a computed node`);
    }
    this.nodes.set(id, {
      kind: 'input',
      value,
      modifiers: existing?.modifiers ?? []
    });
    this.invalidate();
    return this;
  }

  /**
   * Declare or replace a computed node. `deps` makes the graph introspectable
   * (and is validated against what the formula reads); the formula receives a
   * context to pull dependency values.
   */
  define(id: string, deps: string[], formula: Formula): this {
    const existing = this.nodes.get(id);
    this.nodes.set(id, {
      kind: 'computed',
      deps,
      formula,
      modifiers: existing?.modifiers ?? []
    });
    this.invalidate();
    return this;
  }

  /** Layer a modifier onto any node (input or computed). */
  addModifier(id: string, modifier: Modifier): this {
    const node = this.require(id);
    node.modifiers.push(modifier);
    this.invalidate();
    return this;
  }

  /** Remove every modifier on `id` originating from `source`. */
  removeModifiersFrom(id: string, source: string): this {
    const node = this.require(id);
    node.modifiers = node.modifiers.filter((m) => m.source !== source);
    this.invalidate();
    return this;
  }

  has(id: string): boolean {
    return this.nodes.has(id);
  }

  /** Resolved value of a node: base (or input) plus all applied modifiers. */
  get(id: string): number {
    if (this.cachedGen !== this.generation) {
      this.cache.clear();
      this.cachedGen = this.generation;
    }
    return this.evaluate(id, new Set());
  }

  private evaluate(id: string, visiting: Set<string>): number {
    const cached = this.cache.get(id);
    if (cached !== undefined) return cached;

    if (visiting.has(id)) {
      throw new Error(
        `Cycle detected in calculation: ${[...visiting, id].join(' -> ')}`
      );
    }
    const node = this.require(id);
    visiting.add(id);

    const base =
      node.kind === 'input'
        ? node.value
        : node.formula(this.contextFor(visiting));
    const { total } = resolveModifiers(node.modifiers);
    const value = base + total;

    visiting.delete(id);
    this.cache.set(id, value);
    return value;
  }

  private contextFor(visiting: Set<string>): EvalContext {
    return { get: (depId) => this.evaluate(depId, visiting) };
  }

  /** Full computation tree for `id`, recursing through declared dependencies. */
  explain(id: string, seen: Set<string> = new Set()): Explanation {
    const node = this.require(id);
    const { total, applied } = resolveModifiers(node.modifiers);

    if (node.kind === 'input') {
      return {
        id,
        value: node.value + total,
        isInput: true,
        modifiers: applied,
        dependencies: []
      };
    }

    const base = this.get(id) - total;
    // Guard against cycles while building the explanation tree.
    const nextSeen = new Set(seen).add(id);
    const dependencies = node.deps
      .filter((dep) => !seen.has(dep))
      .map((dep) => this.explain(dep, nextSeen));

    return {
      id,
      value: base + total,
      base,
      isInput: false,
      modifiers: applied,
      dependencies
    };
  }

  private require(id: string): Node {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`Unknown calculation node: "${id}"`);
    return node;
  }

  private invalidate(): void {
    this.generation++;
  }
}
