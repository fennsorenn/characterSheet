/**
 * Three-way merge of a character document, for when the server's copy moved
 * on underneath an open sheet — a GM applied damage through a link, or the same
 * player saved from another device.
 *
 * `base` is the document as it was last known to match the server, `local` is
 * what the sheet holds now (base + edits not yet saved), `remote` is the
 * server's current copy. A value the sheet did not touch takes the remote
 * value; a value only the sheet touched keeps the local one; when both moved,
 * the sheet's edit wins — it is the one the player is looking at.
 *
 * The merge recurses into objects (so a GM's `hp.current` and the player's
 * `hp.max` both survive) and into arrays of `{ id }` records matched by id (so
 * a resource's uses merge without the list being treated as one value).
 * Other arrays — conditions, slot tables by position, spells — are compared
 * whole, except fixed-length positional tables of objects (spell slots), which
 * merge slot by slot.
 */

type Json = unknown;

const isObj = (v: Json): v is Record<string, Json> => !!v && typeof v === 'object' && !Array.isArray(v);

export function deepEqual(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  if (isObj(a)) {
    if (!isObj(b)) return false;
    const ka = Object.keys(a).filter((k) => a[k] !== undefined);
    const kb = Object.keys(b).filter((k) => b[k] !== undefined);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
    return true;
  }
  return false;
}

const idOf = (v: Json): string | undefined => (isObj(v) && typeof v.id === 'string' ? v.id : undefined);
const allHaveIds = (arr: Json[]) => {
  const seen = new Set<string>();
  for (const v of arr) {
    const id = idOf(v);
    if (!id || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
};

function mergeIdArrays(base: Json[], local: Json[], remote: Json[]): Json[] {
  const b = new Map(base.map((v) => [idOf(v)!, v]));
  const r = new Map(remote.map((v) => [idOf(v)!, v]));
  const out: Json[] = [];
  const placed = new Set<string>();
  for (const l of local) {
    const id = idOf(l)!;
    placed.add(id);
    const inBase = b.get(id);
    const inRemote = r.get(id);
    if (inBase === undefined) out.push(l); // added here
    else if (inRemote === undefined) {
      if (!deepEqual(l, inBase)) out.push(l); // removed there, but edited here: keep the edit
    } else out.push(merge3(inBase, l, inRemote));
  }
  for (const v of remote) {
    const id = idOf(v)!;
    if (placed.has(id)) continue;
    if (!b.has(id)) out.push(v); // added there
    // in base, missing locally: removed here — stays removed
  }
  return out;
}

/** Merge `local`'s and `remote`'s changes relative to `base`. */
export function merge3<T>(base: T, local: T, remote: T): T {
  if (deepEqual(local, base)) return remote;
  if (deepEqual(remote, base) || deepEqual(local, remote)) return local;

  if (isObj(base) && isObj(local) && isObj(remote)) {
    const out: Record<string, Json> = {};
    for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
      const v = merge3(base[k], local[k], remote[k]);
      if (v !== undefined) out[k] = v;
    }
    return out as T;
  }

  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
    if (allHaveIds(base) && allHaveIds(local) && allHaveIds(remote)) return mergeIdArrays(base, local, remote) as T;
    const positional =
      base.length === local.length && base.length === remote.length && [...base, ...local, ...remote].every(isObj);
    if (positional) return base.map((b, i) => merge3(b, local[i], remote[i])) as T;
  }

  return local; // both changed the same value: the open sheet wins
}

/**
 * Rebase the sheet's unsaved edits onto the server's copy. Same as
 * {@link merge3}; named for what the sheet does with it.
 */
export const rebase = merge3;
