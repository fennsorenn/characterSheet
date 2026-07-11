<script lang="ts">
  import {
    catalogState,
    addOverlayFromRepo,
    addOverlayFromFile,
    removeOverlay
  } from '../stores/catalog.js';
  import {
    fetchRepoIndex,
    supportedProps,
    REPO_PRESETS,
    type RepoConfig,
    type RepoSource
  } from '../data/index.js';
  import UiIcon from './UiIcon.svelte';

  // Selected repo coordinates (a preset by default, editable for custom repos).
  let owner = $state(REPO_PRESETS[0].owner);
  let repo = $state(REPO_PRESETS[0].repo);
  let branch = $state(REPO_PRESETS[0].branch);

  let sources = $state<RepoSource[]>([]);
  let filter = $state('');
  let onlyPlayable = $state(true);
  let loadingIndex = $state(false);
  let busyId = $state<string | null>(null);
  let error = $state<string | null>(null);

  const config = (): RepoConfig => ({ owner, repo, branch, label: `${owner}/${repo}` });

  // Source ids already active, so the list can show "added" instead of "add".
  const activeIds = $derived(new Set($catalogState.overlays.map((o) => o.sourceId)));

  function pickPreset(p: RepoConfig) {
    owner = p.owner;
    repo = p.repo;
    branch = p.branch;
    sources = [];
    error = null;
  }

  async function loadIndex() {
    loadingIndex = true;
    error = null;
    try {
      sources = await fetchRepoIndex(config());
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      sources = [];
    } finally {
      loadingIndex = false;
    }
  }

  const visible = $derived(
    sources.filter((s) => {
      if (onlyPlayable && supportedProps(s).length === 0) return false;
      if (!filter.trim()) return true;
      const q = filter.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.sourceId.toLowerCase().includes(q) ||
        s.abbreviations.some((a) => a.toLowerCase().includes(q))
      );
    })
  );

  async function add(source: RepoSource) {
    busyId = source.sourceId;
    error = null;
    try {
      await addOverlayFromRepo(config(), source);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busyId = null;
    }
  }

  async function onPickFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    error = null;
    try {
      await addOverlayFromFile(file);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    (e.target as HTMLInputElement).value = '';
  }
</script>

