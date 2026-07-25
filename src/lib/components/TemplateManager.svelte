<script lang="ts">
  import {
    layoutList,
    preferredLayouts,
    selectLayout,
    createLayout,
    renameLayout,
    deleteLayout,
    saveAsPreset,
    setPreferredLayout
  } from '../stores/layout.js';
  import { characterLayoutPrefs, setCharacterLayoutPref } from '../stores/character.js';
  import { screenCategory } from '../stores/screen.js';
  import { STARTERS } from '../layout/presets.js';
  import { SCREEN_CATEGORIES, SCREEN_HINTS, SCREEN_LABELS } from '../layout/screen.js';

  /**
   * Create, rename, duplicate and delete layout templates, and designate which
   * template is preferred at each screen-size category — either for every
   * character (the library-wide default) or for this character alone.
   */
  let { onClose }: { onClose?: () => void } = $props();

  let newName = $state('');
  let starter = $state('current');

  const nameFor = (id: string | undefined) =>
    $layoutList.options.find((o) => o.id === id)?.name;

  function create() {
    const name = newName.trim();
    if (!name) return;
    createLayout(name, starter);
    newName = '';
  }

  function rename(id: string) {
    const next = window.prompt('Rename template', nameFor(id) ?? '');
    if (next && next.trim()) renameLayout(id, next.trim());
  }

  function remove(id: string) {
    if (window.confirm(`Delete the template “${nameFor(id)}”?`)) deleteLayout(id);
  }
</script>

<div class="manager">
  <div class="row head">
    <h2>Templates</h2>
    {#if onClose}<button class="close" onclick={onClose} aria-label="Close templates">✕</button>{/if}
  </div>

  <ul class="list">
    {#each $layoutList.options as opt (opt.id)}
      {@const usedFor = SCREEN_CATEGORIES.filter(
        (c) => $characterLayoutPrefs[c] === opt.id || $preferredLayouts[c] === opt.id
      )}
      <li class:active={opt.id === $layoutList.activeId}>
        <button class="pick" onclick={() => selectLayout(opt.id)} title="Switch to this template">
          {opt.name}
        </button>
        <span class="badges">
          {#each usedFor as c}
            <span class="badge" class:own={$characterLayoutPrefs[c] === opt.id} title={SCREEN_HINTS[c]}>
              {SCREEN_LABELS[c]}
            </span>
          {/each}
        </span>
        <button onclick={() => saveAsPreset(`${opt.name} copy`)} title="Duplicate">Duplicate</button>
        <button onclick={() => rename(opt.id)}>Rename</button>
        <button
          class="danger"
          disabled={$layoutList.options.length <= 1}
          onclick={() => remove(opt.id)}
        >Delete</button>
      </li>
    {/each}
  </ul>

  <div class="new">
    <input
      placeholder="New template name…"
      bind:value={newName}
      onkeydown={(e) => e.key === 'Enter' && create()}
    />
    <select bind:value={starter} title="Start from">
      {#each STARTERS as s}
        <option value={s.key} title={s.description}>Start from: {s.name}</option>
      {/each}
    </select>
    <button onclick={create} disabled={!newName.trim()}>Create</button>
  </div>

  <h3>Preferred template per screen size</h3>
  <p class="hint">
    Sheets open with the preferred template for the current screen size. A choice made
    <em>for this character</em> wins over the default for every character.
  </p>
  <table>
    <thead>
      <tr><th>Screen</th><th>Every character</th><th>This character</th></tr>
    </thead>
    <tbody>
      {#each SCREEN_CATEGORIES as c}
        <tr class:current={c === $screenCategory}>
          <th scope="row">
            {SCREEN_LABELS[c]}
            {#if c === $screenCategory}<span class="now">now</span>{/if}
            <small>{SCREEN_HINTS[c]}</small>
          </th>
          <td>
            <select
              value={$preferredLayouts[c] ?? ''}
              aria-label="Default template for {SCREEN_LABELS[c]}"
              onchange={(e) => setPreferredLayout(c, (e.target as HTMLSelectElement).value || undefined)}
            >
              <option value="">No preference</option>
              {#each $layoutList.options as opt}
                <option value={opt.id}>{opt.name}</option>
              {/each}
            </select>
          </td>
          <td>
            <select
              value={$characterLayoutPrefs[c] ?? ''}
              aria-label="This character's template for {SCREEN_LABELS[c]}"
              onchange={(e) => setCharacterLayoutPref(c, (e.target as HTMLSelectElement).value || undefined)}
            >
              <option value="">Use default{$preferredLayouts[c] ? ` (${nameFor($preferredLayouts[c])})` : ''}</option>
              {#each $layoutList.options as opt}
                <option value={opt.id}>{opt.name}</option>
              {/each}
            </select>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .manager {
    margin-top: 0.6rem;
    padding: 0.75rem 0.9rem 1rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--bg);
  }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  h2 { font-size: 1rem; margin: 0; }
  h3 { font-size: 0.9rem; margin: 1.2rem 0 0.3rem; }
  .hint { color: var(--muted); font-size: 0.8rem; margin: 0 0 0.6rem; }
  .close { border: none; background: none; color: var(--muted); cursor: pointer; font-size: 1rem; }

  .list { list-style: none; margin: 0.6rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
  .list li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.4rem;
    border: 1px solid transparent;
    border-radius: 6px;
  }
  .list li.active { border-color: var(--accent); }
  .pick { flex: 1; text-align: left; border: none; background: none; color: var(--fg); font: inherit; cursor: pointer; padding: 0.2rem 0; }
  .list li.active .pick { color: var(--accent); font-weight: 600; }
  .badges { display: flex; gap: 0.25rem; flex-wrap: wrap; }
  .badge {
    font-size: 0.7rem;
    padding: 0.05rem 0.35rem;
    border: 1px solid var(--line);
    border-radius: 999px;
    color: var(--muted);
  }
  .badge.own { border-color: var(--accent); color: var(--accent); }

  .new { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.8rem; }
  .new input { flex: 1 1 10rem; min-width: 0; cursor: text; }

  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  th, td { text-align: left; padding: 0.3rem 0.4rem 0.3rem 0; vertical-align: middle; }
  thead th { color: var(--muted); font-weight: 500; font-size: 0.78rem; }
  tbody th { font-weight: 600; }
  tbody th small { display: block; font-weight: 400; color: var(--muted); font-size: 0.72rem; }
  tr.current th { color: var(--accent); }
  .now {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border: 1px solid var(--accent);
    border-radius: 999px;
    padding: 0 0.3rem;
    margin-left: 0.3rem;
  }

  .manager button, .manager input, .manager select {
    font: inherit;
    font-size: 0.8rem;
    padding: 0.25rem 0.55rem;
    border: 1px solid var(--line);
    background: var(--bg);
    color: var(--fg);
    border-radius: 6px;
    cursor: pointer;
  }
  .manager .pick, .manager .close { border: none; padding: 0.2rem; }
  .manager button:disabled { opacity: 0.4; cursor: not-allowed; }
  .danger { color: var(--accent); border-color: var(--accent) !important; }
  td select { width: 100%; max-width: 14rem; }
</style>
