// @ts-nocheck
export const ATTENDEE_ROOT = '/api/dsh-live-voice/attendee';
/** Derive only from the listener's attested origin, never Host/Forwarded headers. */
export function attendeeReceiverUrl(webServer) {
  try {
    const origin = new URL(webServer.getOrigin());
    if (origin.protocol !== 'https:') return '';
    origin.protocol = 'wss:';
    origin.pathname = ATTENDEE_ROOT + '/ingest';
    origin.search = '';
    origin.hash = '';
    return origin.href;
  } catch {
    return '';
  }
}
export function validateAttendeeApi(value) {
  const api = new URL(value);
  if (
    !['http:', 'https:'].includes(api.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(api.hostname) ||
    api.username ||
    api.password ||
    api.search ||
    api.hash ||
    !['', '/'].includes(api.pathname)
  )
    throw new Error('invalid-api');
  return api.origin;
}
export function validateAttendeeIngress(value) {
  const url = new URL(value);
  if (url.protocol !== 'wss:' || url.username || url.password || url.search || url.hash)
    throw new Error('tls-required');
  if (url.pathname !== ATTENDEE_ROOT + '/ingest') throw new Error('invalid-ingress');
  return url;
}
/** Read a complete bounded snapshot; never fetch an API-provided pagination URL. */
export async function attendeeParticipantNames(api, origin, botId, signal) {
  const path = 'bots/' + encodeURIComponent(botId) + '/participants';
  const endpoint = new URL(origin + '/api/v1/' + path);
  const names = new Map();
  const cursors = new Set(['']);
  const responseBudget = { remaining: 64000 };
  let query = '';
  let count = 0;
  for (let page = 0; page < 16; page++) {
    signal.throwIfAborted();
    const data = await api(path + query, { signal, responseBudget });
    signal.throwIfAborted();
    if (
      !data ||
      Array.isArray(data) ||
      !Array.isArray(data.results) ||
      !(data.next === null || typeof data.next === 'string') ||
      !(data.previous === null || typeof data.previous === 'string') ||
      (count += data.results.length) > 256
    )
      throw new Error('participants');
    for (const row of data.results) {
      if (
        !row ||
        typeof row.uuid !== 'string' ||
        !row.uuid.length ||
        row.uuid.length > 256 ||
        /[\x00-\x1f]/.test(row.uuid) ||
        typeof row.name !== 'string'
      )
        throw new Error('participants');
      names.set(row.uuid, row.name.replace(/[\x00-\x1f]/g, '').slice(0, 80));
    }
    if (data.next === null) return names;
    if (!data.results.length || data.next.length > 2048) throw new Error('participants');
    const next = new URL(data.next, endpoint);
    const cursor = next.searchParams.get('cursor');
    if (
      next.origin !== endpoint.origin ||
      next.pathname !== endpoint.pathname ||
      next.username ||
      next.password ||
      next.hash ||
      [...next.searchParams.keys()].length !== 1 ||
      !cursor ||
      cursor.length > 1024 ||
      /[\x00-\x1f]/.test(cursor) ||
      cursors.has(cursor)
    )
      throw new Error('participants');
    cursors.add(cursor);
    query = '?cursor=' + encodeURIComponent(cursor);
  }
  // A partial participant list must not masquerade as a complete discovery.
  throw new Error('participants');
}
export function attendeeApiRequest(origin, key, fetcher) {
  return async (path, options = {}) => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 5000);
    const { responseBudget, ...requestOptions } = options;
    try {
      const response = await fetcher(origin + '/api/v1/' + path, {
        ...requestOptions,
        headers: {
          Authorization: 'Token ' + key,
          ...(options.body ? { 'content-type': 'application/json' } : {}),
        },
        signal: options.signal ? AbortSignal.any([abort.signal, options.signal]) : abort.signal,
        redirect: 'error',
      });
      if (!response.ok) throw new Error('api-failed');
      if (response.status === 204) return {};
      const reader = response.body.getReader();
      const chunks = [];
      let length = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (responseBudget) responseBudget.remaining -= value.byteLength;
          if (length > 64000 || (responseBudget && responseBudget.remaining < 0))
            throw new Error('api-failed');
          chunks.push(Buffer.from(value));
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } finally {
      clearTimeout(timer);
    }
  };
}
