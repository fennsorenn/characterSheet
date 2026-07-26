import { createCharacter } from '../character/index.js';
import { apiGetCharacter, apiListCharacters, apiPutCharacter } from '../api/client.js';
import { loadLocal, localList, saveLocal, uniqueName, uniqueSlug } from './characters.js';

/**
 * Moving a character between the two libraries — this device's localStorage and
 * a signed-in account's server records.
 *
 * A copy, not a link: the two documents are independent from the moment it is
 * made, since there is no merge story for a character edited in both places.
 * The copy takes a fresh id and a name that is free in the library it lands in,
 * so the target list never shows two identical rows.
 */

export interface CopyResult {
  slug: string;
  name: string;
}

/** Copy a local character into the signed-in account. */
export async function copyLocalToUser(slug: string): Promise<CopyResult> {
  const doc = loadLocal(slug);
  if (!doc) throw new Error('That character is no longer on this device.');

  const existing = (await apiListCharacters()).characters;
  const name = uniqueName(
    doc.name,
    existing.map((c) => c.name)
  );
  const target = uniqueSlug(
    name,
    existing.map((c) => c.slug)
  );

  const res = await apiPutCharacter(target, name, createCharacter({ ...doc, id: undefined, name }));
  if (res.error) throw new Error(res.error);
  return { slug: target, name };
}

/** Copy a character out of the account into this device's local library. */
export async function copyUserToLocal(slug: string): Promise<CopyResult> {
  const res = await apiGetCharacter(slug);
  if (!res.doc) throw new Error(res.error ?? 'That character could not be loaded.');

  const here = localList();
  const name = uniqueName(
    res.doc.name,
    here.map((c) => c.name)
  );
  const target = uniqueSlug(
    name,
    here.map((c) => c.slug)
  );

  saveLocal(target, name, createCharacter({ ...res.doc, id: undefined, name }));
  return { slug: target, name };
}
