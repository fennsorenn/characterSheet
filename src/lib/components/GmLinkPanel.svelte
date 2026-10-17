<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    apiCreateLinkCode,
    apiListLinks,
    apiRevokeLink,
    type GmLink,
    type LinkAccess,
    type PendingLinkCode
  } from '../api/client.js';
  import { character } from '../stores/character.js';

  /**
   * Share this character with a GM's campaign tool. The player picks how much
   * the tool may do, gets a one-time code to read out or paste, and sees (and
   * can cut) every link that code turned into.
   *
   * The code is the whole handshake: the GM types it into their tool, which
   * trades it with this server for a token of its own. Nothing here talks to
   * the GM's tool, and the tool never sees this account.
   */
  let { slug, onClose }: { slug: string; onClose?: () => void } = $props();

  const ACCESS: { value: LinkAccess; label: string; hint: string }[] = [
    { value: 'read', label: 'Read only', hint: 'The GM sees the sheet: stats, hit points, conditions.' },
    {
      value: 'write',
      label: 'Read & write',
      hint: 'The GM can also set hit points, conditions, exhaustion and spent uses during play.'
    }
  ];

  let access = $state<LinkAccess>('read');
  let shown = $state<{ id: string; code: string; access: LinkAccess; expiresAt: number } | null>(null);
  let links = $state<GmLink[]>([]);
  let pending = $state<PendingLinkCode[]>([]);
  let error = $state('');
  let busy = $state(false);
  let copied = $state(false);
  let now = $state(Date.now());

  async function refresh() {
    const r = await apiListLinks(slug).catch(() => ({ error: 'Could not load links.' }) as { error: string; links?: undefined; pending?: undefined });
    if (r.error) {
      error = r.error;
      return;
    }
    links = r.links ?? [];
    pending = r.pending ?? [];
    // The shown code was used (or withdrawn): it has become a link, or nothing.
    if (shown && !pending.some((p) => p.id === shown!.id) && shown.expiresAt > Date.now()) shown = null;
  }

  async function create() {
    busy = true;
    error = '';
    const r = await apiCreateLinkCode(slug, access).catch(() => ({ error: 'Could not create a code.' }) as { error: string });
    busy = false;
    if ('error' in r && r.error) {
      error = r.error;
      return;
    }
    const ok = r as { id: string; code: string; access: LinkAccess; expiresAt: number };
    shown = { id: ok.id, code: ok.code, access: ok.access, expiresAt: ok.expiresAt };
    copied = false;
    await refresh();
  }

  async function revoke(id: string, what: string) {
    if (!window.confirm(`Revoke ${what}? The GM tool loses access immediately.`)) return;
    const r = await apiRevokeLink(slug, id).catch(() => ({ error: 'Could not revoke.' }));
    if (r.error) error = r.error;
    if (shown?.id === id) shown = null;
    await refresh();
  }

  async function copy() {
    if (!shown) return;
    try {
      await navigator.clipboard.writeText(shown.code);
      copied = true;
    } catch {
      /* clipboard unavailable — the code is on screen anyway */
    }
  }

  const pretty = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;
  const remaining = (until: number) => {
    const s = Math.max(0, Math.round((until - now) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const when = (t: number | null) => (t ? new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'never');
  const accessLabel = (a: LinkAccess) => ACCESS.find((x) => x.value === a)?.label ?? a;

  const expired = $derived(!!shown && shown.expiresAt <= now);
  const otherPending = $derived(pending.filter((p) => p.id !== shown?.id));

  let tick: ReturnType<typeof setInterval> | undefined;
  let poll: ReturnType<typeof setInterval> | undefined;
  onMount(() => {
    refresh();
    tick = setInterval(() => (now = Date.now()), 1000);
    // While a code is out, notice when the GM uses it.
    poll = setInterval(() => {
      if (shown && !expired) refresh();
    }, 4000);
  });
  onDestroy(() => {
    clearInterval(tick);
    clearInterval(poll);
  });
</script>

<div class="gmlink" role="region" aria-label="Share with GM">
  <div class="row head">
    <h2>Share with GM</h2>
    {#if onClose}<button class="close" onclick={onClose} aria-label="Close sharing">✕</button>{/if}
  </div>
  <p class="hint">
    Link <strong>{$character.name}</strong> to your GM's campaign tool. Make a code, and the GM enters it in their
    tool within 15 minutes; it works once. You can revoke a link at any time.
  </p>

  <fieldset class="access">
    <legend>The GM may</legend>
    {#each ACCESS as a}
      <label class:on={access === a.value}>
        <input type="radio" name="gm-access" value={a.value} bind:group={access} />
        <span class="lb">{a.label}</span>
        <span class="sub">{a.hint}</span>
      </label>
    {/each}
  </fieldset>
  <button class="primary" onclick={create} disabled={busy}>Create link code</button>

  {#if shown}
    <div class="code" class:expired data-testid="gm-link-code">
      <span class="digits" aria-label="Link code">{pretty(shown.code)}</span>
      <span class="meta">
        {accessLabel(shown.access)} ·
        {#if expired}expired — make a new one{:else}expires in <span class="left">{remaining(shown.expiresAt)}</span>{/if}
      </span>
      {#if !expired}<button onclick={copy}>{copied ? 'Copied' : 'Copy'}</button>{/if}
    </div>
  {/if}

  {#if error}<p class="err" role="alert">{error}</p>{/if}

  <h3>Linked GM tools</h3>
  {#if links.length}
    <ul class="links">
      {#each links as l (l.id)}
        <li>
          <span class="name">{l.label || 'GM tool'}</span>
          <span class="badge" class:write={l.access === 'write'}>{accessLabel(l.access)}</span>
          <span class="meta">linked {when(l.createdAt)} · last used {when(l.lastUsedAt)}</span>
          <button class="danger" onclick={() => revoke(l.id, `the link to “${l.label || 'GM tool'}”`)}>Revoke</button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="none">No GM tool is linked to this character.</p>
  {/if}

  {#if otherPending.length}
    <h3>Unused codes</h3>
    <ul class="links">
      {#each otherPending as p (p.id)}
        <li>
          <span class="name">Code</span>
          <span class="badge" class:write={p.access === 'write'}>{accessLabel(p.access)}</span>
          <span class="meta">expires in {remaining(p.expiresAt)}</span>
          <button onclick={() => revoke(p.id, 'this unused code')}>Withdraw</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .gmlink {
    margin-top: 0.6rem;
    padding: 0.75rem 0.9rem 1rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--bg);
    max-width: 40rem;
  }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  h2 { font-size: 1rem; margin: 0; }
  h3 { font-size: 0.9rem; margin: 1.1rem 0 0.35rem; }
  .hint { color: var(--muted); font-size: 0.8rem; margin: 0.35rem 0 0.7rem; }
  .close { border: none; background: none; color: var(--muted); cursor: pointer; font-size: 1rem; }

  .access { border: none; padding: 0; margin: 0 0 0.6rem; display: flex; flex-direction: column; gap: 0.35rem; }
  .access legend { font-size: 0.78rem; color: var(--muted); margin-bottom: 0.25rem; }
  .access label {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 0.45rem;
    align-items: baseline;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    cursor: pointer;
  }
  .access label.on { border-color: var(--accent); }
  .access .lb { font-weight: 600; font-size: 0.85rem; }
  .access .sub { grid-column: 2; color: var(--muted); font-size: 0.75rem; }

  .code {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem 0.8rem;
    margin-top: 0.7rem;
    padding: 0.55rem 0.7rem;
    border: 1px dashed var(--accent);
    border-radius: 8px;
  }
  .code .digits {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    user-select: all;
  }
  .code.expired { border-color: var(--line); }
  .code.expired .digits { color: var(--muted); text-decoration: line-through; }
  .code .meta { color: var(--muted); font-size: 0.8rem; flex: 1 1 10rem; }
  .left { font-variant-numeric: tabular-nums; }

  .primary { font: inherit; font-weight: 600; padding: 0.4rem 0.85rem; border: 1px solid var(--accent); border-radius: 6px; background: var(--accent); color: #fff; cursor: pointer; }
  .danger { color: var(--danger, #c0392b); }
  .err { color: var(--danger, #c0392b); font-size: 0.8rem; margin: 0.5rem 0 0; }
  .none { color: var(--muted); font-size: 0.8rem; margin: 0; }

  .links { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
  .links li {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.3rem 0.5rem;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .links .name { font-weight: 600; font-size: 0.85rem; }
  .links .meta { color: var(--muted); font-size: 0.75rem; flex: 1 1 12rem; }
  .badge {
    font-size: 0.7rem;
    padding: 0.05rem 0.4rem;
    border: 1px solid var(--line);
    border-radius: 999px;
    color: var(--muted);
  }
  .badge.write { border-color: var(--accent); color: var(--accent); }
</style>
