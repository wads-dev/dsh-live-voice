// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { AttendeeHub } from '../src/modules/conversation/models/AttendeeHub.js';
import {
  attendeeAudio,
  decodeAttendeePcm,
} from '../src/modules/conversation/models/attendeeProtocol.js';
import { ParticipantPcmMeter } from '../src/modules/conversation/models/ParticipantPcmMeter.js';
import { AttendeeClient } from '../src/modules/conversation/models/AttendeeClient.js';
import { MeetingController } from '../src/modules/conversation/models/meeting.js';
import { defaultSettings, normalizeSettings } from '../src/modules/core/settings.js';
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
import {
  attendeeApiRequest,
  attendeeParticipantNames,
} from '../src/app/server/attendeeConnection.js';
import { WhisperHttpRecognitionEngine } from '../src/modules/recognition/engines/whisper/WhisperRecognitionEngine.js';
import { mockRecordingRepository } from './helpers/recording.js';
const packet = (uuid = 'device/1', bot = 'bot_123') => ({
  trigger: 'realtime_audio.per_participant',
  bot_id: bot,
  data: { participant_uuid: uuid, chunk: 'AID/fw==', sample_rate: 16000, timestamp_ms: 1000 },
});
test('Attendee PCM validates exact protocol, rate, bot and bounded payload', () => {
  assert.equal(attendeeAudio(packet()).participantId, 'device/1');
  assert.deepEqual([...decodeAttendeePcm(packet().data.chunk)], [-1, 32767 / 32768]);
  for (const patch of [
    { trigger: 'mixed' },
    { bot_id: 'bad' },
    { data: { ...packet().data, sample_rate: 48000 } },
    { data: { ...packet().data, chunk: 'AA==' } },
    { data: { ...packet().data, participant_uuid: 'x\n' } },
  ]) {
    const p = { ...packet(), ...patch };
    assert.throws(() => attendeeAudio(p));
  }
  assert.throws(() => attendeeAudio(packet(), 'bot_other'));
  assert.throws(() =>
    attendeeAudio({ ...packet(), data: { ...packet().data, chunk: 'AAAA'.repeat(30000) } }),
  );
});
test('receiver capability tokens are distinct, rotate and do not cross owner leases', () => {
  const hub = new AttendeeHub(),
    a = hub.open();
  assert.notEqual(a.owner, a.ingest);
  assert.ok(hub.owns(a.owner));
  assert.ok(hub.owns(a.ingest, true));
  assert.ok(!hub.owns(a.ingest));
  assert.ok(!hub.owns('é'.repeat(64)));
  assert.throws(() => hub.open());
  hub.ingest(packet());
  assert.equal(hub.read(0).events.length, 1);
  assert.equal(hub.read(1).events.length, 0);
  assert.throws(() => hub.ingest(packet('device/2', 'bot_other')));
  hub.close();
  const b = hub.open();
  assert.ok(!hub.owns(a.owner));
  assert.notEqual(a.ingest, b.ingest);
  hub.close();
});
test('receiver fails closed on participant, queue and stale-owner limits', () => {
  const hub = new AttendeeHub();
  hub.open();
  for (let i = 0; i < 16; i++) hub.ingest(packet('device/' + i));
  assert.throws(() => hub.ingest(packet('device/17')), /participants-limit/);
  hub.close();
  hub.open();
  hub.session.lastRead = Date.now() - 16000;
  assert.throws(() => hub.ingest(packet()), /overloaded/);
  hub.fail('overloaded');
  assert.throws(() => hub.ingest(packet()), /closed/);
  hub.close();
});
test('external PCM meters preserve independent buffers and release subscriptions', async () => {
  const a = new ParticipantPcmMeter(16000),
    b = new ParticipantPcmMeter(8000);
  await a.start();
  await b.start();
  const x = [],
    y = [];
  a.push('AID/fw==');
  b.push('AAAAAA==');
  const release = a.subscribePcm((pcm, rate) => x.push({ pcm: [...pcm], rate }));
  b.subscribePcm((pcm) => y.push([...pcm]));
  assert.equal(x[0].rate, 16000);
  assert.deepEqual(y, [[0, 0]]);
  assert.equal(a.level(), 1);
  assert.equal(b.level(), 0);
  release();
  await a.stop();
  a.push('AAAAAA==');
  assert.equal(x.length, 1);
  await b.stop();
});
test('dynamic participant sources recognize independently, label transcripts and reject stale callbacks', async () => {
  let draft = '';
  const callbacks = new Map();
  const meters = [];
  const meeting = new MeetingController({
    settings: () => ({
      ...defaultSettings,
      recognitionFilterEnabled: false,
      voiceCommandsEnabled: false,
      sharedVoiceCommandsEnabled: false,
    }),
    translate: (k) => k,
    composer: { getDraft: () => draft, setDraft: (v) => (draft = v) },
    createSource: () => {
      throw Error('must use supplied PCM');
    },
  });
  for (const [source, name] of [
    ['attendee:bot_123:device/1', 'Alex'],
    ['attendee:bot_123:device/2', 'Alex'],
  ]) {
    const meter = new ParticipantPcmMeter(16000);
    meters.push(meter);
    meeting.transcript.setLabel(source, name);
    const engine = {
      activityManaged: true,
      capability: async () => ({ supported: true }),
      start: async (cb) => callbacks.set(source, cb),
      stop: async () => {},
    };
    await meeting.start(source, undefined, { meter, engine });
    assert.equal(meeting.getSnapshot()[source].listening, true);
  }
  const [one, two] = [...callbacks.values()];
  one.onResult({ final: 'First participant' });
  two.onResult({ final: 'Second participant' });
  assert.match(draft, /Alex: First participant\n\nAlex: Second participant/);
  await meeting.end();
  const before = draft;
  one.onResult({ final: 'Stale' });
  assert.equal(draft, before);
  await meeting.dispose();
});
test('Attendee credentials never enter generic settings, which retain only non-secret connection options', () => {
  const s = normalizeSettings({
    meetingSource: 'attendee',
    attendeeApiUrl: 'http://localhost:8000',
    attendeeApiKey: 'secret',
  });
  assert.equal(s.meetingSource, 'attendee');
  assert.equal(s.attendeeApiKey, undefined);
});
test('receiver route requires owner token and rejects insecure ingress before loading WebSocket', async () => {
  let route,
    cleanup,
    loads = 0;
  registerAttendeeRoutes(
    {
      connection: {
        fetch: {
          register: (r) => {
            route = r;
            return () => {};
          },
        },
      },
      webServer: { registerUpgrade: () => () => {} },
      effect: (f) => (cleanup = f()),
    },
    async () => {
      loads++;
      throw Error('unavailable');
    },
  );
  const get = await route.fetch(new Request('http://host/api/dsh-live-voice/attendee'));
  assert.equal(get.status, 403);
  const post = await route.fetch(
    new Request('http://host/api/dsh-live-voice/attendee', {
      method: 'POST',
      body: JSON.stringify({
        action: 'open',
        apiUrl: 'http://localhost:8000',
        apiKey: 'abcdefgh',
        ingressUrl: 'ws://host/api/dsh-live-voice/attendee/ingest',
      }),
    }),
  );
  assert.equal((await post.json()).error.code, 'tls-required');
  assert.equal(loads, 0);
  await cleanup();
});

