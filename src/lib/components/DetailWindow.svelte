<script lang="ts">
  import { detail, closeDetail, openDetail } from '../stores/detail.js';
  import { catalogLookup } from '../stores/catalog.js';
  import { detailContent, detailDocument } from '../render/detail.js';

  const WIDTH = 360;
  const content = $derived($detail ? detailContent($detail.kind, $detail.entry) : null);

  let pos = $state<{ x: number; y: number }>({ x: 0, y: 0 });
  let wasOpen = false;

  // Reposition only on a fresh open (closed → open), beside the anchor so the
  // list that opened it isn't covered; keep position when the content changes.
  $effect(() => {
    const d = $detail;
    if (d && !wasOpen) pos = place(d.anchor);
    wasOpen = !!d;
  });

  function place(anchor: { x: number; y: number; width: number; height: number } | null) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const h = Math.min(vh * 0.7, 520);
    if (!anchor) return { x: vw - WIDTH - 24, y: vh - h - 24 }; // bottom-right default
    const right = anchor.x + anchor.width;
    let x: number;
    if (vw - right >= WIDTH + 24) x = right + 12; // room on the right of the list
    else if (anchor.x >= WIDTH + 24) x = anchor.x - WIDTH - 12; // else to its left
    else x = vw - WIDTH - 12; // else pin to the right edge
    const y = Math.min(Math.max(anchor.y, 8), Math.max(8, vh - h - 8));
    return { x: Math.max(8, x), y };
  }

  // --- drag ---
  let drag: { dx: number; dy: number } | null = null;
  function down(e: PointerEvent) {
    // Don't start a drag when pressing the header's buttons (close / pop-out).
    if ((e.target as HTMLElement).closest('button')) return;
    drag = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!drag) return;
    pos = {
      x: Math.min(Math.max(0, e.clientX - drag.dx), window.innerWidth - 60),
      y: Math.min(Math.max(0, e.clientY - drag.dy), window.innerHeight - 32)
    };
  }
  function up(e: PointerEvent) {
    drag = null;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
  }

  function popOut() {
    if (!content) return;
    const w = window.open('', '_blank', `width=460,height=640`);
    if (w) {
      w.document.write(detailDocument(content));
      w.document.close();
      closeDetail();
    }
  }

  // Clicking a {@spell …}/{@item …} reference inside the body opens that entry.
  function onBodyClick(e: MouseEvent) {
    const a = (e.target as HTMLElement).closest('a.tag-ref') as HTMLElement | null;
    if (!a) return;
    const name = a.dataset.name;
    const source = a.dataset.source || undefined;
    const tag = a.dataset.tag || '';
    if (!name) return;
    e.preventDefault();
    const spell = $catalogLookup.getSpellByName(name);
    const item = $catalogLookup.getItem(name, source ?? (spell ? String(spell.source) : ''));
    if (/spell/.test(tag) && spell) openDetail('spell', spell, a);
    else if (/item/.test(tag) && item) openDetail('item', item, a);
    else if (spell) openDetail('spell', spell, a);
    else if (item) openDetail('item', item, a);
  }
</script>

{#if content}
  <div class="win" style="left:{pos.x}px; top:{pos.y}px; width:{WIDTH}px;" role="dialog" aria-label={content.title}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <header class="bar" onpointerdown={down} onpointermove={move} onpointerup={up}>
      <span class="title">{content.title}</span>
      <button class="ic" title="Open in a new window" aria-label="Pop out" onclick={popOut}>⧉</button>
      <button class="ic" title="Close" aria-label="Close" onclick={closeDetail}>×</button>
    </header>
    <div class="body">
      <p class="sub">{content.subtitle}</p>
      {#if content.meta.length}
        <div class="meta">
          {#each content.meta as m}<p><span class="k">{m.label}</span> {m.value}</p>{/each}
        </div>
      {/if}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="desc" onclick={onBodyClick}>{@html content.html}</div>
      <p class="src">{content.source}</p>
    </div>
  </div>
{/if}

<style>
  .win {
    position: fixed;
    z-index: 95;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 10px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
    display: flex;
    flex-direction: column;
    max-height: 70vh;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.4rem 0.5rem 0.4rem 0.75rem;
    border-bottom: 1px solid var(--line);
    cursor: grab;
    touch-action: none;
  }
  .bar:active { cursor: grabbing; }
  .title { flex: 1; font-weight: 700; font-size: 0.95rem; color: var(--accent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ic { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 1.1rem; line-height: 1; padding: 0 0.2rem; }
  .ic:hover { color: var(--accent); }
  .body { overflow: auto; padding: 0.6rem 0.85rem 0.85rem; font-size: 0.85rem; }
  .sub { font-style: italic; color: var(--muted); margin: 0 0 0.5rem; }
  .meta { border-left: 2px solid var(--line); padding-left: 0.5rem; margin-bottom: 0.5rem; }
  .meta p { margin: 0.1rem 0; }
  .meta .k { font-size: 0.7rem; text-transform: uppercase; color: var(--muted); margin-right: 0.25rem; }
  .desc :global(p) { margin: 0.35rem 0; }
  .desc :global(.detail-h) { margin: 0.5rem 0 0.1rem; }
  .desc :global(table) { border-collapse: collapse; font-size: 0.8rem; margin: 0.4rem 0; }
  .desc :global(th), .desc :global(td) { border: 1px solid var(--line); padding: 0.15rem 0.4rem; text-align: left; }
  .desc :global(a.tag-ref) { color: var(--accent); cursor: pointer; text-decoration: underline dotted; }
  .src { font-size: 0.7rem; color: var(--muted); text-align: right; margin: 0.5rem 0 0; }
</style>
