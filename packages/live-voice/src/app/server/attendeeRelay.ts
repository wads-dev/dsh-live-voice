// @ts-nocheck
import { X509Certificate } from 'node:crypto';
/** Local descriptor is a loopback bootstrap, not a public PKI or a global trust change. */
export async function connectAttendeeRelay(apiKey, hub, session, loadWs, fetcher, abort) {
  const timeout = AbortSignal.timeout(5000);
  const signal = AbortSignal.any([timeout, abort.signal]);
  const response = await fetcher('http://127.0.0.1:18766/v1/descriptor', {
    redirect: 'error',
    signal,
  });
  if (!response.ok) throw new Error('relay-unavailable');
  const reader = response.body.getReader();
  let bytes = 0;
  const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 16000) throw Error('relay-unavailable');
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const descriptor = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (descriptor.protocol !== 'dsh-attendee-relay-v1' || typeof descriptor.certificate !== 'string')
    throw Error('relay-unavailable');
  const cert = new X509Certificate(descriptor.certificate);
  if (!cert.checkIP('127.0.0.1') || Date.parse(cert.validTo) <= Date.now())
    throw Error('relay-unavailable');
  const module = await loadWs();
  const WebSocket = module.WebSocket || module.default;
  if (abort.signal.aborted || hub.session !== session) throw Error('closed');
  const ws = new WebSocket('wss://127.0.0.1:18765/v1/receive', {
    ca: descriptor.certificate,
    rejectUnauthorized: true,
    headers: { Authorization: 'Token ' + apiKey },
    maxPayload: 128000,
    perMessageDeflate: false,
    handshakeTimeout: 5000,
  });
  session.socket = ws;
  return await new Promise((resolve, reject) => {
    let ready = false,
      settled = false;
    const stop = () => {
      clearTimeout(timer);
      abort.signal.removeEventListener('abort', stop);
      ws.terminate();
      if (!settled) {
        settled = true;
        reject(Error('closed'));
      }
    };
    abort.signal.addEventListener('abort', stop, { once: true });
    const timer = setTimeout(() => {
      stop();
    }, 6000);
    const failed = () => {
      clearTimeout(timer);
      abort.signal.removeEventListener('abort', stop);
      if (!settled) {
        settled = true;
        reject(Error('relay-unavailable'));
      } else if (hub.session === session && !session.error) hub.fail('connection');
    };
    ws.on('error', failed);
    ws.on('close', failed);
    ws.on('message', (data, binary) => {
      if (hub.session !== session) return;
      try {
        if (binary) throw Error('invalid-audio');
        const value = JSON.parse(data.toString());
        if (!ready) {
          const url = new URL(value.ingestUrl);
          if (
            value.type !== 'ready' ||
            url.origin !== 'wss://dsh-audio-bridge:18765' ||
            url.pathname !== '/ingest' ||
            !/^\?token=[a-f0-9]{64}$/.test(url.search) ||
            url.username ||
            url.password ||
            url.hash
          )
            throw Error('relay-unavailable');
          ready = true;
          settled = true;
          clearTimeout(timer);
          resolve(url.href);
          return;
        }
        hub.ingest(value);
      } catch {
        hub.fail('invalid-audio');
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(Error('relay-unavailable'));
        }
      }
    });
  });
}
