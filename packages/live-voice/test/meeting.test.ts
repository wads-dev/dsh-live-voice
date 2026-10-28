// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { MeetingController } from '../src/modules/conversation/models/meeting.js';
import { normalizeSettings } from '../src/modules/core/settings.js';

test('timestamps persist independently across recreated controllers', async () => {
  let saved = normalizeSettings({});
  const create = () =>
    new MeetingController({
      composer: { getDraft: () => '', setDraft() {} },
      settings: () => saved,
      savePreferences: async (_input, patch) => {
        saved = normalizeSettings({ ...saved, ...patch });
      },
    });
  const first = create();
  await first.input().toggleTimestamps();
  first.applySettings(saved);
  assert.equal(first.input().getSnapshot().timestamps, true);
  assert.equal(first.input('microphone').getSnapshot().timestamps, false);
  await first.dispose();
  const next = create();
  assert.equal(next.input().getSnapshot().timestamps, true);
  await next.input('microphone').toggleTimestamps();
  await next.input().toggleTimestamps();
  await next.dispose();
  const reloaded = create();
  assert.equal(reloaded.input().getSnapshot().timestamps, false);
  assert.equal(reloaded.input('microphone').getSnapshot().timestamps, true);
  await reloaded.dispose();
});

test('shared command preference survives controller recreation independently of microphone commands', async () => {
  let saved = normalizeSettings({ voiceCommandsEnabled: true });
  const create = () =>
    new MeetingController({
      composer: { getDraft: () => '', setDraft() {} },
      settings: () => saved,
      savePreferences: async (_input, patch) => {
        saved = normalizeSettings({ ...saved, ...patch });
      },
    });
  const first = create();
  await first.input().updateSettings({ voiceCommandsEnabled: false });
  assert.equal(saved.sharedVoiceCommandsEnabled, false);
  assert.equal(saved.voiceCommandsEnabled, true);
  first.applySettings(saved);
  assert.equal(first.input().getSnapshot().settings.voiceCommandsEnabled, false);
  await first.dispose();
  const reloaded = create();
  assert.equal(reloaded.input().getSnapshot().settings.voiceCommandsEnabled, false);
  await reloaded.input().updateSettings({ voiceCommandsEnabled: true });
  await reloaded.dispose();
  const enabled = create();
  assert.equal(enabled.input().getSnapshot().settings.voiceCommandsEnabled, true);
  enabled.applySettings(normalizeSettings({ ...saved, voiceCommandsEnabled: false }));
  assert.equal(enabled.input().getSnapshot().settings.voiceCommandsEnabled, true);
  await enabled.dispose();
  assert.equal(
    normalizeSettings({ voiceCommandsEnabled: false }).sharedVoiceCommandsEnabled,
    false,
  );
});
test('meeting sources recognize independently and reject stale results without submission', async () => {
  let draft = '';
  const sources = {};
  const meeting = new MeetingController({
    composer: {
      getDraft: () => draft,
      setDraft: (value) => (draft = value),
      submit: () => assert.fail('No meeting submission'),
    },
    settings: () => ({
      recognitionEngine: 'whisper-http',
      recognitionLang: 'pt-BR',
      recognitionMinimumWords: 1,
      sendingMode: 'manual',
    }),
    translate: (key) => key,
    createSource: (source) => {
      const entry = {
        meter: {
          provide() {},
          start: async () => true,
          stop: async () => {},
          stream: { getTracks: () => [] },
        },
        engine: {
          capability: async () => ({ supported: true }),
          start: async (options) => (entry.callbacks = options),
          stop: async () => {},
        },
      };
      sources[source] = entry;
      return entry;
    },
  });
  await meeting.start('microphone');
  sources.microphone.callbacks.onResult({ final: 'First' });
  await meeting.start('shared');
  sources.shared.callbacks.onResult({ final: 'Second' });
  sources.microphone.callbacks.onProcessingChange({ pending: 2 });
  assert.equal(meeting.getSnapshot().microphone.pending, 2);
  assert.equal(meeting.getSnapshot().shared.pending, 0);
  assert.equal(draft, 'First\n\nThem: Second');
  const old = sources.microphone.callbacks;
  await meeting.stop('microphone');
  old.onResult({ final: 'Stale' });
  sources.shared.callbacks.onResult({ final: 'Only shared' });
  assert.equal(draft, 'First\n\nThem: Second Only shared');
  await meeting.dispose();
  assert.equal(meeting.jobs.size, 0);
});

