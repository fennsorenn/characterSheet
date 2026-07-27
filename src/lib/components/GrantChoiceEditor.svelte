<script lang="ts">
  import { canEditBuild } from '../stores/mode.js';
  import { character, setAbilityChoice, setGrantChoice, setFeatureOption } from '../stores/character.js';
  import { universeMembers, memberLabel, type GrantChoice, type Ability } from '../character/index.js';

  // Inline picker for a grant `choose`/`any` block: pick `count` distinct
  // members. Ability choices write score deltas; set choices write members.
  // Fully derived from the stored value.
  let { choice }: { choice: GrantChoice } = $props();

  const isAbility = $derived(choice.category === 'ability');
  const options = $derived(choice.from.length ? choice.from : universeMembers(choice.universe ?? 'open'));
  const freeText = $derived(options.length === 0); // open universe, no preset list

  /** What slot j is worth — an uneven spread pays each slot differently. */
  const amountAt = (j: number) => choice.weights?.[j] ?? choice.amount;

  const picks = $derived.by((): string[] => {
    if (isAbility) {
      const stored = Object.entries($character.abilityChoices[choice.key] ?? {}).filter(([, v]) => v);
      // With weights, a slot is identified by what it pays, not by its position
      // in the stored object: +2 belongs in the +2 slot however it was written.
      if (choice.weights) {
        const left = [...stored];
        return choice.weights.map((w) => {
          const i = left.findIndex(([, v]) => v === w);
          return i === -1 ? '' : left.splice(i, 1)[0][0];
        });
      }
      return stored.map(([a]) => a);
    }
    return ($character.grantChoices[choice.key] ?? []).filter(Boolean);
  });
  const slots = $derived(Array.from({ length: choice.count }, (_, j): string => picks[j] ?? ''));

  function commit(next: string[]) {
    if (isAbility) {
      const inc: Partial<Record<Ability, number>> = {};
      next.forEach((m, j) => {
        if (m && !(m in inc)) inc[m as Ability] = amountAt(j);
      });
      setAbilityChoice(choice.key, inc);
    } else {
      setGrantChoice(choice.key, [...new Set(next.filter(Boolean))]);
    }
  }
  function setSlot(j: number, v: string) {
    const next = [...slots];
    next[j] = v;
    commit(next);
  }
</script>

<span class="gc" title={choice.label}>
  <!-- Alternative spreads (+2/+1 or +1/+1/+1): which one is in force comes
       first, since it decides how many slots there even are. -->
  {#if choice.group && (choice.groupOptions?.length ?? 0) > 1}
    <select
      class="alt"
      aria-label="Ability spread"
      disabled={!$canEditBuild}
      value={String(choice.groupIndex ?? 0)}
      onchange={(e) => setFeatureOption(choice.group!, (e.target as HTMLSelectElement).value)}
    >
      {#each choice.groupOptions ?? [] as opt, i}
        <option value={String(i)}>{opt}</option>
      {/each}
    </select>
  {/if}
  {#each slots as sel, j}
    {#if freeText}
      <input
        disabled={!$canEditBuild}
        class="txt"
        value={sel}
        placeholder={choice.label}
        onchange={(e) => setSlot(j, (e.target as HTMLInputElement).value.trim())}
      />
    {:else}
      <select value={sel} disabled={!$canEditBuild} onchange={(e) => setSlot(j, (e.target as HTMLSelectElement).value)}>
        <option value="">{isAbility ? `+${amountAt(j)}…` : 'choose…'}</option>
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
  .alt { font-weight: 600; }
  select, .txt { font: inherit; font-size: 0.74rem; padding: 0.1rem 0.3rem; border: 1px solid var(--line); border-radius: 5px; background: var(--bg); color: var(--fg); }
  .txt { width: 9rem; }
</style>
