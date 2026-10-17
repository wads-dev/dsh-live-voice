// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { mockRecordingRepository } from './helpers/recording.js';
import {
  encodeMonoPcm16Wav,
  WhisperHttpRecognitionEngine,
} from '../src/modules/recognition/engines/whisper/WhisperRecognitionEngine.ts';
import {
  resolveWhisperUrl,
  validateMonoPcm16Wav,
  WhisperHttpHost,
} from '../src/modules/recognition/engines/whisper/whisperRecognitionHost.ts';

test('Whisper uses a lazy per-engine repository unless an application singleton is injected', async () => {
  const a = new WhisperHttpRecognitionEngine();
  const b = new WhisperHttpRecognitionEngine();
  assert.ok(a.recordings);
  assert.notEqual(a.recordings, b.recordings);
  const repository = mockRecordingRepository();
  const injected = new WhisperHttpRecognitionEngine({ recordings: repository });
  assert.equal(injected.recordings, repository);
  // Constructing a fallback must not open IndexedDB or require WebCodecs.
  await a.recordings.dispose();
  await b.recordings.dispose();
});

test('Whisper host accepts only loopback and canonical mono PCM16 WAV', () => {
  assert.equal(resolveWhisperUrl('http://127.0.0.1:8080/inference').pathname, '/inference');
  for (const url of [
    'https://127.0.0.1/inference',
    'http://example.com/inference',
    'http://user:pass@localhost/inference',
  ])
    assert.throws(() => resolveWhisperUrl(url), /loopback/);
  const wav = encodeMonoPcm16Wav(new Float32Array(48000).fill(0.25), 48000);
  assert.equal(validateMonoPcm16Wav(wav).byteLength, 32044);
  const broken = wav.slice(0);
  new DataView(broken).setUint32(24, 44100, true);
  assert.throws(() => validateMonoPcm16Wav(broken), /16 kHz/);
});

test('Whisper host posts complete WAV multipart and parses final JSON', async () => {
  const wav = encodeMonoPcm16Wav(new Float32Array(16000).fill(0.1), 16000),
    seen = [];
  const host = new WhisperHttpHost({
    fetchImpl: async (url, options) => {
      seen.push({ url: String(url), options });
      if (String(url).endsWith('/health'))
        return new Response('{"status":"ok"}', { headers: { 'content-type': 'application/json' } });
      return Response.json({ text: ' teste final\n' });
    },
  });
  assert.equal((await host.capability()).streaming, false);
  assert.deepEqual(await host.transcribe(wav, { lang: 'pt-BR' }), { text: 'teste final' });
  assert.equal(seen[1].options.method, 'POST');
  assert.equal(seen[1].options.redirect, 'error');
  assert.equal(seen[1].options.body.get('language'), 'pt');
  assert.equal(seen[1].options.body.get('response_format'), 'json');
  assert.deepEqual(await host.transcribe(wav, { lang: 'auto' }), { text: 'teste final' });
  assert.equal(seen[2].options.body.get('language'), 'auto');
});

test('Whisper browser engine segments speech and sends authenticated complete utterance', async (t) => {
  let now = 100000;
  t.mock.method(Date, 'now', () => now);
  const requests = [],
    source = {
      connect(node) {
        this.node = node;
      },
      disconnect() {},
    },
    processor = { connect() {}, disconnect() {}, onaudioprocess: null },
    context = {
      sampleRate: 16000,
      destination: {},
      createScriptProcessor() {
        return processor;
      },
      createGain() {
        return { gain: { value: 1 }, connect() {}, disconnect() {} };
      },
    };
  const globals = {
    crypto,
    fetch: async (url, options = {}) => {
      requests.push({ url, options });
      if (String(url).endsWith('capabilities'))
        return Response.json({
          ok: true,
          value: { supported: true, local: true, streaming: false },
        });
      return Response.json({ ok: true, value: { text: 'Olá do Whisper' } });
    },
  };
  const results = [],
    engine = new WhisperHttpRecognitionEngine({
      recordings: mockRecordingRepository(),
      voiceDetectionEngine: 'energy',
      globals,
      recognitionContext: 'Português técnico\nEnglish terms',
      meter: { context, source },
    });
  assert.equal((await engine.capability()).supported, true);
  await engine.start({ lang: 'pt-BR', onResult: (value) => results.push(value) });
  const emit = (value) =>
    processor.onaudioprocess({
      inputBuffer: { getChannelData: () => new Float32Array(4096).fill(value) },
    });
  emit(0.1);
  now += 1000;
  emit(0.1);
  emit(0.1);
  emit(0.1);
  emit(0);
  emit(0);
  emit(0);
  emit(0);
  emit(0);
  emit(0);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests.at(-1).url, '/api/dsh-live-voice/whisper/transcribe');
  assert.equal(requests.at(-1).options.credentials, 'same-origin');
  assert.equal(
    decodeURIComponent(requests.at(-1).options.headers['x-dlv-transcription-context']),
    'Português técnico\nEnglish terms',
  );
  assert.doesNotThrow(() => validateMonoPcm16Wav(requests.at(-1).options.body));
  assert.deepEqual(
    results.map(({ startedAt, ...text }) => text),
    [{ final: 'Olá do Whisper', interim: '', paragraphBefore: false }],
  );
  assert.equal(
    results[0].startedAt,
    100000,
    'range onset uses the recording sample clock, not request completion',
  );
  await engine.stop();
});