test('ending meeting during capability discovery never starts obsolete capture', async () => {
  let resolve;
  let starts = 0;
  const capability = new Promise((done) => (resolve = done));
  const meeting = new MeetingController({
    composer: { getDraft: () => '', setDraft: () => assert.fail('stale write') },
    settings: () => ({ recognitionEngine: 'whisper-http' }),
    translate: (key) => key,
    createSource: () => ({
      meter: {
        start: async () => {
          starts++;
          return true;
        },
        stop: async () => {},
      },
      engine: { capability: () => capability, start: async () => {}, stop: async () => {} },
    }),
  });
  const starting = meeting.start('microphone');
  await new Promise((done) => setImmediate(done));
  await meeting.end();
  resolve({ supported: true });
  await starting;
  assert.equal(starts, 0);
  assert.equal(meeting.getSnapshot().active, false);
});

function policyFixture(t) {
  let draft = '';
  const submissions = [],
    sources = {};
  let stops = 0;
  const meeting = new MeetingController({
    composer: {
      getDraft: () => draft,
      setDraft: (text) => {
        draft = text;
      },
      submit: (mode) => {
        submissions.push(mode);
        draft = '';
      },
    },
    settings: () => ({ recognitionEngine: 'whisper-http', recognitionMinimumWords: 1 }),
    translate: (key) => key,
    createSource: (source) => {
      const entry = {
        meter: {
          provide() {},
          start: async () => true,
          stop: async () => {
            stops++;
          },
          stream: { getTracks: () => [] },
        },
        engine: {
          capability: async () => ({ supported: true }),
          start: async (options) => {
            entry.callbacks = options;
          },
          stop: async () => {},
        },
      };
      sources[source] = entry;
      return entry;
    },
  });
  t.after(() => meeting.dispose());
  return { meeting, sources, submissions, draft: () => draft, stops: () => stops };
}

test('both sources share exact commands and ignore semantics without closing capture or muting the other', async (t) => {
  const f = policyFixture(t);
  await f.meeting.start('microphone');
  await f.meeting.start('shared');
  const mic = f.meeting.input('microphone'),
    shared = f.meeting.input();
  const result = (text) => f.sources.shared.callbacks.onResult({ final: text });
  result('mute');
  assert.equal(shared.getSnapshot().muted, true);
  assert.equal(mic.getSnapshot().muted, false);
  assert.equal(f.stops(), 0);
  result('ignored words');
  assert.equal(f.draft(), '');
  result('resume');
  result('hello there');
  result('send');
  assert.deepEqual(f.submissions, ['steer']);
  shared.updateSettings({ voiceCommandsEnabled: false, sendingMode: 'steer' });
  f.meeting.applySettings({
    voiceCommandsEnabled: true,
    sendingMode: 'manual',
    microphoneEnabled: false,
  });
  assert.equal(shared.getSnapshot().settings.voiceCommandsEnabled, false);
  assert.equal(shared.getSnapshot().settings.sendingMode, 'steer');
  assert.equal(shared.getSnapshot().muted, false);
  shared.updateSettings({ sendingMode: 'manual' });
  result('send');
  assert.match(f.draft(), /send$/);
  shared.updateSettings({ voiceCommandsEnabled: true });
  result('end');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.meeting.getSnapshot().shared.listening, false);
  assert.equal(f.meeting.getSnapshot().microphone.listening, true);
  result('stale words');
  assert.match(f.draft(), /send$/);
});

