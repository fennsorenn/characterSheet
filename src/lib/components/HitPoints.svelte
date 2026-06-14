<script lang="ts">
  import { character, setHp } from '../stores/character.js';
  import NumberField from './NumberField.svelte';

  let { variant = 'full' }: { variant?: string } = $props();

  // Health bar fraction (temp HP shown as overflow beyond current/max).
  const pct = $derived(
    Math.max(0, Math.min(100, ($character.hp.max ? $character.hp.current / $character.hp.max : 0) * 100))
  );
</script>

<section class="block" data-variant={variant}>
  <h3>Hit Points</h3>
  <div class="bar"><span style="width: {pct}%"></span></div>
  <div class="row">
    <span class="grp">
      <NumberField value={$character.hp.current} min={0} onchange={(v) => setHp('current', v)} width="3.5ch" />
      <span class="sep">/</span>
      <NumberField value={$character.hp.max} min={0} onchange={(v) => setHp('max', v)} width="3.5ch" />
      <span class="lbl">HP</span>
    </span>
    <span class="grp">
      <span class="lbl">Temp</span>
      <NumberField value={$character.hp.temp} min={0} onchange={(v) => setHp('temp', v)} width="3ch" />
    </span>
  </div>
  <p class="tip">Type <code>-5</code> in current HP to take 5 damage, <code>+8</code> to heal.</p>
</section>

<style>
  .block { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem 1rem; }
  h3 { margin: 0 0 0.6rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .bar { height: 0.5rem; background: var(--field-hover); border-radius: 4px; overflow: hidden; margin-bottom: 0.5rem; }
  .bar span { display: block; height: 100%; background: var(--accent); transition: width 0.15s; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .grp { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 1.25rem; font-weight: 700; }
  .sep { color: var(--muted); }
  .lbl { font-size: 0.65rem; text-transform: uppercase; color: var(--muted); font-weight: 600; }
  .tip { color: var(--muted); font-size: 0.75rem; margin: 0.5rem 0 0; }
</style>
