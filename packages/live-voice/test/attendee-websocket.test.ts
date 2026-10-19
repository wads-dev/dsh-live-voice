// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createServer as createTlsServer } from 'node:https';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import WebSocket, { WebSocketServer } from 'ws';
import { connectAttendeeRelay } from '../src/app/server/attendeeRelay.js';
import { AttendeeHub } from '../src/modules/conversation/models/AttendeeHub.js';
import { registerAttendeeRoutes as registerRoutes } from '../src/app/server/attendeeRoutes.js';
// Every legacy route fixture remains isolated from real host credentials.
function registerAttendeeRoutes(ctx, ws, fetcher) {
  const keys = new Map();
  return registerRoutes(ctx, ws, fetcher, {
    metadata: async (origin) => ({ hasSavedKey: keys.has(origin) }),
    get: async (origin) => {
      if (!keys.has(origin)) throw Error('credential-missing');
      return keys.get(origin);
    },
    save: async (origin, key) => {
      keys.set(origin, key);
      return { hasSavedKey: true };
    },
    remove: async (origin) => {
      keys.delete(origin);
      return { hasSavedKey: false };
    },
  });
}

test('real WebSocket ingress rejects foreign owners and relays PCM by UUID over a loopback test socket', async (t) => {
  let route, upgrade, cleanup;
  const sockets = new Set();
  const server = createServer();
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.on('upgrade', (req, socket, head) => upgrade.handler(req, socket, head));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => {
    await cleanup?.();
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  });
  registerAttendeeRoutes({
    connection: {
      fetch: {
        register: (r) => {
          route = r;
          return () => {};
        },
      },
    },
    webServer: {
      registerUpgrade: (r) => {
        upgrade = r;
        return () => {};
      },
    },
    effect: (f) => (cleanup = f()),
  });
  const request = async (value) => {
    const response = await route.fetch(
      new Request('http://local/api/dsh-live-voice/attendee', {
        method: 'POST',
        body: JSON.stringify(value),
      }),
    );
    const json = await response.json();
    assert.equal(response.status, 200);
    assert.equal(json.ok, true);
    return json.value;
  };
  // TLS is deliberately outside this test: only the test socket uses ws://.
  // Production ingress settings remain wss-only and are never downgraded.
  const lease = await request({
    action: 'open',
    apiUrl: 'http://localhost:8000',
    apiKey: 'test-only-api-key',
    ingressUrl: 'wss://receiver.example/api/dsh-live-voice/attendee/ingest',
  });
  const ingress = new URL(lease.ingestUrl);
  ingress.protocol = 'ws:';
  ingress.host = '127.0.0.1:' + server.address().port;
  const rejected = async (url, options = {}) => {
    const ws = new WebSocket(url, options);
    const status = await new Promise((resolve, reject) => {
      ws.on('unexpected-response', (_req, response) => {
        response.resume();
        ws.terminate();
        resolve(response.statusCode);
      });
      ws.on('open', () => reject(Error('unexpected admission')));
      ws.on('error', () => {});
    });
    assert.equal(status, 403);
  };
  const bad = new URL(ingress);
  bad.searchParams.set('token', 'bad');
  await rejected(bad);
  await rejected(ingress, { origin: 'http://foreign.example' });
  const ws = new WebSocket(ingress);
  ws.on('error', () => {});
  await once(ws, 'open');
  await rejected(ingress);
  const packet = (id) => ({
    trigger: 'realtime_audio.per_participant',
    bot_id: 'bot_Test123',
    data: { participant_uuid: id, chunk: 'AID/fw==', timestamp_ms: 1000, sample_rate: 16000 },
  });
  const received = once(ws, 'pong');
  ws.send(JSON.stringify(packet('device/one')));
  ws.send(JSON.stringify(packet('device/two')));
  ws.ping();
  await received;
  const response = await route.fetch(
    new Request('http://local/api/dsh-live-voice/attendee?cursor=0', {
      headers: { 'x-dlv-attendee-owner': lease.owner },
    }),
  );
  const result = await response.json();
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.value.events.map((event) => event.participantId),
    ['device/one', 'device/two'],
  );
  assert.equal(result.value.events[0].chunk, 'AID/fw==');
  const closed = once(ws, 'close');
  ws.send(JSON.stringify({ ...packet('device/one'), bot_id: 'bot_Other' }));
  await closed;
  const failure = await route.fetch(
    new Request('http://local/api/dsh-live-voice/attendee?cursor=0', {
      headers: { 'x-dlv-attendee-owner': lease.owner },
    }),
  );
  assert.equal((await failure.json()).value.error, 'invalid-audio');
  await request({ action: 'close', owner: lease.owner });
  const revoked = await route.fetch(
    new Request('http://local/api/dsh-live-voice/attendee', {
      headers: { 'x-dlv-attendee-owner': lease.owner },
    }),
  );
  assert.equal(revoked.status, 403);
});

