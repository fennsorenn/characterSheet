<script lang="ts">
  import { ABILITIES, ABILITY_NAMES } from '../character/index.js';
  import StatValue from './StatValue.svelte';
  import Reminders from './Reminders.svelte';
  import SaveDot from './SaveDot.svelte';
  import { anchors } from '../character/index.js';

  let { variant = 'full' }: { variant?: string } = $props();
</script>

<section class="block" data-variant={variant}>
  <h3>Saving Throws</h3>
  <ul>
    {#each ABILITIES as abil}
      <li>
        <div class="row">
        <SaveDot {abil} />
        <span class="name">{ABILITY_NAMES[abil]}</span>
        <span class="val"><StatValue node={`save.${abil}`} signed /></span>
        </div>
        <Reminders anchor={anchors.save(abil)} />
      </li>
    {/each}
  </ul>
</section>

<style>
  .block { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 1rem; }
  h3 { margin: 0 0 0.6rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  ul { list-style: none; margin: 0; padding: 0; }
  li { padding: 0.18rem 0; }
  .row { display: flex; align-items: center; gap: 0.55rem; }
  .name { flex: 1; }
  .val { font-weight: 600; }
</style>
