// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { AttendeeClient } from '../src/modules/conversation/models/AttendeeClient.js';
const config = {
  apiUrl: 'http://localhost:8000',
  ingressUrl: 'wss://fixture/api/dsh-live-voice/attendee/ingest',
  relayUrl: 'ws://localhost:18766/events',
  apiKey: 'must-never-forward',
  botId: 'bot_MustNotAttach',
};
const url = 'https://meet.google.com/abc-defg-hij';
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
function fixture(
  reply = () => ({ owner: 'synthetic-owner', hasBotControl: true, ingestUrl: config.ingressUrl }),
) {
  const calls = [];
  const client = new AttendeeClient(
    { transcript: { forget() {} }, removeParticipant: async () => {} },
    () => {},
    (key) => key,
    async (_url, options) => {
      const input = JSON.parse(options.body);
      calls.push(input);
      const result = await reply(input);
      return Response.json(
        result?.ok === false
          ? result
          : {
              ok: true,
              value:
                input.action === 'join' ? { botId: 'bot_Synthetic', hasBotControl: true } : result,
            },
      );
    },
  );
  client.poll = async () => {};
  client.watchControl = () => {};
  return { client, calls };
}
test('one click opens with saved-key-only whitelist then joins validated URL and configured default name', async () => {
  const { client, calls } = fixture();
  await client.connectMeeting(url + '?authuser=1#ignored', '  Default helper  ', config);
  assert.deepEqual(
    calls.map((c) => c.action),
    ['open', 'join'],
  );
  assert.deepEqual(calls[0], {
    action: 'open',
    apiUrl: config.apiUrl,
    ingressUrl: config.ingressUrl,
    relayUrl: config.relayUrl,
    verify: true,
  });
  assert.equal(calls[1].meetingUrl, url);
  assert.equal(calls[1].botName, 'Default helper');
  assert.equal(client.getSnapshot().botId, 'bot_Synthetic');
});
test('already active receiver is reused only for its exact API origin', async () => {
  const { client, calls } = fixture();
  await client.start({ apiUrl: config.apiUrl });
  calls.length = 0;
  await client.connectMeeting(url, 'Default helper', {
    ...config,
    apiUrl: 'http://localhost:8001',
  });
  assert.equal(calls.length, 0);
  assert.equal(client.getSnapshot().error, 'joinFailed');
  await client.connectMeeting(url, 'Default helper', config);
  assert.deepEqual(
    calls.map((c) => c.action),
    ['join'],
  );
});
test('invalid meeting URL name or API origin fails before any network operation', async () => {
  const { client, calls } = fixture();
  for (const invalid of [
    'http://meet.google.com/abc-defg-hij',
    'https://meet.google.com.evil/abc-defg-hij',
    'https://user@meet.google.com/abc-defg-hij',
    'https://meet.google.com:8443/abc-defg-hij',
    'https://meet.google.com/bad',
  ])
    await client.connectMeeting(invalid, 'Helper', config);
  for (const invalid of ['', 'x'.repeat(81), 'bad' + String.fromCharCode(10) + 'name'])
    await client.connectMeeting(url, invalid, config);
  assert.equal(client.getSnapshot().error, 'invalidMeeting');
  await client.connectMeeting(url, 'Helper', { ...config, apiUrl: 'https://public.example' });
  assert.equal(calls.length, 0);
});
for (const code of ['credential-missing', 'credential-storage-unavailable', 'failed'])
  test('failed receiver preparation never joins: ' + code, async () => {
    const { client, calls } = fixture(() => ({ ok: false, error: { code } }));
    await client.connectMeeting(url, 'Helper', config);
    assert.deepEqual(
      calls.map((c) => c.action),
      ['open'],
    );
    assert.equal(client.getSnapshot().active, false);
    assert.ok(client.getSnapshot().error);
  });
test('duplicate click creates only one receiver and one bot while receiver or join is pending', async () => {
  const open = deferred(),
    join = deferred();
  const { client, calls } = fixture((input) =>
    input.action === 'open' ? open.promise : join.promise,
  );
  const first = client.connectMeeting(url, 'Helper', config);
  await client.connectMeeting(url, 'Helper', config);
  open.resolve({ owner: 'owner', hasBotControl: true });
  for (let n = 0; n < 12; n++) await Promise.resolve();
  await client.connectMeeting(url, 'Helper', config);
  join.resolve({ botId: 'bot_Synthetic', hasBotControl: true });
  await first;
  assert.deepEqual(
    calls.map((c) => c.action),
    ['open', 'join'],
  );
});
test('stop or dispose during receiver preparation prevents a late join and releases the obsolete receiver', async () => {
  for (const action of ['stop', 'dispose']) {
    const open = deferred();
    const { client, calls } = fixture((input) => (input.action === 'open' ? open.promise : {}));
    const connecting = client.connectMeeting(url, 'Helper', config);
    for (let n = 0; n < 12; n++) await Promise.resolve();
    await client[action]();
    open.resolve({ owner: 'obsolete-owner', hasBotControl: true });
    await connecting;
    assert.equal(calls.filter((c) => c.action === 'join').length, 0);
    assert.equal(calls.filter((c) => ['close', 'release'].includes(c.action)).length, 1);
  }
});
test('unresolved remote bot or control is never replaced by a new meeting and fails visibly', async () => {
  for (const state of [
    { botId: 'bot_Existing' },
    { joinUncertain: true },
    { joining: true },
    { leaving: true },
    { leaveRequested: true },
    { controlError: 'control-unknown', hasBotControl: true },
    { hasBotControl: true },
  ]) {
    const { client, calls } = fixture();
    client.patch(state);
    await client.connectMeeting(url, 'Helper', config);
    assert.equal(calls.length, 0);
    assert.equal(client.getSnapshot().error, 'joinFailed');
  }
});
