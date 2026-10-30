// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { mockRecordingRepository } from './helpers/recording.js';
import { WhisperHttpRecognitionEngine } from '../src/modules/recognition/engines/whisper/WhisperRecognitionEngine.ts';
import { QwenHttpRecognitionEngine } from '../src/modules/recognition/engines/qwen/QwenRecognitionEngine.ts';
import { VoiceCoordinator } from '../src/modules/core/coordinator.ts';
import { MeetingController } from '../src/modules/conversation/models/meeting.ts';

const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
function fixture(Engine, detector = 'silero', delayedFinish = false) {
  let onPcm,
    callbacks,
    draft = '',
    speechDone;
  const requests = [],
    spoken = [],
    recordings = mockRecordingRepository(),
    finishGate = deferred();
  const processor = { connect() {}, disconnect() {} };
  let vadReleased = false,
    captureReleased = false;
  const meter = {
    context: {
      sampleRate: 16000,
      destination: {},
      state: 'running',
      async suspend() {
        this.state = 'suspended';
      },
      async resume() {
        this.state = 'running';
      },
      createScriptProcessor: () => processor,
      createGain: () => ({ gain: {}, connect() {}, disconnect() {} }),
    },
    source: { connect() {}, disconnect() {} },
    async start() {
      return true;
    },
    async stop() {},
  };
  const recognition = new Engine({
    recordings,
    meter,
    voiceDetectionEngine: detector,
    vadAvailable: async () => true,
    vadFactory: (c) => {
      callbacks = c;
      return {
        release() {
          vadReleased = true;
        },
      };
    },
    vadCapture: async (_context, _source, _vad, ingest) => {
      onPcm = ingest;
      return {
        async finish() {
          if (delayedFinish) await finishGate.promise;
          captureReleased = true;
        },
        release() {
          captureReleased = true;
          finishGate.resolve();
        },
      };
    },
    globals: {
      fetch: (_url, options) => {
        const gate = deferred();
        requests.push({ options, resolve: gate.resolve });
        return gate.promise;
      },
    },
  });
  recognition.capability = async () => ({ supported: true });
  const coordinator = new VoiceCoordinator({
    recognition,
    meter,
    engines: {
      browser: {
        speak(text) {
          spoken.push(text);
          const gate = deferred();
          speechDone = gate.resolve;
          return gate.promise;
        },
        async stop() {
          speechDone?.();
        },
      },
    },
    composer: {
      getDraft: () => draft,
      setDraft: (x) => {
        draft = x;
      },
      submit() {},
    },
    settings: {
      mode: 'speaker',
      sendingMode: 'manual',
      recognitionFilterEnabled: false,
      assistantSpeechDelaySeconds: 0.6,
    },
  });
  return {
    recognition,
    coordinator,
    recordings,
    meter,
    requests,
    spoken,
    finishSpeech: () => speechDone?.(),
    finishGate,
    get vadReleased() {
      return vadReleased;
    },
    get captureReleased() {
      return captureReleased;
    },
    frame(active, value = active ? 0.25 : 0) {
      const pcm = new Float32Array(512).fill(value);
      if (meter.context.state === 'suspended') return;
      if (detector === 'silero') {
        onPcm(pcm, 16000);
        callbacks.onProbability({ probability: active ? 0.9 : 0.01, pcm });
      } else processor.onaudioprocess?.({ inputBuffer: { getChannelData: () => pcm } });
    },
    respond(index) {
      requests[index].resolve(
        Response.json({ ok: true, value: { text: 'synthetic phrase ' + index } }),
      );
    },
    draft: () => draft,
  };
}
const wavSamples = (request) => new Int16Array(request.options.body, 44);
const queuedReply = (h) =>
  h.coordinator.observeMessage('reply', 'Synthetic assistant reply.', { complete: true });

test('speaker playback leaves the same recording writer active across a real capture gap', async (t) => {
  const h = fixture(WhisperHttpRecognitionEngine, 'energy');
  t.after(() => h.coordinator.dispose());
  await h.coordinator.startConversation();
  h.coordinator.updateSettings({ assistantSpeechDelaySeconds: 0 });
  h.frame(true);
  const before = (await h.recordings.list())[0];
  assert.ok(before);
  queuedReply(h);
  await tick();
  assert.equal(h.coordinator.snapshot.listening, true);
  assert.equal(h.recognition.session.writer.session.id, before.id);
  assert.equal((await h.recordings.list()).length, 1);
  assert.equal(h.meter.context.state, 'suspended');
  const atPause = (await h.recordings.list())[0].capturedSamples;
  h.frame(true, 0.99);
  await tick();
  assert.equal((await h.recordings.list())[0].capturedSamples, atPause);
  h.finishSpeech();
  await tick();
  assert.equal(h.meter.context.state, 'running');
  h.frame(true);
  await tick();
  const after = (await h.recordings.list())[0];
  assert.equal(after.id, before.id);
  assert.ok(after.capturedSamples > before.capturedSamples);
  assert.equal((await h.recordings.list()).length, 1);
});

