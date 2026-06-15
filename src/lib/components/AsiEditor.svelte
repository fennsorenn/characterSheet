<script lang="ts">
  import { setAbilityChoice } from '../stores/character.js';
  import { ABILITIES, ABILITY_NAMES, type Ability } from '../character/index.js';

  // Inline editor for an Ability Score Improvement: +2 to one ability, or +1 to
  // two. Fully derived from the stored value; writes ability deltas on change.
  interface Props {
    choiceKey: string;
    value: Partial<Record<Ability, number>>;
  }
  let { choiceKey, value }: Props = $props();

  const entries = $derived(Object.entries(value) as [Ability, number][]);
  const mode = $derived<'one' | 'two'>(
    entries.length === 1 && entries[0][1] === 2 ? 'one' : entries.length ? 'two' : 'one'
  );
  const aVal = $derived<Ability | ''>(entries[0]?.[0] ?? '');
  const bVal = $derived<Ability | ''>(mode === 'two' ? (entries[1]?.[0] ?? '') : '');

  function commit(m: 'one' | 'two', a: Ability | '', b: Ability | '') {
    const inc: Partial<Record<Ability, number>> = {};
    if (m === 'one') {
      if (a) inc[a] = 2;
    } else {
      if (a) inc[a] = (inc[a] ?? 0) + 1;
      if (b) inc[b] = (inc[b] ?? 0) + 1;
    }
    setAbilityChoice(choiceKey, inc);
  }
</script>

<div class="asi">
  <select value={mode} onchange={(e) => commit((e.target as HTMLSelectElement).value as 'one' | 'two', aVal, bVal)}>
    <option value="one">+2 to one</option>
    <option value="two">+1 to two</option>
  </select>
  <select value={aVal} onchange={(e) => commit(mode, (e.target as HTMLSelectElement).value as Ability | '', bVal)}>
    <option value="">—</option>
    {#each ABILITIES as ab}<option value={ab}>{ABILITY_NAMES[ab].slice(0, 3)}</option>{/each}
  </select>
  {#if mode === 'two'}
    <select value={bVal} onchange={(e) => commit(mode, aVal, (e.target as HTMLSelectElement).value as Ability | '')}>
      <option value="">—</option>
      {#each ABILITIES as ab}<option value={ab}>{ABILITY_NAMES[ab].slice(0, 3)}</option>{/each}
    </select>
  {/if}
</div>

<style>
  .asi { display: inline-flex; gap: 0.3rem; align-items: center; }
  select { font: inherit; font-size: 0.74rem; padding: 0.1rem 0.3rem; border: 1px solid var(--line); border-radius: 5px; background: var(--bg); color: var(--fg); }
</style>
