<script lang="ts">
  import { character, addNoteDoc, addNoteFolder, deleteNote, renameNote, saveNoteContent } from '../stores/character.js';
  import { isNoteFolder, type NoteDoc, type NoteFolder, type NoteNode } from '../character/index.js';
  import { renderMarkdown } from '../render/markdown.js';

  let { variant = 'full' }: { variant?: string } = $props();

  // IDs of currently open docs (in tab order).
  let openIds = $state<string[]>([]);
  // Which tab is active.
  let activeId = $state<string | null>(null);
  // Whether the tree modal is open.
  let treeOpen = $state(false);
  // Per-tab unsaved edits (id → content). Flushed to character on blur / tab switch.
  let drafts = $state<Record<string, string>>({});
  // Inline rename state for tree.
  let renamingId = $state<string | null>(null);
  let renameValue = $state('');
  // New item prompt inside tree.
  let addingIn = $state<string | null>(null); // folder id or 'root'
  let addingKind = $state<'doc' | 'folder'>('doc');
  let addingName = $state('');

  /** Find a doc node anywhere in the tree by id. */
  function findDoc(nodes: NoteNode[], id: string): NoteDoc | null {
    for (const n of nodes) {
      if (!isNoteFolder(n) && n.id === id) return n as NoteDoc;
      if (isNoteFolder(n)) {
        const found = findDoc((n as NoteFolder).children, id);
        if (found) return found;
      }
    }
    return null;
  }

  /** Collect all docs in DFS order for navigation. */
  function allDocs(nodes: NoteNode[]): NoteDoc[] {
    const out: NoteDoc[] = [];
    for (const n of nodes) {
      if (!isNoteFolder(n)) out.push(n as NoteDoc);
      else out.push(...allDocs((n as NoteFolder).children));
    }
    return out;
  }

  const notes = $derived($character.notes ?? []);

  const activeDoc = $derived(activeId ? findDoc(notes, activeId) : null);

  const activeContent = $derived(activeId != null
    ? (drafts[activeId] ?? activeDoc?.content ?? '')
    : '');

  function openDoc(id: string) {
    if (!openIds.includes(id)) openIds = [...openIds, id];
    activeId = id;
    // Initialise draft from saved content if not already tracking.
    const doc = findDoc(notes, id);
    if (doc && !(id in drafts)) drafts = { ...drafts, [id]: doc.content };
    treeOpen = false;
  }

  function closeTab(id: string) {
    flushDraft(id);
    openIds = openIds.filter((x) => x !== id);
    if (activeId === id) {
      const idx = openIds.indexOf(id);
      activeId = openIds[idx] ?? openIds[idx - 1] ?? openIds[0] ?? null;
    }
    const { [id]: _, ...rest } = drafts;
    drafts = rest;
  }

  function flushDraft(id: string) {
    if (id in drafts) saveNoteContent(id, drafts[id]);
  }

  function onInput(e: Event) {
    if (!activeId) return;
    const val = (e.target as HTMLTextAreaElement).value;
    drafts = { ...drafts, [activeId]: val };
  }

  function onBlur() {
    if (activeId) flushDraft(activeId);
  }

  function switchTab(id: string) {
    if (activeId) flushDraft(activeId);
    activeId = id;
    const doc = findDoc(notes, id);
    if (doc && !(id in drafts)) drafts = { ...drafts, [id]: doc.content };
  }

  // --- Tree actions ---

  function startRename(id: string, name: string) {
    renamingId = id;
    renameValue = name;
  }

  function commitRename() {
    if (renamingId && renameValue.trim()) renameNote(renamingId, renameValue.trim());
    renamingId = null;
  }

  function startAdd(parentId: string | null, kind: 'doc' | 'folder') {
    addingIn = parentId ?? 'root';
    addingKind = kind;
    addingName = '';
  }

  function commitAdd() {
    const name = addingName.trim();
    if (!name) { addingIn = null; return; }
    const parentId = addingIn === 'root' ? null : addingIn;
    if (addingKind === 'doc') {
      const id = addNoteDoc(parentId, name);
      openDoc(id);
    } else {
      addNoteFolder(parentId, name);
    }
    addingIn = null;
    addingName = '';
  }

  function confirmDelete(id: string, name: string) {
    if (confirm(`Delete "${name}"?`)) {
      // Close any open tab for this doc.
      closeTab(id);
      deleteNote(id);
    }
  }

  const preview = $derived(renderMarkdown(activeContent));

  /** Svelte action: focus element on mount. */
  function focusOnMount(el: HTMLElement) {
    el.focus();
    return {};
  }
