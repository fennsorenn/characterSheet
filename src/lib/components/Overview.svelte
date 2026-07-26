<script lang="ts">
  import { createCharacter } from '../character/index.js';
  import { navigate } from '../stores/router.js';
  import {
    localList,
    localVersion,
    uniqueLocalSlug,
    uniqueSlug,
    saveLocal,
    deleteLocal,
    type LocalEntry
  } from '../stores/characters.js';
  import { copyLocalToUser, copyUserToLocal } from '../stores/transfer.js';
  import { me } from '../stores/session.js';
  import { apiListCharacters, apiPutCharacter, apiDeleteCharacter, type CharacterSummary } from '../api/client.js';

  let { scope, username = '' }: { scope: 'local' | 'user'; username?: string } = $props();

  let newName = $state('');
  let userList = $state<CharacterSummary[]>([]);
  let loading = $state(false);
  let notice = $state<{ text: string; error?: boolean } | null>(null);
  let copying = $state<string | null>(null);

  // Local list reacts to the localVersion bump; the user list is fetched.
  const list = $derived.by<LocalEntry[] | CharacterSummary[]>(() => {
    if (scope === 'local') {
      void $localVersion;
      return localList();
    }
    return userList;
  });
  const sheetPath = (slug: string) =>
    scope === 'local' ? `/local/${slug}` : `/user/${encodeURIComponent(username)}/character/${slug}`;

  async function refreshUser() {
    loading = true;
    try {
      userList = (await apiListCharacters()).characters;
    } catch {
      userList = [];
    }
    loading = false;
  }
  $effect(() => {
    if (scope === 'user') refreshUser();
  });

  async function create(e: Event) {
    e.preventDefault();
    const name = newName.trim() || 'New Character';
    if (scope === 'local') {
      const slug = uniqueLocalSlug(name);
      saveLocal(slug, name, createCharacter({ name }));
      navigate(`/local/${slug}`);
    } else {
      const slug = uniqueSlug(
        name,
        userList.map((c) => c.slug)
      );
      await apiPutCharacter(slug, name, createCharacter({ name }));
      navigate(`/user/${encodeURIComponent(username)}/character/${slug}`);
    }
  }

  async function remove(slug: string, name: string) {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    if (scope === 'local') deleteLocal(slug);
    else {
      await apiDeleteCharacter(slug);
      refreshUser();
    }
  }

  /**
   * Copy a row into the other library. The copy lands where you are not, so the
   * list in front of you does not change — say what happened and where it went.
   */
  async function copy(slug: string) {
    copying = slug;
    notice = null;
    try {
      const to = scope === 'local' ? await copyLocalToUser(slug) : await copyUserToLocal(slug);
      notice = {
        text:
          scope === 'local'
            ? `Copied to ${$me}'s characters as "${to.name}".`
            : `Copied to this device as "${to.name}".`
      };
    } catch (e) {
      notice = { text: e instanceof Error ? e.message : 'The copy failed.', error: true };
    }
    copying = null;
  }
</script>

<section class="overview">
  <h1>{scope === 'local' ? 'Local characters' : `${username}'s characters`}</h1>

  {#if notice}
    <p class="notice" class:err={notice.error} role="status">{notice.text}</p>
  {/if}

  {#if loading}
    <p class="muted">Loading…</p>
  {:else if list.length === 0}
    <p class="muted">No characters yet — create one below.</p>
  {:else}
    <ul class="chars">
      {#each list as c (c.slug)}
        <li>
          <button class="open" onclick={() => navigate(sheetPath(c.slug))}>
            <span class="nm">{c.name}</span>
            <span class="meta">{new Date(c.updatedAt).toLocaleDateString()}</span>
          </button>
          {#if scope === 'user' || $me}
            <button
              class="cp"
              disabled={copying !== null}
              title={scope === 'local' ? `Copy "${c.name}" to ${$me}'s characters` : `Copy "${c.name}" to this device`}
              aria-label={scope === 'local' ? `Copy ${c.name} to account` : `Copy ${c.name} to this device`}
              onclick={() => copy(c.slug)}
            >
              {copying === c.slug ? 'Copying…' : scope === 'local' ? 'To account' : 'To device'}
            </button>
          {/if}
          <button class="del" title="Delete" aria-label="Delete {c.name}" onclick={() => remove(c.slug, c.name)}>×</button>
        </li>
      {/each}
    </ul>
  {/if}

  <form class="new" onsubmit={create}>
    <input placeholder="New character name…" bind:value={newName} />
    <button class="primary" type="submit">+ Create</button>
  </form>
</section>

<style>
  .overview { max-width: 40rem; margin: 1.5rem auto; padding: 0 1rem; }
  h1 { color: var(--accent); margin: 0 0 1rem; }
  .muted { color: var(--muted); }
  .chars { list-style: none; margin: 0 0 1rem; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
  .chars li { display: flex; gap: 0.5rem; }
  .open { flex: 1; display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; text-align: left; font: inherit; padding: 0.6rem 0.85rem; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--fg); cursor: pointer; }
  .open:hover { border-color: var(--accent); }
  .nm { font-weight: 600; }
  .meta { font-size: 0.75rem; color: var(--muted); }
  .notice { margin: -0.5rem 0 1rem; font-size: 0.85rem; color: var(--accent); }
  .notice.err { color: #d2645a; }
  .cp { font: inherit; font-size: 0.78rem; white-space: nowrap; padding: 0 0.7rem; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--muted); cursor: pointer; }
  .cp:hover:not(:disabled) { color: var(--accent); border-color: var(--accent); }
  .del { font: inherit; font-size: 1.1rem; line-height: 1; padding: 0 0.6rem; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--muted); cursor: pointer; }
  .del:hover { color: #d2645a; border-color: #d2645a; }
  .new { display: flex; gap: 0.5rem; }
  .new input { flex: 1; font: inherit; padding: 0.5rem 0.6rem; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--fg); }
  .primary { font: inherit; font-weight: 600; padding: 0.5rem 0.9rem; border: 1px solid var(--accent); background: var(--accent); color: #fff; border-radius: 6px; cursor: pointer; }
</style>
