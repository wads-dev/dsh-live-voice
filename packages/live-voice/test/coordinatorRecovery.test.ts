// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceCoordinator } from '../src/modules/core/coordinator.ts';
import { isRetryableVoiceError } from '../src/modules/core/recovery.ts';
const turn = () => new Promise((resolve) => setImmediate(resolve));
const transient = () =>
  Object.assign(new Error('Temporary transport failure'), { code: 'network', retryable: true });
function fixture(t, settings = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const sessions = [],
    spoken = [];
  let draft = '';
  const recognition = {
    capability: async () => ({ supported: true }),
    start: async (options) => {
      sessions.push(options);
    },
    stop: async () => {},
  };
  const meter = { start: async () => true, stop: async () => {} };
  let stops = 0;
  const engine = {
    speak: (text, options) =>
      new Promise((resolve, reject) => spoken.push({ text, options, resolve, reject })),
    stop: async () => {
      stops++;
    },
    pause: async () => true,
    resume: async () => true,
  };
  const c = new VoiceCoordinator({
    recognition,
    meter,
    engines: { browser: engine },
    settings: { mode: 'headphones', segmentGapMs: 0, ...settings },
    composer: {
      getDraft: () => draft,
      setDraft: (value) => {
        draft = value;
      },
    },
  });
  t.after(() => c.dispose());
  return {
    c,
    recognition,
    meter,
    engine,
    sessions,
    spoken,
    stops: () => stops,
    draft: () => draft,
  };
}
test('input recovery preserves conversation, mute and independent speech; ignores stale callbacks', async (t) => {
  const f = fixture(t, { microphoneEnabled: false });
  await f.c.startConversation();
  const playback = f.c.play('Assistant answer', 'answer', true);
  await turn();
  const stops = f.stops();
  f.sessions[0].onError(transient());
  await turn();
  assert.equal(f.c.snapshot.conversation, true);
  assert.equal(f.c.snapshot.muted, true);
  assert.equal(f.c.snapshot.speaking, true);
  assert.equal(f.stops(), stops);
  assert.deepEqual(f.c.snapshot.inputRecovery, {
    attempt: 1,
    maxAttempts: 3,
    retrying: true,
    reason: 'network',
  });
  f.sessions[0].onResult({ text: 'stale text', final: true });
  assert.equal(f.draft(), '');
  t.mock.timers.tick(250);
  await turn();
  assert.equal(f.sessions.length, 2);
  assert.equal(f.c.snapshot.muted, true);
  f.sessions[1].onResult({ text: 'muted text', final: true });
  assert.equal(f.c.snapshot.inputRecovery, null);
  f.spoken[0].resolve();
  await playback;
});
test('native restart exhaustion gets bounded outer recovery', async (t) => {
  const f = fixture(t);
  await f.c.startConversation();
  const failure = () =>
    Object.assign(new Error('native restart exhausted'), {
      code: 'restart-limit',
      retryable: true,
    });
  for (const delay of [250, 500, 1000]) {
    f.sessions.at(-1).onError(failure());
    await turn();
    t.mock.timers.tick(delay);
    await turn();
  }
  f.sessions.at(-1).onError(failure());
  await turn();
  assert.equal(f.sessions.length, 4);
  assert.equal(f.c.snapshot.inputRecovery.retrying, false);
  t.mock.timers.tick(60000);
  await turn();
  assert.equal(f.sessions.length, 4);
});

