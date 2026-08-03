import { clampValue } from './numberEdit.js';

/**
 * Pure logic behind the per-digit value dial — the editor that replaces the
 * on-screen keyboard on a touchscreen.
 *
 * Stepping carries rather than cycling: the arrow over the tens adds ten, so 19
 * goes to 29 and 99 goes to 109. Cycling a digit in place reads tidier on an
 * odometer, but it makes ▲ on 99 mean *minus ninety*, which is a strange thing
 * for an up arrow to do to a hit point total.
 */

/**
 * How many digits a field needs to show anything it can legally hold.
 *
 * The ceiling is what governs the width, so an open-ended field falls back
 * rather than being sized by its floor: a resource with `min: 0` and no maximum
 * is not a one-digit field.
 */
export function digitsFor(min: number, max: number, fallback = 2): number {
  const len = (n: number) => String(Math.floor(Math.abs(n))).length;
  const floor = Number.isFinite(min) ? len(min) : 1;
  return Math.max(Number.isFinite(max) ? len(max) : fallback, floor, 1);
}

/**
 * The digits shown, most significant first, zero-padded to `count`.
 * The sign is not a digit — it is a separate cell, and only when one is possible.
 */
export function digitCells(value: number, count: number): number[] {
  const text = String(Math.abs(Math.trunc(value))).padStart(count, '0').slice(-count);
  return [...text].map(Number);
}

/** Place value of the cell at `index` in a `count`-digit display (leftmost is largest). */
export function placeOf(index: number, count: number): number {
  return 10 ** (count - 1 - index);
}

/** Step the digit at `place` (1, 10, 100…) up or down, staying inside the bounds. */
export function stepDigit(
  value: number,
  place: number,
  dir: 1 | -1,
  min = -Infinity,
  max = Infinity
): number {
  return clampValue(value + place * dir, min, max);
}

/**
 * Replace the digit at `place`, keeping the rest of the number.
 *
 * Typing is not stepping: a digit typed into a cell *is* that digit, so this
 * substitutes rather than adding, and never carries. The result is still
 * clamped — typing 9 into the tens of an ability score asks for 9x, and the
 * field's ceiling answers.
 */
export function setDigit(
  value: number,
  place: number,
  digit: number,
  min = -Infinity,
  max = Infinity
): number {
  const sign = value < 0 ? -1 : 1;
  const magnitude = Math.abs(Math.trunc(value));
  const current = Math.floor(magnitude / place) % 10;
  return clampValue(sign * (magnitude + (digit - current) * place), min, max);
}

/** Whether a field can hold a negative number at all — decides the sign cell. */
export function canBeNegative(min: number): boolean {
  return min < 0;
}

/** Flip the sign, clamped; a value of zero has no other sign to take. */
export function flipSign(value: number, min = -Infinity, max = Infinity): number {
  const next = clampValue(-value, min, max);
  return next === 0 ? 0 : next; // negating zero gives -0, which is nobody's idea of a value
}

/** "+3" / "−2" / "±0" — the change this edit would make. */
export function formatDelta(from: number, to: number): string {
  const d = to - from;
  if (d === 0) return '±0';
  return d > 0 ? `+${d}` : `−${Math.abs(d)}`;
}
