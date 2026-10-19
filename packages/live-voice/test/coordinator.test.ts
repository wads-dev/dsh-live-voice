// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceCoordinator } from '../src/modules/core/coordinator.ts';
const turn = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture(settings = {}) {
  settings = { segmentGapMs: 0, ...settings };
  const log = [],
    spoken = [],
    sessions = [];
  let draft = 'typed';
  let active;
  const recognition = {
    lang: 'old',
    async capability() {
      log.push('cap:' + this.lang);
      return { supported: true };
    },
    async start(options) {
      sessions.push(options);
      log.push('input:start');
    },
    async stop() {
      log.push('input:stop');
    },
    reset() {
      log.push('input:reset');
      return true;
    },
  };
  const meter = {
    async capability() {
      return { supported: true, permission: 'prompt' };
    },
    async start() {
      log.push('meter:start');
      return true;
    },
    async stop() {
      log.push('meter:stop');
    },
  };
  const engine = {
    capability() {
      return { supported: true };
    },
    speak(text) {
      log.push('speak:' + text);
      const done = deferred();
      active = done;
      spoken.push({ text, ...done });
      return done.promise;
    },
    async stop() {
      log.push('speech:stop');
      active?.reject(Object.assign(new Error('cancel'), { name: 'AbortError' }));
      active = null;
    },
    pause() {
      log.push('pause');
      return true;
    },
    resume() {
      log.push('resume');
      return true;
    },
  };
  const coordinator = new VoiceCoordinator({
    recognition,
    meter,
    engines: { browser: engine },
    settings,
    composer: {
      getDraft: () => draft,
      setDraft: (value) => {
        draft = value;
      },
    },
  });
  return { coordinator, recognition, meter, engine, spoken, sessions, log, draft: () => draft };
}

for (const delay of [0.6, 1.5]) {
  test('automatic playback waits through the exact quiet boundary: ' + delay, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    const f = fixture({ assistantSpeechDelaySeconds: delay });
    t.after(() => f.coordinator.dispose());
    await f.coordinator.startConversation();
    const input = f.sessions.at(-1);
    input.onActivity(true);
    f.coordinator.observeMessage('quiet', 'Wait for my turn.', { complete: true });
    input.onActivity(false);
    t.mock.timers.tick(delay * 1000 - 1);
    await turn();
    assert.equal(f.spoken.length, 0);
    input.onActivity(true);
    input.onActivity(false);
    t.mock.timers.tick(delay * 1000 - 1);
    await turn();
    assert.equal(f.spoken.length, 0);
    t.mock.timers.tick(1);
    await turn();
    assert.equal(f.spoken.length, 1);
  });
}

test('recording timeline distinguishes gating from real playback start and ignores stale starts', async () => {
  const f = fixture();
  const events = [];
  f.coordinator.recordingTimeline = () => (kind) => events.push(kind);
  let options;
  f.engine.speak = (_text, next) => {
    options = next;
    return new Promise((resolve) => {
      f.done = resolve;
    });
  };
  await f.coordinator.startConversation();
  const playback = f.coordinator.speak('A diagnostic answer.');
  await turn();
  assert.deepEqual(events, ['assistant-play-request', 'capture-gated', 'input-stop-complete']);
  assert.equal(f.coordinator.snapshot.listening, false);
  options.onPlaybackStart();
  options.onPlaybackStart();
  await f.coordinator.pauseSpeech();
  await f.coordinator.resumeSpeech();
  f.done();
  await playback;
  assert.deepEqual(events, [
    'assistant-play-request',
    'capture-gated',
    'input-stop-complete',
    'assistant-start',
    'assistant-pause',
    'assistant-resume',
    'assistant-end',
  ]);
  options.onPlaybackStart();
  assert.equal(events.filter((e) => e === 'assistant-start').length, 1);
  await f.coordinator.dispose();
});

test('overconstrained selected microphone is persisted as system default and retried once', async () => {
  const f = fixture({ inputDeviceId: 'disconnected', recognitionLang: 'pt-BR' });
  const saved = [];
  f.coordinator.persistSettings = async (next) => saved.push(next);
  const devices = [];
  f.meter.start = async () => {
    devices.push(f.meter.deviceId);
    if (devices.length === 1)
      throw Object.assign(new Error('unavailable'), { name: 'OverconstrainedError' });
    return true;
  };
  await f.coordinator.startDictation();
  assert.deepEqual(devices, ['disconnected', '']);
  assert.deepEqual(saved, [{ inputDeviceId: '' }]);
  assert.equal(f.coordinator.snapshot.settings.inputDeviceId, '');
  assert.equal(f.coordinator.snapshot.settings.recognitionLang, 'pt-BR');
  assert.equal(f.coordinator.snapshot.listening, true);
  assert.equal(f.coordinator.snapshot.error, null);
  await f.coordinator.dispose();
});

test('default microphone failure is not retried and permission denial preserves selection', async () => {
  for (const [deviceId, name, expectedCalls] of [
    ['', 'OverconstrainedError', 1],
    ['selected', 'NotAllowedError', 1],
    ['selected', 'OverconstrainedError', 2],
  ]) {
    const f = fixture({ inputDeviceId: deviceId });
    let calls = 0;
    f.meter.start = async () => {
      calls++;
      throw Object.assign(new Error('capture failed'), { name });
    };
    await f.coordinator.startDictation();
    assert.equal(calls, expectedCalls);
    assert.equal(
      f.coordinator.snapshot.settings.inputDeviceId,
      expectedCalls === 2 ? '' : deviceId,
    );
    assert.equal(f.coordinator.snapshot.listening, false);
    assert.match(f.coordinator.snapshot.error, /capture failed/);
    await f.coordinator.dispose();
  }
});

test('obsolete constraint failure cannot reset a newer microphone selection', async () => {
  const f = fixture({ inputDeviceId: 'old' });
  const pending = deferred();
  let saved = 0;
  f.coordinator.persistSettings = () => saved++;
  f.meter.start = () => pending.promise;
  const starting = f.coordinator.startDictation();
  await turn();
  f.coordinator.updateSettings({ inputDeviceId: 'new' });
  pending.reject(Object.assign(new Error('obsolete'), { name: 'OverconstrainedError' }));
  await starting;
  assert.equal(f.coordinator.snapshot.settings.inputDeviceId, 'new');
  assert.equal(saved, 0);
  await f.coordinator.dispose();
});

test('cancellation during default preference persistence prevents capture retry', async () => {
  const f = fixture({ inputDeviceId: 'old' });
  const pending = deferred();
  let calls = 0;
  f.coordinator.persistSettings = () => pending.promise;
  f.meter.start = async () => {
    calls++;
    throw Object.assign(new Error('unavailable'), { name: 'OverconstrainedError' });
  };
  const starting = f.coordinator.startDictation();
  await turn();
  await f.coordinator.stopListening();
  await starting;
  pending.resolve();
  await turn();
  assert.equal(calls, 1);
  assert.equal(f.coordinator.snapshot.listening, false);
  await f.coordinator.dispose();
});

test('configuration capability discovery never probes providers or installs recognition packs', async () => {
  const f = fixture();
  f.engine.voices = () => [{ name: 'Local', voiceURI: 'local', lang: 'pt-BR' }];
  f.engine.getPlaybackCapabilities = () => ({ pause: true, resume: true });
  f.engine.capability = () => assert.fail('configuration must not check synthesis health');
  f.recognition.capability = () => assert.fail('configuration must not check recognition health');
  f.coordinator.engines.remote = {
    capability: () => assert.fail('no HTTP health during configuration'),
  };
  await f.coordinator.refreshCapabilities({ localOnly: true });
  assert.equal(f.coordinator.snapshot.capabilities.browser.voices[0].voiceURI, 'local');
  assert.equal(f.coordinator.snapshot.capabilities.browser.pause, true);
  assert.equal(f.coordinator.snapshot.capabilities.capture.supported, true);
  delete f.coordinator.engines.remote;
  await f.coordinator.dispose();
});

test('speech capability publishes before pending recognition discovery', async () => {
  const f = fixture();
  const pending = deferred();
  f.recognition.capability = () => pending.promise;
  const refresh = f.coordinator.refreshCapabilities();
  await turn();
  assert.equal(f.coordinator.snapshot.capabilities.browser.supported, true);
  assert.equal(f.coordinator.snapshot.capabilities.recognition, undefined);
  pending.resolve({ supported: false });
  await refresh;
  assert.equal(f.coordinator.snapshot.capabilities.browser.supported, true);
  await f.coordinator.dispose();
});