test('shared source keeps audio writes separate from displayed transcription and still blocks delivery', async (t) => {
  const f = policyFixture(t);
  await f.meeting.start('shared');
  const input = f.meeting.input(),
    cb = f.sources.shared.callbacks;
  input.updateSettings({ sendingMode: 'queue', autoSendDelaySeconds: 1 });
  cb.onProcessingChange({ pending: 2, transcribing: 0 });
  assert.equal(input.getSnapshot().pendingTranscriptionRequests, 0);
  assert.equal(input.getSnapshot().pendingTranscriptions, 2);
  cb.onResult({ final: 'shared words' });
  assert.equal(input.getSnapshot().autoSendAt, null);
  cb.onProcessingChange({ pending: 2, transcribing: 1 });
  assert.equal(input.getSnapshot().pendingTranscriptionRequests, 1);
  cb.onProcessingChange({ pending: 1, transcribing: 0 });
  assert.equal(input.getSnapshot().autoSendAt, null);
  cb.onProcessingChange({ pending: 0, transcribing: 0 });
  assert.ok(input.getSnapshot().autoSendAt);
});

test('automatic delivery waits for processing and is cancelled by ignore, manual edit, stop and disposal', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const f = policyFixture(t);
  await f.meeting.start('shared');
  const input = f.meeting.input(),
    cb = f.sources.shared.callbacks;
  input.updateSettings({ sendingMode: 'queue', autoSendDelaySeconds: 1 });
  cb.onProcessingChange({ pending: 1 });
  cb.onResult({ final: 'first words' });
  assert.equal(input.getSnapshot().autoSendAt, null);
  cb.onProcessingChange({ pending: 0 });
  assert.ok(input.getSnapshot().autoSendAt);
  t.mock.timers.tick(1000);
  assert.deepEqual(f.submissions, ['queue']);
  input.updateSettings({ sendingMode: 'steer' });
  cb.onResult({ final: 'next words' });
  input.muteListening();
  t.mock.timers.tick(1000);
  assert.equal(f.submissions.length, 1);
  cb.onProcessingChange({ pending: 0 });
  assert.equal(input.getSnapshot().autoSendAt, null);
  input.resumeListeningInput();
  cb.onResult({ final: 'more words' });
  f.meeting.composer.setDraft('manually changed');
  t.mock.timers.tick(1000);
  assert.equal(f.submissions.length, 1);
  cb.onResult({ final: 'new words' });
  t.mock.timers.tick(1000);
  assert.deepEqual(f.submissions, ['queue', 'steer']);
  cb.onResult({ final: 'never sent' });
  await f.meeting.stop('shared');
  t.mock.timers.tick(1000);
  assert.equal(f.submissions.length, 2);
  await f.meeting.start('shared');
  f.sources.shared.callbacks.onResult({ final: 'never sent either' });
  await f.meeting.dispose();
  t.mock.timers.tick(1000);
  assert.equal(f.submissions.length, 2);
});

test('timestamps use identical source-local controls, including single-source dictation', async (t) => {
  const f = policyFixture(t);
  await f.meeting.start('microphone');
  f.meeting.input('microphone').toggleTimestamps();
  f.sources.microphone.callbacks.onResult({
    final: 'timestamped words',
    startedAt: new Date(2026, 9, 9, 12, 34, 56).getTime(),
  });
  assert.equal(f.draft(), '[2026/10/09 12:34:56] timestamped words');
  await f.meeting.start('shared');
  assert.equal(f.meeting.input().getSnapshot().timestamps, false);
  f.sources.shared.callbacks.onResult({ final: 'no timestamp' });
  assert.match(f.draft(), /\n\nThem: no timestamp$/);
  f.meeting.input().toggleTimestamps();
  assert.equal(f.meeting.input().getSnapshot().timestamps, true);
});

