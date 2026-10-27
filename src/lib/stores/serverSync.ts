import { deepEqual, rebase } from '../character/rebase.js';
import type { Character } from '../character/index.js';

/**
 * Autosave for a character held on the server, aware that someone else may
 * write it too — a GM through a link, or the same player on another device.
 *
 * Every save names the `rev` it was based on. When the server has moved on it
 * answers 409 with its copy; the sheet then rebases its unsaved edits onto that
 * copy ({@link rebase}) and saves again. Changes pushed over the sheet's event
 * stream go through the same rebase straight away, so the next autosave builds
 * on them instead of writing the old values back.
 *
 * Kept free of Svelte and `fetch` so the conflict handling is unit-testable;
 * `character.ts` wires it to the store, the API and the EventSource.
 */

export type PutResult =
  | { ok: true; rev: number }
  | { conflict: true; rev: number; doc: Character }
  | { error: string };

export interface PutRequest {
  doc: Character;
  baseRev: number;
  summary?: unknown;
}

export interface ServerSyncOptions {
  /** The document and rev as loaded from the server. */
  doc: Character;
  rev: number;
  /** The summary the server holds, if any — a save is skipped while it still matches. */
  summary?: unknown;
  put: (req: PutRequest) => Promise<PutResult>;
  /** The sheet's current document. */
  read: () => Character;
  /** Replace the sheet's document (after a rebase). */
  write: (doc: Character) => void;
  /** The current summary, or undefined when it can't be computed (no dataset). */
  summarize?: () => unknown;
  /** Bring a document from the server into the shape the sheet holds. */
  normalize?: (doc: Character) => Character;
  debounceMs?: number;
  /** Give up after this many conflicts in a row (until the next edit). */
  maxConflicts?: number;
}

export interface ServerSync {
  /** Note an edit; saves after the debounce. */
  schedule(): void;
  /** Save now (resolves when this and any queued follow-up save are done). */
  flush(): Promise<void>;
  /** Fold in a change someone else made (from the event stream). */
  applyRemote(rev: number, doc: Character): void;
  /** The rev the sheet's last known server copy has. */
  readonly rev: number;
  stop(): void;
}

export function createServerSync(o: ServerSyncOptions): ServerSync {
  const normalize = o.normalize ?? ((d: Character) => d);
  const debounceMs = o.debounceMs ?? 500;
  const maxConflicts = o.maxConflicts ?? 5;
  let synced = { doc: o.doc, rev: o.rev };
  let savedSummary: unknown = o.summary;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | null = null;
  let again = false;
  let conflicts = 0;
  let stopped = false;
  /** Set while the sync itself writes the store, whose subscriber calls schedule(). */
  let selfWrite = false;

  function applyRemote(rev: number, remoteDoc: Character) {
    if (stopped || rev <= synced.rev) return;
    const remote = normalize(remoteDoc);
    const current = o.read();
    const merged = rebase(synced.doc, current, remote);
    synced = { doc: remote, rev };
    if (deepEqual(merged, current)) return;
    selfWrite = true;
    try {
      o.write(merged);
    } finally {
      selfWrite = false;
    }
  }

  async function saveOnce() {
    const doc = o.read();
    const summary = o.summarize?.();
    const summaryMoved = summary !== undefined && !deepEqual(summary, savedSummary);
    if (!summaryMoved && deepEqual(doc, synced.doc)) return;
    const res = await o.put({ doc, baseRev: synced.rev, ...(summary !== undefined ? { summary } : {}) });
    if (stopped) return;
    if ('ok' in res) {
      conflicts = 0;
      if (summary !== undefined) savedSummary = summary;
      if (res.rev > synced.rev) synced = { doc, rev: res.rev };
    } else if ('conflict' in res) {
      conflicts++;
      applyRemote(res.rev, res.doc);
      // Rebased (or already had that copy from the stream): try again on top of it.
      if (conflicts < maxConflicts) again = true;
    }
    // { error }: leave it; the next edit retries.
  }

  function flush(): Promise<void> {
    clearTimeout(timer);
    timer = undefined;
    if (stopped) return Promise.resolve();
    if (inFlight) {
      again = true;
      return inFlight;
    }
    inFlight = (async () => {
      try {
        do {
          again = false;
          await saveOnce().catch(() => {});
        } while (again && !stopped);
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }

  return {
    schedule() {
      if (stopped) return;
      if (!selfWrite) conflicts = 0;
      clearTimeout(timer);
      timer = setTimeout(() => void flush(), debounceMs);
    },
    flush,
    applyRemote,
    get rev() {
      return synced.rev;
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
    }
  };
}