test('late capability refresh cannot overwrite newer device availability', async () => {
  const f = fixture();
  const first = deferred();
  let calls = 0;
  f.engine.capability = () => (++calls === 1 ? first.promise : { supported: true });
  const old = f.coordinator.refreshCapabilities();
  await f.coordinator.refreshCapabilities();
  first.resolve({ supported: false, reason: 'Stale' });
  await old;
  assert.equal(f.coordinator.snapshot.capabilities.browser.supported, true);
  await f.coordinator.dispose();
});

test('end conversation does not wait for hung capability discovery', async () => {
  const f = fixture();
  f.recognition.capability = () => new Promise(() => {});
  const start = f.coordinator.startConversation();
  await turn();
  await f.coordinator.endConversation();
  await start;
  assert.equal(f.coordinator.snapshot.starting, false);
  assert.equal(f.coordinator.snapshot.listening, false);
  await f.coordinator.dispose();
});

test('speaker gating reserves playback and preserves incoming chunk order', async () => {
  const f = fixture();
  await f.coordinator.startConversation();
  f.coordinator.observeMessage('a', 'First.\n');
  assert.equal(f.coordinator.snapshot.speaking, true);
  f.coordinator.observeMessage('a', 'First.\nSecond.\n');
  assert.equal(f.coordinator.snapshot.speechSegmentsRemaining, 2);
  await turn();
  assert.deepEqual(
    f.spoken.map((item) => item.text),
    ['First.'],
  );
  assert.equal(f.coordinator.snapshot.listening, false);
  assert.ok(f.log.lastIndexOf('input:stop') < f.log.indexOf('speak:First.'));
  f.spoken[0].resolve();
  await turn();
  assert.equal(f.coordinator.snapshot.speechSegmentsRemaining, 1);
  assert.deepEqual(
    f.spoken.map((item) => item.text),
    ['First.', 'Second.'],
  );
  f.spoken[1].resolve();
  await turn();
  assert.equal(f.coordinator.snapshot.speechSegmentsRemaining, 0);
  assert.equal(f.coordinator.snapshot.listening, true);
  await f.coordinator.dispose();
});

for (const mode of ['headphones', 'speaker']) {
  test('mic mode toggles preserve manual playback and its queue in ' + mode, async () => {
    const f = fixture({ mode });
    const c = f.coordinator;
    const playing = c.speak('First sentence.\nSecond sentence.', 'manual');
    await turn();
    const epoch = c.speechEpoch;
    const stops = f.log.filter((item) => item === 'speech:stop').length;
    await c.startConversation();
    assert.equal(c.snapshot.conversation, true);
    assert.equal(c.snapshot.listening, mode === 'headphones');
    assert.equal(c.snapshot.speaking, true);
    assert.equal(c.speechEpoch, epoch);
    assert.equal(c.snapshot.speechSegmentsRemaining, 2);
    await c.stopConversationInput();
    assert.equal(c.snapshot.conversation, false);
    assert.equal(c.snapshot.listening, false);
    assert.equal(c.snapshot.speaking, true);
    assert.equal(c.snapshot.activeMessageId, 'manual');
    assert.equal(c.speechEpoch, epoch);
    assert.equal(f.log.filter((item) => item === 'speech:stop').length, stops);
    f.spoken[0].resolve();
    await turn();
    assert.equal(f.spoken[1].text, 'Second sentence.');
    f.spoken[1].resolve();
    await playing;
    await turn();
    assert.equal(
      c.snapshot.listening,
      false,
      'closing mic prevents completion from reopening capture',
    );
    assert.equal(c.snapshot.speechRunActive, false);
    await c.dispose();
  });
}

test('speaker mode defers newly enabled input until manual playback finishes', async () => {
  const f = fixture({ mode: 'speaker' });
  const playing = f.coordinator.speak('Answer', 'manual');
  await turn();
  await f.coordinator.startConversation();
  assert.equal(f.sessions.length, 0);
  f.spoken[0].resolve();
  await playing;
  assert.equal(f.coordinator.snapshot.listening, true);
  await f.coordinator.dispose();
});

test('paused playback survives mic start and stop without resuming or clearing captions', async () => {
  const f = fixture({ mode: 'speaker' });
  const playing = f.coordinator.speak('Answer', 'manual');
  await turn();
  await f.coordinator.pauseSpeech();
  await f.coordinator.startConversation();
  assert.equal(f.coordinator.snapshot.listening, true);
  await f.coordinator.stopConversationInput();
  assert.equal(f.coordinator.snapshot.paused, true);
  assert.equal(f.coordinator.snapshot.speechText, 'Answer');
  assert.equal(f.log.includes('resume'), false);
  await f.coordinator.stopSpeech(false);
  await playing;
  await f.coordinator.dispose();
});

test('explicit microphone takeover still cancels playback before capture', async () => {
  const f = fixture();
  const playing = f.coordinator.speak('Answer', 'manual');
  await turn();
  await f.coordinator.takeMicrophone();
  await playing;
  assert.equal(f.coordinator.snapshot.speaking, false);
  assert.equal(f.coordinator.snapshot.listening, true);
  assert.equal(f.coordinator.snapshot.speechRunActive, false);
  await f.coordinator.dispose();
});

test('automatic speech streams once with microphone mode off and never starts capture', async () => {
  const f = fixture();
  const c = f.coordinator;
  c.observeMessage('history', 'Loaded history.', { complete: true, baseline: true });
  c.observeMessage('stream', 'First');
  await turn();
  assert.equal(f.spoken.length, 0, 'wait for a stable paragraph or completion');
  c.observeMessage('stream', 'First.\nSecond');
  await turn();
  assert.deepEqual(
    f.spoken.map((item) => item.text),
    ['First.'],
  );
  c.observeMessage('stream', 'First.\nSecond.', { complete: true });
  c.observeMessage('stream', 'First.\nSecond.', { complete: true });
  f.spoken[0].resolve();
  await turn();
  assert.deepEqual(
    f.spoken.map((item) => item.text),
    ['First.', 'Second.'],
  );
  f.spoken[1].resolve();
  await turn();
  assert.equal(c.snapshot.conversation, false);
  assert.equal(c.snapshot.listening, false);
  assert.equal(f.sessions.length, 0);
  assert.ok(!f.log.includes('meter:start'));
  await c.dispose();
});

test('automatic speech continues accepting segments after mic mode is closed', async () => {
  const f = fixture({ mode: 'headphones' });
  await f.coordinator.startConversation();
  f.coordinator.observeMessage('stream', 'First.\nSecond.\n');
  await turn();
  await f.coordinator.stopConversationInput();
  f.coordinator.observeMessage('stream', 'First.\nSecond.\nThird.', { complete: true });
  f.spoken[0].resolve();
  await turn();
  assert.equal(f.spoken[1].text, 'Second.');
  f.spoken[1].resolve();
  await turn();
  assert.equal(f.spoken[2].text, 'Third.');
  f.spoken[2].resolve();
  await turn();
  assert.equal(f.spoken.length, 3);
  assert.equal(f.coordinator.snapshot.listening, false);
  await f.coordinator.dispose();
});

test('headphones retain capture during playback', async () => {
  const f = fixture({ mode: 'headphones' });
  await f.coordinator.startConversation();
  f.coordinator.observeMessage('a', 'Answer', { complete: true });
  await turn();
  assert.equal(f.coordinator.snapshot.speaking, true);
  assert.equal(f.coordinator.snapshot.listening, true);
  assert.equal(f.coordinator.snapshot.listening, true);
  await f.coordinator.stopSpeech(false);
  await f.coordinator.dispose();
});

test('global stop invalidates result callbacks and stops every resource', async () => {
  const f = fixture({ mode: 'headphones' });
  await f.coordinator.startConversation();
  const callbacks = f.sessions.at(-1);
  f.coordinator.observeMessage('a', 'Answer', { complete: true });
  await turn();
  await f.coordinator.endConversation();
  callbacks.onResult({ final: 'stale' });
  callbacks.onActivity(true);
  assert.equal(f.draft(), 'typed');
  for (const key of ['conversation', 'listening', 'recognizing', 'speaking', 'paused', 'starting'])
    assert.equal(f.coordinator.snapshot[key], false, key);
  assert.ok(f.log.includes('meter:stop'));
  await f.coordinator.dispose();
});