test('shared capture starts and restarts Listening independently of global microphone mute', async (t) => {
  const f = policyFixture(t);
  f.meeting.settings = () => ({
    recognitionEngine: 'whisper-http',
    microphoneEnabled: false,
    recognitionMinimumWords: 1,
  });
  await f.meeting.start('shared');
  assert.equal(f.meeting.input().getSnapshot().muted, false);
  f.meeting.input().muteListening();
  await f.meeting.stop('shared');
  await f.meeting.start('shared');
  assert.equal(f.meeting.input().getSnapshot().muted, false);
  f.sources.shared.callbacks.onResult({ final: 'fresh capture words' });
  assert.equal(f.draft(), 'fresh capture words');
});

test('accepted-source delivery resumes after the other source is idle without inventing sends from its draft', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const f = policyFixture(t);
  await f.meeting.start('shared');
  await f.meeting.start('microphone');
  const input = f.meeting.input();
  let ready = false;
  input.composer.canAutoSend = () => ready;
  input.updateSettings({ sendingMode: 'queue', autoSendDelaySeconds: 1 });
  f.sources.shared.callbacks.onResult({ final: 'eligible shared words' });
  assert.equal(input.getSnapshot().autoSendAt, null);
  ready = true;
  f.meeting.refreshDeliveryReadiness();
  assert.ok(input.getSnapshot().autoSendAt);
  ready = false;
  f.meeting.refreshDeliveryReadiness();
  t.mock.timers.tick(1000);
  assert.equal(f.submissions.length, 0);
  ready = true;
  f.meeting.refreshDeliveryReadiness();
  t.mock.timers.tick(1000);
  assert.deepEqual(f.submissions, ['queue']);
  f.meeting.composer.setDraft('typed text alone');
  f.sources.shared.callbacks.onProcessingChange({ pending: 0 });
  t.mock.timers.tick(1000);
  assert.equal(f.submissions.length, 1);
  f.sources.shared.callbacks.onResult({ final: 'accepted words' });
  ready = false;
  t.mock.timers.tick(1000);
  assert.equal(f.submissions.length, 1);
  ready = true;
  f.meeting.refreshDeliveryReadiness();
  t.mock.timers.tick(1000);
  assert.equal(f.submissions.length, 2);
});

function browserMeetingFixture({
  capability = async () => ({ supported: true, externalAudio: true }),
  capture,
  recognize,
  settings: currentSettings,
} = {}) {
  const order = [],
    tracks = [],
    entries = [],
    submissions = [];
  let draft = '';
  const track = {
    kind: 'audio',
    readyState: 'live',
    stops: 0,
    stop() {
      this.stops++;
      this.readyState = 'ended';
    },
    addEventListener(_name, callback) {
      tracks.push(callback);
    },
  };
  const stream = { getAudioTracks: () => [track], getTracks: () => [track] };
  const meeting = new MeetingController({
    composer: {
      submit: (mode) => submissions.push(mode),
      getDraft: () => draft,
      setDraft: (text) => {
        draft = text;
      },
    },
    settings: () => ({
      ...currentSettings?.(),
      recognitionEngine: currentSettings?.().recognitionEngine || 'browser',
      recognitionLang: currentSettings?.().recognitionLang || 'pt-BR',
      recognitionMinimumWords: 1,
      sendingMode: 'manual',
    }),
    translate: (key) =>
      key === 'browserSharedUnsupported'
        ? 'Unsupported shared Browser audio; choose Qwen or Whisper HTTP.'
        : key,
    createSource: () => {
      const entry = {
        meter: {
          stream: null,
          provide(request) {
            entry.request = request;
          },
          async start(options) {
            order.push('capture');
            await capture?.(options);
            this.stream = stream;
            return true;
          },
          async stop() {
            order.push('meter-stop');
            this.stream?.getTracks().forEach((t) => t.stop());
            this.stream = null;
          },
        },
        engine: {
          async capability(options) {
            order.push('capability');
            entry.capabilityOptions = options;
            return capability(options);
          },
          async start(options) {
            order.push('recognition');
            entry.callbacks = options;
            assert.equal((this.meter || entry.meter).stream?.getAudioTracks()[0], track);
            await recognize?.(options);
          },
          async stop() {
            order.push('engine-stop');
          },
        },
      };
      entries.push(entry);
      return entry;
    },
  });
  return { meeting, entries, order, stream, track, tracks, submissions, draft: () => draft };
}