</script>

<!-- Tree modal -->
{#if treeOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="tree-overlay" onclick={() => { treeOpen = false; }}>
    <div class="tree-modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Notes tree">
      <div class="tree-head">
        <span>Notes</span>
        <button class="close-btn" onclick={() => { treeOpen = false; }} aria-label="Close tree">✕</button>
      </div>
      <div class="tree-body">
        {@render nodeList(notes, null)}
        {#if addingIn === 'root'}
          {@render addForm(null)}
        {:else}
          <div class="tree-actions">
            <button onclick={() => startAdd(null, 'doc')}>+ Doc</button>
            <button onclick={() => startAdd(null, 'folder')}>+ Folder</button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

{#snippet nodeList(nodes: NoteNode[], parentId: string | null)}
  <ul class="node-list">
    {#each nodes as node (node.id)}
      <li class="node-item">
        {#if isNoteFolder(node)}
          <div class="node-row folder-row">
            <span class="node-icon">📁</span>
            {#if renamingId === node.id}
              <input
                class="rename-input"
                bind:value={renameValue}
                onblur={commitRename}
                onkeydown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { renamingId = null; } }}
                use:focusOnMount
              />
            {:else}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <span class="node-name" ondblclick={() => startRename(node.id, node.name)}>{node.name}</span>
            {/if}
            <span class="node-acts">
              <button class="act-btn" title="Rename" onclick={() => startRename(node.id, node.name)}>✎</button>
              <button class="act-btn del" title="Delete" onclick={() => confirmDelete(node.id, node.name)}>✕</button>
            </span>
          </div>
          <div class="folder-children">
            {@render nodeList((node as NoteFolder).children, node.id)}
            {#if addingIn === node.id}
              {@render addForm(node.id)}
            {:else}
              <div class="tree-actions sub">
                <button onclick={() => startAdd(node.id, 'doc')}>+ Doc</button>
                <button onclick={() => startAdd(node.id, 'folder')}>+ Folder</button>
              </div>
            {/if}
          </div>
        {:else}
          <div class="node-row doc-row" class:active={activeId === node.id}>
            <span class="node-icon">📄</span>
            {#if renamingId === node.id}
              <input
                class="rename-input"
                bind:value={renameValue}
                onblur={commitRename}
                onkeydown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { renamingId = null; } }}
                use:focusOnMount
              />
            {:else}
              <button class="node-name-btn" onclick={() => openDoc(node.id)}>{node.name}</button>
            {/if}
            <span class="node-acts">
              <button class="act-btn" title="Rename" onclick={() => startRename(node.id, node.name)}>✎</button>
              <button class="act-btn del" title="Delete" onclick={() => confirmDelete(node.id, node.name)}>✕</button>
            </span>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

{#snippet addForm(parentId: string | null)}
  <div class="add-form">
    <select bind:value={addingKind}>
      <option value="doc">Doc</option>
      <option value="folder">Folder</option>
    </select>
    <input
      class="add-input"
      placeholder="Name…"
      bind:value={addingName}
      onkeydown={(e) => { if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') { addingIn = null; } }}
      use:focusOnMount
    />
    <button onclick={commitAdd}>Add</button>
    <button onclick={() => { addingIn = null; }}>Cancel</button>
  </div>
{/snippet}

<!-- Main block -->
<div class="notes-block">
  <!-- Tab bar -->
  <div class="tab-bar">
    <button class="tree-btn" onclick={() => { treeOpen = !treeOpen; }} title="Open notes tree">📂 Notes</button>
    <div class="tabs">
      {#each openIds as id (id)}
        {@const doc = findDoc(notes, id)}
        {#if doc}
          <button
            class="tab"
            class:active={activeId === id}
            onclick={() => switchTab(id)}
          >
            {doc.name}
            <span
              class="tab-close"
              role="button"
              tabindex="0"
              aria-label="Close tab"
              onclick={(e) => { e.stopPropagation(); closeTab(id); }}
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); closeTab(id); } }}
            >✕</span>
          </button>
        {/if}
      {/each}
    </div>
    <button class="new-btn" title="New document at root" onclick={() => { startAdd(null, 'doc'); treeOpen = true; }}>+</button>
  </div>

  <!-- Editor / preview -->
  {#if activeId && activeDoc}
    <div class="editor-area">
      <textarea
        class="md-editor"
        value={activeContent}
        oninput={onInput}
        onblur={onBlur}
        placeholder="Write in Markdown…"
        spellcheck="true"
      ></textarea>
      <div class="md-preview">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html preview}
      </div>
    </div>
  {:else}
    <div class="empty-state">
      <p>Open a document from the <button class="inline-link" onclick={() => { treeOpen = true; }}>notes tree</button>, or <button class="inline-link" onclick={() => { startAdd(null, 'doc'); treeOpen = true; }}>create one</button>.</p>
    </div>
  {/if}
</div>

<style>
  .notes-block {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 320px;
  }

  /* Tab bar */
  .tab-bar {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    border-bottom: 1px solid var(--line);
    padding: 0.25rem 0.5rem;
    overflow-x: auto;
    flex-shrink: 0;
  }

  .tree-btn {
    background: none;
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 0.2rem 0.5rem;
    cursor: pointer;
    color: var(--fg);
    font-size: 0.8rem;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .tree-btn:hover { background: var(--field-hover); }

  .tabs {
    display: flex;
    gap: 0.15rem;
    overflow-x: auto;
    flex: 1;
  }

  .tab {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    background: none;
    border: 1px solid var(--line);
    border-bottom: none;
    border-radius: 4px 4px 0 0;
    padding: 0.2rem 0.6rem;
    cursor: pointer;
    color: var(--muted);
    font-size: 0.8rem;
    white-space: nowrap;
    transition: background 0.1s;
  }
  .tab:hover { background: var(--field-hover); color: var(--fg); }
  .tab.active { background: var(--bg); color: var(--fg); border-bottom: 1px solid var(--bg); margin-bottom: -1px; }

  .tab-close {
    font-size: 0.65rem;
    color: var(--muted);
    cursor: pointer;
    line-height: 1;
    padding: 1px 2px;
    border-radius: 2px;
  }
  .tab-close:hover { background: var(--field-hover); color: var(--fg); }

  .new-btn {
    background: none;
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 0.2rem 0.5rem;
    cursor: pointer;
    color: var(--muted);
    font-size: 0.9rem;
    flex-shrink: 0;
  }
  .new-btn:hover { color: var(--fg); background: var(--field-hover); }

  /* Editor */
  .editor-area {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    flex: 1;
    overflow: hidden;
  }

  .md-editor {
    resize: none;
    border: none;
    border-right: 1px solid var(--line);
    background: var(--bg);
    color: var(--fg);
    font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
    font-size: 0.85rem;
    padding: 0.75rem;
    outline: none;
    overflow-y: auto;
    line-height: 1.55;
  }

  .md-preview {
    padding: 0.75rem;
    overflow-y: auto;
    font-size: 0.875rem;
    line-height: 1.65;
  }

  /* Markdown preview typography */
  .md-preview :global(h1) { font-size: 1.25rem; margin: 0.5rem 0; }
  .md-preview :global(h2) { font-size: 1.1rem; margin: 0.5rem 0; }
  .md-preview :global(h3) { font-size: 1rem; margin: 0.4rem 0; }
  .md-preview :global(h4) { font-size: 0.9rem; margin: 0.3rem 0; }
  .md-preview :global(h5) { font-size: 0.9rem; margin: 0.3rem 0; }
  .md-preview :global(h6) { font-size: 0.9rem; margin: 0.3rem 0; }
  .md-preview :global(p) { margin: 0.3rem 0; }
  .md-preview :global(ul) { padding-left: 1.4rem; margin: 0.3rem 0; }
  .md-preview :global(ol) { padding-left: 1.4rem; margin: 0.3rem 0; }
  .md-preview :global(li) { margin: 0.15rem 0; }
  .md-preview :global(code) { background: var(--field-hover); padding: 0.1em 0.3em; border-radius: 3px; font-family: monospace; font-size: 0.85em; }
  .md-preview :global(pre) { background: var(--field-hover); padding: 0.6rem; border-radius: 4px; overflow-x: auto; }
  .md-preview :global(pre code) { background: none; padding: 0; }
  .md-preview :global(blockquote) { border-left: 3px solid var(--accent); margin: 0.4rem 0; padding: 0.2rem 0.6rem; color: var(--muted); }
  .md-preview :global(hr) { border: none; border-top: 1px solid var(--line); margin: 0.6rem 0; }
  .md-preview :global(a) { color: var(--accent); }
  .md-preview :global(strong) { font-weight: 600; }

  /* Empty state */
  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    font-size: 0.9rem;
    padding: 2rem;
    text-align: center;
  }

  .inline-link {
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    padding: 0;
    font-size: inherit;
    text-decoration: underline;
  }

  /* Tree modal */
  .tree-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 200;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    padding: 4rem 2rem;
  }

  .tree-modal {
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 8px;
    min-width: 260px;
    max-width: 360px;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  .tree-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--line);
    font-weight: 600;
    font-size: 0.9rem;
    flex-shrink: 0;
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--muted);
    font-size: 0.8rem;
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
  }
  .close-btn:hover { color: var(--fg); background: var(--field-hover); }

  .tree-body {
    overflow-y: auto;
    padding: 0.5rem;
    flex: 1;
  }

  /* Tree nodes */
  .node-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .node-item {
    margin: 0;
  }

  .node-row {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.3rem;
    border-radius: 4px;
  }
  .node-row:hover { background: var(--field-hover); }
  .node-row.active { background: var(--field-hover); }

  .node-icon {
    font-size: 0.85rem;
    flex-shrink: 0;
  }

  .node-name {
    flex: 1;
    font-size: 0.85rem;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: default;
    user-select: none;
  }

  .node-name-btn {
    flex: 1;
    background: none;
    border: none;
    text-align: left;
    font-size: 0.85rem;
    cursor: pointer;
    color: var(--fg);
    padding: 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .node-name-btn:hover { color: var(--accent); }

  .node-acts {
    display: none;
    gap: 0.1rem;
  }
  .node-row:hover .node-acts { display: flex; }

  .act-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--muted);
    font-size: 0.7rem;
    padding: 0.1rem 0.2rem;
    border-radius: 2px;
    line-height: 1;
  }
  .act-btn:hover { color: var(--fg); background: var(--line); }
  .act-btn.del:hover { color: #c0392b; }

  .folder-children {
    padding-left: 1.1rem;
  }

  .rename-input {
    flex: 1;
    border: 1px solid var(--accent);
    border-radius: 3px;
    padding: 0.1rem 0.3rem;
    font-size: 0.85rem;
    background: var(--bg);
    color: var(--fg);
    outline: none;
  }

  /* Add form */
  .add-form {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.3rem;
    flex-wrap: wrap;
  }

  .add-input {
    flex: 1;
    border: 1px solid var(--line);
    border-radius: 3px;
    padding: 0.15rem 0.35rem;
    font-size: 0.8rem;
    background: var(--bg);
    color: var(--fg);
    outline: none;
    min-width: 80px;
  }
  .add-input:focus { border-color: var(--accent); }

  .add-form select,
  .add-form button {
    font-size: 0.78rem;
    padding: 0.15rem 0.3rem;
    border: 1px solid var(--line);
    border-radius: 3px;
    background: var(--bg);
    color: var(--fg);
    cursor: pointer;
  }
  .add-form button:hover { background: var(--field-hover); }

  .tree-actions {
    display: flex;
    gap: 0.25rem;
    padding: 0.2rem 0.3rem;
  }
  .tree-actions.sub { padding-left: 0; }

  .tree-actions button {
    background: none;
    border: 1px solid var(--line);
    border-radius: 3px;
    font-size: 0.75rem;
    padding: 0.1rem 0.35rem;
    cursor: pointer;
    color: var(--muted);
  }
  .tree-actions button:hover { color: var(--fg); background: var(--field-hover); }
</style>