test('input repeated callback failures exhaust three retries without ending conversation', async (t) => {
  const f = fixture(t);
  await f.c.startConversation();
  for (const delay of [250, 500, 1000]) {
    f.sessions.at(-1).onError(transient());
    await turn();
    t.mock.timers.tick(delay);
    await turn();
  }
  f.sessions.at(-1).onError(transient());
  await turn();
  assert.equal(f.sessions.length, 4);
  assert.equal(f.c.snapshot.inputRecovery.attempt, 3);
  assert.equal(f.c.snapshot.inputRecovery.retrying, false);
  assert.equal(f.c.snapshot.conversation, true);
  t.mock.timers.tick(10000);
  await turn();
  assert.equal(f.sessions.length, 4);
});
for (const action of ['stop', 'settings', 'dispose'])
  test('input backoff is invalidated by ' + action, async (t) => {
    const f = fixture(t);
    await f.c.startConversation();
    f.sessions[0].onError(transient());
    await turn();
    if (action === 'stop') await f.c.stopConversationInput();
    if (action === 'settings') f.c.updateSettings({ recognitionLang: 'fr-FR' });
    if (action === 'dispose') await f.c.dispose();
    t.mock.timers.tick(10000);
    await turn();
    assert.equal(f.sessions.length, 1);
    assert.equal(f.c.snapshot.inputRecovery, null);
  });
for (const code of ['NotAllowedError', 'unsupported', 'permanent'])
  test('input does not retry ' + code, async (t) => {
    const f = fixture(t);
    await f.c.startConversation();
    f.sessions[0].onError(Object.assign(new Error(code), { code, retryable: true }));
    await turn();
    t.mock.timers.tick(10000);
    await turn();
    assert.equal(f.sessions.length, 1);
    assert.equal(f.c.snapshot.inputRecovery.retrying, false);
  });
test('input teardown failure blocks retries', async (t) => {
  const f = fixture(t);
  await f.c.startConversation();
  f.recognition.stop = async () => {
    throw transient();
  };
  f.sessions[0].onError(transient());
  await turn();
  t.mock.timers.tick(10000);
  await turn();
  assert.equal(f.sessions.length, 1);
  assert.equal(f.c.snapshot.inputRecovery.reason, 'teardown-failed');
});
test('speech retries failed segment before unread queue and clears feedback on success', async (t) => {
  const f = fixture(t);
  const initial = f.c.play('First segment', 'a', true);
  await turn();
  f.c.queue.push({ text: 'Unread segment', id: 'b', manual: true });
  f.spoken[0].reject(transient());
  await initial;
  assert.deepEqual(
    f.c.queue.map((i) => i.text),
    ['First segment', 'Unread segment'],
  );
  assert.equal(f.c.snapshot.speechRecovery.retrying, true);
  t.mock.timers.tick(249);
  await turn();
  assert.equal(f.spoken.length, 1);
  t.mock.timers.tick(1);
  await turn();
  assert.equal(f.spoken[1].text, 'First segment');
  f.spoken[1].resolve();
  await turn();
  assert.equal(f.c.snapshot.speechRecovery, null);
  assert.equal(f.c.snapshot.speechError, null);
  assert.equal(f.spoken[2].text, 'Unread segment');
  f.spoken[2].resolve();
  await turn();
});
test('speech exhaustion parks failed segment and unread queue until manual resume', async (t) => {
  const f = fixture(t);
  const initial = f.c.play('First', 'a', true);
  await turn();
  f.c.queue.push({ text: 'Unread', id: 'b', manual: true });
  f.spoken.at(-1).reject(transient());
  await initial;
  for (const delay of [250, 500, 1000]) {
    t.mock.timers.tick(delay);
    await turn();
    f.spoken.at(-1).reject(transient());
    await turn();
  }
  assert.equal(f.spoken.length, 4);
  assert.equal(f.c.snapshot.paused, true);
  assert.equal(f.c.snapshot.speechRecovery.retrying, false);
  assert.deepEqual(
    f.c.queue.map((i) => i.text),
    ['First', 'Unread'],
  );
  t.mock.timers.tick(10000);
  await turn();
  assert.equal(f.spoken.length, 4);
  await f.c.resumeSpeech();
  await turn();
  assert.equal(f.spoken[4].text, 'First');
  f.spoken[4].resolve();
  await turn();
  f.spoken.at(-1).resolve();
  await turn();
});
for (const action of ['pause', 'stop', 'settings', 'dispose'])
  test('speech backoff respects ' + action, async (t) => {
    const f = fixture(t);
    const initial = f.c.play('First', 'a', true);
    await turn();
    f.spoken[0].reject(transient());
    await initial;
    if (action === 'pause') await f.c.pauseSpeech();
    if (action === 'stop') await f.c.stopSpeech(false);
    if (action === 'settings') f.c.updateSettings({ rate: 1.2 });
    if (action === 'dispose') await f.c.dispose();
    t.mock.timers.tick(10000);
    await turn();
    assert.equal(f.spoken.length, 1);
    if (action === 'pause' || action === 'settings') {
      assert.equal(f.c.snapshot.paused, true);
      assert.equal(f.c.queue.length, 1);
    }
  });