test('late microphone start is released before replacement capture begins', async () => {
  const f = fixture();
  const gate = deferred();
  let starts = 0;
  f.meter.start = async () => {
    f.log.push('meter:start');
    return ++starts === 1 ? gate.promise : true;
  };
  const first = f.coordinator.startConversation();
  await turn();
  const second = f.coordinator.startDictation();
  gate.resolve(true);
  await Promise.all([first, second]);
  assert.equal(f.sessions.length, 1);
  assert.equal(f.coordinator.snapshot.listening, true);
  assert.equal(f.coordinator.snapshot.conversation, false);
  await f.coordinator.dispose();
});

test('late recognition start and callbacks cannot survive disposal', async () => {
  const f = fixture();
  const gate = deferred();
  f.recognition.start = async (options) => {
    f.sessions.push(options);
    await gate.promise;
  };
  const starting = f.coordinator.startConversation();
  await turn();
  const disposed = f.coordinator.dispose();
  f.sessions[0].onResult({ final: 'stale' });
  gate.resolve();
  await Promise.all([starting, disposed]);
  assert.equal(f.draft(), 'typed');
  assert.equal(f.coordinator.snapshot.listening, false);
  await f.coordinator.startConversation();
  await f.coordinator.speak('never');
  assert.equal(f.spoken.length, 0);
});

test('manual speech uses the same segmented queue and counter as streaming speech', async () => {
  const f = fixture({ mode: 'headphones' });
  await f.coordinator.startConversation();
  void f.coordinator.speak('First sentence.\nSecond sentence!\nThird line.');
  await turn();
  assert.equal(f.coordinator.snapshot.speechSegmentsRemaining, 3);
  assert.deepEqual(
    f.spoken.map((item) => item.text),
    ['First sentence.'],
  );
  f.spoken[0].resolve();
  await turn();
  assert.equal(f.coordinator.snapshot.speechSegmentsRemaining, 2);
  assert.deepEqual(
    f.spoken.map((item) => item.text),
    ['First sentence.', 'Second sentence!'],
  );
  f.spoken[1].resolve();
  await turn();
  f.spoken[2].resolve();
  await turn();
  assert.equal(f.coordinator.snapshot.speechSegmentsRemaining, 0);
  await f.coordinator.dispose();
});

test('concurrent manual speech requests cannot start obsolete text', async () => {
  const f = fixture();
  const first = f.coordinator.speak('obsolete');
  const second = f.coordinator.speak('latest');
  await turn();
  assert.deepEqual(
    f.spoken.map((item) => item.text),
    ['latest'],
  );
  f.spoken[0].resolve();
  await Promise.all([first, second]);
  await f.coordinator.dispose();
});

test('capability sees updated recognition language; failed input startup cleans both resources', async () => {
  const f = fixture();
  f.coordinator.updateSettings({ recognitionLang: 'en-US' });
  await f.coordinator.refreshCapabilities();
  assert.ok(f.log.includes('cap:en-US'));
  f.meter.start = async () => false;
  await f.coordinator.startConversation();
  assert.equal(f.coordinator.snapshot.starting, false);
  assert.equal(f.coordinator.snapshot.conversation, false);
  assert.match(f.coordinator.snapshot.error, /Microphone/);
  assert.ok(f.log.includes('input:stop'));
  await f.coordinator.dispose();
});

test('cleanup failure still attempts all resources and exposes an error', async () => {
  const f = fixture();
  await f.coordinator.startConversation();
  f.recognition.stop = async () => {
    throw new Error('input failure');
  };
  await f.coordinator.endConversation();
  assert.match(f.coordinator.snapshot.error, /input failure/);
  assert.ok(f.log.includes('meter:stop'));
  assert.ok(f.log.includes('speech:stop'));
  await f.coordinator.dispose();
});

test('failed speaker gate prevents playback rather than speaking over capture', async () => {
  const f = fixture();
  await f.coordinator.startConversation();
  f.recognition.stop = async () => {
    throw new Error('cannot gate');
  };
  f.coordinator.observeMessage('a', 'Answer', { complete: true });
  await turn();
  assert.equal(f.spoken.length, 0);
  assert.match(f.coordinator.snapshot.error, /cannot gate/);
  assert.equal(f.coordinator.snapshot.speaking, false);
  await f.coordinator.dispose();
});

test('failed speech teardown blocks replacement playback and microphone startup', async () => {
  const f = fixture();
  f.engine.stop = async () => {
    throw new Error('cannot stop playback');
  };
  await f.coordinator.speak('unsafe');
  assert.equal(f.spoken.length, 0);
  await f.coordinator.startConversation();
  assert.equal(f.sessions.length, 0);
  assert.match(f.coordinator.snapshot.error, /cannot stop playback/);
  await f.coordinator.dispose();
});

test('engine failures retain diagnostics after automatic listening recovery', async () => {
  const f = fixture();
  await f.coordinator.startConversation();
  f.coordinator.observeMessage('a', 'Answer', { complete: true });
  await turn();
  f.spoken[0].reject(new Error('synthesis failure'));
  await turn();
  assert.equal(f.coordinator.snapshot.listening, true);
  assert.match(f.coordinator.snapshot.error, /synthesis failure/);
  await f.coordinator.dispose();
});

test('late pause result cannot resurrect naturally completed playback state', async () => {
  const f = fixture({ mode: 'headphones' });
  const gate = deferred();
  f.engine.pause = () => gate.promise;
  f.coordinator.speak('Answer');
  await turn();
  const paused = f.coordinator.pauseSpeech();
  f.spoken[0].resolve();
  await turn();
  gate.resolve(true);
  await paused;
  assert.equal(f.coordinator.snapshot.speaking, false);
  assert.equal(f.coordinator.snapshot.paused, false);
  await f.coordinator.dispose();
});

test('late pause result cannot resurrect stopped playback state', async () => {
  const f = fixture({ mode: 'headphones' });
  const gate = deferred();
  f.engine.pause = () => gate.promise;
  await f.coordinator.startConversation();
  f.coordinator.observeMessage('a', 'Answer', { complete: true });
  await turn();
  const paused = f.coordinator.pauseSpeech();
  await f.coordinator.endConversation();
  gate.resolve(true);
  await paused;
  assert.equal(f.coordinator.snapshot.paused, false);
  await f.coordinator.dispose();
});

test('disabled automatic assistant announcements consume text without queueing speech', async () => {
  const f = fixture({ announceAssistantMessages: false });
  await f.coordinator.startConversation();
  f.coordinator.observeMessage('silent', 'Do not announce this.', { complete: true });
  await turn();
  assert.deepEqual(f.spoken, []);
  f.coordinator.updateSettings({ announceAssistantMessages: true });
  f.coordinator.observeMessage('silent', 'Do not announce this.', { complete: true });
  await turn();
  assert.deepEqual(f.spoken, [], 'enabling does not replay text observed while disabled');
  await f.coordinator.dispose();
});

for (const mode of ['headphones', 'speaker']) {
  for (const paused of [false, true]) {
    test(
      'disabling automatic speech cancels playback and its run in ' +
        mode +
        (paused ? ' while paused' : ''),
      async () => {
        const f = fixture({ mode });
        const c = f.coordinator;
        await c.startConversation();
        c.observeMessage('stream', 'First sentence. Second sentence.\n');
        await turn();
        assert.equal(c.snapshot.speaking, true);
        assert.ok(c.queue.length > 0);
        if (paused) await c.pauseSpeech();

        c.updateSettings({ announceAssistantMessages: false });
        assert.equal(c.snapshot.settings.announceAssistantMessages, false);
        assert.equal(c.snapshot.speaking, false);
        assert.equal(c.snapshot.paused, false);
        assert.equal(c.snapshot.speechLoading, false);
        assert.equal(c.snapshot.speechText, null);
        assert.equal(c.snapshot.speechEngine, null);
        assert.equal(c.snapshot.activeMessageId, null);
        assert.equal(c.snapshot.speechSegmentsRemaining, 0);
        assert.equal(c.snapshot.speechSegmentsTotal, 0);
        assert.equal(c.snapshot.speechRunActive, false);
        assert.deepEqual(c.getSpeechHistory(), []);
        await c.speechBarrier;
        await turn();
        assert.ok(f.log.includes('speech:stop'));
        assert.equal(c.snapshot.conversation, true);
        assert.equal(c.snapshot.listening, true);

        c.updateSettings({ announceAssistantMessages: true });
        c.observeMessage('stream', 'First sentence. Second sentence.\nLate continuation.', {
          complete: true,
        });
        await turn();
        assert.equal(
          f.spoken.length,
          1,
          'cancelled streaming response cannot restart after re-enabling',
        );
        c.observeMessage('new', 'New reply.', { complete: true });
        await turn();
        assert.equal(f.spoken.at(-1).text, 'New reply.');
        await c.dispose();
      },
    );
  }
}

