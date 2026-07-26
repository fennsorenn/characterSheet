import { writable } from 'svelte/store';
import type { NamedEntry } from '../data/index.js';
import type { StatblockParams } from '../render/statblock.js';

export type DetailKind = 'spell' | 'item' | 'creature';

export interface DetailTarget {
  kind: DetailKind;
  entry: NamedEntry;
  /** Bounding rect of the row/element that opened it, to avoid covering the list. */
  anchor: { x: number; y: number; width: number; height: number } | null;
  /** For a summon creature: the chosen spell level (defaults to its minimum). */
  spellLevel?: number;
  /**
   * Statblock params to render with, when the caller has its own. A pinned
   * creature keeps the caster stats it was pinned at, so reopening it must not
   * silently re-resolve against whatever the caster looks like now.
   */
  params?: StatblockParams;
  /**
   * The pinned entry this window is showing, if it was opened from one — or
   * pinned while open. It makes the window's pin control a toggle: without it
   * the only thing pinning can do is add another copy.
   */
  pinnedId?: string;
}

export const detail = writable<DetailTarget | null>(null);

/** Open the detail window for a catalog entry, anchored to the clicked element. */
export function openDetail(
  kind: DetailKind,
  entry: NamedEntry,
  el?: Element | null,
  spellLevel?: number,
  params?: StatblockParams
) {
  const r = el?.getBoundingClientRect();
  detail.set({
    kind,
    entry,
    spellLevel,
    params,
    anchor: r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null
  });
}
export function closeDetail() {
  detail.set(null);
}

/** Set the summon spell level on the open creature window (recomputes its stats). */
export function setDetailSpellLevel(level: number) {
  detail.update((d) => (d ? { ...d, spellLevel: level } : d));
}

// ── Pinned creatures (docked at the bottom with an HP / uses tracker) ────────

export interface PinnedCreature {
  id: string;
  entry: NamedEntry;
  /** Resolved caster/level context captured when pinned, so the dock is stable. */
  params: StatblockParams;
  hp: { current: number; max: number; temp: number };
  /** Spent legendary actions this round (when the creature has them). */
  legendaryUsed: number;
  /** Recharge abilities currently expended (name → true). */
  uses?: Record<string, boolean>;
}

const PIN_KEY = 'charactersheet.pinnedCreatures';

function loadPinned(): PinnedCreature[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PIN_KEY);
    const parsed = raw ? (JSON.parse(raw) as PinnedCreature[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const pinned = writable<PinnedCreature[]>(loadPinned());
pinned.subscribe((list) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(PIN_KEY, JSON.stringify(list));
});

/** Pin a creature to the dock with a starting HP pool and captured params. */
/** Pin a creature and return the id of the entry created, so a caller can
 *  offer to unpin exactly that one. Pinning the same creature twice is
 *  deliberate — two goblins are two goblins. */
export function pinCreature(entry: NamedEntry, params: StatblockParams, maxHp: number): string {
  const id = crypto.randomUUID();
  pinned.update((list) => [
    ...list,
    { id, entry, params, hp: { current: maxHp, max: maxHp, temp: 0 }, legendaryUsed: 0 }
  ]);
  return id;
}

export function unpinCreature(id: string) {
  pinned.update((list) => list.filter((c) => c.id !== id));
}

export function setPinnedHp(id: string, field: 'current' | 'max' | 'temp', value: number) {
  pinned.update((list) =>
    list.map((c) => (c.id === id ? { ...c, hp: { ...c.hp, [field]: Math.max(0, value) } } : c))
  );
}

/** Apply damage (temp HP absorbs first) or, with a negative amount, healing. */
export function damagePinned(id: string, amount: number) {
  pinned.update((list) =>
    list.map((c) => {
      if (c.id !== id) return c;
      let { current, temp } = c.hp;
      if (amount > 0) {
        const fromTemp = Math.min(temp, amount);
        temp -= fromTemp;
        current = Math.max(0, current - (amount - fromTemp));
      } else {
        current = Math.min(c.hp.max, current - amount);
      }
      return { ...c, hp: { ...c.hp, current, temp } };
    })
  );
}

export function adjustPinnedLegendary(id: string, delta: number, max: number) {
  pinned.update((list) =>
    list.map((c) =>
      c.id === id ? { ...c, legendaryUsed: Math.min(max, Math.max(0, c.legendaryUsed + delta)) } : c
    )
  );
}

/** Toggle whether a recharge ability is expended. */
export function togglePinnedUse(id: string, key: string) {
  pinned.update((list) =>
    list.map((c) => (c.id === id ? { ...c, uses: { ...c.uses, [key]: !c.uses?.[key] } } : c))
  );
}

/** Open the detail window on an already-pinned creature, as that entry. */
export function openPinnedDetail(c: PinnedCreature, el?: Element | null) {
  const r = el?.getBoundingClientRect();
  detail.set({
    kind: 'creature',
    entry: c.entry,
    spellLevel: c.params?.spellLevel,
    params: c.params,
    pinnedId: c.id,
    anchor: r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null
  });
}

/** Note that the open window is now (or is no longer) a pinned entry. */
export function setDetailPinned(id: string | undefined) {
  detail.update((d) => (d ? { ...d, pinnedId: id } : d));
}
