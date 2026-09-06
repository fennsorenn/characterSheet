<script lang="ts">
  import CoinFields from './CoinFields.svelte';

  /**
   * Currency as its own placeable block — the same row the Inventory block can
   * show, for layouts that would rather keep the purse separate from the pack.
   *
   * Block-level reminders are rendered by the layout renderer for every block,
   * so this deliberately adds none of its own.
   */
  let { variant = 'full' }: { variant?: string } = $props();
</script>

<section class="block" data-variant={variant}>
  <header class="head">
    <h3>Currency</h3>
  </header>
  <CoinFields compact={variant === 'compact'} />
</section>

<style>
  .head { display: flex; align-items: baseline; justify-content: space-between; }
  h3 { margin: 0; }
</style>