test('disabling automatic speech invalidates pending synthesis with input closed', async () => {
  const f = fixture();
  const pending = deferred();
  let disposed = 0;
  f.engine.prepare = () => pending.promise;
  f.engine.playPrepared = () => assert.fail('obsolete prepared audio must not play');
  f.coordinator.observeMessage('preparing', 'Preparing reply.', { complete: true });
  await turn();
  assert.equal(f.coordinator.snapshot.speechLoading, true);
  const epoch = f.coordinator.speechEpoch;
  f.coordinator.updateSettings({ announceAssistantMessages: false });
  assert.ok(f.coordinator.speechEpoch > epoch);
  assert.equal(f.coordinator.snapshot.speaking, false);
  assert.equal(f.coordinator.snapshot.speechLoading, false);
  await f.coordinator.speechBarrier;
  pending.resolve({ dispose: () => disposed++ });
  await turn();
  assert.ok(disposed > 0);
  assert.equal(f.coordinator.snapshot.speechRunActive, false);
  assert.equal(f.coordinator.snapshot.speechText, null);
  assert.equal(f.coordinator.snapshot.listening, false);
  assert.equal(f.coordinator.snapshot.conversation, false);
  await f.coordinator.dispose();
});

test('disabling automatic speech clears a segment-gap timer and waiting speech run', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const f = fixture({ segmentGapMs: 1000 });
  f.coordinator.observeMessage('gap', 'First sentence. Second sentence.\n');
  await turn();
  f.spoken[0].resolve();
  await turn();
  assert.equal(f.coordinator.snapshot.speaking, false);
  assert.equal(f.coordinator.snapshot.speechRunActive, true);
  assert.ok(f.coordinator.assistantSpeechTimer);
  f.coordinator.updateSettings({ announceAssistantMessages: false });
  assert.equal(f.coordinator.assistantSpeechTimer, null);
  assert.equal(f.coordinator.assistantSpeechNotBefore, 0);
  assert.equal(f.coordinator.snapshot.speechRunActive, false);
  assert.equal(f.coordinator.snapshot.speechSegmentsRemaining, 0);
  f.coordinator.updateSettings({ announceAssistantMessages: true });
  t.mock.timers.tick(2000);
  await turn();
  assert.equal(f.spoken.length, 1);
  await f.coordinator.dispose();
});

test('manual playback remains available with automatic speech disabled and unchanged preferences', async () => {
  const f = fixture({ announceAssistantMessages: false });
  const playing = f.coordinator.speak('Manual reply. Another sentence.', 'manual');
  await turn();
  const stops = f.log.filter((entry) => entry === 'speech:stop').length;
  f.coordinator.updateSettings({ announceAssistantMessages: false });
  assert.equal(f.coordinator.snapshot.speaking, true);
  assert.equal(f.log.filter((entry) => entry === 'speech:stop').length, stops);
  f.spoken[0].resolve();
  await playing;
  await turn();
  assert.equal(f.spoken.length, 2);
  await f.coordinator.dispose();
});

test('turning off automatic assistant speech discards delayed queued phrases', async () => {
  const f = fixture({ assistantSpeechDelaySeconds: 1.5 });
  await f.coordinator.startConversation();
  const callbacks = f.sessions.at(-1);
  callbacks.onActivity(true);
  f.coordinator.observeMessage('queued', 'Do not speak later.', { complete: true });
  assert.equal(f.coordinator.queue.length, 1);
  f.coordinator.updateSettings({ announceAssistantMessages: false });
  assert.equal(f.coordinator.queue.length, 0);
  callbacks.onActivity(false);
  await new Promise((resolve) => setTimeout(resolve, 2100));
  assert.deepEqual(f.spoken, []);
  await f.coordinator.dispose();
});

test('headphone interruption requires qualifying transcript and sustained activity', async () => {
  const f = fixture({ mode: 'headphones', recognitionMinimumWords: 2 });
  f.coordinator.snapshot.settings.assistantSpeechDelaySeconds = 0.1;
  await f.coordinator.startConversation();
  void f.coordinator.speak('A sufficiently long answer');
  await turn();

  f.sessions[0].onActivity(true);
  await new Promise((resolve) => setTimeout(resolve, 110));
  assert.equal(
    f.log.includes('pause'),
    false,
    'activity without transcript does not pause playback',
  );
  f.sessions[0].onActivity(false);

  f.sessions[0].onActivity(true);
  f.sessions[0].onResult({ interim: '' });
  await new Promise((resolve) => setTimeout(resolve, 110));
  assert.equal(f.log.includes('pause'), false, 'empty recognition does not pause playback');
  f.sessions[0].onActivity(false);

  f.sessions[0].onActivity(true);
  f.sessions[0].onResult({ interim: 'hello' });
  await new Promise((resolve) => setTimeout(resolve, 110));
  assert.equal(f.coordinator.snapshot.paused, true);
  f.sessions[0].onActivity(false);
  await new Promise((resolve) => setTimeout(resolve, 110));
  assert.equal(f.coordinator.snapshot.paused, false);
  assert.ok(f.log.includes('resume'));
  await f.coordinator.stopSpeech(false);
  await f.coordinator.dispose();
});

test('voice commands run before the minimum-word filter and never enter the composer', async () => {
  const f = fixture({ recognitionMinimumWords: 2 });
  const submitted = [];
  f.coordinator.composer.submit = (mode) => submitted.push(mode);
  await f.coordinator.startConversation();
  const commandEvents = [];
  f.sessions[0].onResult({
    final: 'SEND!!!',
    onCommandRecognized: (command) => commandEvents.push(command),
  });
  assert.deepEqual(commandEvents, ['send']);
  assert.deepEqual(submitted, ['steer']);
  assert.equal(f.coordinator.snapshot.settings.sendingMode, 'manual');
  assert.equal(f.draft(), 'typed');
  f.sessions[0].onResult({ final: 'queue.' });
  assert.deepEqual(submitted, ['steer', 'queue']);
  assert.equal(f.coordinator.snapshot.settings.sendingMode, 'manual');
  assert.equal(f.draft(), 'typed');
  f.sessions[0].onResult({ final: 'END' });
  await turn();
  assert.equal(f.coordinator.snapshot.conversation, false);
  assert.equal(f.draft(), 'typed');
  await f.coordinator.dispose();
});

for (const sendingMode of ['manual', 'queue', 'steer']) {
  test(
    'spoken delivery preserves ' + sendingMode + ' preferences and never persists a mode change',
    async () => {
      const f = fixture({ sendingMode });
      await f.coordinator.startConversation();
      const saved = [];
      const submitted = [];
      const update = f.coordinator.updateSettings.bind(f.coordinator);
      f.coordinator.updateSettings = (next) => {
        saved.push(next);
        update(next);
      };
      f.coordinator.composer.submit = (mode) => submitted.push(mode);
      for (const command of ['send', 'queue']) {
        f.sessions[0].onResult({ final: command });
        assert.equal(f.coordinator.snapshot.settings.sendingMode, sendingMode);
        assert.equal(f.coordinator.snapshot.autoSendAt, null);
      }
      assert.deepEqual(submitted, ['steer', 'queue']);
      assert.deepEqual(saved, [], 'one-shot commands must not invoke settings persistence');
      f.sessions[0].onResult({ final: 'more dictated words' });
      assert.equal(f.coordinator.snapshot.autoSendAt === null, sendingMode === 'manual');
      await f.coordinator.dispose();
    },
  );
}

test('clear command removes all composer text and cancels pending automatic delivery', async () => {
  const f = fixture({ sendingMode: 'queue', autoSendDelaySeconds: 2 });
  await f.coordinator.startConversation();
  f.coordinator.composer.submit = () => {};
  f.sessions[0].onResult({ final: 'some useful words' });
  assert.ok(f.coordinator.snapshot.autoSendAt);
  f.sessions[0].onResult({ final: 'clear all!' });
  assert.equal(f.draft(), '');
  assert.equal(f.coordinator.snapshot.autoSendAt, null);
  await f.coordinator.dispose();
});