test('Browser meeting probes capability before capture and recognizes only after its shared track is available', async (t) => {
  const f = browserMeetingFixture();
  t.after(() => f.meeting.dispose());
  await f.meeting.start('shared', Promise.resolve(f.stream));
  assert.deepEqual(f.order, ['capability', 'capture', 'recognition']);
  assert.equal(f.entries[0].capabilityOptions.lang, 'pt-BR');
  assert.equal(f.entries[0].capabilityOptions.signal.aborted, false);
  assert.equal(f.meeting.getSnapshot().shared.listening, true);
  f.entries[0].callbacks.onResult({ final: 'shared browser words' });
  assert.equal(f.draft(), 'shared browser words');
  const stale = f.entries[0].callbacks;
  await f.meeting.stop('shared');
  assert.deepEqual(f.order.slice(-2), ['engine-stop', 'meter-stop']);
  assert.equal(f.track.stops, 1);
  stale.onResult({ final: 'obsolete words' });
  stale.onActivity(true);
  stale.onError(new Error());
  assert.equal(f.draft(), 'shared browser words');
  assert.equal(f.meeting.getSnapshot().shared.listening, false);
  assert.equal(f.meeting.getSnapshot().shared.error, null);
});

for (const [code, expected] of [
  ['external-audio-unsupported', 'Unsupported shared Browser audio; choose Qwen or Whisper HTTP.'],
  ['browser-local-unavailable', 'browserLocalUnavailable'],
])
  test('Browser meeting localizes capability failure before capture: ' + code, async () => {
    const f = browserMeetingFixture({
      capability: async () => ({ supported: false, code, reason: 'internal English' }),
    });
    await f.meeting.start('shared', Promise.resolve(f.stream));
    assert.equal(f.order.includes('capture'), false);
    assert.equal(f.order.includes('recognition'), false);
    assert.equal(f.meeting.getSnapshot().shared.error, expected);
    assert.equal(f.track.readyState, 'ended');
    assert.equal(f.meeting.jobs.size, 0);
    await f.meeting.dispose();
  });

test('Browser shared capability cancellation releases late permission tracks and does not start obsolete capture', async () => {
  let resolveCapability, resolveRequest;
  const f = browserMeetingFixture({
    capability: () =>
      new Promise((resolve) => {
        resolveCapability = resolve;
      }),
  });
  const request = new Promise((resolve) => {
    resolveRequest = resolve;
  });
  const work = f.meeting.start('shared', request);
  await new Promise((resolve) => setImmediate(resolve));
  await f.meeting.end();
  assert.equal(f.entries[0].capabilityOptions.signal.aborted, true);
  resolveCapability({ supported: true, externalAudio: true });
  await work;
  resolveRequest(f.stream);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.order.includes('capture'), false);
  assert.equal(f.track.readyState, 'ended');
  assert.equal(f.meeting.getSnapshot().active, false);
  assert.equal(f.meeting.getSnapshot().shared.error, null);
  await f.meeting.dispose();
});

test('Browser meeting cancellation during capture or native start rejects stale callbacks/readiness', async () => {
  for (const stage of ['capture', 'recognize']) {
    let release;
    const f = browserMeetingFixture({
      [stage]: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    });
    const work = f.meeting.start('shared', Promise.resolve(f.stream));
    await new Promise((resolve) => setImmediate(resolve));
    await f.meeting.stop('shared');
    release();
    await work;
    assert.equal(f.meeting.getSnapshot().shared.listening, false);
    assert.equal(f.meeting.getSnapshot().shared.starting, false);
    assert.equal(f.meeting.jobs.size, 0);
    assert.equal(f.track.readyState, 'ended');
    f.entries[0].callbacks?.onResult({ final: 'never accepted' });
    assert.equal(f.draft(), '');
    if (stage === 'capture') assert.equal(f.order.includes('recognition'), false);
    await f.meeting.dispose();
  }
});

