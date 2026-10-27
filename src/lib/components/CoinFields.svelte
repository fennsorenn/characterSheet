<script lang="ts">
  import { character, setCoin } from '../stores/character.js';
  import { canEditPlay } from '../stores/mode.js';
  import { COINS, currencyOf, type Coin } from '../character/index.js';
  import NumberField from './NumberField.svelte';

  /**
   * The coin row itself, shared by the Inventory block's currency option and the
   * standalone Currency block — they are the same row in two places, so they
   * live in one component and cannot drift apart.
   */
  let { compact = false }: { compact?: boolean } = $props();

  const coins = $derived(currencyOf($character));
  // Compact hides empty denominations, but never everything: a purse showing
  // nothing at all reads as broken rather than as empty.
  const shown = $derived(
    compact ? (COINS.filter((c) => coins[c] > 0) as Coin[]) : ([...COINS] as Coin[])
  );
</script>

<ul class="coins" class:compact>
  {#if shown.length === 0}
    <li class="none">No coins</li>
  {:else}
    {#each shown as coin (coin)}
      <li>
        <NumberField
          value={coins[coin]}
          min={0}
          digits={4}
          locked={!$canEditPlay}
          label={coin.toUpperCase()}
          onchange={(v) => setCoin(coin, v)}
        />
        <span class="denom">{coin}</span>
      </li>
    {/each}
  {/if}
</ul>

<style>
  .coins {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.15rem 0.6rem;
  }
  .coins li { display: flex; align-items: baseline; gap: 0.2rem; }
  .denom { font-size: 0.7rem; text-transform: uppercase; color: var(--muted, #777); letter-spacing: 0.04em; }
  .none { font-size: 0.8rem; color: var(--muted, #777); }
</style>
