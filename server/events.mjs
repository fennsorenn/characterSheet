/**
 * Server-sent-event fan-out for character changes.
 *
 * Two kinds of listener watch a character: its owner's open sheet (keyed by
 * owner + slug) and GM links (keyed by link id, but notified by character). The
 * hub holds the open responses and nothing else; what an event says is decided
 * by the API layer, which knows who wrote what.
 */

export const HEARTBEAT_MS = 25_000;

export function sseHeaders(res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // nginx and friends buffer proxied responses unless told not to.
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  // Tell EventSource how long to wait before reconnecting.
  res.write('retry: 3000\n\n');
}

export function sseSend(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function createHub({ heartbeatMs = HEARTBEAT_MS } = {}) {
  /** @type {Set<{ res, owner, slug, linkId?, clientId? }>} */
  const clients = new Set();

  const timer = setInterval(() => {
    for (const c of clients) c.res.write(': ping\n\n');
  }, heartbeatMs);
  timer.unref?.();

  function add(req, res, meta) {
    const client = { res, ...meta };
    clients.add(client);
    const drop = () => clients.delete(client);
    req.on('close', drop);
    res.on('close', drop);
    return client;
  }

  return {
    /** Register an owner's open sheet. */
    addOwner(req, res, { owner, slug, clientId }) {
      return add(req, res, { kind: 'owner', owner, slug, clientId });
    },
    /** Register a GM link stream. */
    addLink(req, res, { owner, slug, linkId }) {
      return add(req, res, { kind: 'link', owner, slug, linkId });
    },
    /** Every listener on one character: `fn(client)` decides what each gets. */
    forCharacter(owner, slug, fn) {
      for (const c of clients) if (c.owner === owner && c.slug === slug) fn(c);
    },
    /** End every stream of one link, after sending each a last event. */
    closeLink(linkId, event, data) {
      for (const c of clients) {
        if (c.kind === 'link' && c.linkId === linkId) {
          sseSend(c.res, event, data);
          c.res.end();
          clients.delete(c);
        }
      }
    },
    /** End every stream on one character (it was deleted). */
    closeCharacter(owner, slug, event, data) {
      for (const c of clients) {
        if (c.owner === owner && c.slug === slug) {
          sseSend(c.res, event, data);
          c.res.end();
          clients.delete(c);
        }
      }
    },
    size: () => clients.size,
    stop() {
      clearInterval(timer);
      for (const c of clients) c.res.end();
      clients.clear();
    }
  };
}