test('external PCM feeds independent Silero states and recording-owned STT without AudioContext', async () => {
  const recordings = mockRecordingRepository(),
    results = [],
    engines = [],
    meters = [];
  for (let i = 0; i < 2; i++) {
    const meter = new ParticipantPcmMeter(16000);
    await meter.start();
    meters.push(meter);
    const engine = new WhisperHttpRecognitionEngine({
      meter,
      recordings,
      inputSource: 'shared',
      sourceId: 'attendee:' + i,
      sourceLabel: 'Speaker ' + i,
      voiceDetectionEngine: 'silero',
      voiceDetectionMinimumSpeechMs: 50,
      voiceDetectionPreset: 'short',
      vadAvailable: async () => true,
      vadFactory: (options) => ({
        ingest(pcm) {
          options.onProbability({
            pcm,
            sampleRate: 16000,
            probability: pcm.some((x) => x !== 0) ? 1 : 0,
          });
        },
        flush: async () => {},
        release() {},
      }),
      globals: { fetch: async () => Response.json({ ok: true, value: { text: 'Source ' + i } }) },
    });
    engines.push(engine);
    await engine.start({ onResult: (r) => results.push(r.final) });
  }
  const voice = Buffer.alloc(16000);
  for (let i = 0; i < 8000; i++) voice.writeInt16LE(10000, i * 2);
  meters[0].push(voice.toString('base64'));
  for (let i = 0; i < 4; i++) meters[0].push(Buffer.alloc(16000).toString('base64'));
  meters[1].push(Buffer.alloc(16000).toString('base64'));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(results, ['Source 0']);
  const sessions = await recordings.list();
  assert.equal(sessions.length, 2);
  assert.ok(sessions[0].pins.some((p) => p.kind === 'speech-start'));
  assert.ok(!sessions[1].pins.some((p) => p.kind === 'speech-start'));
  await Promise.all(engines.map((e) => e.stop()));
  await Promise.all(meters.map((m) => m.stop()));
});