for (const announceAssistantMessages of [true, false]) {
  test(
    'stop-speaking command stops playback with automatic speech ' +
      (announceAssistantMessages ? 'on' : 'off'),
    async () => {
      const f = fixture({ mode: 'headphones', announceAssistantMessages });
      await f.coordinator.startConversation();
      void f.coordinator.speak('A long spoken response');
      await turn();
      f.sessions[0].onResult({ final: 'shut up!' });
      await turn();
      assert.equal(f.coordinator.snapshot.settings.announceAssistantMessages, false);
      assert.equal(f.coordinator.snapshot.speaking, false);
      assert.equal(f.coordinator.snapshot.listening, true);
      await f.coordinator.dispose();
    },
  );
}

test('soft mute keeps recognition active, ignores dictation, and accepts resume command', async () => {
  const f = fixture({
    voiceCommandMute: 'mute, ignore me',
    voiceCommandResume: 'resume, listen again',
  });
  await f.coordinator.startConversation();
  f.sessions[0].onResult({ final: 'ignore me' });
  assert.equal(f.coordinator.snapshot.muted, true);
  assert.equal(f.coordinator.snapshot.listening, true);
  f.sessions[0].onResult({ final: 'this must be ignored' });
  assert.equal(f.draft(), 'typed');
  f.sessions[0].onResult({ final: 'listen again' });
  assert.equal(f.coordinator.snapshot.muted, false);
  f.sessions[0].onResult({ final: 'normal dictation' });
  assert.equal(f.draft(), 'typed normal dictation');
  await f.coordinator.dispose();
});

test('disabled voice commands continue through normal recognition filtering', async () => {
  const f = fixture({ voiceCommandsEnabled: false, recognitionMinimumWords: 2 });
  await f.coordinator.startConversation();
  f.sessions[0].onResult({ final: 'send' });
  assert.equal(f.draft(), 'typed');
  f.sessions[0].onResult({ final: 'send message' });
  assert.equal(f.draft(), 'typed send message');
  await f.coordinator.dispose();
});

test('automatic sending waits after a final phrase and remains cancellable', async () => {
  const submitted = [];
  const f = fixture({ sendingMode: 'queue', autoSendDelaySeconds: 2 });
  f.coordinator.composer.submit = () => submitted.push(f.draft());
  await f.coordinator.startDictation();
  f.sessions[0].onResult({ final: 'hello world' });
  assert.ok(f.coordinator.snapshot.autoSendAt);
  f.coordinator.cancelAutoSend();
  assert.equal(f.coordinator.snapshot.autoSendAt, null);
  await new Promise((resolve) => setTimeout(resolve, 2100));
  assert.deepEqual(submitted, []);
  await f.coordinator.dispose();
});

test('automatic sending uses DSH submit only when the draft is still unchanged', async () => {
  const submitted = [];
  const f = fixture({ sendingMode: 'queue', autoSendDelaySeconds: 2 });
  f.coordinator.composer.submit = () => submitted.push(f.draft());
  await f.coordinator.startDictation();
  f.sessions[0].onResult({ final: 'hello world' });
  await new Promise((resolve) => setTimeout(resolve, 2100));
  assert.deepEqual(submitted, ['typed hello world']);
  await f.coordinator.dispose();
});

test('successful automatic send resets recognition before the next utterance', async () => {
  const submitted = [];
  const f = fixture({ sendingMode: 'queue', autoSendDelaySeconds: 2 });
  f.coordinator.composer.submit = () => submitted.push(f.draft());
  await f.coordinator.startDictation();
  f.sessions[0].onResult({ final: 'hello world' });
  await new Promise((resolve) => setTimeout(resolve, 2100));

  assert.deepEqual(submitted, ['typed hello world']);
  assert.equal(f.log.filter((entry) => entry === 'input:reset').length, 1);
  await f.coordinator.dispose();
});

test('steer delivery passes the direct mode to the DSH composer', async () => {
  const submitted = [];
  const f = fixture({ sendingMode: 'steer', autoSendDelaySeconds: 2 });
  f.coordinator.composer.submit = (mode) => submitted.push([f.draft(), mode]);
  await f.coordinator.startDictation();
  f.sessions[0].onResult({ final: 'interrupt now' });
  await new Promise((resolve) => setTimeout(resolve, 2100));
  assert.deepEqual(submitted, [['typed interrupt now', 'steer']]);
  await f.coordinator.dispose();
});

test('new speech activity cancels a pending automatic send', async () => {
  const submitted = [];
  const f = fixture({ sendingMode: 'queue', autoSendDelaySeconds: 2 });
  f.coordinator.composer.submit = () => submitted.push(f.draft());
  await f.coordinator.startDictation();
  f.sessions[0].onResult({ final: 'hello world' });
  assert.ok(f.coordinator.snapshot.autoSendAt);
  f.sessions[0].onActivity(true);
  assert.equal(f.coordinator.snapshot.autoSendAt, null);
  await new Promise((resolve) => setTimeout(resolve, 2100));
  assert.deepEqual(submitted, []);
  await f.coordinator.dispose();
});

test('a breathing pause cannot start queued assistant speech and renewed speech restarts delay', async () => {
  const f = fixture({ assistantSpeechDelaySeconds: 1.5 });
  await f.coordinator.startConversation();
  const callbacks = f.sessions.at(-1);
  callbacks.onActivity(true);
  f.coordinator.observeMessage('a', 'Wait for me.', { complete: true });
  callbacks.onActivity(false);
  await new Promise((resolve) => setTimeout(resolve, 600));
  callbacks.onActivity(true);
  await new Promise((resolve) => setTimeout(resolve, 600));
  assert.equal(f.spoken.length, 0);
  callbacks.onActivity(false);
  await new Promise((resolve) => setTimeout(resolve, 1600));
  assert.deepEqual(
    f.spoken.map((item) => item.text),
    ['Wait for me.'],
  );
  f.spoken[0].resolve();
  await turn();
  await f.coordinator.dispose();
});

test('speaker mode keeps queued assistant speech behind pending transcription', async () => {
  const f = fixture({
    mode: 'speaker',
    sendingMode: 'queue',
    autoSendDelaySeconds: 2,
    assistantSpeechDelaySeconds: 0,
  });
  const submitted = [];
  f.coordinator.composer.submit = () => submitted.push(f.draft());
  await f.coordinator.startConversation();
  const callbacks = f.sessions[0];
  callbacks.onActivity(true);
  callbacks.onProcessingChange({ pending: 1 });
  callbacks.onResult({ final: 'complete my turn' });
  callbacks.onActivity(false);
  f.coordinator.observeMessage('a', 'Queued answer.', { complete: true });
  await turn();

  assert.equal(f.spoken.length, 0, 'playback must not stop recognition while STT is pending');
  assert.equal(f.coordinator.snapshot.listening, true);
  callbacks.onProcessingChange({ pending: 0 });
  await new Promise((resolve) => setTimeout(resolve, 2100));
  await turn();
  assert.deepEqual(submitted, ['typed complete my turn']);
  await new Promise((resolve) => setTimeout(resolve, 1600));
  assert.equal(f.spoken.length, 1, 'playback starts only after automatic delivery');
  assert.equal(f.spoken[0].text, 'Queued answer.');
  f.spoken[0].resolve();
  await turn();
  await f.coordinator.dispose();
});

test('speaker mode preserves the auto-send countdown before assistant speech', async () => {
  const f = fixture({
    mode: 'speaker',
    sendingMode: 'queue',
    autoSendDelaySeconds: 2,
    assistantSpeechDelaySeconds: 0,
  });
  const submitted = [];
  f.coordinator.composer.submit = () => submitted.push(f.draft());
  await f.coordinator.startConversation();
  const callbacks = f.sessions[0];
  callbacks.onResult({ final: 'send this first' });
  f.coordinator.observeMessage('a', 'Do not overtake.', { complete: true });
  await turn();

  assert.ok(f.coordinator.snapshot.autoSendAt);
  assert.equal(f.spoken.length, 0);
  assert.equal(f.coordinator.snapshot.listening, true);
  await new Promise((resolve) => setTimeout(resolve, 2100));
  await turn();
  assert.deepEqual(submitted, ['typed send this first']);
  assert.equal(f.spoken.length, 1);
  assert.equal(f.spoken[0].text, 'Do not overtake.');
  f.spoken[0].resolve();
  await turn();
  await f.coordinator.dispose();
});

