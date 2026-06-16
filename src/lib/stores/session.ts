import { writable } from 'svelte/store';
import { apiMe, apiLogin, apiSignup, apiLogout } from '../api/client.js';

/** Current username: undefined = still loading, null = signed out. */
export const me = writable<string | null | undefined>(undefined);

export async function refreshMe() {
  try {
    me.set((await apiMe()).username);
  } catch {
    me.set(null);
  }
}

export async function login(username: string, password: string): Promise<string | null> {
  const r = await apiLogin(username, password);
  if (r.error) return r.error;
  me.set(r.username ?? null);
  return null;
}

export async function signup(username: string, password: string): Promise<string | null> {
  const r = await apiSignup(username, password);
  if (r.error) return r.error;
  me.set(r.username ?? null);
  return null;
}

export async function logout() {
  await apiLogout().catch(() => {});
  me.set(null);
}
