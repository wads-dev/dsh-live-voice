// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
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
import { AttendeeClient } from '../src/modules/conversation/models/AttendeeClient.js';
const root = 'http://fixture/api/dsh-live-voice/attendee';
const settle = () => new Promise((r) => setImmediate(r));
async function fixture(
  api = async (url) =>
    Response.json(
      url.endsWith('/bots')
        ? { id: 'bot_Test', state: 'joining' }
        : url.endsWith('/leave')
          ? { id: 'bot_Test', state: 'leaving' }
          : { next: null, previous: null, results: [] },
    ),
) {
  let route, cleanup, upgrade;
  const calls = [];
  registerAttendeeRoutes(
    {
      connection: {
        fetch: {
          register(r) {
            route = r;
            return () => {};
          },
        },
      },
      webServer: {
        getOrigin: () => 'https://fixture',
        registerUpgrade: (r) => {
          upgrade = r;
          return () => {};
        },
      },
      effect: (f) => {
        cleanup = f();
      },
    },
    async () => ({
      WebSocketServer: class {
        handleUpgrade(_req, _socket, _head, callback) {
          callback(_socket);
        }
        close() {}
      },
    }),
    async (url, options) => {
      calls.push({ url, options });
      return api(url, options);
    },
  );
  const fetcher = (url, options) => route.fetch(new Request(new URL(url, root), options));
  const post = async (p) =>
    (await fetcher(root, { method: 'POST', body: JSON.stringify(p) })).json();
  const open = await post({
    action: 'open',
    apiUrl: 'http://localhost:8000',
    apiKey: 'fixture-key',
  });
  assert.equal(open.ok, true);
  const owner = open.value.owner;
  const control = async (token = owner) =>
    (
      await fetcher(root + '?action=control', { headers: { 'x-dlv-attendee-owner': token } })
    ).json();
  const join = () =>
    post({
      action: 'join',
      owner,
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      botName: 'Test',
    });
  const ingest = (value) => {
    const handlers = new Map();
    const socket = {
      on: (name, handler) => handlers.set(name, handler),
      close() {},
      end() {
        throw Error('rejected');
      },
    };
    upgrade.handler({ url: open.value.ingestUrl, headers: {} }, socket, Buffer.alloc(0));
    handlers.get('message')(Buffer.from(JSON.stringify(value)), false);
  };
  return { calls, fetcher, post, owner, control, join, cleanup, open, ingest };
}
test('bot control survives receiver close; leave failure retains owner and retry; accepted leave is not ended', async () => {
  let leaves = 0;
  const f = await fixture(async (url) => {
    if (url.endsWith('/bots')) return Response.json({ id: 'bot_Test', state: 'joining' });
    if (url.endsWith('/leave')) {
      if (++leaves === 1) throw Error('unavailable');
      return Response.json({ id: 'bot_Test', state: 'leaving' });
    }
    return Response.json({ next: null, previous: null, results: [] });
  });
  try {
    await f.join();
    const close = await f.post({ action: 'close', owner: f.owner });
    assert.equal(close.value.hasBotControl, true);
    assert.equal(close.value.botId, 'bot_Test');
    assert.equal(leaves, 0);
    assert.equal((await f.control('bad')).error.code, 'ownership');
    assert.equal((await f.post({ action: 'open' })).error.code, 'busy');
    assert.equal((await f.post({ action: 'join', owner: f.owner })).error.code, 'busy');
    assert.equal((await f.post({ action: 'leave', owner: f.owner })).ok, false);
    assert.equal((await f.control()).value.controlError, 'leave-failed');
    const left = await f.post({ action: 'leave', owner: f.owner });
    assert.equal(left.value.botState, 'leaving');
    assert.equal(left.value.leaveRequested, true);
    assert.equal(left.value.hasBotControl, true);
    await f.post({ action: 'release', owner: f.owner });
    assert.equal((await f.control()).ok, false);
    assert.equal(leaves, 2);
  } finally {
    await f.cleanup();
  }
});
test('late create after receiver stop retains identity; duplicate creates remain locked', async () => {
  let resolveCreate;
  const f = await fixture(async (url) =>
    url.endsWith('/bots')
      ? new Promise((r) => {
          resolveCreate = r;
        })
      : Response.json({ next: null, previous: null, results: [] }),
  );
  try {
    const joining = f.join();
    await settle();
    await f.post({ action: 'close', owner: f.owner });
    assert.equal((await f.control()).value.joining, true);
    resolveCreate(Response.json({ id: 'bot_Late', state: 'joining' }));
    assert.equal((await joining).value.botId, 'bot_Late');
    assert.equal((await f.control()).value.botId, 'bot_Late');
    assert.equal((await f.post({ action: 'open' })).error.code, 'busy');
    assert.equal(f.calls.filter((c) => c.url.endsWith('/bots')).length, 1);
  } finally {
    await f.cleanup();
  }
});
test('unknown creation is retained until explicit discard without implicit leave', async () => {
  const f = await fixture(async () => {
    throw Error('timeout');
  });
  try {
    assert.equal((await f.join()).error.code, 'join-uncertain');
    await f.post({ action: 'close', owner: f.owner });
    const state = (await f.control()).value;
    assert.equal(state.hasBotControl, true);
    assert.equal(state.joinUncertain, true);
    assert.equal(state.controlError, 'control-unknown');
    await f.post({ action: 'release', owner: f.owner });
    assert.equal(f.calls.length, 1);
  } finally {
    await f.cleanup();
  }
});
test('control lease expires after five idle minutes and has a two hour absolute cap despite heartbeats', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 1000000 });
  const f = await fixture();
  try {
    await f.join();
    await f.post({ action: 'close', owner: f.owner });
    assert.equal((await f.control()).value.controlExpiresAt, 1300000);
    t.mock.timers.tick(300000);
    assert.equal((await f.control()).ok, false);
    assert.equal(
      f.calls.some((c) => c.url.endsWith('/leave')),
      false,
    );
  } finally {
    await f.cleanup();
  }
  const g = await fixture();
  try {
    await g.join();
    await g.post({ action: 'close', owner: g.owner });
    const cap = Date.now() + 7200000;
    for (let i = 0; i < 35; i++) {
      t.mock.timers.tick(200000);
      assert.equal((await g.control()).ok, true);
    }
    assert.equal((await g.control()).value.controlExpiresAt, cap);
    t.mock.timers.tick(200000);
    assert.equal((await g.control()).ok, false);
  } finally {
    await g.cleanup();
  }
});
test('release aborts in-flight create and final host cleanup never sends leave', async () => {
  let signal;
  const f = await fixture(async (_url, options) => {
    signal = options.signal;
    return new Promise((_, reject) =>
      signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
    );
  });
  const pending = f.join();
  await settle();
  await f.post({ action: 'release', owner: f.owner });
  assert.equal(signal.aborted, true);
  assert.equal((await pending).error.code, 'join-uncertain');
  await f.cleanup();
  assert.equal(f.calls.length, 1);
});
function clientFor(f) {
  const removed = [];
  const client = new AttendeeClient(
    { transcript: { forget() {} }, removeParticipant: async (s) => removed.push(s) },
    () => {},
    (k) => k,
    f.fetcher,
  );
  client.owner = f.owner;
  client.applyControl(f.open.value);
  return { client, removed };
}
test('client receiver failure cleans sources and keeps explicit leave/retry after navigation stop', async () => {
  const f = await fixture();
  const { client, removed } = clientFor(f);
  try {
    await client.join('https://meet.google.com/abc-defg-hij', 'Test');
    client.rows.set('attendee:old', {});
    client.rows.get('attendee:old').source = 'attendee:old';
    client.abort = new AbortController();
    client.fetcher = async (url, options) =>
      url.includes('?cursor=')
        ? Response.json({ ok: true, value: { error: 'participants', botId: 'bot_Test' } })
        : f.fetcher(url, options);
    await client.poll(client.generation);
    assert.deepEqual(removed, ['attendee:old']);
    assert.equal(client.getSnapshot().active, false);
    assert.equal(client.getSnapshot().hasBotControl, true);
    assert.equal(client.getSnapshot().botId, 'bot_Test');
    await client.stop();
    await client.leave();
    assert.equal(client.getSnapshot().botState, 'leaving');
    assert.equal(client.getSnapshot().hasBotControl, true);
    assert.equal(f.calls.filter((c) => c.url.endsWith('/leave')).length, 1);
    await client.releaseControl();
    assert.equal(client.getSnapshot().hasBotControl, false);
    assert.equal(client.getSnapshot().controlError, 'control-released');
    assert.equal(client.getSnapshot().botId, 'bot_Test');
  } finally {
    await client.dispose();
    await f.cleanup();
  }
});
test('client late join ignores audio generation changes, while final dispose is idempotent and preserves unknown warning', async () => {
  let finish;
  const f = await fixture(async (url) =>
    url.endsWith('/bots')
      ? new Promise((r) => {
          finish = r;
        })
      : Response.json({}),
  );
  const { client } = clientFor(f);
  try {
    const joining = client.join('https://meet.google.com/abc-defg-hij', 'Test');
    await settle();
    await client.stop();
    finish(Response.json({ id: 'bot_Late', state: 'joining' }));
    await joining;
    assert.equal(client.getSnapshot().botId, 'bot_Late');
    const disposing = client.dispose();
    assert.equal(client.dispose(), disposing);
    await disposing;
    assert.equal(client.getSnapshot().hasBotControl, false);
    assert.equal(client.getSnapshot().controlError, 'control-released');
    assert.equal(
      f.calls.some((c) => c.url.endsWith('/leave')),
      false,
    );
  } finally {
    await f.cleanup();
  }
});
test('stale heartbeat cannot overwrite a completed leave or restore discarded control', async () => {
  const f = await fixture();
  const { client } = clientFor(f);
  let heartbeat;
  const original = client.fetcher;
  try {
    await client.join('https://meet.google.com/abc-defg-hij', 'Test');
    client.fetcher = async (url, options) =>
      url.includes('?action=control')
        ? new Promise((r) => {
            heartbeat = r;
          })
        : original(url, options);
    const pending = client.refreshControl();
    await settle();
    await client.leave();
    heartbeat(
      Response.json({
        ok: true,
        value: { ...f.open.value, botId: 'bot_Test', botState: 'joining' },
      }),
    );
    await pending;
    assert.equal(client.getSnapshot().botState, 'leaving');
    const second = client.refreshControl();
    await settle();
    await client.releaseControl();
    heartbeat(Response.json({ ok: true, value: { ...f.open.value, botId: 'bot_Test' } }));
    await second;
    assert.equal(client.getSnapshot().hasBotControl, false);
    assert.equal(client.getSnapshot().controlError, 'control-released');
  } finally {
    await client.dispose();
    await f.cleanup();
  }
});
test('client leave failure conserves retry; heartbeat expiry keeps last known identity as unavailable', async (t) => {
  let leaves = 0;
  const f = await fixture(async (url) => {
    if (url.endsWith('/bots')) return Response.json({ id: 'bot_Test', state: 'joining' });
    if (url.endsWith('/leave')) {
      if (++leaves === 1) throw Error('offline');
      return Response.json({ id: 'bot_Test', state: 'leaving' });
    }
    return Response.json({ next: null, previous: null, results: [] });
  });
  const { client } = clientFor(f);
  try {
    await client.join('https://meet.google.com/abc-defg-hij', 'Test');
    await client.leave();
    assert.equal(client.getSnapshot().controlError, 'leave-failed');
    assert.equal(client.getSnapshot().hasBotControl, true);
    await client.leave();
    assert.equal(client.getSnapshot().botState, 'leaving');
    t.mock.timers.enable({ apis: ['Date'], now: client.getSnapshot().controlExpiresAt });
    await client.refreshControl();
    assert.equal(client.getSnapshot().hasBotControl, false);
    assert.equal(client.getSnapshot().botId, 'bot_Test');
    assert.equal(client.getSnapshot().controlError, 'control-expired');
    client.patch({ joining: true, joinUncertain: true });
    await client.releaseControl();
    assert.equal(client.getSnapshot().joining, false);
    assert.equal(client.getSnapshot().joinUncertain, false);
  } finally {
    await client.dispose();
    await f.cleanup();
  }
});
test('heartbeat renews controls every ten seconds without restarting audio or issuing leave', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  let reads = 0;
  const client = new AttendeeClient(
    { transcript: { forget() {} }, removeParticipant: async () => {} },
    () => {},
    (k) => k,
    async (_url, options) => {
      if (options?.method === 'POST')
        return Response.json({ ok: true, value: { hasBotControl: true, botId: 'bot_Test' } });
      reads++;
      return Response.json({
        ok: true,
        value: { hasBotControl: true, botId: 'bot_Test', controlExpiresAt: Date.now() + 300000 },
      });
    },
  );
  client.owner = 'fixture-owner';
  client.patch({ hasBotControl: true, botId: 'bot_Test' });
  client.watchControl();
  t.mock.timers.tick(10000);
  await settle();
  assert.equal(reads, 1);
  assert.equal(client.getSnapshot().active, false);
  t.mock.timers.tick(10000);
  await settle();
  assert.equal(reads, 2);
  await client.dispose();
  t.mock.timers.tick(10000);
  assert.equal(reads, 2);
});
test('obsolete advanced open releases its retained bot capability without silently declaring departure', async () => {
  let resolveOpen;
  const actions = [];
  const client = new AttendeeClient(
    { transcript: { forget() {} }, removeParticipant: async () => {} },
    () => {},
    (k) => k,
    async (_url, options) => {
      const p = JSON.parse(options.body);
      actions.push(p.action);
      if (p.action === 'open')
        return new Promise((r) => {
          resolveOpen = r;
        });
      return Response.json({ ok: true, value: {} });
    },
  );
  const opening = client.start({ botId: 'bot_Existing' });
  await settle();
  await client.stop();
  resolveOpen(
    Response.json({
      ok: true,
      value: { owner: 'old', botId: 'bot_Existing', hasBotControl: true },
    }),
  );
  await opening;
  assert.deepEqual(actions, ['open', 'release']);
  assert.equal(client.getSnapshot().hasBotControl, false);
  assert.equal(client.getSnapshot().botId, 'bot_Existing');
  assert.equal(client.getSnapshot().controlError, 'control-released');
  await client.dispose();
});
test('unresolved control rejects replacement open as an explicit conflict', async () => {
  const f = await fixture();
  try {
    await f.join();
    await f.post({ action: 'close', owner: f.owner });
    const r = await f.fetcher(root, { method: 'POST', body: JSON.stringify({ action: 'open' }) });
    assert.equal(r.status, 409);
    assert.equal((await r.json()).error.code, 'busy');
  } finally {
    await f.cleanup();
  }
});
test('expired cached idle timestamp asks the authoritative host before surrendering valid control', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 1000000 });
  const f = await fixture();
  const { client } = clientFor(f);
  try {
    await client.join('https://meet.google.com/abc-defg-hij', 'Test');
    await client.stop();
    const cachedExpiry = client.getSnapshot().controlExpiresAt;
    t.mock.timers.tick(200000);
    await f.control();
    t.mock.timers.tick(cachedExpiry - Date.now());
    await client.refreshControl();
    assert.equal(client.getSnapshot().hasBotControl, true);
    assert.equal(client.getSnapshot().botId, 'bot_Test');
    assert.ok(client.getSnapshot().controlExpiresAt > cachedExpiry);
    assert.equal(client.getSnapshot().active, false);
  } finally {
    await client.dispose();
    await f.cleanup();
  }
});
test('dispose during accepted leave teardown never republishes an available bot control', async () => {
  const f = await fixture();
  const { client } = clientFor(f);
  let releaseTeardown;
  const states = [];
  try {
    await client.join('https://meet.google.com/abc-defg-hij', 'Test');
    client.rows.set('attendee:old', { source: 'attendee:old' });
    client.meeting.removeParticipant = () =>
      new Promise((r) => {
        releaseTeardown = r;
      });
    const left = client.leave();
    await settle();
    assert.ok(releaseTeardown);
    client.subscribe(() => states.push(client.getSnapshot()));
    const disposing = client.dispose();
    releaseTeardown();
    await Promise.all([left, disposing]);
    assert.equal(client.getSnapshot().hasBotControl, false);
    assert.equal(
      states.some((s) => s.leaveRequested === true && s.hasBotControl === true),
      false,
    );
  } finally {
    await client.dispose();
    await f.cleanup();
  }
});
test('audio idle cleanup retains ingress-discovered bot identity without inventing upstream state', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 1000000 });
  const f = await fixture();
  try {
    f.ingest({
      trigger: 'realtime_audio.per_participant',
      bot_id: 'bot_FromPcm',
      data: {
        participant_uuid: 'device/one',
        chunk: 'AID/fw==',
        sample_rate: 16000,
        timestamp_ms: 1000,
      },
    });
    t.mock.timers.tick(16000);
    await settle();
    const state = (await f.control()).value;
    assert.equal(state.hasBotControl, true);
    assert.equal(state.botId, 'bot_FromPcm');
    assert.equal(state.botState, '');
    const audio = await f.fetcher(root, { headers: { 'x-dlv-attendee-owner': f.owner } });
    assert.equal(audio.status, 403);
    const leave = await f.post({ action: 'leave', owner: f.owner });
    assert.equal(leave.value.leaveRequested, true);
    assert.ok(f.calls.some((c) => c.url.endsWith('/bot_FromPcm/leave')));
  } finally {
    await f.cleanup();
  }
});
