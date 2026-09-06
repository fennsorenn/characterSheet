<script lang="ts">
  import {
    characterSources,
    recordSourceLink,
    forgetSourceLink
  } from '../stores/character.js';
  import { addOverlayFromUrl } from '../stores/catalog.js';

  /**
   * The content sources this character depends on, and whether they are here.
   *
   * A character names its content by `{name, source}`, which is enough to look
   * an entry up but not to obtain one — so opening a character on a device that
   * never loaded a given brew silently renders unresolved refs with no clue
   * where they came from. This panel makes the dependency explicit and, when
   * the document carries a link, one click away from fixed.
   */

  let busy = $state<string | null>(null);
  let failed = $state<Record<string, string>>({});
  let editing = $state<string | null>(null);
  let draft = $state('');

  async function download(id: string, url: string) {
    busy = id;
    failed = { ...failed, [id]: '' };
    try {
      await addOverlayFromUrl(url);
    } catch (e) {
      failed = { ...failed, [id]: e instanceof Error ? e.message : String(e) };
    } finally {
      busy = null;
    }
  }

  function startEdit(id: string, url: string | undefined) {
    editing = id;
    draft = url ?? '';
  }

  function saveEdit(id: string, label: string | undefined) {
    const url = draft.trim();
    if (url) recordSourceLink({ id, label, url });
    editing = null;
    draft = '';
  }
</script>

<section class="sources">
  <h3>Content sources</h3>
  {#if $characterSources.length === 0}
    <p class="none">This character uses no catalog content yet.</p>
  {:else}
    <ul>
      {#each $characterSources as s (s.id)}
        <li class:missing={!s.loaded}>
          <div class="row">
            <span class="dot" class:ok={s.loaded} aria-hidden="true"></span>
            <span class="name">
              <strong>{s.label ?? s.id}</strong>
              <span class="meta">
                {s.id} · {s.refCount}
                {s.refCount === 1 ? 'reference' : 'references'}
              </span>
            </span>
            {#if s.loaded}
              <span class="state">Loaded</span>
            {:else if editing === s.id}
              <!-- no-op: the editor below owns this row -->
            {:else if s.url}
              <button
                onclick={() => download(s.id, s.url!)}
                disabled={busy === s.id}
              >
                {busy === s.id ? 'Downloading…' : 'Download'}
              </button>
            {:else}
              <span class="state warn">No link</span>
            {/if}
            <button class="link" onclick={() => startEdit(s.id, s.url)}>
              {s.url ? 'Edit link' : 'Add link'}
            </button>
          </div>

          {#if editing === s.id}
            <div class="editor">
              <input
                type="url"
                placeholder="https://…/source.json"
                bind:value={draft}
                onkeydown={(e) => e.key === 'Enter' && saveEdit(s.id, s.label)}
              />
              <button onclick={() => saveEdit(s.id, s.label)}>Save</button>
              <button class="link" onclick={() => (editing = null)}>Cancel</button>
              {#if s.url}
                <button class="link danger" onclick={() => { forgetSourceLink(s.id); editing = null; }}>
                  Forget
                </button>
              {/if}
            </div>
          {/if}

          {#if failed[s.id]}
            <p class="error">{failed[s.id]}</p>
          {/if}
        </li>
      {/each}
    </ul>
    <p class="hint">
      Links travel with the character, so a device that is missing a source can
      fetch it here. The base dataset and your own custom entries aren't listed —
      neither has anything to download.
    </p>
  {/if}
</section>

<style>
  .sources { display: flex; flex-direction: column; gap: 0.5rem; }
  h3 { margin: 0; font-size: 0.95rem; }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
  li { padding: 0.4rem 0.5rem; border: 1px solid var(--line, #ddd); border-radius: 6px; }
  li.missing { border-color: var(--warn, #c98a00); }
  .row { display: flex; align-items: center; gap: 0.5rem; }
  .name { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .name strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta { font-size: 0.75rem; color: var(--muted, #777); }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--warn, #c98a00); flex: none; }
  .dot.ok { background: var(--ok, #2e9e5b); }
  .state { font-size: 0.8rem; color: var(--muted, #777); }
  .state.warn { color: var(--warn, #c98a00); }
  .editor { display: flex; gap: 0.4rem; margin-top: 0.4rem; }
  .editor input { flex: 1; min-width: 0; }
  .error { color: var(--danger, #c0392b); font-size: 0.8rem; margin: 0.3rem 0 0; }
  .none, .hint { font-size: 0.8rem; color: var(--muted, #777); margin: 0; }
  button.link { background: none; border: none; padding: 0; color: var(--accent, #36c); cursor: pointer; font-size: 0.8rem; }
  button.link.danger { color: var(--danger, #c0392b); }
</style>
