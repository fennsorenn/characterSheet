<script lang="ts">
  import { character, graph } from '../../stores/character.js';
  import { totalLevel } from '../../character/index.js';
  import {
    pageSize,
    prefill,
    customRedaction,
    printClasses,
    closePrint,
    printNow
  } from '../../stores/print.js';
  import { PREFILL_LABELS, type PrefillLevel } from '../../print/redaction.js';
  import { collectSheetValues } from '../../print/sheetValues.js';
  import { buildCharacterPdf } from '../../print/pdf.js';
  import { get } from 'svelte/store';
  import { setLayoutController } from '../../layout/controller.js';
  import { BLOCK_META } from '../../layout/blocks.js';
  import { layout as screenLayout } from '../../stores/layout.js';
  import {
    printController,
    printEditMode,
    togglePrintEdit,
    resetPrintLayout,
    adoptLayout
  } from '../../stores/printLayout.js';
  import LayoutRenderer from '../layout/LayoutRenderer.svelte';

  // The print sheet edits its own dedicated layout, independent of the screen.
  setLayoutController(printController);

  const blockTypes = Object.entries(BLOCK_META);
  let addType = $state('');

  function onAddBlock(e: Event) {
    const type = (e.target as HTMLSelectElement).value;
    if (type) printController.addBlock(type);
    addType = '';
  }

  // Build and download a form-fillable PDF, prefilled per the current options.
  async function downloadFillablePdf() {
    const values = collectSheetValues($character, $graph);
    const bytes = await buildCharacterPdf(values, {
      prefill: $prefill,
      custom: $customRedaction
    });
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${$character.name || 'character'}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const LEVELS = Object.keys(PREFILL_LABELS) as PrefillLevel[];
  const subtitle = $derived(
    `${$character.classes.map((c) => `${c.name} ${c.level}`).join(' / ')} · Level ${totalLevel($character)}`
  );

  // Drive the printed paper size via an injected @page rule.
  $effect(() => {
    const style = document.createElement('style');
    style.textContent = `@page { size: ${$pageSize}; margin: 12mm; }`;
    document.head.appendChild(style);
    return () => style.remove();
  });
</script>

<div class="print-overlay">
  <div class="print-toolbar">
    <button class="back" onclick={closePrint}>← Back to sheet</button>

    <label>
      Paper
      <select bind:value={$pageSize}>
        <option value="letter">Letter</option>
        <option value="a4">A4</option>
      </select>
    </label>

    <label>
      Prefill
      <select bind:value={$prefill}>
        {#each LEVELS as level}
          <option value={level}>{PREFILL_LABELS[level]}</option>
        {/each}
      </select>
    </label>

    {#if $prefill === 'custom'}
      <span class="custom">
        <label><input type="checkbox" bind:checked={$customRedaction.frequent} /> hide frequent</label>
        <label><input type="checkbox" bind:checked={$customRedaction.occasional} /> hide occasional</label>
      </span>
    {/if}

    <button class="edit" class:on={$printEditMode} onclick={togglePrintEdit}>
      {$printEditMode ? 'Done editing' : 'Edit print layout'}
    </button>

    <span class="spacer"></span>
    <button onclick={downloadFillablePdf} title="Download an editable AcroForm PDF">Fillable PDF</button>
    <button class="print" onclick={printNow}>Print / Save PDF</button>
  </div>

  {#if $printEditMode}
    <div class="edit-row">
      <span class="hint">Customize the print sheet independently of your screen layout.</span>
      <span class="spacer"></span>
      <select value={addType} onchange={onAddBlock} title="Add a block">
        <option value="">+ Add block…</option>
        {#each blockTypes as [type, meta]}
          <option value={type}>{meta.label}</option>
        {/each}
      </select>
      <button onclick={() => adoptLayout(get(screenLayout))}>Copy screen layout</button>
      <button onclick={resetPrintLayout}>Reset</button>
    </div>
  {/if}

  <div class="print-scroll">
    <div class="print-pages {$printClasses}">
      <header class="sheet-head">
        <h1>{$character.name}</h1>
        <p>{subtitle}</p>
      </header>
      <LayoutRenderer />
    </div>
  </div>
</div>

<style>
  .print-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: #6b6864;
    display: flex;
    flex-direction: column;
  }
  .print-toolbar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 1rem;
    background: var(--bg);
    border-bottom: 1px solid var(--line);
    flex-wrap: wrap;
  }
  .print-toolbar label { font-size: 0.8rem; color: var(--muted); display: inline-flex; gap: 0.35rem; align-items: center; }
  .print-toolbar .custom { display: inline-flex; gap: 0.75rem; }
  .edit-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--field-hover);
    border-bottom: 1px solid var(--line);
    flex-wrap: wrap;
  }
  .edit-row .hint { font-size: 0.8rem; color: var(--muted); }
  .edit-row select, .edit-row button {
    font: inherit; font-size: 0.85rem;
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--line);
    background: var(--bg); color: var(--fg);
    border-radius: 6px; cursor: pointer;
  }
  .edit { border-color: var(--line); }
  .edit.on { border-color: var(--accent) !important; color: var(--accent); }
  .spacer { flex: 1; }
  .print-toolbar select, .print-toolbar button {
    font: inherit; font-size: 0.85rem;
    padding: 0.35rem 0.7rem;
    border: 1px solid var(--line);
    background: var(--bg); color: var(--fg);
    border-radius: 6px; cursor: pointer;
  }
  .print {
    border-color: var(--accent) !important;
    background: var(--accent) !important;
    color: #fff !important;
  }
  .print-scroll { flex: 1; overflow: auto; padding: 1.5rem; display: flex; justify-content: center; }
  .print-pages {
    background: #fff;
    color: #111;
    padding: 12mm;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
    align-self: flex-start;
  }
  .print-pages.page-letter { width: 8.5in; }
  .print-pages.page-a4 { width: 210mm; }
  .sheet-head { border-bottom: 2px solid #111; margin-bottom: 1rem; padding-bottom: 0.5rem; }
  .sheet-head h1 { margin: 0; font-size: 1.6rem; }
  .sheet-head p { margin: 0.1rem 0 0; color: #555; }
</style>