test('navigation joins speaker suspension instead of flushing a suspended worklet', async (t) => {
  const h = fixture(WhisperHttpRecognitionEngine, 'silero');
  t.after(() => h.coordinator.dispose());
  const gate = deferred();
  h.meter.context.suspend = async function () {
    await gate.promise;
    this.state = 'suspended';
  };
  await h.coordinator.startConversation();
  let flushes = 0;
  h.recognition.session.capture.flush = async () => {
    flushes++;
  };
  const speakerPause = h.recognition.suspendCapture();
  const navigationPause = h.recognition.pauseForNavigation();
  gate.resolve();
  assert.equal(await speakerPause, true);
  assert.equal(await navigationPause, true);
  assert.equal(flushes, 0);
  assert.equal(h.meter.context.state, 'suspended');
});

for (const Engine of [WhisperHttpRecognitionEngine, QwenHttpRecognitionEngine]) {
  test(
    Engine.name + ': completed transcription waits for the originating chat to resume',
    async (t) => {
      const h = fixture(Engine, 'energy');
      t.after(() => h.coordinator.dispose());
      await h.coordinator.startConversation();
      for (let i = 0; i < 20; i++) h.frame(true);
      await tick();
      const id = h.recognition.session.writer.session.id;
      await h.coordinator.pauseInputForNavigation();
      await tick();
      const samples = h.recognition.session.writer.session.capturedSamples;
      assert.equal(h.requests.length, 1);
      h.respond(0);
      await tick();
      assert.equal(h.draft(), '');
      assert.equal(h.coordinator.navigationResults.length, 1);
      h.frame(true);
      await tick();
      assert.equal(h.recognition.session.writer.session.capturedSamples, samples);
      await h.coordinator.resumeInputFromNavigation();
      assert.equal(h.draft(), 'synthetic phrase 0');
      assert.equal(h.recognition.session.writer.session.id, id);
      assert.equal((await h.recordings.list()).length, 1);
      await h.coordinator.pauseInputForNavigation();
      await h.coordinator.resumeInputFromNavigation();
      assert.equal(h.draft(), 'synthetic phrase 0', 'return never duplicates accepted text');
    },
  );
  test(
    Engine.name + ': navigation pause transcribes captured speech without ending recording',
    async (t) => {
      const h = fixture(Engine, 'energy');
      t.after(() => h.coordinator.dispose());
      await h.coordinator.startConversation();
      for (let i = 0; i < 20; i++) h.frame(true);
      await tick();
      const id = h.recognition.session.writer.session.id;
      assert.equal(await h.recognition.pauseForNavigation(), true);
      await tick();
      assert.equal(h.meter.context.state, 'suspended');
      assert.equal(h.requests.length, 1);
      assert.equal((await h.recordings.list())[0].state, 'recording');
      h.respond(0);
      await tick();
      assert.match(h.draft(), /synthetic phrase 0/);
      assert.equal(await h.recognition.resumeCapture(), true);
      h.frame(true);
      await tick();
      assert.equal(h.recognition.session.writer.session.id, id);
      assert.equal((await h.recordings.list()).length, 1);
    },
  );
  for (const detector of ['silero', 'energy']) {
    test(
      Engine.name + ' ' + detector + ': a negative frame cannot discard an open segment',
      async (t) => {
        const h = fixture(Engine, detector);
        t.after(() => h.coordinator.dispose());
        await h.coordinator.startConversation();
        await tick();
        for (let i = 0; i < 100; i++) h.frame(true);
        queuedReply(h);
        h.frame(false);
        await tick();
        assert.equal(h.coordinator.snapshot.listening, true);
        assert.equal(h.spoken.length, 0);
        for (let i = 0; i < 24; i++) h.frame(false);
        await tick();
        assert.equal(h.requests.length, 1);
        assert.equal(wavSamples(h.requests[0]).length, 100 * 512 + 12800);
        assert.ok(
          wavSamples(h.requests[0])
            .subarray(0, 100 * 512)
            .every((x) => x === 8191),
        );
        assert.equal(h.spoken.length, 0, 'closed segment must still wait for transcription');
        await tick();
        h.respond(0);
        await tick();
        await new Promise((resolve) => setTimeout(resolve, 650));
        assert.match(h.draft(), /synthetic phrase 0/);
        assert.equal(h.spoken.length, 1, 'playback is allowed only after the final is committed');
      },
    );
  }
  for (const detector of ['silero', 'energy']) {
    test(
      Engine.name + ' ' + detector + ': max-length split cannot release continuous speech',
      async (t) => {
        const h = fixture(Engine, detector);
        t.after(() => h.coordinator.dispose());
        h.recognition.maxUtteranceSeconds = 0.3;
        await h.coordinator.startConversation();
        for (let i = 0; i < 35; i++) h.frame(true);
        await tick();
        assert.equal(h.requests.length, 1);
        queuedReply(h);
        await tick();
        h.respond(0);
        await tick();
        assert.equal(h.coordinator.snapshot.recognizing, true);
        assert.equal(h.coordinator.snapshot.listening, true);
        assert.equal(h.spoken.length, 0);
        h.recognition.maxUtteranceSeconds = 60;
        for (let i = 0; i < 16; i++) h.frame(false);
        await tick();
        assert.equal(h.coordinator.snapshot.recognizing, false);
      },
    );
  }
  test(Engine.name + ': older finals cannot clear a newer open utterance', async (t) => {
    const h = fixture(Engine);
    t.after(() => h.coordinator.dispose());
    await h.coordinator.startConversation();
    for (let n = 0; n < 2; n++) {
      for (let i = 0; i < 10; i++) h.frame(true);
      for (let i = 0; i < 16; i++) h.frame(false);
    }
    await tick();
    for (let i = 0; i < 100; i++) h.frame(true);
    queuedReply(h);
    for (let n = 0; n < 2; n++) {
      await tick();
      h.respond(n);
      await tick();
      assert.equal(
        h.coordinator.snapshot.recognizing,
        true,
        'capture activity belongs to the new utterance',
      );
    }
    assert.equal(h.coordinator.snapshot.pendingTranscriptions, 0);
    h.frame(false);
    await tick();
    assert.equal(h.coordinator.snapshot.listening, true);
    assert.equal(h.spoken.length, 0);
    for (let i = 0; i < 24; i++) h.frame(false);
    await tick();
    assert.equal(h.requests.length, 3);
    assert.equal(wavSamples(h.requests[2]).length, 12800 + 100 * 512 + 12800);
    assert.ok(
      wavSamples(h.requests[2])
        .subarray(12800, 12800 + 100 * 512)
        .every((x) => x === 8191),
      'pre/post-roll overlap must not discard any of the new utterance',
    );
    h.respond(2);
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 650));
    assert.equal(h.draft(), 'synthetic phrase 0 synthetic phrase 1 synthetic phrase 2');
    assert.equal(h.spoken.length, 1);
  });
}

