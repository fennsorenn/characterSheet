<script lang="ts">
  import { detail, closeDetail, openDetail, setDetailSpellLevel, pinCreature } from '../stores/detail.js';
  import { catalogLookup, catalogState } from '../stores/catalog.js';
  import { casterSummonParams } from '../stores/character.js';
  import { rollExpr } from '../stores/dice.js';
  import { detailContent, detailDocument } from '../render/detail.js';
  import { buildStatblock, type StatblockParams } from '../render/statblock.js';
  import Statblock from './Statblock.svelte';
  import UiIcon from './UiIcon.svelte';

  const isCreature = $derived($detail?.kind === 'creature');
  const WIDTH = $derived(isCreature ? 420 : 360);

  // Spell/item content (unchanged); creature content is a resolved statblock.
  const content = $derived(
    $detail && !isCreature ? detailContent($detail.kind as 'spell' | 'item', $detail.entry) : null
  );
  const params = $derived<StatblockParams>({ ...$casterSummonParams, spellLevel: $detail?.spellLevel });
  const sb = $derived($detail && isCreature ? buildStatblock($detail.entry, params) : null);
  const title = $derived(isCreature ? sb?.name ?? '' : content?.title ?? '');
  // Effective summon level (chosen or the creature's minimum), for the control + pin.
  const level = $derived($detail?.spellLevel ?? sb?.summonMin);

  let pos = $state<{ x: number; y: number }>({ x: 0, y: 0 });
  let wasOpen = false;
  // A note shown in-window when a reference can't be resolved (e.g. no bestiary).
  let notice = $state('');

  $effect(() => {
    const d = $detail;
    if (d && !wasOpen) { pos = place(d.anchor); notice = ''; }
    wasOpen = !!d;
  });

  function place(anchor: { x: number; y: number; width: number; height: number } | null) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const h = Math.min(vh * 0.7, 520);
    if (!anchor) return { x: vw - WIDTH - 24, y: vh - h - 24 };
    const right = anchor.x + anchor.width;
    let x: number;
    if (vw - right >= WIDTH + 24) x = right + 12;
    else if (anchor.x >= WIDTH + 24) x = anchor.x - WIDTH - 12;
    else x = vw - WIDTH - 12;
    const y = Math.min(Math.max(anchor.y, 8), Math.max(8, vh - h - 8));
    return { x: Math.max(8, x), y };
  }

  // --- drag ---
  let drag: { dx: number; dy: number } | null = null;
  function down(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('button, input, select')) return;
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

  function pin() {
    if (!$detail || !sb) return;
    pinCreature($detail.entry, { ...params, spellLevel: level }, sb.hpValue ?? 0);
    closeDetail();
  }

  // Clicking a {@spell}/{@item}/{@creature} reference opens that entry; clicking a
  // {@damage}/{@dice} roll sends it to the dice roller.
  function onBodyClick(e: MouseEvent) {
    const roll = (e.target as HTMLElement).closest('.tag-roll') as HTMLElement | null;
    if (roll?.dataset.roll) {
      e.preventDefault();
      rollExpr(roll.dataset.roll);
      return;
    }
    const a = (e.target as HTMLElement).closest('a.tag-ref') as HTMLElement | null;
    if (!a) return;
    const name = a.dataset.name;
    const source = a.dataset.source || undefined;
    const tag = a.dataset.tag || '';
    if (!name) return;
    e.preventDefault();
    notice = '';
    const creature = $catalogLookup.getCreature(name, source ?? '') ?? $catalogLookup.getCreatureByName(name);
    const spell = $catalogLookup.getSpellByName(name);
    const item = $catalogLookup.getItem(name, source ?? (spell ? String(spell.source) : ''));
    if (/creature/.test(tag) && creature) openDetail('creature', creature, a);
    else if (/spell/.test(tag) && spell) openDetail('spell', spell, a);
    else if (/item/.test(tag) && item) openDetail('item', item, a);
    else if (creature) openDetail('creature', creature, a);
    else if (spell) openDetail('spell', spell, a);
    else if (item) openDetail('item', item, a);
    else if (/creature/.test(tag)) {
      // No match — most often the bestiary just isn't loaded in this dataset.
      notice = ($catalogState.catalog?.counts.monster ?? 0) === 0
        ? `Creature data isn't loaded — re-import your 5etools data (with the bestiary) to view “${name}”.`
        : `Couldn't find “${name}” in the loaded data.`;
    }
  }
</script>

{#if $detail}
  <div class="win" style="left:{pos.x}px; top:{pos.y}px; width:{WIDTH}px;" role="dialog" aria-label={title}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <header class="bar" onpointerdown={down} onpointermove={move} onpointerup={up}>
      <span class="title">{title}</span>
      {#if isCreature}
        <button class="ic" title="Pin to the tracker dock" aria-label="Pin" onclick={pin}><UiIcon name="pin" size="0.95em" /></button>
      {:else}
        <button class="ic" title="Open in a new window" aria-label="Pop out" onclick={popOut}>⧉</button>
      {/if}
      <button class="ic" title="Close" aria-label="Close" onclick={closeDetail}>×</button>
    </header>

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="body" onclick={onBodyClick}>
      {#if notice}<p class="notice">{notice}</p>{/if}
      {#if isCreature && sb}
        <p class="sub">{sb.meta}</p>
        {#if sb.summonMin != null}
          <label class="lvl">
            Summon level
            <input
              type="number"
              min={sb.summonMin}
              max="9"
              value={level}
              onchange={(e) => setDetailSpellLevel(Number((e.target as HTMLInputElement).value) || sb.summonMin!)}
            />
          </label>
        {/if}
        <Statblock {sb} />
        <p class="src">{sb.source}</p>
      {:else if content}
        <p class="sub">{content.subtitle}</p>
        {#if content.meta.length}
          <div class="meta">
            {#each content.meta as m}<p><span class="k">{m.label}</span> {m.value}</p>{/each}
          </div>
        {/if}
        <div class="desc">{@html content.html}</div>
        <p class="src">{content.source}</p>
      {/if}
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
    max-width: calc(100vw - 16px);
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
  .notice { margin: 0 0 0.6rem; padding: 0.4rem 0.5rem; border: 1px solid var(--accent); border-radius: 6px; background: var(--field-hover); color: var(--accent); font-size: 0.8rem; }
  .lvl { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: var(--muted); margin-bottom: 0.5rem; }
  .lvl input { width: 3.5rem; font: inherit; padding: 0.1rem 0.3rem; border: 1px solid var(--line); border-radius: 4px; background: var(--bg); color: var(--fg); }
  .meta { border-left: 2px solid var(--line); padding-left: 0.5rem; margin-bottom: 0.5rem; }
  .meta p { margin: 0.1rem 0; }
  .meta .k { font-size: 0.7rem; text-transform: uppercase; color: var(--muted); margin-right: 0.25rem; }
  .desc :global(p) { margin: 0.35rem 0; }
  .desc :global(.detail-h) { margin: 0.5rem 0 0.1rem; }
  .desc :global(table) { border-collapse: collapse; font-size: 0.8rem; margin: 0.4rem 0; }
  .desc :global(th), .desc :global(td) { border: 1px solid var(--line); padding: 0.15rem 0.4rem; text-align: left; }
  .desc :global(a.tag-ref) { color: var(--accent); cursor: pointer; text-decoration: underline dotted; }
  .desc :global(.tag-roll) { color: var(--accent); cursor: pointer; text-decoration: underline dotted; }
  .src { font-size: 0.7rem; color: var(--muted); text-align: right; margin: 0.5rem 0 0; }
</style>
