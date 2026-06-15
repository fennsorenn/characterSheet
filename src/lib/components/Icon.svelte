<script lang="ts">
  import { SLOT_ICONS } from './icons.generated.js';

  // Monochrome equipment-slot / source icons, vendored from game-icons.net
  // (CC BY 3.0; see ICON_CREDITS.md). Rendered as currentColor on a 512 viewBox.
  let { name, size = '1em' }: { name: string; size?: string } = $props();
  const markup = $derived(SLOT_ICONS[name] ?? SLOT_ICONS.magic);
</script>

<svg class="icon" width={size} height={size} viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
  {@html markup}
</svg>

<style>
  .icon { display: inline-block; vertical-align: -0.12em; }
</style>