test('Browser meeting shared track end stops recognition and capture independently of stale callbacks', async () => {
  const f = browserMeetingFixture();
  await f.meeting.start('shared', Promise.resolve(f.stream));
  const stale = f.entries[0].callbacks;
  f.tracks[0]();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.meeting.getSnapshot().shared.listening, false);
  assert.equal(f.track.readyState, 'ended');
  stale.onResult({ final: 'late after track end' });
  assert.equal(f.draft(), '');
  await f.meeting.dispose();
});

test('shared-input silent persistence does not repeatedly restart automatic delivery', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const f = policyFixture(t);
  await f.meeting.start('shared');
  const input = f.meeting.input(),
    cb = f.sources.shared.callbacks;
  input.updateSettings({ sendingMode: 'queue', autoSendDelaySeconds: 1 });
  cb.onProcessingChange({ pending: 1, transcribing: 0, deliveryPending: 0 });
  cb.onResult({ final: 'send these words' });
  assert.ok(input.getSnapshot().autoSendAt);
  for (let i = 0; i < 10; i++) {
    cb.onProcessingChange({ pending: i % 2, transcribing: 0, deliveryPending: 0 });
    t.mock.timers.tick(100);
  }
  assert.deepEqual(f.submissions, ['queue']);
});

const flushRecovery = () => new Promise((resolve) => setImmediate(resolve));
const transientRecognitionFailure = () =>
  Object.assign(new Error('temporary'), { code: 'network' });

test('shared recognition recovers on the retained track with current settings, mute and stale callback protection', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let settings = { recognitionLang: 'pt-BR' };
  const f = browserMeetingFixture({ settings: () => settings });
  t.after(() => f.meeting.dispose());
  await f.meeting.start('shared', Promise.resolve(f.stream));
  const old = f.entries[0].callbacks;
  old.onActivity(true);
  old.onProcessingChange({ pending: 3 });
  old.onError(transientRecognitionFailure());
  f.meeting.input().updateSettings({ microphoneEnabled: false });
  settings = { recognitionLang: 'en-US' };
  old.onResult({ final: 'obsolete words' });
  old.onProcessingChange({ pending: 99 });
  await flushRecovery();
  assert.equal(f.track.stops, 0);
  assert.equal(f.meeting.getSnapshot().shared.starting, true);
  assert.equal(f.meeting.getSnapshot().shared.pending, 0);
  t.mock.timers.tick(250);
  await flushRecovery();
  assert.equal(f.entries.length, 2);
  assert.equal(f.entries[1].callbacks.lang, 'en-US');
  assert.equal(f.entries[1].engine.meter, f.entries[0].meter);
  assert.equal(f.order.filter((step) => step === 'capture').length, 1);
  assert.equal(f.meeting.input().getSnapshot().muted, true);
  assert.equal(f.meeting.getSnapshot().shared.error, null);
  f.entries[1].callbacks.onResult({ final: 'ignored while muted' });
  assert.equal(f.draft(), '');
});

test('shared recovery budget does not reset merely because start resolves', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = browserMeetingFixture();
  t.after(() => f.meeting.dispose());
  await f.meeting.start('shared', Promise.resolve(f.stream));
  for (const delay of [250, 500, 1000]) {
    f.entries.at(-1).callbacks.onError(transientRecognitionFailure());
    await flushRecovery();
    t.mock.timers.tick(delay - 1);
    await flushRecovery();
    const count = f.entries.length;
    t.mock.timers.tick(1);
    await flushRecovery();
    assert.equal(f.entries.length, count + 1);
    assert.equal(f.track.stops, 0);
  }
  f.entries.at(-1).callbacks.onError(transientRecognitionFailure());
  await flushRecovery();
  assert.equal(f.meeting.jobs.size, 0);
  assert.equal(f.track.readyState, 'ended');
  t.mock.timers.tick(10000);
  await flushRecovery();
  assert.equal(f.entries.length, 4);
});

