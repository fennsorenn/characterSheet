/**
 * Pure logic behind {@link NumberField}'s commit, extracted so the
 * delta-vs-absolute parsing is unit-testable (it caused a double-apply
 * regression when Enter was followed by blur).
 *
 * Returns the new value, or `null` when the input is empty/invalid (commit
 * should then leave the value unchanged).
 */
export function applyNumberEdit(current: number, raw: string): number | null {
  const trimmed = raw.trim();
  if (/^[+-]\d+$/.test(trimmed)) return current + Number(trimmed); // delta
  if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return Number(trimmed); // absolute
  return null;
}

export function clampValue(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