test(
  'real WSS validates certificate trust before accepting participant PCM',
  { timeout: 10000 },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'dlv-attendee-tls-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const keyPath = join(directory, 'test.key'),
      certPath = join(directory, 'test.crt');
    try {
      execFileSync(
        'openssl',
        [
          'req',
          '-x509',
          '-newkey',
          'rsa:2048',
          '-nodes',
          '-keyout',
          keyPath,
          '-out',
          certPath,
          '-days',
          '1',
          '-subj',
          '/CN=localhost',
          '-addext',
          'subjectAltName=IP:127.0.0.1,DNS:localhost',
        ],
        { stdio: 'ignore', timeout: 5000 },
      );
    } catch (error) {
      if (error.code === 'ENOENT') {
        t.skip('OpenSSL is unavailable for the temporary TLS test certificate');
        return;
      }
      throw error;
    }
    const cert = await readFile(certPath),
      key = await readFile(keyPath);
    const server = createTlsServer({ cert, key }),
      sockets = new Set();
    let route, upgrade, cleanup;
    t.after(async () => {
      await cleanup?.();
      for (const socket of sockets) socket.destroy();
      if (server.listening) await new Promise((resolve) => server.close(resolve));
    });
    server.on('connection', (socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
    server.on('upgrade', (req, socket, head) => upgrade.handler(req, socket, head));
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    registerAttendeeRoutes({
      connection: {
        fetch: {
          register: (r) => {
            route = r;
            return () => {};
          },
        },
      },
      webServer: {
        registerUpgrade: (r) => {
          upgrade = r;
          return () => {};
        },
      },
      effect: (f) => (cleanup = f()),
    });
    const post = async (payload) => {
      const r = await route.fetch(
        new Request('http://local/api/dsh-live-voice/attendee', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      );
      const j = await r.json();
      assert.equal(j.ok, true);
      return j.value;
    };
    const lease = await post({
      action: 'open',
      apiUrl: 'http://localhost:8000',
      apiKey: 'test-only-api-key',
      ingressUrl:
        'wss://127.0.0.1:' + server.address().port + '/api/dsh-live-voice/attendee/ingest',
    });
    const untrusted = new WebSocket(lease.ingestUrl);
    const rejected = await new Promise((resolve) => {
      untrusted.once('error', resolve);
      untrusted.once('open', () => resolve(null));
    });
    assert.ok(rejected, 'An untrusted certificate must not connect');
    assert.match(rejected.code, /CERT|SELF_SIGNED|UNABLE_TO_VERIFY/);
    untrusted.terminate();
    // Explicit test-local trust; never rejectUnauthorized:false or global CA changes.
    const trusted = new WebSocket(lease.ingestUrl, { ca: cert });
    trusted.on('error', () => {});
    await once(trusted, 'open');
    assert.equal(trusted._socket.authorized, true);
    const acknowledged = once(trusted, 'pong');
    trusted.send(
      JSON.stringify({
        trigger: 'realtime_audio.per_participant',
        bot_id: 'bot_Tls123',
        data: {
          participant_uuid: 'device/tls',
          chunk: 'AAAAAA==',
          timestamp_ms: 1000,
          sample_rate: 16000,
        },
      }),
    );
    trusted.ping();
    await acknowledged;
    const r = await route.fetch(
      new Request('http://local/api/dsh-live-voice/attendee?cursor=0', {
        headers: { 'x-dlv-attendee-owner': lease.owner },
      }),
    );
    const batch = await r.json();
    assert.equal(batch.value.events[0].participantId, 'device/tls');
    const closed = once(trusted, 'close');
    await post({ action: 'close', owner: lease.owner });
    await closed;
  },
);

test(
  'host relay uses only local certificate trust and delivers validated audio without an exposed DSH listener',
  { timeout: 10000 },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'dlv-relay-tls-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const keyPath = join(directory, 'test.key'),
      certPath = join(directory, 'test.crt');
    try {
      execFileSync(
        'openssl',
        [
          'req',
          '-x509',
          '-newkey',
          'rsa:2048',
          '-nodes',
          '-keyout',
          keyPath,
          '-out',
          certPath,
          '-days',
          '1',
          '-subj',
          '/CN=localhost',
          '-addext',
          'subjectAltName=IP:127.0.0.1,DNS:localhost',
        ],
        { stdio: 'ignore', timeout: 5000 },
      );
    } catch (error) {
      if (error.code === 'ENOENT') {
        t.skip('OpenSSL unavailable');
        return;
      }
      throw error;
    }
    const cert = await readFile(certPath, 'utf8'),
      key = await readFile(keyPath);
    const https = createTlsServer({ cert, key });
    const server = new WebSocketServer({ server: https, perMessageDeflate: false });
    t.after(async () => {
      for (const ws of server.clients) ws.terminate();
      server.close();
      await new Promise((resolve) => https.close(resolve));
    });
    await new Promise((resolve) => https.listen(0, '127.0.0.1', resolve));
    let peer;
    server.on('connection', (ws, req) => {
      peer = ws;
      assert.equal(req.url, '/v1/receive');
      assert.equal(req.headers.authorization, 'Token test-only-key');
      ws.send(
        JSON.stringify({
          type: 'ready',
          ingestUrl: 'wss://dsh-audio-bridge:18765/ingest?token=' + 'a'.repeat(64),
        }),
      );
    });
    const hub = new AttendeeHub(),
      session = hub.open(),
      abort = new AbortController();
    t.after(() => {
      abort.abort();
      hub.close();
    });
    const fetcher = async (url, options) => {
      assert.equal(url, 'http://127.0.0.1:18766/v1/descriptor');
      assert.equal(options.redirect, 'error');
      return Response.json({ protocol: 'dsh-attendee-relay-v1', certificate: cert });
    };
    const RoutedWebSocket = class extends WebSocket {
      constructor(url, options) {
        assert.equal(url, 'wss://127.0.0.1:18765/v1/receive');
        assert.equal(options.rejectUnauthorized, true);
        super('wss://127.0.0.1:' + https.address().port + '/v1/receive', options);
      }
    };
    const ingest = await connectAttendeeRelay(
      'test-only-key',
      hub,
      session,
      async () => ({ WebSocket: RoutedWebSocket }),
      fetcher,
      abort,
    );
    assert.equal(new URL(ingest).hostname, 'dsh-audio-bridge');
    peer.send(
      JSON.stringify({
        trigger: 'realtime_audio.per_participant',
        bot_id: 'bot_Relay',
        data: {
          participant_uuid: 'device/relay',
          chunk: 'AAAAAA==',
          timestamp_ms: 1000,
          sample_rate: 16000,
        },
      }),
    );
    await once(session.socket, 'message');
    assert.equal(hub.read(0).events[0].participantId, 'device/relay');
    const closed = once(peer, 'close');
    abort.abort();
    await closed;
  },
);
