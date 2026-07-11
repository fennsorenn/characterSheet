<script lang="ts">
  import { ABILITIES, ABILITY_NAMES, type Buff } from '../character/index.js';
  import { character, addBuff, removeBuff, toggleBuff } from '../stores/character.js';

  let { variant = 'full' }: { variant?: string } = $props();

  // Flat numeric presets (dice/advantage buffs can't map to numeric nodes).
  const PRESETS: Omit<Buff, 'id' | 'active'>[] = [
    { name: 'Shield of Faith', concentration: true, modifiers: [{ target: 'ac', value: 2 }] },
    { name: 'Shield (spell)', modifiers: [{ target: 'ac', value: 5 }] },
    { name: 'Haste', concentration: true, modifiers: [{ target: 'ac', value: 2 }] },
    { name: 'Half Cover', modifiers: [{ target: 'ac', value: 2 }] },
    { name: 'Three-Quarters Cover', modifiers: [{ target: 'ac', value: 5 }] }
  ];

  const TARGETS = [
    { id: 'ac', label: 'AC' },
    { id: 'initiative', label: 'Initiative' },
    { id: 'spell.dc', label: 'Spell Save DC' },
    { id: 'spell.attack', label: 'Spell Attack' },
    ...ABILITIES.map((a) => ({ id: `save.${a}`, label: `${ABILITY_NAMES[a]} Save` }))
  ];
  const targetLabel = (id: string) => TARGETS.find((t) => t.id === id)?.label ?? id;

  const concentratingOn = $derived(
    $character.buffs.find((b) => b.active && b.concentration)?.name
  );

  function summary(buff: Buff): string {
    return buff.modifiers
      .map((m) => `${targetLabel(m.target)} ${m.value >= 0 ? '+' : ''}${m.value}`)
      .join(', ');
  }

  function addPreset(e: Event) {
    const i = (e.target as HTMLSelectElement).value;
    if (i === '') return;
    addBuff({ ...PRESETS[Number(i)], active: false });
    (e.target as HTMLSelectElement).value = '';
  }

  // Custom-buff form.
  let showCustom = $state(false);
  let cName = $state('');
  let cTarget = $state('ac');
  let cValue = $state(1);
  let cConc = $state(false);

  function addCustom() {
    if (!cName.trim()) return;
    addBuff({
      name: cName.trim(),
      active: false,
      concentration: cConc,
      modifiers: [{ target: cTarget, value: cValue }]
    });
    cName = '';
    cValue = 1;
    cConc = false;
    showCustom = false;
  }
</script>

<section class="block" data-variant={variant}>
  <h3>Effects</h3>

  {#if concentratingOn}
    <p class="conc">Concentrating on <strong>{concentratingOn}</strong></p>
  {/if}

  {#if $character.buffs.length === 0}
    <p class="empty">Toggleable bonuses (Shield of Faith, cover, custom). Active ones feed the calc graph.</p>
  {:else}
    <ul>
      {#each $character.buffs as buff (buff.id)}
        <li class:active={buff.active}>
          <label class="tog">
            <input type="checkbox" checked={buff.active} onchange={() => toggleBuff(buff.id)} />
            <span class="name">{buff.name}</span>
          </label>
          <span class="sum">{summary(buff)}</span>
          {#if buff.concentration}<span class="ctag" title="Concentration">C</span>{/if}
          <button class="rm" aria-label="Remove" onclick={() => removeBuff(buff.id)}>×</button>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="addrow">
    <select onchange={addPreset} aria-label="Add preset effect">
      <option value="">+ Add preset…</option>
      {#each PRESETS as preset, i}
        <option value={i}>{preset.name}</option>
      {/each}
    </select>
    <button class="custom" onclick={() => (showCustom = !showCustom)}>Custom</button>
  </div>

  {#if showCustom}
    <form class="customform" onsubmit={(e) => { e.preventDefault(); addCustom(); }}>
      <input placeholder="Effect name" bind:value={cName} />
      <select bind:value={cTarget}>
        {#each TARGETS as t}<option value={t.id}>{t.label}</option>{/each}
      </select>
      <input class="val" type="number" bind:value={cValue} />
      <label class="cc"><input type="checkbox" bind:checked={cConc} /> Conc.</label>
      <button type="submit">Add</button>
    </form>
  {/if}
</section>

<style>
  .block { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 1rem; }
  h3 { margin: 0 0 0.6rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .conc { margin: 0 0 0.5rem; font-size: 0.8rem; color: var(--accent); }
  .empty { color: var(--muted); font-size: 0.85rem; margin: 0; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; align-items: center; gap: 0.5rem; padding: 0.28rem 0; border-bottom: 1px solid var(--line); opacity: 0.6; }
  li.active { opacity: 1; }
  .tog { display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; flex: 1; min-width: 0; cursor: pointer; }
  .name { font-weight: 600; overflow-wrap: anywhere; }
  .sum { font-size: 0.78rem; color: var(--muted); }
  .ctag { font-size: 0.65rem; font-weight: 700; color: #fff; background: var(--accent); border-radius: 3px; padding: 0 0.25rem; }
  .rm { background: none; border: none; color: var(--muted); font-size: 1.1rem; cursor: pointer; line-height: 1; }
  .rm:hover { color: var(--accent); }
  .addrow { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.6rem; }
  .addrow select { flex: 1; min-width: 0; }
  .customform { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem; align-items: center; }
  .customform .val { width: 4ch; flex: none; }
  .customform input:not([type='checkbox']) { flex: 1; min-width: 6rem; }
  select, input, button {
    padding: 0.3rem 0.4rem;
    border: 1px solid var(--line);
    border-radius: 5px;
    background: var(--bg);
    color: var(--fg);
    font: inherit;
  }
  .addrow button, .customform button[type='submit'] { cursor: pointer; }
  .customform button[type='submit'] { border-color: var(--accent); background: var(--accent); color: #fff; }
  .cc { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.8rem; border: none; padding: 0; }
</style>
