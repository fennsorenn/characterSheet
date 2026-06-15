<script lang="ts">
  import { character, setAbilityChoice, setGrantChoice } from '../stores/character.js';
  import { universeMembers, memberLabel, type GrantChoice, type Ability } from '../character/index.js';

  // Inline picker for a grant `choose`/`any` block: pick `count` distinct
  // members. Ability choices write score deltas; set choices write members.
  // Fully derived from the stored value.
  let { choice }: { choice: GrantChoice } = $props();

  const isAbility = $derived(choice.category === 'ability');
  const options = $derived(choice.from.length ? choice.from : universeMembers(choice.universe ?? 'open'));
  const freeText = $derived(options.length === 0); // open universe, no preset list

  const picks = $derived.by((): string[] => {
    if (isAbility) {
      return Object.entries($character.abilityChoices[choice.key] ?? {})
        .filter(([, v]) => v)
        .map(([a]) => a);
    }
    return ($character.grantChoices[choice.key] ?? []).filter(Boolean);
  });
  const slots = $derived(Array.from({ length: choice.count }, (_, j): string => picks[j] ?? ''));

  function commit(next: string[]) {
    const members = [...new Set(next.filter(Boolean))];
    if (isAbility) {
      const inc: Partial<Record<Ability, number>> = {};
      for (const m of members) inc[m as Ability] = choice.amount;
      setAbilityChoice(choice.key, inc);
    } else {
      setGrantChoice(choice.key, members);
    }
  }
  function setSlot(j: number, v: string) {
    const next = [...slots];
    next[j] = v;
    commit(next);
  }
</script>

<span class="gc" title={choice.label}>
  {#each slots as sel, j}
    {#if freeText}
      <input
        class="txt"
        value={sel}
        placeholder={choice.label}
        onchange={(e) => setSlot(j, (e.target as HTMLInputElement).value.trim())}
      />
    {:else}
      <select value={sel} onchange={(e) => setSlot(j, (e.target as HTMLSelectElement).value)}>
        <option value="">{isAbility ? `+${choice.amount}…` : 'choose…'}</option>
        {#each options as m}
          <option value={m} disabled={m !== sel && slots.includes(m)}>
            {memberLabel(choice.category, m).slice(0, isAbility || choice.category === 'saveProf' ? 3 : 99)}
          </option>
        {/each}
      </select>
    {/if}
  {/each}
</span>

<style>
  .gc { display: inline-flex; gap: 0.3rem; align-items: center; flex-wrap: wrap; }
  select, .txt { font: inherit; font-size: 0.74rem; padding: 0.1rem 0.3rem; border: 1px solid var(--line); border-radius: 5px; background: var(--bg); color: var(--fg); }
  .txt { width: 9rem; }
</style>
