<script lang="ts">
  // Small monochrome inline-SVG icons (currentColor, no dependency). Used for
  // source badges (equipment slot / magic). Line style for most, filled for
  // sparkles, all on a 24×24 viewBox.
  let { name, size = '1em' }: { name: string; size?: string } = $props();
</script>

<svg
  class="icon"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if name === 'gem'}
    <path d="M6 3h12l4 6-10 13L2 9Z" />
    <path d="M11 3 8 9l4 13 4-13-3-6" />
    <path d="M2 9h20" />
  {:else if name === 'crown'}
    <path d="M3 7l4 4 5-6 5 6 4-4-2 11H5z" />
    <path d="M5 21h14" />
  {:else if name === 'belt'}
    <rect x="2" y="9.5" width="20" height="5" rx="1.5" />
    <rect x="9" y="8" width="6" height="8" rx="1" />
  {:else if name === 'shirt'}
    <path
      d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"
    />
  {:else if name === 'wand'}
    <path d="M4 20 14 10" />
    <path d="M17 3l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="currentColor" stroke="none" />
  {:else}
    <path
      d="M12 2l1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6z"
      fill="currentColor"
      stroke="none"
    />
    <path d="M18.5 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" fill="currentColor" stroke="none" />
  {/if}
</svg>

<style>
  .icon { display: inline-block; vertical-align: -0.1em; }
</style>