test('audio persistence remains a delivery barrier without becoming visible transcription work', async () => {
  const f = fixture({ sendingMode: 'queue', autoSendDelaySeconds: 1 });
  f.coordinator.composer.submit = () => {};
  await f.coordinator.startDictation();
  const callbacks = f.sessions[0];
  callbacks.onProcessingChange({ pending: 2, transcribing: 0 });
  assert.equal(f.coordinator.snapshot.pendingTranscriptions, 2);
  assert.equal(f.coordinator.snapshot.pendingTranscriptionRequests, 0);
  callbacks.onResult({ final: 'captured words' });
  assert.equal(f.coordinator.snapshot.autoSendAt, null);
  callbacks.onProcessingChange({ pending: 2, transcribing: 1 });
  assert.equal(f.coordinator.snapshot.pendingTranscriptionRequests, 1);
  callbacks.onProcessingChange({ pending: 1, transcribing: 0 });
  assert.equal(f.coordinator.snapshot.autoSendAt, null);
  callbacks.onProcessingChange({ pending: 0, transcribing: 0 });
  assert.ok(f.coordinator.snapshot.autoSendAt);
  await f.coordinator.dispose();
});

test('automatic sending waits until every queued transcription completes', async () => {
  const f = fixture({ sendingMode: 'queue', autoSendDelaySeconds: 1 });
  f.coordinator.composer.submit = () => {};
  await f.coordinator.startDictation();
  const callbacks = f.sessions[0];
  callbacks.onProcessingChange({ pending: 2 });
  callbacks.onResult({ final: 'first phrase' });
  assert.equal(f.coordinator.snapshot.autoSendAt, null, 'a queued transcription blocks auto-send');
  callbacks.onProcessingChange({ pending: 1 });
  callbacks.onResult({ final: 'second phrase' });
  assert.equal(
    f.coordinator.snapshot.autoSendAt,
    null,
    'the active transcription still blocks auto-send',
  );
  callbacks.onProcessingChange({ pending: 0 });
  assert.ok(
    f.coordinator.snapshot.autoSendAt,
    'idle queue starts the countdown after all results join the draft',
  );
  assert.equal(f.draft(), 'typed first phrase second phrase');
  f.coordinator.cancelAutoSend();
  await f.coordinator.dispose();
});

test('hold-to-talk release waits for queued transcription before forced delayed delivery', async () => {
  const f = fixture({ sendingMode: 'manual', autoSendDelaySeconds: 2 });
  const scheduled = [];
  f.coordinator.scheduleAutoSend = (draft, options) => scheduled.push({ draft, options });
  f.recognition.finish = async () => f.log.push('input:finish');
  await f.coordinator.startHoldToTalk();
  const callbacks = f.sessions[0];
  callbacks.onProcessingChange({ pending: 1 });
  callbacks.onResult({ final: 'held phrase' });
  await f.coordinator.releaseHoldToTalk();
  assert.deepEqual(scheduled, [], 'delivery waits while a transcription remains pending');
  callbacks.onProcessingChange({ pending: 0 });
  assert.deepEqual(scheduled, [
    { draft: 'typed held phrase', options: { force: true, stopAfter: true } },
  ]);
  assert.ok(f.log.includes('input:finish'));
  await f.coordinator.dispose();
});

test('pausing host playback discards prefetched audio and resume refills the window', async () => {
  const f = fixture();
  const prepared = [],
    signals = [];
  f.engine.prepare = (text, { signal }) => {
    signals.push(signal);
    const value = {
      text,
      dispose() {
        value.disposed = true;
      },
    };
    prepared.push(value);
    return Promise.resolve(value);
  };
  f.engine.pause = async () => true;
  f.engine.resume = async () => true;
  f.coordinator.patch({ speaking: true });
  for (const text of ['one', 'two', 'three', 'four']) await f.coordinator.play(text, 'message');
  await turn();
  await f.coordinator.pauseSpeech();
  assert.equal(
    signals.slice(0, 3).every((signal) => signal.aborted),
    true,
  );
  assert.equal(
    prepared.slice(0, 3).every((item) => item.disposed),
    true,
  );
  const count = prepared.length;
  await f.coordinator.resumeSpeech();
  await turn();
  assert.equal(prepared.length, count + 3);
  await f.coordinator.stopSpeech(false);
});

test('next speech segment stops only the active item and immediately drains the preserved queue', async () => {
  const f = fixture({ mode: 'headphones', segmentGapMs: 0 });
  await f.coordinator.startConversation();
  f.coordinator.observeMessage('first', 'First.', { complete: true });
  await turn();
  f.coordinator.observeMessage('second', 'Second.', { complete: true });
  f.coordinator.observeMessage('third', 'Third.', { complete: true });
  assert.equal(f.coordinator.snapshot.speechSegmentsRemaining, 3);

  await f.coordinator.skipSpeechSegment();
  await turn();
  assert.equal(f.coordinator.snapshot.speechSegmentsRemaining, 2);
  assert.deepEqual(
    f.spoken.map((item) => item.text),
    ['First.', 'Second.'],
    'Next begins the queued item without a segment gap',
  );
  f.spoken[1].resolve();
  await turn();
  assert.deepEqual(
    f.spoken.map((item) => item.text),
    ['First.', 'Second.', 'Third.'],
  );
  f.spoken[2].resolve();
  await turn();
  assert.equal(f.coordinator.snapshot.speechSegmentsRemaining, 0);
  await f.coordinator.dispose();
});

test('next preserves incoming streaming speech after it skips the active segment', async () => {
  const f = fixture({ mode: 'headphones' });
  await f.coordinator.startConversation();
  f.coordinator.observeMessage('first', 'First.\n');
  await turn();
  f.coordinator.observeMessage('second', 'Second.\n');
  await f.coordinator.skipSpeechSegment();
  f.coordinator.observeMessage('third', 'Third.\n');
  await turn();
  assert.deepEqual(
    f.spoken.map((item) => item.text),
    ['First.', 'Second.'],
  );
  assert.equal(f.coordinator.snapshot.speechSegmentsRemaining, 2);
  f.spoken[1].resolve();
  await turn();
  assert.deepEqual(
    f.spoken.map((item) => item.text),
    ['First.', 'Second.', 'Third.'],
  );
  f.spoken[2].resolve();
  await turn();
  await f.coordinator.dispose();
});

test('next skips the imminent segment during a queued speech gap', async () => {
  const f = fixture({ mode: 'headphones', segmentGapMs: 1000 });
  await f.coordinator.startConversation();
  f.coordinator.observeMessage('first', 'First.', { complete: true });
  await turn();
  f.coordinator.observeMessage('second', 'Second.', { complete: true });
  f.coordinator.observeMessage('third', 'Third.', { complete: true });
  f.spoken[0].resolve();
  await turn();
  assert.equal(f.coordinator.snapshot.speaking, false);
  assert.equal(f.coordinator.snapshot.speechSegmentsRemaining, 2);

  await f.coordinator.skipSpeechSegment();
  await turn();
  assert.deepEqual(
    f.spoken.map((item) => item.text),
    ['First.', 'Third.'],
  );
  assert.equal(f.coordinator.snapshot.speechSegmentsRemaining, 1);
  f.spoken[1].resolve();
  await turn();
  await f.coordinator.dispose();
});

test('speech queue waits for the configured gap before its next segment', async () => {
  const f = fixture({ segmentGapMs: 40 });
  f.coordinator.patch({ conversation: true });
  const first = f.coordinator.play('one', 'message');
  await turn();
  await f.coordinator.play('two', 'message');
  f.spoken[0].resolve();
  await first;
  await turn();
  assert.equal(f.spoken.length, 1, 'the next segment must not start immediately');
  await new Promise((resolve) => setTimeout(resolve, 55));
  assert.equal(f.spoken.length, 2);
  f.spoken[1].resolve();
  await turn();
  await f.coordinator.dispose();
});

test('stopping during a speech gap cancels the queued next segment', async () => {
  const f = fixture({ segmentGapMs: 40 });
  f.coordinator.patch({ conversation: true });
  const first = f.coordinator.play('one', 'message');
  await turn();
  await f.coordinator.play('two', 'message');
  f.spoken[0].resolve();
  await first;
  await f.coordinator.stopSpeech(false);
  await new Promise((resolve) => setTimeout(resolve, 55));
  assert.equal(f.spoken.length, 1);
  await f.coordinator.dispose();
});

