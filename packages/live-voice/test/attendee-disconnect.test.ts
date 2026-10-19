// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerAttendeeRoutes } from '../src/app/server/attendeeRoutes.js';
import { AttendeeClient } from '../src/modules/conversation/models/AttendeeClient.js';
const defer = () => {
  let resolve, reject;
  const promise = new Promise((r, f) => {
    resolve = r;
    reject = f;
  });
  return { promise, resolve, reject };
};
const flush = async () => {
  for (let n = 0; n < 18; n++) await Promise.resolve();
};
const root = 'https://fixture/api/dsh-live-voice/attendee';
function host(
  api = async (url) =>
    Response.json(
      url.endsWith('/bots')
        ? { id: 'bot_Test', state: 'joining' }
        : url.endsWith('/leave')
          ? { state: 'leaving' }
          : { results: [], next: null, previous: null },
    ),
) {
  let route, cleanup;
  const calls = [],
    keys = new Map([['http://localhost:8000', 'synthetic-key-only']]);
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
      webServer: { getOrigin: () => 'https://fixture', registerUpgrade: () => () => {} },
      effect(f) {
        cleanup = f();
      },
    },
    async () => ({
      WebSocketServer: class {
        close() {}
      },
    }),
    async (url, options) => {
      calls.push({ url, options });
      return api(url, options);
    },
    {
      get: async (origin) => keys.get(origin),
      metadata: async (origin) => ({ hasSavedKey: keys.has(origin) }),
      save: async (origin, key) => {
        keys.set(origin, key);
        return { hasSavedKey: true };
      },
      remove: async () => {
        throw Error('must not erase saved keys');
      },
    },
  );
  const post = async (value) =>
    (await route.fetch(new Request(root, { method: 'POST', body: JSON.stringify(value) }))).json();
  return { post, cleanup, calls, keys };
}
function client(reply = async () => ({ disconnected: true })) {
  const calls = [],
    removed = [];
  const c = new AttendeeClient(
    { transcript: { forget() {} }, removeParticipant: async (s) => removed.push(s) },
    () => {},
    (key) => key,
    async (_url, options) => {
      const input = JSON.parse(options.body);
      calls.push(input);
      return Response.json({ ok: true, value: await reply(input) });
    },
  );
  c.poll = async () => {};
  c.watchControl = () => {};
  c.owner = 'old-owner';
  c.receiverApiOrigin = 'http://localhost:8000';
  c.patch({
    active: true,
    hasBotControl: true,
    botId: 'bot_Test',
    botState: 'joined_recording',
    joining: false,
    joinUncertain: true,
    leaving: true,
    leaveRequested: true,
    controlError: 'control-released',
    participants: [{ source: 'synthetic' }],
  });
  c.rows.set('synthetic', { source: 'synthetic' });
  return { c, calls, removed };
}
function idle(s) {
  assert.equal(s.active, false);
  assert.equal(s.starting, false);
  assert.equal(s.botId, '');
  assert.equal(s.botState, '');
  assert.equal(s.hasBotControl, false);
  assert.equal(s.joining, false);
  assert.equal(s.joinUncertain, false);
  assert.equal(s.leaving, false);
  assert.equal(s.leaveRequested, false);
  assert.equal(s.controlError, null);
  assert.deepEqual(s.participants, []);
}
test('host disconnect leaves known bot once then releases the old lease even after remote failure; keys survive and new open works', async () => {
  for (const failed of [false, true]) {
    const f = host(async (url) => {
      if (url.endsWith('/leave')) {
        if (failed) throw Error('private upstream details');
        return Response.json({ state: 'leaving' });
      }
      return Response.json(
        url.endsWith('/bots')
          ? { id: 'bot_Test', state: 'joining' }
          : { results: [], next: null, previous: null },
      );
    });
    try {
      const opened = await f.post({ action: 'open', apiUrl: 'http://localhost:8000' }),
        owner = opened.value.owner;
      await f.post({
        action: 'join',
        owner,
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
        botName: 'Synthetic helper',
      });
      const result = await f.post({ action: 'disconnect', owner });
      assert.equal(result.ok, true);
      assert.equal(result.value.disconnected, true);
      assert.equal(result.value.leaveRequested, !failed);
      assert.equal(result.value.warning, failed ? 'leave-failed' : null);
      assert.equal(f.calls.filter((x) => x.url.endsWith('/leave')).length, 1);
      assert.equal((await f.post({ action: 'open', apiUrl: 'http://localhost:8000' })).ok, true);
      assert.equal(f.keys.size, 1);
      assert.equal(JSON.stringify(result).includes('private'), false);
    } finally {
      await f.cleanup();
    }
  }
});
test('client immediately resets PCM ownership and every meeting flag without confirmation or a tombstone', async () => {
  const remote = defer(),
    f = client(() => remote.promise);
  const pending = f.c.disconnectMeeting();
  idle(f.c.getSnapshot());
  assert.equal(f.c.owner, null);
  assert.equal(f.c.rows.size, 0);
  assert.deepEqual(f.removed, ['synthetic']);
  assert.deepEqual(f.calls, [{ action: 'disconnect', owner: 'old-owner' }]);
  assert.equal(f.c.disconnectMeeting(), pending);
  remote.resolve({ warning: 'leave-failed' });
  await pending;
  idle(f.c.getSnapshot());
  assert.equal(f.c.getSnapshot().error, 'disconnectUnconfirmed');
});
test('legacy released or expired state without an owner resets locally without any network request', async () => {
  for (const error of ['control-released', 'control-expired', 'control-unknown']) {
    const f = client();
    f.c.owner = null;
    f.c.patch({ controlError: error });
    await f.c.disconnectMeeting();
    idle(f.c.getSnapshot());
    assert.equal(f.calls.length, 0);
  }
});
test('bounded host leave ignores a hanging fetch and late completion cannot clear a fresh owner', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const leave = defer();
  const f = host(async (url) =>
    url.endsWith('/leave')
      ? leave.promise
      : Response.json({ results: [], next: null, previous: null }),
  );
  try {
    const opened = await f.post({
      action: 'open',
      apiUrl: 'http://localhost:8000',
      botId: 'bot_Test',
    });
    const pending = f.post({ action: 'disconnect', owner: opened.value.owner });
    await flush();
    t.mock.timers.tick(3001);
    await flush();
    const disconnected = await pending;
    assert.equal(disconnected.value.warning, 'leave-failed');
    const fresh = await f.post({ action: 'open', apiUrl: 'http://localhost:8000' });
    assert.equal(fresh.ok, true);
    leave.resolve(Response.json({ state: 'leaving' }));
    await flush();
    assert.equal((await f.post({ action: 'release', owner: fresh.value.owner })).ok, true);
  } finally {
    await f.cleanup();
    t.mock.timers.reset();
  }
});
test('pending join obtains a known bot ID within the disconnect budget and requests leave exactly once', async () => {
  const creation = defer(),
    f = host(async (url) =>
      url.endsWith('/bots') ? creation.promise : Response.json({ state: 'leaving' }),
    );
  try {
    const opened = await f.post({ action: 'open', apiUrl: 'http://localhost:8000' }),
      owner = opened.value.owner;
    const joining = f.post({
      action: 'join',
      owner,
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      botName: 'Synthetic helper',
    });
    await flush();
    const disconnect = f.post({ action: 'disconnect', owner });
    await flush();
    creation.resolve(Response.json({ id: 'bot_Test', state: 'joining' }));
    await joining;
    const result = await disconnect;
    assert.equal(result.value.leaveRequested, true);
    assert.equal(f.calls.filter((x) => x.url.endsWith('/leave')).length, 1);
  } finally {
    await f.cleanup();
  }
});
test('explicit disconnect suppresses a late old open tombstone and old leave warnings cannot change a new owner', async () => {
  const open = defer();
  const f = client(async (input) => (input.action === 'open' ? open.promise : {}));
  f.c.owner = null;
  f.c.patch({
    hasBotControl: false,
    botId: '',
    joinUncertain: false,
    leaving: false,
    leaveRequested: false,
    controlError: null,
  });
  const starting = f.c.start({ apiUrl: 'http://localhost:8000' });
  await flush();
  await f.c.disconnectMeeting();
  open.resolve({ owner: 'obsolete-owner', hasBotControl: true, botId: 'bot_Obsolete' });
  await starting;
  idle(f.c.getSnapshot());
  const leave = defer(),
    g = client(() => leave.promise);
  const disconnect = g.c.disconnectMeeting();
  g.c.owner = 'new-owner';
  g.c.patch({ active: true, hasBotControl: true, botId: 'bot_New' });
  ++g.c.generation;
  leave.resolve({ warning: 'leave-failed' });
  await disconnect;
  assert.equal(g.c.owner, 'new-owner');
  assert.equal(g.c.getSnapshot().botId, 'bot_New');
  assert.equal(g.c.getSnapshot().error, null);
});
test('fresh guided connection waits for bounded disconnect release and can join again without erasing settings', async () => {
  const remote = defer();
  const f = client(async (input) =>
    input.action === 'disconnect'
      ? remote.promise
      : input.action === 'open'
        ? { owner: 'new-owner', hasBotControl: true }
        : { botId: 'bot_New', hasBotControl: true },
  );
  const disconnect = f.c.disconnectMeeting();
  const connecting = f.c.connectMeeting('https://meet.google.com/abc-defg-hij', 'Configured name', {
    apiUrl: 'http://localhost:8000',
  });
  await flush();
  assert.deepEqual(
    f.calls.map((x) => x.action),
    ['disconnect'],
  );
  remote.resolve({ disconnected: true });
  await Promise.all([disconnect, connecting]);
  assert.deepEqual(
    f.calls.map((x) => x.action),
    ['disconnect', 'open', 'join'],
  );
  assert.equal(f.c.getSnapshot().botId, 'bot_New');
});
test('a timed-out pending join cannot send leave after the budget or affect a replacement lease', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const creation = defer(),
    f = host(async (url) =>
      url.endsWith('/bots') ? creation.promise : Response.json({ state: 'leaving' }),
    );
  try {
    const opened = await f.post({ action: 'open', apiUrl: 'http://localhost:8000' }),
      owner = opened.value.owner;
    const joining = f.post({
      action: 'join',
      owner,
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      botName: 'Synthetic helper',
    });
    await flush();
    const disconnect = f.post({ action: 'disconnect', owner });
    await flush();
    t.mock.timers.tick(3001);
    await flush();
    assert.equal((await disconnect).value.warning, 'control-unknown');
    const fresh = await f.post({ action: 'open', apiUrl: 'http://localhost:8000' });
    assert.equal(fresh.ok, true);
    creation.resolve(Response.json({ id: 'bot_Obsolete', state: 'joining' }));
    await joining;
    await flush();
    assert.equal(f.calls.filter((x) => x.url.endsWith('/leave')).length, 0);
    assert.equal((await f.post({ action: 'release', owner: fresh.value.owner })).ok, true);
  } finally {
    await f.cleanup();
    t.mock.timers.reset();
  }
});
test('duplicate host disconnects share one leave and disposal cannot resurrect client meeting state', async () => {
  const leave = defer(),
    f = host(async (url) =>
      url.endsWith('/leave')
        ? leave.promise
        : Response.json({ results: [], next: null, previous: null }),
    );
  try {
    const opened = await f.post({
        action: 'open',
        apiUrl: 'http://localhost:8000',
        botId: 'bot_Test',
      }),
      owner = opened.value.owner;
    const first = f.post({ action: 'disconnect', owner }),
      second = f.post({ action: 'disconnect', owner });
    await flush();
    assert.equal(f.calls.filter((x) => x.url.endsWith('/leave')).length, 1);
    leave.resolve(Response.json({ state: 'leaving' }));
    assert.equal((await first).ok, true);
    assert.equal((await second).ok, true);
  } finally {
    await f.cleanup();
  }
  const remote = defer(),
    g = client(() => remote.promise);
  const disconnect = g.c.disconnectMeeting();
  const disposing = g.c.dispose();
  remote.resolve({ warning: 'leave-failed' });
  await Promise.all([disconnect, disposing]);
  idle(g.c.getSnapshot());
  assert.equal(g.c.getSnapshot().error, null);
});
test('an ownerless idle control-error warning does not block the visible URL form from reconnecting', async () => {
  for (const error of ['control-released', 'control-expired', 'control-unknown']) {
    const f = client(async (input) =>
      input.action === 'open'
        ? { owner: 'new-owner', hasBotControl: true }
        : { botId: 'bot_New', hasBotControl: true },
    );
    f.c.owner = null;
    f.c.patch({
      active: false,
      hasBotControl: false,
      botId: '',
      joining: false,
      joinUncertain: false,
      leaving: false,
      leaveRequested: false,
      controlError: error,
    });
    await f.c.connectMeeting('https://meet.google.com/abc-defg-hij', 'Configured name', {
      apiUrl: 'http://localhost:8000',
    });
    assert.deepEqual(
      f.calls.map((x) => x.action),
      ['open', 'join'],
    );
    assert.equal(f.c.getSnapshot().botId, 'bot_New');
  }
});
