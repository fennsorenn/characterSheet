import type { CatalogRef } from './schema.js';

/**
 * Reminders: short notes a player pins to an exact spot on the sheet —
 * "disadv. in armor" sitting under the Stealth row, "silvered" under a weapon.
 *
 * A reminder names an **anchor** rather than a position, so it stays attached
 * as the sheet reflows: switch template, resize to a phone, reorder the block,
 * and the note is still under Stealth. Anchors are stable string ids built by
 * the helpers below; a row that can be annotated renders the reminders for its
 * anchor, and anything else is left alone.
 *
 * They live on the character document (not the template), because what they say
 * is usually a fact about that character's build or gear — so they follow the
 * character everywhere and stay private to it.
 */

export interface Reminder {
  id: string;
  /** Where it is pinned, e.g. `skill.stealth` — see the anchor helpers. */
  anchor: string;
  text: string;
}

/** Anchor ids. Keep them lowercase and stable: they are persisted. */
export const anchors = {
  skill: (skill: string) => `skill.${skill.toLowerCase()}`,
  save: (ability: string) => `save.${ability.toLowerCase()}`,
  ability: (ability: string) => `ability.${ability.toLowerCase()}`,
  /** Attacks are identified by weapon name; a character can't wield two alike. */
  attack: (name: string) => `attack.${name.toLowerCase()}`,
  item: (ref: CatalogRef) => `item.${ref.name.toLowerCase()}|${ref.source.toLowerCase()}`,
  spell: (ref: CatalogRef) => `spell.${ref.name.toLowerCase()}|${ref.source.toLowerCase()}`,
  /** A whole block, wherever it sits in the layout, e.g. `block.defenses`. */
  block: (type: string) => `block.${type}`
};

/** The reminders pinned at one anchor, in the order they were added. */
export function remindersAt(list: Reminder[] | undefined, anchor: string): Reminder[] {
  return (list ?? []).filter((r) => r.anchor === anchor);
}

/** Add a reminder at an anchor. Blank text adds nothing. */
export function addReminder(
  list: Reminder[] | undefined,
  anchor: string,
  text: string,
  id: string
): Reminder[] {
  const trimmed = text.trim();
  if (!trimmed) return list ?? [];
  return [...(list ?? []), { id, anchor, text: trimmed }];
}

/** Edit a reminder's text; blanking it removes the reminder. */
export function updateReminder(
  list: Reminder[] | undefined,
  id: string,
  text: string
): Reminder[] {
  const trimmed = text.trim();
  if (!trimmed) return removeReminder(list, id);
  return (list ?? []).map((r) => (r.id === id ? { ...r, text: trimmed } : r));
}

export function removeReminder(list: Reminder[] | undefined, id: string): Reminder[] {
  return (list ?? []).filter((r) => r.id !== id);
}

/**
 * Move a reminder one place earlier (-1) or later (+1) among those sharing its
 * anchor, leaving reminders at other anchors where they are.
 */
export function moveReminder(
  list: Reminder[] | undefined,
  id: string,
  dir: -1 | 1
): Reminder[] {
  const all = [...(list ?? [])];
  const target = all.find((r) => r.id === id);
  if (!target) return all;
  const siblings = all.filter((r) => r.anchor === target.anchor);
  const at = siblings.indexOf(target);
  const to = at + dir;
  if (to < 0 || to >= siblings.length) return all;
  // Swap within the anchor group, then write the group back over its own slots.
  [siblings[at], siblings[to]] = [siblings[to], siblings[at]];
  let n = 0;
  return all.map((r) => (r.anchor === target.anchor ? siblings[n++] : r));
}

/**
 * Reminders whose anchor is not among those currently on screen — an item sold,
 * a spell forgotten, a block removed from every template. They would otherwise
 * be invisible and impossible to delete, so the UI surfaces them for cleanup.
 */
export function strandedReminders(
  list: Reminder[] | undefined,
  visible: Iterable<string>
): Reminder[] {
  const shown = new Set(visible);
  return (list ?? []).filter((r) => !shown.has(r.anchor));
}

/** A readable name for an anchor, for listing reminders away from their row. */
export function anchorLabel(anchor: string): string {
  const [kind, rest = ''] = [anchor.slice(0, anchor.indexOf('.')), anchor.slice(anchor.indexOf('.') + 1)];
  const name = rest.split('|')[0].replace(/\b\w/g, (c) => c.toUpperCase());
  switch (kind) {
    case 'skill':
    case 'attack':
    case 'item':
    case 'spell':
      return name;
    case 'save':
      return `${name} save`;
    case 'ability':
      return `${name} score`;
    case 'block':
      return `${name} block`;
    default:
      return anchor;
  }
}
