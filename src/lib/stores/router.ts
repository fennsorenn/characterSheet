import { writable, derived } from 'svelte/store';

/** Current location path; updated by navigate() and browser back/forward. */
export const path = writable(typeof location !== 'undefined' ? location.pathname : '/');

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => path.set(location.pathname));
}

/** Client-side navigation (pushState) — no full reload. */
export function navigate(to: string, replace = false) {
  if (typeof history === 'undefined') return;
  if (to === location.pathname) return;
  history[replace ? 'replaceState' : 'pushState']({}, '', to);
  path.set(to);
}

export type Route =
  | { view: 'home' }
  | { view: 'login' }
  | { view: 'signup' }
  | { view: 'localOverview' }
  | { view: 'localSheet'; slug: string }
  | { view: 'userOverview'; username: string }
  | { view: 'userSheet'; username: string; slug: string }
  | { view: 'notfound' };

export function parseRoute(p: string): Route {
  const seg = p.replace(/\/+$/, '').split('/').filter(Boolean);
  if (seg.length === 0) return { view: 'home' };
  if (seg[0] === 'login') return { view: 'login' };
  if (seg[0] === 'signup') return { view: 'signup' };
  if (seg[0] === 'local') return seg[1] ? { view: 'localSheet', slug: seg[1] } : { view: 'localOverview' };
  if (seg[0] === 'user' && seg[1]) {
    const username = decodeURIComponent(seg[1]);
    if (seg[2] === 'character' && seg[3]) return { view: 'userSheet', username, slug: seg[3] };
    return { view: 'userOverview', username };
  }
  return { view: 'notfound' };
}

export const route = derived(path, parseRoute);