<section class="prerelease">
  <h3>Prerelease &amp; homebrew content</h3>
  <p class="intro">
    Layer Unearthed Arcana or homebrew sources on top of your data — e.g. to play
    a UA subclass. Content is added by source and can be removed at any time.
  </p>

  {#if $catalogState.overlays.length > 0}
    <ul class="active">
      {#each $catalogState.overlays as o (o.sourceId)}
        <li>
          <span class="name">{o.label}</span>
          <span class="tag">{o.sourceId}</span>
          <button class="remove" onclick={() => removeOverlay(o.sourceId)} title="Remove" aria-label="Remove"><UiIcon name="close" size="0.85em" /></button>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="repo-row">
    <div class="presets">
      {#each REPO_PRESETS as p}
        <button
          class="chip"
          class:selected={owner === p.owner && repo === p.repo}
          onclick={() => pickPreset(p)}
        >{p.label}</button>
      {/each}
    </div>
    <div class="coords">
      <input bind:value={owner} placeholder="owner" size="14" />
      <span>/</span>
      <input bind:value={repo} placeholder="repo" size="14" />
      <span>@</span>
      <input bind:value={branch} placeholder="branch" size="8" />
      <button onclick={loadIndex} disabled={loadingIndex}>
        {loadingIndex ? 'Loading…' : 'Browse'}
      </button>
    </div>
  </div>

  {#if sources.length > 0}
    <div class="controls">
      <input class="filter" bind:value={filter} placeholder="Filter sources…" />
      <label class="toggle">
        <input type="checkbox" bind:checked={onlyPlayable} />
        Only content this app can use
      </label>
      <span class="count">{visible.length} of {sources.length}</span>
    </div>

    <ul class="list">
      {#each visible as s (s.sourceId)}
        {@const usable = supportedProps(s)}
        <li>
          <div class="s-main">
            <span class="name">{s.name}</span>
            {#if s.abbreviations.length}<span class="abbr">{s.abbreviations[0]}</span>{/if}
          </div>
          <div class="props">
            {#each usable as p}<span class="prop">{p}</span>{/each}
            {#if usable.length === 0}<span class="prop none">no supported content</span>{/if}
          </div>
          {#if activeIds.has(s.sourceId)}
            <button class="added" disabled>Added ✓</button>
          {:else}
            <button onclick={() => add(s)} disabled={busyId === s.sourceId}>
              {busyId === s.sourceId ? 'Adding…' : 'Add'}
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  <div class="file-fallback">
    <label class="file">
      …or load a source file
      <input type="file" accept=".json" onchange={onPickFile} hidden />
    </label>
  </div>

  {#if error}<p class="error">{error}</p>{/if}
</section>

<style>
  .prerelease { margin-top: 1rem; }
  h3 { margin: 0 0 0.25rem; font-size: 1rem; }
  .intro { color: var(--muted); margin: 0 0 0.75rem; font-size: 0.85rem; }
  .active { list-style: none; padding: 0; margin: 0 0 0.75rem; display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .active li {
    display: flex; align-items: center; gap: 0.4rem;
    border: 1px solid var(--accent); border-radius: 999px;
    padding: 0.15rem 0.3rem 0.15rem 0.6rem; font-size: 0.85rem;
  }
  .active .tag { color: var(--muted); font-size: 0.75rem; }
  .remove { border: none; background: none; color: var(--muted); cursor: pointer; padding: 0 0.2rem; }
  .remove:hover { color: var(--accent); }
  .repo-row { display: flex; flex-direction: column; gap: 0.5rem; }
  .presets { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .chip {
    border: 1px solid var(--line); background: var(--bg); color: var(--fg);
    border-radius: 999px; padding: 0.25rem 0.7rem; cursor: pointer; font-size: 0.8rem;
  }
  .chip.selected { border-color: var(--accent); color: var(--accent); }
  .coords { display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; }
  .controls { display: flex; align-items: center; gap: 0.75rem; margin: 0.75rem 0 0.5rem; flex-wrap: wrap; }
  .filter { flex: 1; min-width: 10rem; }
  .toggle { display: flex; align-items: center; gap: 0.3rem; color: var(--muted); font-size: 0.85rem; }
  .count { color: var(--muted); font-size: 0.8rem; }
  .list { list-style: none; padding: 0; margin: 0; max-height: 20rem; overflow-y: auto; border: 1px solid var(--line); border-radius: 6px; }
  .list li { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--line); }
  .list li:last-child { border-bottom: none; }
  .s-main { display: flex; align-items: baseline; gap: 0.4rem; flex: 1; min-width: 0; }
  .s-main .name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .abbr { color: var(--muted); font-size: 0.75rem; }
  .props { display: flex; flex-wrap: wrap; gap: 0.25rem; max-width: 40%; }
  .prop { font-size: 0.7rem; color: var(--muted); border: 1px solid var(--line); border-radius: 4px; padding: 0 0.3rem; }
  .prop.none { border-color: transparent; }
  .file-fallback { margin-top: 0.75rem; }
  .file { color: var(--accent); cursor: pointer; text-decoration: underline; font-size: 0.85rem; }
  input {
    padding: 0.35rem 0.5rem; border: 1px solid var(--line); border-radius: 6px;
    background: var(--bg); color: var(--fg);
  }
  input[type='checkbox'] { padding: 0; }
  button {
    padding: 0.35rem 0.7rem; border: 1px solid var(--accent);
    background: var(--accent); color: #fff; border-radius: 6px; cursor: pointer; font-size: 0.85rem;
  }
  button:disabled { opacity: 0.6; cursor: default; }
  button.added, button.chip { background: var(--bg); color: var(--fg); border-color: var(--line); }
  .error { color: var(--accent); font-size: 0.85rem; }
</style>
