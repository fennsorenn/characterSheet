<script lang="ts">
  import { login, signup } from '../stores/session.js';
  import { navigate } from '../stores/router.js';

  let { mode }: { mode: 'login' | 'signup' } = $props();

  let username = $state('');
  let password = $state('');
  let error = $state<string | null>(null);
  let busy = $state(false);

  async function submit(e: Event) {
    e.preventDefault();
    error = null;
    busy = true;
    const err = mode === 'login' ? await login(username, password) : await signup(username, password);
    busy = false;
    if (err) {
      error = err;
      return;
    }
    navigate(`/user/${encodeURIComponent(username.toLowerCase())}`);
  }
</script>

<div class="auth">
  <form onsubmit={submit}>
    <h1>{mode === 'login' ? 'Log in' : 'Sign up'}</h1>
    <label>
      Username
      <input bind:value={username} autocomplete="username" autocapitalize="off" required />
    </label>
    <label>
      Password
      <input type="password" bind:value={password} autocomplete={mode === 'login' ? 'current-password' : 'new-password'} required />
    </label>
    {#if error}<p class="err">{error}</p>{/if}
    <button class="primary" type="submit" disabled={busy}>{mode === 'login' ? 'Log in' : 'Create account'}</button>
    <p class="alt">
      {#if mode === 'login'}
        No account? <button type="button" class="link" onclick={() => navigate('/signup')}>Sign up</button>
      {:else}
        Have an account? <button type="button" class="link" onclick={() => navigate('/login')}>Log in</button>
      {/if}
    </p>
    <p class="alt"><button type="button" class="link" onclick={() => navigate('/local')}>Continue without an account →</button></p>
  </form>
</div>

<style>
  .auth { min-height: 70vh; display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
  form { width: 100%; max-width: 22rem; display: flex; flex-direction: column; gap: 0.75rem; border: 1px solid var(--line); border-radius: 10px; padding: 1.5rem; }
  h1 { margin: 0 0 0.25rem; color: var(--accent); font-size: 1.4rem; }
  label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.78rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; }
  input { font: inherit; padding: 0.45rem 0.55rem; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--fg); }
  .err { color: #d2645a; font-size: 0.85rem; margin: 0; }
  .primary { font: inherit; font-weight: 600; padding: 0.5rem; border: 1px solid var(--accent); background: var(--accent); color: #fff; border-radius: 6px; cursor: pointer; }
  .primary:disabled { opacity: 0.6; cursor: progress; }
  .alt { font-size: 0.82rem; color: var(--muted); margin: 0; text-align: center; }
  .link { background: none; border: none; color: var(--accent); cursor: pointer; font: inherit; padding: 0; }
</style>