test('host receiver opens once, validates ingress ownership and releases all routes', async () => {
  let route,
    upgrade,
    cleanup,
    disposed = false,
    closed = false;
  class FakeWsServer {
    constructor(options) {
      assert.equal(options.maxPayload, 128000);
      assert.equal(options.perMessageDeflate, false);
    }
    handleUpgrade(_req, _socket, _head, callback) {
      callback({ on() {}, close() {} });
    }
    close() {
      closed = true;
    }
  }
  registerAttendeeRoutes(
    {
      connection: {
        fetch: {
          register: (r) => {
            route = r;
            return () => {
              disposed = true;
            };
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
    },
    async () => ({ WebSocketServer: FakeWsServer }),
  );
  const post = async (value) => {
    const response = await route.fetch(
      new Request('http://host/api/dsh-live-voice/attendee', {
        method: 'POST',
        body: JSON.stringify(value),
      }),
    );
    return response.json();
  };
  const open = await post({
    action: 'open',
    apiUrl: 'http://localhost:8000',
    apiKey: 'abcdefgh',
    ingressUrl: 'wss://receiver.example/api/dsh-live-voice/attendee/ingest',
  });
  assert.equal(open.ok, true);
  assert.ok(open.value.owner);
  assert.match(open.value.ingestUrl, /token=/);
  const busy = await post({ action: 'open' });
  assert.equal(busy.error.code, 'busy');
  let rejected = false;
  upgrade.handler(
    { url: '/api/dsh-live-voice/attendee/ingest?token=bad', headers: {} },
    {
      end() {
        rejected = true;
      },
    },
    Buffer.alloc(0),
  );
  assert.equal(rejected, true);
  assert.equal((await post({ action: 'close', owner: 'bad' })).error.code, 'ownership');
  assert.equal((await post({ action: 'close', owner: open.value.owner })).ok, true);
  await cleanup();
  assert.equal(disposed, true);
  assert.equal(closed, true);
});
test('late receiver open is closed without resuming an obsolete client', async () => {
  let resolveOpen;
  const closes = [];
  const fetcher = async (_url, options) => {
    const p = JSON.parse(options.body);
    if (p.action === 'open')
      return new Promise(
        (resolve) =>
          (resolveOpen = () =>
            resolve(
              Response.json({ ok: true, value: { owner: 'old', ingestUrl: 'wss://example' } }),
            )),
      );
    closes.push(p.owner);
    return Response.json({ ok: true, value: {} });
  };
  const client = new AttendeeClient(
    { removeParticipant: async () => {} },
    () => {},
    (k) => k,
    fetcher,
  );
  const opening = client.start({});
  await new Promise((resolve) => setImmediate(resolve));
  await client.stop();
  resolveOpen();
  await opening;
  assert.deepEqual(closes, ['old']);
  assert.equal(client.getSnapshot().active, false);
});

test('sparse participant bursts finish real PCM and restart without appending fabricated silence', async () => {
  let draft = '';
  const callbacks = [],
    engines = [];
  const meeting = new MeetingController({
    settings: () => ({
      ...defaultSettings,
      recognitionFilterEnabled: false,
      sharedVoiceCommandsEnabled: false,
    }),
    translate: (k) => k,
    composer: { getDraft: () => draft, setDraft: (v) => (draft = v) },
    createSource: () => {
      throw Error('unexpected source');
    },
  });
  const client = new AttendeeClient(
    meeting,
    (_source, meter) => {
      const engine = {
        activityManaged: true,
        frames: 0,
        finishes: 0,
        capability: async () => ({ supported: true }),
        start: async (cb) => {
          callbacks.push(cb);
          engine.release = meter.subscribePcm((pcm) => (engine.frames += pcm.length));
        },
        finish: async () => {
          engine.finishes++;
          engine.release();
        },
        stop: async () => engine.release?.(),
      };
      engines.push(engine);
      return engine;
    },
    (k) => k,
  );
  const first = { ...attendeeAudio(packet()), name: 'Speaker' };
  await client.audio(first, 0);
  assert.equal(engines[0].frames, 2);
  callbacks[0].onResult({ final: 'First phrase' });
  const input = meeting.input([...client.rows.keys()][0]);
  input.updateSettings({ microphoneEnabled: false });
  await client.audio({ ...first, timestamp: 3000 }, 0);
  assert.equal(engines[0].finishes, 1);
  assert.equal(engines[0].frames, 4);
  assert.equal(input.getSnapshot().muted, true);
  callbacks[1].onResult({ final: 'Muted phrase' });
  assert.doesNotMatch(draft, /Muted phrase/);
  input.updateSettings({ microphoneEnabled: true });
  callbacks[1].onResult({ final: 'Next phrase' });
  assert.match(draft, /First phrase/);
  assert.match(draft, /Next phrase/);
  await client.stop();
  assert.equal(meeting.inputs.size, 0);
  assert.equal(client.rows.size, 0);
  await meeting.dispose();
});
test('explicit energy detection accepts external PCM without browser recapture', async () => {
  const meter = new ParticipantPcmMeter(8000);
  await meter.start();
  const recordings = mockRecordingRepository();
  const engine = new WhisperHttpRecognitionEngine({
    meter,
    recordings,
    voiceDetectionEngine: 'energy',
    globals: { fetch: async () => Response.json({ ok: true, value: { text: '' } }) },
  });
  await engine.start({});
  meter.push('AAAAAA==');
  await engine.finish();
  const [session] = await recordings.list();
  assert.equal(session.capturedSamples, 2);
  assert.equal(session.sampleRate, 8000);
  await engine.stop();
  await meter.stop();
});

test('one participant startup does not block other participant audio queues', async () => {
  let release;
  const received = [];
  const client = new AttendeeClient(
    { removeParticipant: async () => {} },
    () => {},
    (k) => k,
  );
  client.audio = async (event) => {
    if (event.participantId === 'slow') await new Promise((resolve) => (release = resolve));
    received.push(event.participantId);
  };
  client.enqueue({ botId: 'bot_123', participantId: 'slow', chunk: 'AAAA' }, 0);
  client.enqueue({ botId: 'bot_123', participantId: 'fast', chunk: 'AAAA' }, 0);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(received, ['fast']);
  release();
  await Promise.all([...client.queues.values()]);
  assert.deepEqual(received, ['fast', 'slow']);
  assert.equal(client.queuedBytes, 0);
  await client.stop();
});
test('participant command and timestamp overrides stay local to their own bar', async () => {
  const saves = [];
  const settings = {
    ...defaultSettings,
    sharedVoiceCommandsEnabled: true,
    sharedTimestampsEnabled: false,
  };
  const meeting = new MeetingController({
    settings: () => settings,
    translate: (k) => k,
    savePreferences: (_input, next) => saves.push(next),
    composer: { getDraft: () => '', setDraft() {} },
    createSource: () => {
      throw Error('unused');
    },
  });
  const a = meeting.input('attendee:1'),
    b = meeting.input('attendee:2');
  a.updateSettings({ voiceCommandsEnabled: false, timestampsEnabled: true });
  meeting.applySettings(settings);
  assert.equal(a.getSnapshot().settings.voiceCommandsEnabled, false);
  assert.equal(b.getSnapshot().settings.voiceCommandsEnabled, true);
  assert.equal(a.getSnapshot().timestamps, true);
  assert.equal(b.getSnapshot().timestamps, false);
  assert.deepEqual(saves, []);
  await meeting.dispose();
});

test('a repeated stop retains source teardown before opening another receiver', async () => {
  let release;
  const calls = [];
  const client = new AttendeeClient(
    { removeParticipant: () => new Promise((resolve) => (release = resolve)) },
    () => {},
    (k) => k,
    async (_url, options) => {
      const p = JSON.parse(options.body);
      calls.push(p.action);
      if (p.action === 'open') throw Error('test complete');
      return Response.json({ ok: true, value: {} });
    },
  );
  client.rows.set('attendee:old', { source: 'attendee:old' });
  const stopping = client.stop();
  const opening = client.start({});
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, []);
  release();
  await stopping;
  await opening;
  assert.deepEqual(calls, ['open']);
});
test('disposing during WebSocket module import never installs a late upgrade route', async () => {
  let route,
    cleanup,
    resolveModule,
    upgrades = 0,
    servers = 0;
  registerAttendeeRoutes(
    {
      connection: {
        fetch: {
          register: (r) => {
            route = r;
            return () => {};
          },
        },
      },
      webServer: {
        registerUpgrade: () => {
          upgrades++;
          return () => {};
        },
      },
      effect: (f) => (cleanup = f()),
    },
    () => new Promise((resolve) => (resolveModule = resolve)),
  );
  const opening = route.fetch(
    new Request('http://host/api/dsh-live-voice/attendee', {
      method: 'POST',
      body: JSON.stringify({
        action: 'open',
        apiUrl: 'http://localhost:8000',
        apiKey: 'abcdefgh',
        ingressUrl: 'wss://receiver.example/api/dsh-live-voice/attendee/ingest',
      }),
    }),
  );
  await new Promise((resolve) => setImmediate(resolve));
  await cleanup();
  resolveModule({
    WebSocketServer: class {
      constructor() {
        servers++;
      }
    },
  });
  const response = await opening;
  assert.equal(response.status, 400);
  assert.equal(upgrades, 0);
  assert.equal(servers, 0);
});

test('host batches are byte bounded and report remaining audio without dropping it', () => {
  const hub = new AttendeeHub();
  hub.open();
  const value = packet();
  value.data.chunk = Buffer.alloc(32000).toString('base64');
  for (let i = 0; i < 8; i++) hub.ingest(value);
  let cursor = 0,
    total = 0;
  while (total < 8) {
    const batch = hub.read(cursor);
    assert.ok(batch.events.length > 0);
    assert.ok(batch.events.reduce((n, event) => n + event.chunk.length, 0) <= 128000);
    total += batch.events.length;
    cursor = batch.cursor;
    assert.equal(batch.hasMore, total < 8);
  }
  assert.equal(hub.read(cursor).events.length, 0);
  hub.close();
});

test('guided connection derives trusted listener URL, creates bot only on explicit join and lists silent participants', async () => {
  let route, dispose;
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/participants'))
      return Response.json({
        next: 'http://localhost:8000/api/v1/bots/bot_Guided/participants?cursor=page%2B2%3D',
        previous: null,
        results: [{ id: 'par_NotTheUuid', uuid: 'device/silent', name: 'Quiet person' }],
      });
    if (url.endsWith('/participants?cursor=page%2B2%3D'))
      return Response.json({
        next: null,
        previous: 'http://localhost:8000/api/v1/bots/bot_Guided/participants?cursor=previous',
        results: [{ uuid: 'device/second', name: 'Quiet person' }],
      });
    if (options.method === 'POST' && url.endsWith('/bots'))
      return Response.json({ id: 'bot_Guided', state: 'joining' });
    return Response.json({ results: [] });
  };
  registerAttendeeRoutes(
    {
      connection: {
        fetch: {
          register: (r) => {
            route = r;
            return () => {};
          },
        },
      },
      webServer: { getOrigin: () => 'https://127.0.0.1:3443', registerUpgrade: () => () => {} },
      effect: (f) => (dispose = f()),
    },
    async () => ({
      WebSocketServer: class {
        close() {}
      },
    }),
    fetcher,
  );
  const post = async (payload) => {
    const response = await route.fetch(
      new Request('http://local/api/dsh-live-voice/attendee', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    );
    return { status: response.status, ...(await response.json()) };
  };
  try {
    const caps = await (
      await route.fetch(
        new Request('http://local/api/dsh-live-voice/attendee?action=capabilities', {
          headers: { host: 'evil.example' },
        }),
      )
    ).json();
    assert.equal(caps.value.receiverUrl, 'wss://127.0.0.1:3443/api/dsh-live-voice/attendee/ingest');
    const open = await post({
      action: 'open',
      apiUrl: 'http://localhost:8000',
      apiKey: 'test-only-key',
      verify: true,
    });
    assert.equal(open.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.method, undefined);
    assert.equal(
      (
        await post({
          action: 'join',
          owner: 'bad',
          meetingUrl: 'https://meet.google.com/abc-defg-hij',
          botName: 'DSH',
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await post({
          action: 'join',
          owner: open.value.owner,
          meetingUrl: 'https://evil.example/abc-defg-hij',
          botName: 'DSH',
        })
      ).error.code,
      'invalid-meeting',
    );
    const joined = await post({
      action: 'join',
      owner: open.value.owner,
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      botName: 'My meeting helper',
    });
    assert.equal(joined.value.botId, 'bot_Guided');
    const create = calls.find((call) => call.options.method === 'POST');
    const payload = JSON.parse(create.options.body);
    assert.equal(payload.bot_name, 'My meeting helper');
    assert.equal(payload.recording_settings.format, 'none');
    assert.equal(payload.websocket_settings.per_participant_audio.sample_rate, 16000);
    assert.equal(
      new URL(payload.websocket_settings.per_participant_audio.url).searchParams.get('token')
        .length,
      64,
    );
    assert.equal(
      (
        await post({
          action: 'join',
          owner: open.value.owner,
          meetingUrl: 'https://meet.google.com/abc-defg-hij',
          botName: 'Duplicate',
        })
      ).error.code,
      'busy',
    );
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const batch = await (
      await route.fetch(
        new Request('http://local/api/dsh-live-voice/attendee', {
          headers: { 'x-dlv-attendee-owner': open.value.owner },
        }),
      )
    ).json();
    assert.equal(batch.value.status, 'waiting');
    assert.equal(batch.value.error, '');
    assert.deepEqual(batch.value.participants, [
      { id: 'device/silent', name: 'Quiet person' },
      { id: 'device/second', name: 'Quiet person' },
    ]);
    assert.ok(calls.some((call) => call.url.endsWith('/participants?cursor=page%2B2%3D')));
    await post({ action: 'leave', owner: open.value.owner });
    assert.ok(calls.some((call) => call.url.endsWith('/bot_Guided/leave')));
    await post({ action: 'close', owner: open.value.owner });
  } finally {
    await dispose();
  }
});

const participantOrigin = 'http://localhost:8000';
const participantEndpoint = participantOrigin + '/api/v1/bots/bot_Test/participants';
const participantPage = (results = [], next = null) => ({ next, previous: null, results });
const participantRows = (count, offset = 0) =>
  Array.from({ length: count }, (_, i) => ({
    uuid: 'device/' + (offset + i),
    name: 'Person ' + i,
  }));
async function readParticipantFixture(fetcher, signal = new AbortController().signal) {
  return attendeeParticipantNames(
    attendeeApiRequest(participantOrigin, 'fixture-only-key', fetcher),
    participantOrigin,
    'bot_Test',
    signal,
  );
}
test('participant discovery reads all 25-row cursor pages with a fixed endpoint and bounded credentials', async () => {
  const calls = [];
  const names = await readParticipantFixture(async (url, options) => {
    calls.push(url);
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Token fixture-only-key');
    assert.equal('responseBudget' in options, false);
    return Response.json(
      calls.length === 1
        ? participantPage(participantRows(25), participantEndpoint + '?cursor=cG9zPTI1%2B%2F%3D')
        : participantPage([
            { uuid: 'device/25', name: 'Final' + String.fromCharCode(10) + 'x'.repeat(90) },
          ]),
    );
  });
  assert.deepEqual(calls, [participantEndpoint, participantEndpoint + '?cursor=cG9zPTI1%2B%2F%3D']);
  assert.equal(names.size, 26);
  assert.equal(names.get('device/25'), 'Final' + 'x'.repeat(75));
  assert.equal(
    (await readParticipantFixture(async () => Response.json(participantPage()))).size,
    0,
  );
});
test('participant discovery rejects malformed envelopes and rows instead of skipping them', async () => {
  for (const payload of [
    [],
    null,
    {},
    { results: [] },
    { ...participantPage(), results: {} },
    { ...participantPage(), next: false },
    { ...participantPage(), previous: false },
    participantPage([null]),
    participantPage([{}]),
    participantPage([{ uuid: '', name: 'x' }]),
    participantPage([{ uuid: 'x\n', name: 'x' }]),
    participantPage([{ uuid: 'x'.repeat(257), name: 'x' }]),
    participantPage([{ uuid: 'x', name: null }]),
  ]) {
    await assert.rejects(
      readParticipantFixture(async () => Response.json(payload)),
      /participants/,
    );
  }
});
test('participant pagination refuses unsafe URLs and never forwards credentials to next', async () => {
  for (const next of [
    'https://evil.example/api/v1/bots/bot_Test/participants?cursor=x',
    'http://localhost:8001/api/v1/bots/bot_Test/participants?cursor=x',
    'http://localhost:8000/api/v1/bots/bot_Other/participants?cursor=x',
    'http://user:password@localhost:8000/api/v1/bots/bot_Test/participants?cursor=x',
    participantEndpoint + '?cursor=x#fragment',
    participantEndpoint + '?cursor=x&cursor=y',
    participantEndpoint + '?cursor=x&other=y',
    participantEndpoint,
    participantEndpoint + '?cursor=',
    participantEndpoint + '?cursor=%00',
    participantEndpoint + '?cursor=' + 'x'.repeat(1025),
    'x'.repeat(2049),
  ]) {
    let calls = 0;
    await assert.rejects(
      readParticipantFixture(async (url) => {
        assert.equal(url, participantEndpoint);
        calls++;
        return Response.json(participantPage(participantRows(1), next));
      }),
    );
    assert.equal(calls, 1);
  }
});
test('participant pagination rejects cycles, empty continuations and page or total-row overflow', async () => {
  let calls = 0;
  await assert.rejects(
    readParticipantFixture(async () => {
      calls++;
      return Response.json(participantPage(participantRows(1), '?cursor=repeated'));
    }),
    /participants/,
  );
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(
    readParticipantFixture(async () => {
      calls++;
      return Response.json(participantPage([], '?cursor=empty'));
    }),
    /participants/,
  );
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(
    readParticipantFixture(async () => {
      calls++;
      return Response.json(participantPage(participantRows(1), '?cursor=' + calls));
    }),
    /participants/,
  );
  assert.equal(calls, 16);
  calls = 0;
  await assert.rejects(
    readParticipantFixture(async () => {
      calls++;
      return Response.json(
        calls === 1
          ? participantPage(participantRows(256), '?cursor=overflow')
          : participantPage(participantRows(1, 256)),
      );
    }),
    /participants/,
  );
  assert.equal(calls, 2);
  assert.equal(
    (await readParticipantFixture(async () => Response.json(participantPage(participantRows(256)))))
      .size,
    256,
  );
});
test('participant pagination shares a 64 KB response budget across pages and cancels oversized bodies', async () => {
  let calls = 0,
    cancelled = 0;
  await assert.rejects(
    readParticipantFixture(async () => {
      calls++;
      const body = JSON.stringify(
        participantPage([{ uuid: 'device/' + calls, name: 'x'.repeat(33000) }], '?cursor=' + calls),
      );
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(body));
            if (calls === 1) controller.close();
          },
          cancel() {
            cancelled++;
          },
        }),
      );
    }),
    /api-failed/,
  );
  assert.equal(calls, 2);
  assert.ok(cancelled >= 1);
  await assert.rejects(
    readParticipantFixture(async () =>
      Response.json(participantPage([{ uuid: 'x', name: 'x'.repeat(64000) }])),
    ),
    /api-failed/,
  );
});
test('participant pagination respects cancellation between pages and rejects late aborted results', async () => {
  for (const next of [null, '?cursor=next']) {
    const abort = new AbortController();
    let calls = 0;
    await assert.rejects(
      readParticipantFixture(async () => {
        calls++;
        abort.abort();
        return Response.json(participantPage(participantRows(1), next));
      }, abort.signal),
      { name: 'AbortError' },
    );
    assert.equal(calls, 1);
  }
});