test('host speech prefetch is bounded to three queued segments and cancelled on stop', async () => {
  const f = fixture();
  const prepared = [],
    signals = [];
  f.engine.prepare = (text, { signal }) => {
    signals.push(signal);
    const value = {
      text,
      dispose() {
        value.disposed = true;
      },
    };
    prepared.push(value);
    return Promise.resolve(value);
  };
  f.engine.playPrepared = async () => {};
  f.coordinator.patch({ speaking: true });
  for (const text of ['one', 'two', 'three', 'four', 'five'])
    await f.coordinator.play(text, 'message');
  await turn();
  assert.deepEqual(
    prepared.map((item) => item.text),
    ['one', 'two', 'three'],
  );
  await f.coordinator.stopSpeech(false);
  assert.equal(
    signals.every((signal) => signal.aborted),
    true,
  );
  assert.equal(
    prepared.every((item) => item.disposed),
    true,
  );
});

test('previous replays retained message segments and stop releases the entire run', async () => {
  const f = fixture({ mode: 'headphones' });
  const prepared = [],
    played = [];
  let active;
  f.engine.prepare = async (text) => {
    const item = {
      text,
      disposed: false,
      dispose() {
        this.disposed = true;
      },
    };
    prepared.push(item);
    return item;
  };
  f.engine.playPrepared = (item, options) => {
    assert.equal(options.retainPrepared, true);
    const done = deferred();
    active = done;
    played.push({ item, ...done });
    return done.promise;
  };
  f.engine.stop = async () => {
    active?.reject(Object.assign(new Error('cancel'), { name: 'AbortError' }));
    active = null;
  };
  const playing = f.coordinator.speak(
    'First sentence.\nSecond sentence.\nThird sentence.',
    'message',
  );
  await turn();
  assert.ok(played.length);
  played[0].resolve();
  await turn();
  assert.equal(f.coordinator.snapshot.speechHasPrevious, true);
  assert.equal(prepared[0].disposed, false);
  await f.coordinator.previousSpeechSegment();
  await turn();
  assert.equal(played.at(-1).item, played[0].item);
  assert.equal(f.coordinator.getSpeechHistory().length, 1);
  assert.equal(f.coordinator.getSpeechHistory()[0].messageId, 'message');
  await f.coordinator.stopSpeech();
  await playing;
  assert.equal(f.coordinator.speechHistory.length, 0);
  assert.ok(prepared.every((item) => item.disposed));
  assert.equal(f.coordinator.snapshot.speechRunActive, false);
});

test('speech run remains visible through manual segment gaps', async () => {
  const f = fixture({ segmentGapMs: 10000 });
  const playing = f.coordinator.speak('First sentence.\nSecond sentence.', 'message');
  await turn();
  f.spoken[0].resolve();
  await turn();
  assert.equal(f.coordinator.snapshot.speaking, false);
  assert.equal(f.coordinator.snapshot.speechRunActive, true);
  assert.ok(f.coordinator.snapshot.speechText);
  await f.coordinator.stopSpeech();
  await playing;
});

test('manual speech and captions share the normalized Markdown text', async () => {
  const f = fixture();
  const playing = f.coordinator.speak('**Hello** [guide](https://example.com/private)', 'markdown');
  await turn();
  assert.equal(f.coordinator.snapshot.speechText, 'Hello Link para guide');
  assert.equal(f.spoken[0].text, f.coordinator.snapshot.speechText);
  await f.coordinator.stopSpeech();
  await playing;
});

test('replaying retained speech after switching output engine uses current settings, not previous browser engine', async () => {
  const f = fixture({ mode: 'headphones' });
  const sayCalls = [];
  let current;
  f.coordinator.engines.say = {
    capability: () => ({ supported: true }),
    speak: (text, options) => {
      const done = deferred();
      current = done;
      sayCalls.push({ text, options, ...done });
      return done.promise;
    },
    stop: async () => {
      current?.reject(Object.assign(new Error('cancel'), { name: 'AbortError' }));
    },
  };
  const playing = f.coordinator.speak('First sentence. Second sentence.', 'switch-output');
  await turn();
  f.spoken[0].resolve();
  await turn();
  assert.ok(f.coordinator.snapshot.speechHasPrevious);
  f.coordinator.updateSettings({ engine: 'say' });
  await f.coordinator.previousSpeechSegment();
  await turn();
  assert.equal(f.coordinator.snapshot.settings.engine, 'say');
  assert.equal(sayCalls.length, 1, 'replay must use say, not the retained browser adapter');
  assert.equal(sayCalls[0].text, 'First sentence.');
  await f.coordinator.stopSpeech();
  await playing;
});

test('prefetched speech from previous voice settings is disposed and regenerated before replay', async () => {
  const f = fixture({ mode: 'headphones', voice: 'old', lang: 'en-US', rate: 1 });
  const prepared = [];
  const played = [];
  let active;
  f.engine.prepare = async (text, options) => {
    const item = {
      text,
      options,
      disposed: false,
      dispose() {
        this.disposed = true;
      },
    };
    prepared.push(item);
    return item;
  };
  f.engine.playPrepared = (item, options) => {
    const done = deferred();
    active = done;
    played.push({ item, options, ...done });
    return done.promise;
  };
  f.engine.stop = async () =>
    active?.reject(Object.assign(new Error('cancel'), { name: 'AbortError' }));
  const playing = f.coordinator.speak('First sentence. Second sentence.', 'voice-cache');
  await turn();
  played[0].resolve();
  await turn();
  const old = played[1].item;
  f.coordinator.updateSettings({
    ...f.coordinator.snapshot.settings,
    voice: 'new',
    lang: 'pt-BR',
    rate: 1.4,
  });
  await f.coordinator.previousSpeechSegment();
  await turn();
  assert.equal(played[2].item.text, 'First sentence.');
  assert.equal(played[2].options.voice, 'new');
  played[2].resolve();
  await turn();
  assert.equal(old.disposed, true);
  assert.equal(played[3].item.options.voice, 'new');
  assert.equal(played[3].item.options.lang, 'pt-BR');
  assert.equal(played[3].item.options.rate, 1.4);
  await f.coordinator.stopSpeech();
  await playing;
});

test('meeting activity gates queued playback and confirmed participants pause speakers without TTS echo', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const f = fixture({ mode: 'speaker', assistantSpeechDelaySeconds: 1.5 });
  const c = f.coordinator;
  await c.startConversation();
  c.setExternalSpeechActivity(true);
  c.observeMessage('new', 'Assistant reply.', { complete: true });
  await turn();
  assert.equal(f.spoken.length, 0);
  c.setExternalSpeechActivity(false);
  t.mock.timers.tick(1500);
  await turn();
  assert.equal(f.spoken.length, 1);
  c.setExternalSpeechActivity(true);
  assert.equal(c.confirmExternalSpeech('Assistant reply'), false);
  t.mock.timers.tick(1500);
  await turn();
  assert.equal(c.getSnapshot().paused, false);
  c.confirmExternalSpeech('A participant has a different question');
  t.mock.timers.tick(1500);
  await turn();
  assert.equal(c.getSnapshot().paused, true);
  c.setExternalSpeechActivity(false);
  t.mock.timers.tick(1500);
  await turn();
  assert.equal(c.getSnapshot().paused, false);
  await c.pauseSpeech();
  c.setExternalSpeechActivity(true);
  c.confirmExternalSpeech('Participant');
  c.setExternalSpeechActivity(false);
  await turn();
  assert.equal(c.getSnapshot().paused, true, 'manual pause remains manual');
  await c.dispose();
});
test('meeting and microphone overlap does not resume playback until both are silent', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const f = fixture({ mode: 'headphones', assistantSpeechDelaySeconds: 1.5 });
  const c = f.coordinator;
  await c.startConversation();
  const speech = c.speak('Assistant reply');
  await turn();
  c.setExternalSpeechActivity(true);
  c.confirmExternalSpeech('Participant talking');
  t.mock.timers.tick(1500);
  await turn();
  assert.equal(c.getSnapshot().paused, true);
  f.sessions.at(-1).onActivity(true);
  c.setExternalSpeechActivity(false);
  await turn();
  assert.equal(c.getSnapshot().paused, true);
  f.sessions.at(-1).onActivity(false);
  t.mock.timers.tick(1500);
  await turn();
  assert.equal(c.getSnapshot().paused, false);
  await c.dispose();
  await speech;
});