test('speech teardown failure parks queue without replacement', async (t) => {
  const f = fixture(t);
  const initial = f.c.play('First', 'a', true);
  await turn();
  f.engine.stop = async () => {
    throw transient();
  };
  f.spoken[0].reject(transient());
  await initial;
  t.mock.timers.tick(10000);
  await turn();
  assert.equal(f.spoken.length, 1);
  assert.equal(f.c.snapshot.speechRecovery.reason, 'teardown-failed');
  await f.c.resumeSpeech();
  await turn();
  assert.equal(f.spoken.length, 1);
});
test('settings changed during speech recovery teardown parks queue without stale retry', async (t) => {
  const f = fixture(t);
  const initial = f.c.play('First', 'a', true);
  await turn();
  let release;
  f.engine.stop = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  f.spoken[0].reject(transient());
  await turn();
  f.c.updateSettings({ rate: 1.3 });
  release();
  await initial;
  t.mock.timers.tick(10000);
  await turn();
  assert.equal(f.spoken.length, 1);
  assert.equal(f.c.snapshot.paused, true);
  f.engine.stop = async () => {};
});
test('speech navigation skips parked failed segment rather than retrying it', async (t) => {
  const f = fixture(t);
  const initial = f.c.play('Failed', 'a', true);
  await turn();
  f.c.queue.push({ text: 'Unread', id: 'b', manual: true });
  f.spoken[0].reject(Object.assign(new Error('permanent'), { retryable: false }));
  await initial;
  await f.c.skipSpeechSegment();
  await turn();
  assert.equal(f.spoken[1].text, 'Unread');
  f.spoken[1].resolve();
  await turn();
});
test('speaker retry still gates microphone before replacement playback', async (t) => {
  const f = fixture(t, { mode: 'speaker' });
  await f.c.startConversation();
  const initial = f.c.play('First', 'a', true);
  await turn();
  f.spoken[0].reject(transient());
  await initial;
  assert.equal(f.c.snapshot.listening, true);
  t.mock.timers.tick(250);
  await turn();
  assert.equal(f.c.snapshot.listening, false);
  assert.equal(f.spoken.length, 2);
  f.spoken[1].resolve();
  await turn();
});
test('failed active input releases its silence barrier without blocking queued speech', async (t) => {
  const f = fixture(t);
  await f.c.startConversation();
  f.sessions[0].onActivity(true);
  f.c.queue.push({ text: 'Independent answer', id: 'answer', manual: true });
  assert.equal(f.c.assistantSpeechNotBefore, Infinity);
  f.sessions[0].onError(Object.assign(new Error('permission denied'), { name: 'NotAllowedError' }));
  await turn();
  t.mock.timers.tick(6000);
  await turn();
  assert.equal(f.spoken.length, 1);
  f.spoken[0].resolve();
  await turn();
});

test('changing input mute does not cancel speech recovery', async (t) => {
  const f = fixture(t);
  const initial = f.c.play('First', 'a', true);
  await turn();
  f.spoken[0].reject(transient());
  await initial;
  f.c.muteListening();
  assert.equal(f.c.snapshot.speechRecovery.retrying, true);
  t.mock.timers.tick(250);
  await turn();
  assert.equal(f.spoken.length, 2);
  f.spoken[1].resolve();
  await turn();
});

test('recovery policy honors explicit non-retryability and conservative unknown failures', () => {
  assert.equal(isRetryableVoiceError(Object.assign(transient(), { retryable: false })), false);
  assert.equal(isRetryableVoiceError(new Error('unknown')), false);
});
