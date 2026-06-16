<script lang="ts">
  import { onMount } from 'svelte';
  import { restoreCached } from './lib/stores/catalog.js';
  import { route, navigate } from './lib/stores/router.js';
  import { me, refreshMe, logout } from './lib/stores/session.js';
  import { migrateLegacyCharacter } from './lib/stores/characters.js';
  import { openLocalCharacter, openUserCharacter, detachCharacter } from './lib/stores/character.js';
  import AuthView from './lib/components/AuthView.svelte';
  import Overview from './lib/components/Overview.svelte';
  import SheetView from './lib/components/SheetView.svelte';

  let sheetReady = $state(false);

  onMount(() => {
    migrateLegacyCharacter();
    restoreCached();
    refreshMe();
  });

  // Load the right character / enforce auth as the route (or login state) changes.
  $effect(() => {
    const r = $route;
    const user = $me;
    sheetReady = false;

    if (r.view === 'home') {
      navigate('/local', true);
      return;
    }
    if (r.view === 'localSheet') {
      openLocalCharacter(r.slug);
      sheetReady = true;
      return;
    }
    if (r.view === 'userOverview' || r.view === 'userSheet') {
      if (user === undefined) return; // still resolving session
      if (user === null || user !== r.username) {
        navigate('/login', true);
        return;
      }
      if (r.view === 'userSheet') openUserCharacter(r.slug).then(() => (sheetReady = true));
      return;
    }
    detachCharacter();
  });
</script>

{#if $route.view === 'localSheet'}
  {#if sheetReady}<SheetView backTo="/local" />{/if}
{:else if $route.view === 'userSheet'}
  {#if sheetReady && $me === $route.username}<SheetView backTo={`/user/${encodeURIComponent($route.username)}`} />{:else}<p class="loading">Loading…</p>{/if}
{:else}
  <header class="nav">
    <button class="brand" onclick={() => navigate('/local')}>Character Sheet</button>
    <nav>
      {#if $me}
        <button class="link" onclick={() => navigate(`/user/${encodeURIComponent($me)}`)}>{$me}</button>
        <button class="link" onclick={() => { logout(); navigate('/local'); }}>Log out</button>
      {:else}
        <button class="link" onclick={() => navigate('/local')}>Local</button>
        <button class="link" onclick={() => navigate('/login')}>Log in</button>
      {/if}
    </nav>
  </header>

  {#if $route.view === 'login'}
    <AuthView mode="login" />
  {:else if $route.view === 'signup'}
    <AuthView mode="signup" />
  {:else if $route.view === 'localOverview'}
    <Overview scope="local" />
  {:else if $route.view === 'userOverview'}
    {#if $me === $route.username}<Overview scope="user" username={$route.username} />{:else}<p class="loading">Loading…</p>{/if}
  {:else}
    <p class="loading">Page not found. <button class="link" onclick={() => navigate('/local')}>Go home</button></p>
  {/if}
{/if}

<style>
  .nav { display: flex; align-items: center; justify-content: space-between; padding: 0.6rem clamp(1rem, 2.5vw, 2.5rem); border-bottom: 1px solid var(--line); }
  .brand { font: inherit; font-weight: 700; color: var(--accent); background: none; border: none; cursor: pointer; font-size: 1.05rem; }
  nav { display: flex; gap: 0.75rem; }
  .link { background: none; border: none; color: var(--fg); cursor: pointer; font: inherit; }
  .link:hover { color: var(--accent); }
  .loading { text-align: center; color: var(--muted); margin: 4rem 1rem; }
</style>