test('Whisper voice detection defaults to short pauses and external presets change segmentation', async () => {
  const run = async (preset, customMs = 1000) => {
    const requests = [],
      source = { connect() {}, disconnect() {} },
      processor = { connect() {}, disconnect() {}, onaudioprocess: null };
    const context = {
      sampleRate: 16000,
      destination: {},
      createScriptProcessor() {
        return processor;
      },
      createGain() {
        return { gain: { value: 1 }, connect() {}, disconnect() {} };
      },
    };
    const engine = new WhisperHttpRecognitionEngine({
      recordings: mockRecordingRepository(),
      voiceDetectionEngine: 'energy',
      voiceDetectionPreset: preset,
      voiceDetectionCustomSilenceMs: customMs,
      globals: {
        crypto,
        fetch: async (url, options = {}) => {
          requests.push({ url, options });
          return Response.json({ ok: true, value: { text: 'done' } });
        },
      },
      meter: { context, source },
    });
    await engine.start({});
    const emit = (value) =>
      processor.onaudioprocess({
        inputBuffer: { getChannelData: () => new Float32Array(4096).fill(value) },
      });
    emit(0.1);
    for (let i = 0; i < 4; i++) emit(0);
    await new Promise((resolve) => setImmediate(resolve));
    const sent = requests.length;
    await engine.stop();
    return sent;
  };
  assert.equal(new WhisperHttpRecognitionEngine().segmentation.silenceMs, 400);
  assert.equal(await run(undefined), 1, 'default profile sends after a short pause');
  assert.equal(await run('natural'), 1, 'natural profile confirms the boundary after 1 second');
  assert.equal(await run('short'), 1, 'short profile sends the utterance sooner');
  assert.equal(await run('long'), 0);
  assert.equal(await run('custom', 300), 1);
  assert.equal(await run('custom', 400), 1);
  assert.equal(await run('custom', 1800), 0);
});

test('Whisper browser engine serializes closed utterances and discards queued work on stop', async () => {
  const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => {
      resolve = yes;
      reject = no;
    });
    return { promise, resolve, reject };
  };
  const source = { connect() {}, disconnect() {} },
    processor = { connect() {}, disconnect() {}, onaudioprocess: null },
    context = {
      sampleRate: 16000,
      destination: {},
      createScriptProcessor() {
        return processor;
      },
      createGain() {
        return { gain: { value: 1 }, connect() {}, disconnect() {} };
      },
    },
    requests = [];
  const engine = new WhisperHttpRecognitionEngine({
    recordings: mockRecordingRepository(),
    voiceDetectionEngine: 'energy',
    globals: {
      crypto,
      fetch: (_url, options) => {
        const request = { ...deferred(), options, aborted: false };
        requests.push(request);
        options.signal.addEventListener(
          'abort',
          () => {
            request.aborted = true;
            request.reject(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
          },
          { once: true },
        );
        return request.promise;
      },
    },
    meter: { context, source },
    voiceDetectionPreset: 'short',
  });
  const results = [],
    processing = [];
  await engine.start({
    onResult: (result) => results.push(result.final),
    onProcessingChange: (state) => processing.push(state.pending),
  });
  const emit = (value) =>
    processor.onaudioprocess({
      inputBuffer: { getChannelData: () => new Float32Array(4096).fill(value) },
    });
  const utterance = () => {
    emit(0.1);
    emit(0.1);
    for (let index = 0; index < 4; index++) emit(0);
  };
  utterance();
  utterance();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests.length, 1, 'the second utterance waits for the first request');
  assert.deepEqual(processing.at(-1), 2);
  requests[0].resolve(Response.json({ ok: true, value: { text: 'first result' } }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests.length, 2, 'the queued utterance starts after the first response');
  requests[1].resolve(Response.json({ ok: true, value: { text: 'second result' } }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(results, ['first result', 'second result']);
  assert.equal(processing.at(-1), 0);
  utterance();
  utterance();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests.length, 3);
  await engine.stop();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests[2].aborted, true);
  assert.equal(requests.length, 3, 'stop must discard segments that never started');
});