async function participantRouteFixture(fetcher) {
  let route, dispose;
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
      webServer: { getOrigin: () => 'https://127.0.0.1:3443', registerUpgrade: () => () => {} },
      effect: (f) => {
        dispose = f();
      },
    },
    async () => ({
      WebSocketServer: class {
        close() {}
      },
    }),
    fetcher,
  );
  const post = async (value) =>
    (
      await route.fetch(
        new Request('http://local/api/dsh-live-voice/attendee', {
          method: 'POST',
          body: JSON.stringify(value),
        }),
      )
    ).json();
  const open = await post({
    action: 'open',
    apiUrl: participantOrigin,
    apiKey: 'fixture-only-key',
  });
  assert.equal(open.ok, true);
  const owner = open.value.owner;
  return {
    post,
    owner,
    dispose,
    read: async () =>
      (
        await route.fetch(
          new Request('http://local/api/dsh-live-voice/attendee', {
            headers: { 'x-dlv-attendee-owner': owner },
          }),
        )
      ).json(),
    join: () =>
      post({
        action: 'join',
        owner,
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
        botName: 'Test',
      }),
  };
}
test('participant refresh publishes only complete snapshots and fails explicitly without truncation', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  let refresh = 0,
    calls = 0;
  const fixture = await participantRouteFixture(async (url) => {
    if (url.endsWith('/bots')) return Response.json({ id: 'bot_Test' });
    calls++;
    if (!url.includes('?')) refresh++;
    return Response.json(
      refresh === 1
        ? participantPage([{ uuid: 'retained', name: 'Complete snapshot' }])
        : !url.includes('?')
          ? participantPage([{ uuid: 'partial', name: 'Do not publish' }], '?cursor=badpage')
          : participantPage([null]),
    );
  });
  try {
    await fixture.join();
    await new Promise((r) => setImmediate(r));
    const original = (await fixture.read()).value.participants;
    assert.deepEqual(original, [{ id: 'retained', name: 'Complete snapshot' }]);
    t.mock.timers.tick(2000);
    await new Promise((r) => setImmediate(r));
    const failed = (await fixture.read()).value;
    assert.equal(failed.status, 'failed');
    assert.equal(failed.error, 'participants');
    assert.deepEqual(failed.participants, original);
    t.mock.timers.tick(4000);
    assert.equal(calls, 3);
  } finally {
    await fixture.dispose();
  }
});
test('participant pagination deadline covers every page in one refresh', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  let pendingSignal,
    calls = 0;
  const fixture = await participantRouteFixture(async (url, options) => {
    if (url.endsWith('/bots')) return Response.json({ id: 'bot_Test' });
    calls++;
    if (calls === 1) return Response.json(participantPage(participantRows(1), '?cursor=second'));
    pendingSignal = options.signal;
    return new Promise((_, reject) =>
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }),
    );
  });
  try {
    await fixture.join();
    await new Promise((r) => setImmediate(r));
    assert.equal(calls, 2);
    assert.equal(pendingSignal.aborted, false);
    t.mock.timers.tick(5000);
    await new Promise((r) => setImmediate(r));
    assert.equal(pendingSignal.aborted, true);
    const state = (await fixture.read()).value;
    assert.equal(state.error, 'participants');
    assert.deepEqual(state.participants, []);
    assert.equal(calls, 2);
  } finally {
    await fixture.dispose();
  }
});