for (const outcome of ['filtered', 'muted', 'command', 'resume', 'question']) {
  test('an older ' + outcome + ' final does not clear managed capture activity', async (t) => {
    const h = fixture(WhisperHttpRecognitionEngine);
    t.after(() => h.coordinator.dispose());
    await h.coordinator.startConversation();
    if (outcome === 'filtered')
      h.coordinator.updateSettings({ recognitionFilterEnabled: true, recognitionMinimumWords: 10 });
    if (outcome === 'muted') h.coordinator.updateSettings({ microphoneEnabled: false });
    if (outcome === 'command')
      h.coordinator.updateSettings({ voiceCommandClear: 'synthetic phrase 0' });
    if (outcome === 'resume')
      h.coordinator.updateSettings({
        voiceCommandResume: 'synthetic phrase 0',
        microphoneEnabled: false,
      });
    if (outcome === 'question') h.coordinator.composer.handleQuestionResult = () => true;
    for (let i = 0; i < 10; i++) h.frame(true);
    for (let i = 0; i < 16; i++) h.frame(false);
    await tick();
    for (let i = 0; i < 100; i++) h.frame(true);
    await tick();
    h.respond(0);
    await tick();
    assert.equal(h.coordinator.snapshot.recognizing, true);
    if (outcome === 'resume') assert.equal(h.coordinator.snapshot.muted, false);
  });
}

for (const rejected of [false, true]) {
  test(
    'shared capture activity survives an older ' + (rejected ? 'rejected' : 'accepted') + ' final',
    async (t) => {
      let callbacks,
        draft = '';
      const activity = [];
      const meeting = new MeetingController({
        composer: {
          getDraft: () => draft,
          setDraft: (x) => {
            draft = x;
          },
          submit() {},
        },
        settings: () => ({ sendingMode: 'manual', recognitionFilterEnabled: false }),
        translate: (x) => x,
        onActivity: (_source, active) => activity.push(active),
        onSpeech: () => !rejected,
        createSource: () => ({
          meter: {
            provide() {},
            async start() {
              return true;
            },
            async stop() {},
            stream: { getTracks: () => [] },
          },
          engine: {
            activityManaged: true,
            async capability() {
              return { supported: true };
            },
            async start(c) {
              callbacks = c;
            },
            async stop() {},
          },
        }),
      });
      t.after(() => meeting.dispose());
      await meeting.start('shared');
      callbacks.onActivity(true);
      callbacks.onResult({ final: 'synthetic older phrase' });
      assert.equal(meeting.input().snapshot.recognizing, true);
      assert.equal(activity.at(-1), true);
      callbacks.onActivity(false);
      assert.equal(meeting.input().snapshot.recognizing, false);
    },
  );
}