test('stop, disposal and ended tracks cancel shared recovery without reacquiring capture', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const action of ['stop', 'dispose', 'track']) {
    const f = browserMeetingFixture();
    await f.meeting.start('shared', Promise.resolve(f.stream));
    const old = f.entries[0].callbacks;
    old.onError(transientRecognitionFailure());
    await flushRecovery();
    if (action === 'track') {
      f.track.readyState = 'ended';
      f.tracks[0]();
    } else if (action === 'stop') await f.meeting.stop('shared');
    else await f.meeting.dispose();
    t.mock.timers.tick(10000);
    await flushRecovery();
    old.onResult({ final: 'late words' });
    assert.equal(f.draft(), '');
    assert.equal(f.entries.length, 1);
    assert.equal(f.meeting.jobs.size, 0);
    await f.meeting.dispose();
  }
});

test('permanent, unknown and permission errors never retry shared recognition', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const code of [
    'not-allowed',
    'service-not-allowed',
    'language-not-supported',
    'restart-limit',
    undefined,
  ]) {
    const f = browserMeetingFixture();
    await f.meeting.start('shared', Promise.resolve(f.stream));
    f.entries[0].callbacks.onError(Object.assign(new Error('terminal'), { code }));
    await flushRecovery();
    t.mock.timers.tick(10000);
    await flushRecovery();
    assert.equal(f.entries.length, 1);
    assert.equal(f.meeting.jobs.size, 0);
    assert.equal(f.track.readyState, 'ended');
    await f.meeting.dispose();
  }
});

test('composer replacement retains sharing but rejects old recognition and delivery intent', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = browserMeetingFixture();
  t.after(() => f.meeting.dispose());
  await f.meeting.start('shared', Promise.resolve(f.stream));
  const old = f.entries[0].callbacks;
  f.meeting.composerReplaced();
  old.onResult({ final: 'previous conversation words' });
  assert.equal(f.draft(), '');
  await flushRecovery();
  t.mock.timers.tick(250);
  await flushRecovery();
  assert.equal(f.track.stops, 0);
  assert.equal(f.entries.length, 2);
  f.entries[1].callbacks.onResult({ final: 'current conversation words' });
  assert.equal(f.draft(), 'current conversation words');
});

test('failed recognition teardown blocks replacement but still releases shared capture', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = browserMeetingFixture();
  t.after(() => f.meeting.dispose());
  await f.meeting.start('shared', Promise.resolve(f.stream));
  f.entries[0].engine.stop = async () => {
    throw new Error('teardown failed');
  };
  f.entries[0].callbacks.onError(transientRecognitionFailure());
  await flushRecovery();
  t.mock.timers.tick(10000);
  await flushRecovery();
  assert.equal(f.entries.length, 1);
  assert.equal(f.track.readyState, 'ended');
});

test('shared recovery parks accepted delivery intent and resumes it only after recognition is ready', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const f = browserMeetingFixture();
  t.after(() => f.meeting.dispose());
  await f.meeting.start('shared', Promise.resolve(f.stream));
  f.meeting.input().updateSettings({ sendingMode: 'queue', autoSendDelaySeconds: 1 });
  f.entries[0].callbacks.onResult({ final: 'accepted delivery words' });
  assert.ok(f.meeting.input().getSnapshot().autoSendAt);
  f.entries[0].callbacks.onError(transientRecognitionFailure());
  f.meeting.refreshDeliveryReadiness();
  assert.equal(f.meeting.input().getSnapshot().autoSendAt, null);
  await flushRecovery();
  t.mock.timers.tick(250);
  await flushRecovery();
  assert.ok(f.meeting.input().getSnapshot().autoSendAt);
  t.mock.timers.tick(1000);
  assert.deepEqual(f.submissions, ['queue']);
});