test('HTTP listener cannot fabricate WSS; failed creation is never automatically retried', async () => {
  let route, dispose;
  let creates = 0;
  registerAttendeeRoutes(
    {
      connection: {
        fetch: {
          register: (r) => {
            route = r;
            return () => {};
          },
        },
      },
      webServer: { getOrigin: () => 'http://127.0.0.1:3081', registerUpgrade: () => () => {} },
      effect: (f) => (dispose = f()),
    },
    async () => ({
      WebSocketServer: class {
        close() {}
      },
    }),
    async () => {
      creates++;
      throw Error('timeout');
    },
  );
  const post = async (payload) =>
    await (
      await route.fetch(
        new Request('http://local/api/dsh-live-voice/attendee', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      )
    ).json();
  try {
    const open = await post({
      action: 'open',
      apiUrl: 'http://localhost:8000',
      apiKey: 'test-only-key',
    });
    assert.equal(open.value.tlsRequired, true);
    assert.equal(open.value.ingestUrl, '');
    assert.equal(
      (
        await post({
          action: 'join',
          owner: open.value.owner,
          meetingUrl: 'https://meet.google.com/abc-defg-hij',
          botName: 'DSH',
        })
      ).error.code,
      'tls-required',
    );
    assert.equal(creates, 0);
    await post({ action: 'close', owner: open.value.owner });
    const next = await post({
      action: 'open',
      apiUrl: 'http://localhost:8000',
      apiKey: 'test-only-key',
      ingressUrl: 'wss://receiver.example/api/dsh-live-voice/attendee/ingest',
    });
    const payload = {
      action: 'join',
      owner: next.value.owner,
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      botName: 'DSH',
    };
    assert.equal((await post(payload)).error.code, 'join-uncertain');
    assert.equal((await post(payload)).error.code, 'busy');
    assert.equal(creates, 1);
  } finally {
    await dispose();
  }
});

test('participant aliases survive discovered-name refresh and are scoped to connection', async () => {
  const meeting = new MeetingController({
    getSettings: () => ({ ...defaultSettings }),
    t: () => '',
  });
  const client = new AttendeeClient(
    meeting,
    () => {},
    (x) => x,
  );
  const source = 'attendee:bot_A:device/1';
  client.discovered.set(source, { source, originalName: 'Original' });
  client.publishParticipants();
  client.rename(source, 'Alias');
  assert.equal(client.getSnapshot().participants[0].name, 'Alias');
  client.discovered.set(source, { source, originalName: 'Updated' });
  client.publishParticipants();
  assert.equal(client.getSnapshot().participants[0].name, 'Alias');
  assert.equal(client.getSnapshot().participants[0].originalName, 'Updated');
  client.rename(source, '');
  assert.equal(client.getSnapshot().participants[0].name, 'Updated');
  await client.stop();
  assert.equal(client.getSnapshot().participants.length, 0);
});

test('verified HTTP connection fails closed when Compose bridge is absent and releases its lease', async () => {
  let route, dispose;
  const calls = [];
  registerAttendeeRoutes(
    {
      connection: {
        fetch: {
          register: (r) => {
            route = r;
            return () => {};
          },
        },
      },
      webServer: {
        getOrigin: () => 'http://127.0.0.1:3081',
        registerUpgrade: () => {
          throw Error('must not expose DSH ingress');
        },
      },
      effect: (f) => (dispose = f()),
    },
    async () => {
      throw Error('ws must not load before local descriptor validation');
    },
    async (url) => {
      calls.push(url);
      if (url === 'http://localhost:8000/api/v1/bots?limit=1')
        return Response.json({ results: [] });
      throw Error('bridge absent');
    },
  );
  const post = async (payload) =>
    await (
      await route.fetch(
        new Request('http://local/api/dsh-live-voice/attendee', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      )
    ).json();
  try {
    const payload = {
      action: 'open',
      apiUrl: 'http://localhost:8000',
      apiKey: 'test-only-key',
      verify: true,
    };
    assert.equal((await post(payload)).error.code, 'relay-unavailable');
    assert.equal((await post(payload)).error.code, 'relay-unavailable');
    assert.equal(calls.filter((url) => url === 'http://127.0.0.1:18766/v1/descriptor').length, 2);
  } finally {
    await dispose();
  }
});

test('reopening Settings cannot overwrite connected relay TLS state or publish stale capability failures', async () => {
  let finish,
    calls = 0;
  const meeting = { transcript: { forget() {} }, removeParticipant: async () => {} };
  const client = new AttendeeClient(
    meeting,
    () => {},
    (key) => key,
    () => {
      calls++;
      return new Promise((resolve) => (finish = resolve));
    },
  );
  const pending = client.capabilities();
  client.patch({
    active: true,
    tlsRequired: false,
    ingestUrl: 'wss://dsh-audio-bridge:18765/ingest?token=test-only',
  });
  finish(Response.json({ ok: true, value: { receiverUrl: '', tlsRequired: true } }));
  await pending;
  assert.equal(client.getSnapshot().tlsRequired, false);
  await client.capabilities();
  assert.equal(calls, 1);
  client.patch({ active: false });
  const stale = client.capabilities();
  await client.stop();
  finish(Response.json({ ok: false }, { status: 500 }));
  await stale;
  assert.equal(client.getSnapshot().error, null);
});

test('only the latest idle capability response may update the receiver hint', async () => {
  const pending = [];
  const client = new AttendeeClient(
    {},
    () => {},
    (key) => key,
    () => new Promise((resolve) => pending.push(resolve)),
  );
  const first = client.capabilities(),
    second = client.capabilities();
  pending[1](
    Response.json({
      ok: true,
      value: { receiverUrl: 'wss://current.example', tlsRequired: false },
    }),
  );
  await second;
  pending[0](
    Response.json({ ok: true, value: { receiverUrl: 'wss://old.example', tlsRequired: true } }),
  );
  await first;
  assert.equal(client.getSnapshot().receiverUrl, 'wss://current.example');
  assert.equal(client.getSnapshot().tlsRequired, false);
});
