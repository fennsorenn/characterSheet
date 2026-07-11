<script lang="ts">
  import { UI_ICONS } from './uiIcons.generated.js';

  // Stroke-style basic-UI icons vendored from Lucide (ISC; see ICON_CREDITS.md),
  // on a 24 viewBox with currentColor — kept separate from the fill-style
  // game-icons pack (Icon.svelte). `filled` fills the shape (e.g. favorite star).
  let { name, size = '1em', filled = false }: { name: string; size?: string; filled?: boolean } =
    $props();
  const markup = $derived(UI_ICONS[name] ?? UI_ICONS.close);
</script>

<svg
  class="ui-icon"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill={filled ? 'currentColor' : 'none'}
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {@html markup}
</svg>

<style>
  .ui-icon { display: inline-block; vertical-align: -0.15em; }
</style>
