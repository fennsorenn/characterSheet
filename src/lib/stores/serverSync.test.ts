import { describe, it, expect } from 'vitest';
import { createServerSync, type PutRequest, type PutResult } from './serverSync.js';
import { createCharacter, type Character } from '../character/index.js';

/**
 * A fake server holding one document and a rev, enforcing `baseRev` the way
 * the real one does, plus a GM who can write status behind the sheet's back.
 */
function fakeServer(doc: Character) {
  const state = { doc: structuredClone(doc), rev: 1, summary: undefined as unknown };
  const puts: PutRequest[] = [];
  return {
    state,
    puts,
    async put(req: PutRequest): Promise<PutResult> {
      puts.push(structuredClone(req));
      if (req.baseRev !== state.rev) return { conflict: true, rev: state.rev, doc: structuredClone(state.doc) };
      state.doc = structuredClone(req.doc);
      if (req.summary !== undefined) state.summary = req.summary;
      state.rev++;
      return { ok: true, rev: state.rev };
    },
    gm(patch: Partial<Character>) {
      state.doc = { ...state.doc, ...structuredClone(patch) };
      state.rev++;
      return { rev: state.rev, doc: structuredClone(state.doc) };
    }
  };
}

function sheet(initial: Character, server: ReturnType<typeof fakeServer>, summarize?: () => unknown) {
  let current = structuredClone(initial);
  const sync = createServerSync({
    doc: structuredClone(initial),
    rev: server.state.rev,
    put: (r) => server.put(r),
    read: () => current,
    write: (d) => {
      current = d;
      sync.schedule();
    },
    summarize,
    debounceMs: 0
  });
  return {
    sync,
    get doc() {
      return current;
    },
    edit(fn: (c: Character) => Character) {
      current = fn(current);
      sync.schedule();
    }
  };
}

const start = () => createCharacter({ id: 'c1', name: 'Bran', hp: { max: 30, current: 30, temp: 0 } });

describe('server sync', () => {
  it('saves with baseRev and advances its rev', async () => {
    const server = fakeServer(start());
    const s = sheet(start(), server);
    s.edit((c) => ({ ...c, name: 'Bran the Bold' }));
    await s.sync.flush();
    expect(server.puts.map((p) => p.baseRev)).toEqual([1]);
    expect(s.sync.rev).toBe(2);
    expect(server.state.doc.name).toBe('Bran the Bold');
  });

  it('skips a save when nothing changed', async () => {
    const server = fakeServer(start());
    const s = sheet(start(), server);
    s.sync.schedule();
    await s.sync.flush();
    expect(server.puts).toHaveLength(0);
  });

  it('on 409, rebases unsaved edits onto the GM’s change and retries — not reverting it', async () => {
    const server = fakeServer(start());
    const s = sheet(start(), server);
    server.gm({ hp: { max: 30, current: 9, temp: 0 }, conditions: ['Poisoned'] }); // the sheet never heard
    s.edit((c) => ({ ...c, name: 'Bran the Bold', hp: { ...c.hp, temp: 5 } }));
    await s.sync.flush();
    expect(server.puts.map((p) => p.baseRev)).toEqual([1, 2]); // stale, then rebased
    expect(server.state.doc.hp).toEqual({ max: 30, current: 9, temp: 5 });
    expect(server.state.doc.conditions).toEqual(['Poisoned']);
    expect(server.state.doc.name).toBe('Bran the Bold');
    expect(s.doc.hp.current).toBe(9); // the sheet shows it too
    expect(s.sync.rev).toBe(3);
  });

  it('applies a streamed change at once, and the next autosave keeps it', async () => {
    const server = fakeServer(start());
    const s = sheet(start(), server);
    const ev = server.gm({ hp: { max: 30, current: 4, temp: 0 } });
    s.sync.applyRemote(ev.rev, ev.doc);
    expect(s.doc.hp.current).toBe(4);
    await s.sync.flush();
    expect(server.puts).toHaveLength(0); // nothing of the sheet's own to save
    s.edit((c) => ({ ...c, exhaustion: 1 }));
    await s.sync.flush();
    expect(server.puts.map((p) => p.baseRev)).toEqual([2]); // no conflict: it knew rev 2
    expect(server.state.doc).toMatchObject({ exhaustion: 1, hp: { current: 4 } });
  });

  it('ignores a streamed change it has already seen', () => {
    const server = fakeServer(start());
    const s = sheet(start(), server);
    const ev = server.gm({ exhaustion: 2 });
    s.sync.applyRemote(ev.rev, ev.doc);
    s.sync.applyRemote(1, { ...ev.doc, exhaustion: 5 });
    expect(s.doc.exhaustion).toBe(2);
  });

  it('saves when only the summary moved, and not again once it is stored', async () => {
    const server = fakeServer(start());
    let summary = { ac: 15 };
    const s = sheet(start(), server, () => summary);
    s.sync.schedule();
    await s.sync.flush();
    expect(server.puts).toHaveLength(1);
    expect(server.state.summary).toEqual({ ac: 15 });
    s.sync.schedule();
    await s.sync.flush();
    expect(server.puts).toHaveLength(1);
    summary = { ac: 17 };
    s.sync.schedule();
    await s.sync.flush();
    expect(server.puts).toHaveLength(2);
  });

  it('gives up after repeated conflicts instead of looping', async () => {
    const server = fakeServer(start());
    const put = server.put.bind(server);
    // A server that moves on before every save lands.
    server.put = async (r) => {
      if (server.puts.length > 20) throw new Error('still looping'); // fail, don't hang
      server.gm({ exhaustion: (server.state.doc.exhaustion + 1) % 6 });
      return put(r);
    };
    const s = sheet(start(), server);
    s.edit((c) => ({ ...c, name: 'X' }));
    await s.sync.flush();
    expect(server.puts.length).toBeLessThanOrEqual(5);
  });
});
