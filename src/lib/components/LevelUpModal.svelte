<script lang="ts">
  import { character, levelUp } from '../stores/character.js';
  import { catalogState } from '../stores/catalog.js';
  import {
    conModifier,
    hpGainAverage,
    hpGainRoll,
    totalHpGain,
    totalLevel,
    type LevelUpPlan
  } from '../character/index.js';

  let { onClose }: { onClose: () => void } = $props();

  // Target: advance an existing class, or multiclass into a new one.
  let target = $state<string>('0'); // class index, or 'new'
  let newClassKey = $state(''); // `name|source` of a catalog class
  let method = $state<'average' | 'roll'>('average');
  let rolled = $state<number | null>(null);

  // Classes from the catalog you aren't already in (for the multiclass picker).
  const catalogClasses = $derived(
    ($catalogState.catalog?.entries.class ?? [])
      .filter((c) => !$character.classes.some((cl) => cl.name === c.name && String(c.source) === cl.source))
      .map((c) => ({ name: c.name, source: String(c.source), die: (c.hd as { faces?: number } | undefined)?.faces ?? 8 }))
      .sort((a, b) => a.name.localeCompare(b.name))
  );
  const picked = $derived(catalogClasses.find((c) => `${c.name}|${c.source}` === newClassKey));

  const isNew = $derived(target === 'new');
  const die = $derived(
    isNew ? (picked?.die ?? 8) : ($character.classes[Number(target)]?.hitDie ?? 8)
  );
  const conMod = $derived(conModifier($character));
  const base = $derived(method === 'roll' ? (rolled ?? hpGainAverage(die)) : hpGainAverage(die));
  const hpGain = $derived(totalHpGain(base, conMod));

  const newLevel = $derived(totalLevel($character) + 1);
  const profBefore = $derived(2 + Math.floor((totalLevel($character) - 1) / 4));
  const profAfter = $derived(2 + Math.floor((newLevel - 1) / 4));
  const isAsiLevel = $derived([4, 8, 12, 16, 19].includes(newLevel));

  function roll() {
    rolled = hpGainRoll(die);
    method = 'roll';
  }

  const canConfirm = $derived(!isNew || !!picked);

  function confirm() {
    if (!canConfirm) return;
    const plan: LevelUpPlan = isNew
      ? { newClass: { name: picked!.name, source: picked!.source }, die, hpGain }
      : { classIndex: Number(target), die, hpGain };
    levelUp(plan);
    onClose();
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

<div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && onClose()}>
  <div class="modal" role="dialog" aria-modal="true" tabindex="-1">
    <header><h2>Level Up → {newLevel}</h2><button class="x" aria-label="Close" onclick={onClose}>×</button></header>

    <label class="row">
      <span>Class</span>
      <select bind:value={target}>
        {#each $character.classes as cls, i}
          <option value={String(i)}>{cls.name} {cls.level} → {cls.level + 1}</option>
        {/each}
        <option value="new">New class (multiclass)…</option>
      </select>
    </label>

    {#if isNew}
      <div class="newclass">
        <select bind:value={newClassKey}>
          <option value="">Choose a class…</option>
          {#each catalogClasses as c}
            <option value={`${c.name}|${c.source}`}>{c.name} ({c.source}) · d{c.die}</option>
          {/each}
        </select>
        {#if catalogClasses.length === 0}<span class="muted">Load game data to multiclass.</span>{/if}
      </div>
    {/if}

    <div class="hp">
      <span class="lbl">HP gain</span>
      <label><input type="radio" bind:group={method} value="average" /> Average ({hpGainAverage(die)})</label>
      <label><input type="radio" bind:group={method} value="roll" /> Roll</label>
      <button class="rollbtn" onclick={roll}>Roll d{die}{rolled !== null ? `: ${rolled}` : ''}</button>
    </div>

    <p class="result">
      +{hpGain} HP <span class="muted">(d{die} {base} {conMod >= 0 ? '+' : ''}{conMod} CON, min 1)</span>
    </p>

    {#if profAfter !== profBefore}
      <p class="note">Proficiency bonus rises to +{profAfter}.</p>
    {/if}
    {#if isAsiLevel}
      <p class="note">Level {newLevel} grants an Ability Score Improvement / feat — apply it in Ability Scores.</p>
    {/if}
    <p class="note muted">New class features &amp; spell slots aren't applied automatically — add them via quick import / the slots block.</p>

    <div class="actions">
      <button class="cancel" onclick={onClose}>Cancel</button>
      <button class="confirm" onclick={confirm} disabled={!canConfirm}>Level up (+{hpGain} HP)</button>
    </div>
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 60; }
  .modal { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; max-width: 440px; width: 100%; padding: 1rem 1.25rem 1.25rem; box-shadow: 0 12px 40px rgba(0,0,0,0.35); }
  header { display: flex; align-items: baseline; justify-content: space-between; }
  h2 { margin: 0; font-size: 1.2rem; color: var(--accent); }
  .x { background: none; border: none; font-size: 1.5rem; color: var(--muted); cursor: pointer; line-height: 1; }
  .row { display: flex; align-items: center; gap: 0.6rem; margin: 0.75rem 0; }
  .row span { font-size: 0.8rem; color: var(--muted); min-width: 3rem; }
  .newclass { display: flex; gap: 0.4rem; margin-bottom: 0.5rem; flex-wrap: wrap; align-items: center; }
  .newclass select { flex: 1; }
  .newclass .muted { color: var(--muted); font-size: 0.8rem; }
  .confirm:disabled { opacity: 0.5; cursor: not-allowed; }
  .hp { display: flex; align-items: center; gap: 0.75rem; margin: 0.5rem 0; flex-wrap: wrap; font-size: 0.9rem; }
  .hp .lbl { font-size: 0.7rem; text-transform: uppercase; color: var(--muted); }
  .rollbtn { font: inherit; font-size: 0.8rem; padding: 0.2rem 0.6rem; border: 1px solid var(--line); background: var(--bg); color: var(--fg); border-radius: 5px; cursor: pointer; }
  .result { font-size: 1.1rem; font-weight: 700; margin: 0.5rem 0; }
  .muted { color: var(--muted); font-weight: 400; font-size: 0.8rem; }
  .note { font-size: 0.82rem; color: var(--accent); margin: 0.25rem 0; }
  .note.muted { color: var(--muted); }
  select, input { padding: 0.3rem 0.4rem; border: 1px solid var(--line); border-radius: 5px; background: var(--bg); color: var(--fg); font: inherit; }
  .actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
  .actions button { padding: 0.4rem 0.9rem; border-radius: 6px; cursor: pointer; font: inherit; border: 1px solid var(--line); background: var(--bg); color: var(--fg); }
  .confirm { border-color: var(--accent) !important; background: var(--accent) !important; color: #fff !important; font-weight: 600; }
</style>
