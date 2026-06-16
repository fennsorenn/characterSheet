import type { Character } from '../character/index.js';

/**
 * Thin wrappers over the auth/character API. Cookies carry the session, so all
 * requests are same-origin with credentials. Each returns parsed JSON; mutating
 * calls surface `{ error }` from the server.
 */

export interface CharacterSummary {
  slug: string;
  name: string;
  updatedAt: number;
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...init });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok && !body.error) throw new Error(`Request failed (${res.status})`);
  return body;
}

export const apiMe = () => req<{ username: string | null }>('/api/auth/me');
export const apiSignup = (username: string, password: string) =>
  req<{ username?: string; error?: string }>('/api/auth/signup', { method: 'POST', body: JSON.stringify({ username, password }) });
export const apiLogin = (username: string, password: string) =>
  req<{ username?: string; error?: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
export const apiLogout = () => req<object>('/api/auth/logout', { method: 'POST' });

export const apiListCharacters = () => req<{ characters: CharacterSummary[] }>('/api/characters');
export const apiGetCharacter = (slug: string) =>
  req<{ doc?: Character; error?: string }>(`/api/characters/${encodeURIComponent(slug)}`);
export const apiPutCharacter = (slug: string, name: string, doc: Character) =>
  req<{ slug?: string; error?: string }>(`/api/characters/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    body: JSON.stringify({ name, doc })
  });
export const apiDeleteCharacter = (slug: string) =>
  req<object>(`/api/characters/${encodeURIComponent(slug)}`, { method: 'DELETE' });
