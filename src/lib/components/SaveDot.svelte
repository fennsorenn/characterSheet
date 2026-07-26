<script lang="ts">
  import { canEditBuild } from '../stores/mode.js';
  import { ABILITY_NAMES, setMembers, type Ability } from '../character/index.js';
  import { character, grantPool, toggleSaveProficiency } from '../stores/character.js';

  /**
   * The proficiency dot for one saving throw. Shared, because the saves appear
   * in two places — their own block and folded into the ability boxes — and the
   * difference between "you ticked this" and "a feature granted it" should not
   * be re-derived in each.
   */

  let { abil }: { abil: Ability } = $props();

  const proficient = $derived($character.saveProficiencies.includes(abil));
  const grantedBy = $derived(
    new Map(setMembers($grantPool, 'saveProf').map((m) => [m.member.toLowerCase(), m.sources])).get(abil)
  );
</script>

<button
  class="dot"
  disabled={!$canEditBuild}
  class:on={proficient || !!grantedBy}
  class:granted={!!grantedBy && !proficient}
  aria-label="Toggle {ABILITY_NAMES[abil]} save proficiency"
  title={grantedBy ? `Granted by ${grantedBy.join(', ')}` : undefined}
  onclick={() => toggleSaveProficiency(abil)}
></button>

<style>
  .dot {
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 50%;
    border: 1.5px solid var(--muted);
    background: transparent;
    cursor: pointer;
    flex: none;
    padding: 0;
  }
  .dot.on { background: var(--accent); border-color: var(--accent); }
  /* Granted (not manually toggled) reads as a hollow accent ring. */
  .dot.granted { background: transparent; box-shadow: inset 0 0 0 2px var(--bg), 0 0 0 1.5px var(--accent); }
</style>