test('final recognition releases automatic pause without activity-end event and renewed speech resets quiet time', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const f = fixture({ mode: 'headphones', assistantSpeechDelaySeconds: 1.5 });
  const c = f.coordinator;
  await c.startConversation();
  const speech = c.speak('Long answer that is preserved');
  await turn();
  f.sessions.at(-1).onActivity(true);
  f.sessions.at(-1).onResult({ interim: 'hello' });
  t.mock.timers.tick(1500);
  await turn();
  assert.equal(c.getSnapshot().paused, true);
  f.sessions.at(-1).onResult({ final: 'hello' });
  t.mock.timers.tick(900);
  await turn();
  assert.equal(c.getSnapshot().paused, true);
  f.sessions.at(-1).onActivity(true);
  t.mock.timers.tick(100);
  await turn();
  assert.equal(c.getSnapshot().paused, true);
  f.sessions.at(-1).onActivity(false);
  t.mock.timers.tick(1500);
  await turn();
  assert.equal(c.getSnapshot().paused, false);
  assert.equal(f.spoken.length, 1, 'resume does not synthesize or restart text');
  assert.equal(f.log.filter((x) => x === 'resume').length, 1);
  await c.dispose();
  await speech;
});
test('explicit pause during automatic quiet countdown prevents automatic resume', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const f = fixture({ mode: 'headphones', assistantSpeechDelaySeconds: 1.5 });
  const c = f.coordinator;
  await c.startConversation();
  const speech = c.speak('Answer');
  await turn();
  f.sessions.at(-1).onActivity(true);
  f.sessions.at(-1).onResult({ interim: 'interrupt' });
  t.mock.timers.tick(1500);
  await turn();
  f.sessions.at(-1).onActivity(false);
  await c.pauseSpeech();
  t.mock.timers.tick(1500);
  await turn();
  assert.equal(c.getSnapshot().paused, true);
  assert.equal(f.log.includes('resume'), false);
  await c.dispose();
  await speech;
});

for (const voiceCommandsEnabled of [true, false]) {
  test(
    'Ignoring retains interruption and silence recovery with commands ' + voiceCommandsEnabled,
    async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
      const f = fixture({
        mode: 'headphones',
        voiceCommandsEnabled,
        assistantSpeechDelaySeconds: 1.5,
        sendingMode: 'automatic',
      });
      const c = f.coordinator;
      await c.startConversation();
      const speech = c.speak('An answer worth retaining');
      await turn();
      f.sessions.at(-1).onActivity(true);
      const stops = f.log.filter((x) => x === 'input:stop').length;
      await c.muteListening();
      assert.equal(c.getSnapshot().recognizing, true);
      assert.equal(c.getSnapshot().listening, true);
      assert.equal(f.log.filter((x) => x === 'input:stop').length, stops);
      let questionResults = 0;
      c.composer.handleQuestionResult = () => {
        questionResults++;
        return true;
      };
      f.sessions.at(-1).onResult({ interim: 'different human request' });
      t.mock.timers.tick(1500);
      await turn();
      assert.equal(c.getSnapshot().paused, true);
      f.sessions.at(-1).onResult({ final: 'different human request' });
      assert.equal(f.draft(), 'typed');
      assert.equal(questionResults, 0);
      assert.equal(c.getSnapshot().autoSendAt, null);
      t.mock.timers.tick(1500);
      await turn();
      assert.equal(c.getSnapshot().paused, false);
      assert.equal(f.spoken.length, 1);
      assert.equal(c.getSnapshot().muted, true);
      delete c.composer.handleQuestionResult;
      await c.resumeListeningInput();
      f.sessions.at(-1).onResult({ final: 'new dictation works' });
      assert.equal(f.draft(), 'typed new dictation works');
      await c.dispose();
      await speech;
    },
  );
}

test('silent recording writes preserve the auto-send deadline while speech work still cancels it', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const f = fixture({ sendingMode: 'queue', autoSendDelaySeconds: 1 });
  t.after(() => f.coordinator.dispose());
  const sent = [];
  f.coordinator.composer.submit = () => sent.push(f.draft());
  await f.coordinator.startDictation();
  const cb = f.sessions[0];
  cb.onProcessingChange({ pending: 1, transcribing: 0, deliveryPending: 0 });
  cb.onResult({ final: 'finished words' });
  const deadline = f.coordinator.snapshot.autoSendAt;
  assert.ok(deadline);
  for (let i = 0; i < 10; i++) {
    cb.onProcessingChange({ pending: i % 2, transcribing: 0, deliveryPending: 0 });
    t.mock.timers.tick(100);
  }
  assert.deepEqual(sent, ['typed finished words']);
  cb.onResult({ final: 'another turn' });
  cb.onProcessingChange({ pending: 1, transcribing: 0, deliveryPending: 1 });
  assert.equal(
    f.coordinator.snapshot.autoSendAt,
    null,
    'speech boundary not queued yet blocks sending',
  );
  t.mock.timers.tick(2000);
  assert.equal(sent.length, 1);
  cb.onProcessingChange({ pending: 2, transcribing: 1, deliveryPending: 1 });
  cb.onResult({ final: 'late result' });
  assert.equal(f.coordinator.snapshot.autoSendAt, null);
  cb.onProcessingChange({ pending: 1, transcribing: 0, deliveryPending: 0 });
  t.mock.timers.tick(1500);
  assert.equal(sent.length, 2);
});

test('speech audit records wait reason transitions without frame spam or starting playback early', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const f = fixture({ assistantSpeechDelaySeconds: 0.6 });
  t.after(() => f.coordinator.dispose());
  const events = [];
  f.coordinator.recordingTimeline = () => (kind, details) => events.push({ kind, details });
  await f.coordinator.startConversation();
  const input = f.sessions.at(-1);
  input.onActivity(true);
  f.coordinator.observeMessage('private-id', 'Private text must never enter audit.', {
    complete: true,
  });
  assert.equal(events[0].kind, 'assistant-wait-start');
  assert.deepEqual(events[0].details.reasons, ['user-speech']);
  for (let i = 0; i < 20; i++) input.onActivity(true);
  assert.equal(events.length, 1);
  input.onProcessingChange({ pending: 1, transcribing: 1, deliveryPending: 1 });
  assert.deepEqual(events.at(-1).details.reasons, ['user-speech', 'transcription']);
  input.onActivity(false);
  assert.ok(events.at(-1).details.reasons.includes('silence-delay'));
  t.mock.timers.tick(600);
  await turn();
  assert.equal(f.spoken.length, 0, 'pending transcription still owns the boundary');
  input.onProcessingChange({ pending: 0, transcribing: 0, deliveryPending: 0 });
  await turn();
  assert.equal(f.spoken.length, 1);
  assert.ok(events.some((e) => e.kind === 'assistant-wait-end' && e.details.outcome === 'ready'));
  assert.ok(
    events.findIndex((e) => e.kind === 'assistant-play-request') <
      events.findIndex((e) => e.kind === 'capture-gated'),
  );
  assert.ok(events.some((e) => e.kind === 'input-stop-complete'));
  assert.equal(JSON.stringify(events).includes('Private text'), false);
  assert.equal(JSON.stringify(events).includes('private-id'), false);
});

test('speech audit distinguishes failed input teardown, cancellation and actual engine start', async (t) => {
  const f = fixture();
  t.after(() => f.coordinator.dispose());
  const events = [];
  f.coordinator.recordingTimeline = () => (kind, details) => events.push({ kind, details });
  await f.coordinator.startConversation();
  f.recognition.stop = async () => {
    throw new Error('private hardware failure');
  };
  await f.coordinator.speak('Diagnostic answer.');
  assert.ok(events.some((e) => e.kind === 'capture-gate-failed'));
  assert.ok(events.some((e) => e.kind === 'assistant-error'));
  assert.ok(!events.some((e) => e.kind === 'input-stop-complete' || e.kind === 'assistant-start'));
  assert.equal(JSON.stringify(events).includes('private hardware'), false);
  f.recognition.stop = async () => {};
});

test('cancelling a waiting speech run closes the wait without fabricating playback', async (t) => {
  const f = fixture();
  t.after(() => f.coordinator.dispose());
  const events = [];
  f.coordinator.recordingTimeline = () => (kind, details) => events.push({ kind, details });
  await f.coordinator.startConversation();
  f.sessions.at(-1).onActivity(true);
  f.coordinator.observeMessage('waiting', 'A queued answer.', { complete: true });
  await f.coordinator.stopSpeech(false);
  assert.ok(events.some((e) => e.kind === 'assistant-cancel'));
  assert.ok(
    events.some((e) => e.kind === 'assistant-wait-end' && e.details.outcome === 'cancelled'),
  );
  assert.ok(!events.some((e) => e.kind === 'assistant-start'));
});
