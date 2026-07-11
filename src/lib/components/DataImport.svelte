<script lang="ts">
  import { catalogState, importFile, importUrl, resetCatalog } from '../stores/catalog.js';
  import { CATEGORIES } from '../data/index.js';
  import PrereleaseManager from './PrereleaseManager.svelte';

  let url = $state(
    'https://github.com/5etools-mirror-3/5etools-src/releases/download/v2.30.0/5etools-v2.30.0.zip'
  );
  let dragging = $state(false);

  const stageLabel: Record<string, string> = {
    downloading: 'Downloading…',
    unpacking: 'Unpacking zip…',
    parsing: 'Parsing data…',
    caching: 'Saving offline copy…'
  };

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) importFile(file);
  }

  function onPick(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) importFile(file);
  }
</script>

<section class="import">
  {#if $catalogState.catalog}
    <div class="loaded">
      <strong>Data loaded</strong> · {$catalogState.catalog.version}
      <ul class="counts">
        {#each CATEGORIES as c}
          <li><span>{$catalogState.catalog.counts[c]}</span>{c}</li>
        {/each}
      </ul>
      <button onclick={resetCatalog}>Load different data</button>
    </div>
    <hr class="sep" />
    <PrereleaseManager />
  {:else}
    <p class="intro">
      This app ships without game data. Supply the 5etools release zip to begin —
      it stays in your browser and is never uploaded.
    </p>

    <div
      class="dropzone"
      class:dragging
      role="button"
      tabindex="0"
      ondragover={(e) => {
        e.preventDefault();
        dragging = true;
      }}
      ondragleave={() => (dragging = false)}
      ondrop={onDrop}
    >
      Drag a release <code>.zip</code> here, or
      <label class="file">
        choose a file
        <input type="file" accept=".zip" onchange={onPick} hidden />
      </label>
    </div>

    <div class="url-row">
      <input type="url" bind:value={url} placeholder="…or paste a release zip URL" />
      <button onclick={() => importUrl(url)}>Load from URL</button>
    </div>
  {/if}

  {#if $catalogState.stage !== 'idle' && $catalogState.stage !== 'done'}
    <p class="status" class:error={$catalogState.stage === 'error'}>
      {$catalogState.stage === 'error'
        ? `Error: ${$catalogState.error}`
        : (stageLabel[$catalogState.stage] ?? '')}
    </p>
  {/if}
</section>

<style>
  .import { border: 1px solid var(--line); border-radius: 8px; padding: 1rem; }
  .intro { color: var(--muted); margin-top: 0; }
  .dropzone {
    border: 2px dashed var(--line);
    border-radius: 8px;
    padding: 1.5rem;
    text-align: center;
    color: var(--muted);
    transition: background 0.15s, border-color 0.15s;
  }
  .dropzone.dragging { border-color: var(--accent); background: var(--field-hover); }
  .file { color: var(--accent); cursor: pointer; text-decoration: underline; }
  .url-row { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
  .url-row input { flex: 1; }
  input {
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg);
    color: var(--fg);
  }
  button {
    padding: 0.4rem 0.8rem;
    border: 1px solid var(--accent);
    background: var(--accent);
    color: #fff;
    border-radius: 6px;
    cursor: pointer;
  }
  .counts { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.75rem; }
  .counts li { color: var(--muted); font-size: 0.85rem; }
  .counts span { color: var(--fg); font-weight: 600; margin-right: 0.25rem; }
  .status { color: var(--muted); }
  .status.error { color: var(--accent); }
  .sep { border: none; border-top: 1px solid var(--line); margin: 1rem 0; }
</style>
