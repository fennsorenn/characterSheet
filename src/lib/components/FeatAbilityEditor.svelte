<script lang="ts">
  import { setAbilityChoice } from '../stores/character.js';
  import { ABILITY_NAMES, type Ability, type FeatAbilityChoice } from '../character/index.js';

  // Inline editor for a half-feat's `choose` ability bonus: pick `count`
  // distinct abilities from `from`, each gaining `amount`. Fully derived from
  // the stored value; writes ability deltas on change.
  interface Props {
    choice: FeatAbilityChoice;
    value: Partial<Record<Ability, number>>;
  }
  let { choice, value }: Props = $props();

  const picks = $derived(
    (Object.entries(value) as [Ability, number][]).filter(([, v]) => v).map(([a]) => a)
  );
  const slots = $derived(
    Array.from({ length: choice.count }, (_, j): Ability | '' => picks[j] ?? '')
  );

  function commit(next: (Ability | '')[]) {
    const inc: Partial<Record<Ability, number>> = {};
    for (const a of next) if (a) inc[a] = choice.amount;
    setAbilityChoice(choice.key, inc);
  }
  function setSlot(j: number, a: Ability | '') {
    const next = [...slots];
    next[j] = a;
    commit(next);
  }
</script>

<span class="fae" title={choice.label}>
  {#each slots as sel, j}
    <select
      value={sel}
      onchange={(e) => setSlot(j, (e.target as HTMLSelectElement).value as Ability | '')}
    >
      <option value="">+{choice.amount}…</option>
      {#each choice.from as ab}
        <option value={ab} disabled={ab !== sel && slots.includes(ab)}>{ABILITY_NAMES[ab].slice(0, 3)}</option>
      {/each}
    </select>
  {/each}
</span>

<style>
  .fae { display: inline-flex; gap: 0.3rem; align-items: center; }
  select { font: inherit; font-size: 0.74rem; padding: 0.1rem 0.3rem; border: 1px solid var(--line); border-radius: 5px; background: var(--bg); color: var(--fg); }
</style>
