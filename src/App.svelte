<script lang="ts">
  // Placeholder shell. The sheet layout engine, blocks, and data-import UI
  // land in the next phases; this just confirms the toolchain renders.
  const version = '0.0.0';
</script>

<main>
  <h1>Character Sheet <small>v{version}</small></h1>
  <p>
    Scaffold is up. Core calculation engine is wired and tested — the sheet UI
    comes next.
  </p>
</main>

<style>
  main {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }
  h1 { color: var(--accent); }
  small { color: var(--muted); font-weight: 400; font-size: 0.6em; }
</style>
